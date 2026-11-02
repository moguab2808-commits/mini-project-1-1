import { describe, expect, it } from 'vitest';
import {
  approachAngle,
  cameraRig,
  deskShakeOffset,
  pickStoneByRay,
  rayPlaneHit,
  rotateDeg,
  serverToWorld,
  worldToServer,
} from './scene-math.ts';

describe('좌표 변환', () => {
  it('서버 (x, y)는 월드 (x, -y)이고 되돌리면 같은 값이다', () => {
    const [X, Z] = serverToWorld(3, 5, 0);
    expect(X).toBeCloseTo(3);
    expect(Z).toBeCloseTo(-5);
    const [x, y] = worldToServer(X, Z, 0);
    expect(x).toBeCloseTo(3);
    expect(y).toBeCloseTo(5);
  });

  it('표시 회전이 있어도 서버 → 월드 → 서버가 항등이다', () => {
    for (const delta of [-45, -13.5, 0, 22, 45]) {
      const [X, Z] = serverToWorld(-7.5, 11, delta);
      const [x, y] = worldToServer(X, Z, delta);
      expect(x).toBeCloseTo(-7.5);
      expect(y).toBeCloseTo(11);
    }
  });

  it('서버 반시계 90도는 월드에서 +X → -Z 방향이다', () => {
    const [X, Z] = serverToWorld(1, 0, 90);
    expect(X).toBeCloseTo(0);
    expect(Z).toBeCloseTo(-1);
  });

  it('rotateDeg는 반시계 회전이다', () => {
    const [x, y] = rotateDeg(1, 0, 90);
    expect(x).toBeCloseTo(0);
    expect(y).toBeCloseTo(1);
  });
});

describe('판 평면 교차', () => {
  it('seat 0 카메라(+Z)의 광선이 판 위 서버 좌표로 돌아온다', () => {
    const rig = cameraRig(0, 16 / 9);
    // 서버 (5, -8) = 선공 쪽 알 위치 → 월드 (5, 0, 8)
    const dir = { x: 5 - rig.px, y: 0 - rig.py, z: 8 - rig.pz };
    const hit = rayPlaneHit({ x: rig.px, y: rig.py, z: rig.pz }, dir, 0);
    expect(hit).not.toBeNull();
    const [x, y] = worldToServer(hit!.x, hit!.z, 0);
    expect(x).toBeCloseTo(5);
    expect(y).toBeCloseTo(-8);
  });

  it('seat 1 카메라(-Z)에서도 같은 서버 좌표를 얻는다(180도 역변환)', () => {
    const rig = cameraRig(1, 16 / 9);
    expect(rig.pz).toBeLessThan(0);
    const dir = { x: 5 - rig.px, y: 0 - rig.py, z: 8 - rig.pz };
    const hit = rayPlaneHit({ x: rig.px, y: rig.py, z: rig.pz }, dir, 0);
    const [x, y] = worldToServer(hit!.x, hit!.z, 0);
    expect(x).toBeCloseTo(5);
    expect(y).toBeCloseTo(-8);
  });

  it('위를 보는 광선이나 평행 광선은 null이다', () => {
    expect(rayPlaneHit({ x: 0, y: 10, z: 0 }, { x: 0, y: 1, z: -1 }, 0)).toBeNull();
    expect(rayPlaneHit({ x: 0, y: 10, z: 0 }, { x: 1, y: 0, z: 0 }, 0)).toBeNull();
  });
});

describe('알 선택', () => {
  const origin = { x: 0, y: 40, z: 40 };
  const stones = [
    { id: 1, x: 0, y: 0.5, z: 0 },
    { id: 2, x: 1.5, y: 0.5, z: 0 },
    { id: 3, x: 20, y: 0.5, z: 0 },
  ];
  const toward = (x: number, y: number, z: number) => ({
    x: x - origin.x,
    y: y - origin.y,
    z: z - origin.z,
  });

  it('반지름+여유 안의 가장 가까운 알을 고른다', () => {
    expect(pickStoneByRay(origin, toward(0.2, 0.5, 0), stones, 3, 1.8)).toBe(1);
    expect(pickStoneByRay(origin, toward(1.4, 0.5, 0), stones, 3, 1.8)).toBe(2);
  });

  it('멀리 있으면 null이다', () => {
    expect(pickStoneByRay(origin, toward(10, 0, 0), stones, 3, 1.8)).toBeNull();
  });

  it('떠 있는 알은 화면에 보이는 위치 기준으로 집는다', () => {
    const lifted = [{ id: 9, x: 0, y: 4.9, z: 0 }];
    // 판 평면 위 같은 (x, z)를 가리키는 광선은 떠 있는 알의 중심을 지나지 않는다
    expect(pickStoneByRay(origin, toward(0, 0, 0), lifted, 1, 1.8)).toBeNull();
    expect(pickStoneByRay(origin, toward(0, 4.9, 0), lifted, 1, 1.8)).toBe(9);
  });

  it('count 밖의 후보는 무시한다', () => {
    expect(pickStoneByRay(origin, toward(0, 0.5, 0), stones, 0, 1.8)).toBeNull();
  });
});

describe('판 각도 보간', () => {
  it('목표에 정확히 도달하고 넘지 않는다', () => {
    let a = 0;
    for (let i = 0; i < 200; i++) a = approachAngle(a, 45, 1 / 60);
    expect(a).toBe(45);
  });

  it('약 1초 안에 45도에 도달한다', () => {
    let a = 0;
    for (let i = 0; i < 60; i++) a = approachAngle(a, 45, 1 / 60);
    expect(a).toBeGreaterThan(40);
    let b = 0;
    for (let i = 0; i < 90; i++) b = approachAngle(b, 45, 1 / 60);
    expect(b).toBe(45);
  });

  it('음수 방향도 같다', () => {
    expect(approachAngle(45, 0, 10)).toBe(0);
  });
});

describe('책상 흔들림', () => {
  it('구간 밖이면 0이고 구간 안에서는 최대 변위를 넘지 않는다', () => {
    expect(deskShakeOffset(-0.1, 0, 1)).toEqual([0, 0]);
    expect(deskShakeOffset(1, 0.5, 1)).toEqual([0, 0]);
    for (let i = 0; i < 50; i++) {
      const [x, z] = deskShakeOffset(i / 50, i / 100, 1.1);
      expect(Math.abs(x)).toBeLessThanOrEqual(1.1);
      expect(Math.abs(z)).toBeLessThanOrEqual(1.1);
    }
  });
});

describe('카메라', () => {
  it('seat 1은 seat 0의 Z를 뒤집은 시점이다', () => {
    const a = cameraRig(0, 16 / 9);
    const b = cameraRig(1, 16 / 9);
    expect(b.pz).toBe(-a.pz);
    expect(b.tz).toBe(-a.tz);
    expect(b.py).toBe(a.py);
  });

  it('좁은 화면에서는 더 물러난다', () => {
    expect(cameraRig(0, 0.8).py).toBeGreaterThan(cameraRig(0, 16 / 9).py);
  });
});
