import { SEAT_GEOMETRY } from '@alkkagi/shared';
import { PerspectiveCamera, Raycaster, Vector2 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  PHI_MAX,
  PHI_MIN,
  R_MAX,
  aimPointFromRay,
  applyDrag,
  applyPreset,
  applyWheel,
  createCameraState,
  createRightDrag,
  dragDown,
  dragMove,
  dragUp,
  nearestAngle,
  orbitPosition,
  presetOrbit,
  stepCamera,
} from './camera-math.ts';
import { v3 } from './rig-math.ts';

describe('orbit 수학', () => {
  it('구면 좌표: theta=0은 +Z, phi=0은 바로 위', () => {
    const p = orbitPosition({ theta: 0, phi: Math.PI / 2, r: 10, tx: 0, ty: 0, tz: 0 }, 1, v3());
    expect(p.z).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(0);
    const top = orbitPosition({ theta: 0, phi: 0, r: 10, tx: 1, ty: 2, tz: 3 }, 1, v3());
    expect(top.y).toBeCloseTo(12);
    expect(top.x).toBeCloseTo(1);
  });

  it('default 시점은 내 캐릭터 머리 뒤 위에 있다(좌석 0은 +Z, 좌석 1은 −Z)', () => {
    for (const seat of [0, 1] as const) {
      const p = orbitPosition(presetOrbit('default', seat), 1, v3());
      const side = seat === 0 ? 1 : -1;
      expect(p.z * side).toBeGreaterThan(SEAT_GEOMETRY.anchorDistance);
      expect(p.y).toBeGreaterThan(SEAT_GEOMETRY.headHeight);
    }
    const opp = orbitPosition(presetOrbit('opponent', 0), 1, v3());
    expect(opp.z).toBeLessThan(-SEAT_GEOMETRY.anchorDistance);
  });

  it('nearestAngle은 한 바퀴 넘게 돌지 않는다', () => {
    expect(nearestAngle(0.1, Math.PI * 2)).toBeCloseTo(0);
    expect(nearestAngle(6.0, 0)).toBeCloseTo(Math.PI * 2);
    expect(nearestAngle(-3, 3)).toBeCloseTo(3 - Math.PI * 2);
  });

  it('프리셋으로 바꾸면 현재값이 목표로 부드럽게 수렴한다', () => {
    const cs = createCameraState('default', 0);
    applyPreset(cs, 'top', 0);
    stepCamera(cs, 1 / 60);
    expect(cs.phi).toBeLessThan(presetOrbit('default', 0).phi);
    expect(cs.phi).toBeGreaterThan(PHI_MIN);
    for (let i = 0; i < 300; i++) stepCamera(cs, 1 / 60);
    expect(cs.phi).toBeCloseTo(PHI_MIN, 3);
  });

  it('first는 1인칭 비율을 올리고, 드래그는 고개를 돌린다', () => {
    const cs = createCameraState('default', 1);
    applyPreset(cs, 'first', 1);
    for (let i = 0; i < 300; i++) stepCamera(cs, 1 / 60);
    expect(cs.fpBlend).toBe(1);
    const theta = cs.goal.theta;
    applyDrag(cs, 100, 0);
    expect(cs.goal.theta).toBe(theta);
    expect(cs.fpYaw).toBeLessThan(0);
    expect(applyWheel(cs, 100)).toBe(false);
  });

  it('default는 눈보다 높은 1인칭 계열이고, 드래그·휠을 하면 자유 회전으로 넘어간다', () => {
    const cs = createCameraState('default', 0);
    expect(cs.fpOn).toBe(true);
    expect(cs.fpLift).toBe(1);
    applyPreset(cs, 'first', 0);
    expect(cs.fpLiftGoal).toBe(0);
    applyPreset(cs, 'default', 0);
    applyDrag(cs, 30, 0);
    expect(cs.fpOn).toBe(false);
    const cs2 = createCameraState('default', 1);
    expect(applyWheel(cs2, 100)).toBe(true);
    expect(cs2.fpOn).toBe(false);
  });

  it('드래그는 극각을 제한하고 휠은 거리를 제한한다', () => {
    const cs = createCameraState('default', 0);
    applyDrag(cs, 0, -10000);
    expect(cs.goal.phi).toBe(PHI_MAX);
    for (let i = 0; i < 50; i++) applyWheel(cs, 200);
    expect(cs.goal.r).toBe(R_MAX);
  });
});

describe('오른쪽 버튼 클릭·드래그 구분', () => {
  it('조금만 움직이고 놓으면 클릭, 6px 넘게 끌면 회전', () => {
    const d = createRightDrag();
    dragDown(d, 100, 100);
    expect(dragMove(d, 103, 102)).toBeNull();
    expect(dragUp(d)).toBe('click');
    dragDown(d, 100, 100);
    expect(dragMove(d, 110, 100)).toEqual({ dx: 10, dy: 0 });
    expect(dragMove(d, 112, 101)).toEqual({ dx: 2, dy: 1 });
    expect(dragUp(d)).toBe('drag');
    expect(dragUp(d)).toBe('none');
  });
});

describe('조준점(aimPoint) 광선 교차', () => {
  it('상대 좌석 세로 평면과 만나는 점(서버 좌표, h는 판 윗면 기준)', () => {
    // 좌석 0 시점: 상대는 좌석 1(서버 y=+30, 월드 Z=−30)
    const p = aimPointFromRay(v3(5, 40, 60), v3(0, -0.2, -1), 1);
    expect(p).not.toBeNull();
    expect(p!.y).toBeCloseTo(SEAT_GEOMETRY.anchorDistance);
    expect(p!.x).toBeCloseTo(5);
    expect(p!.h).toBeCloseTo(40 - 0.2 * 90);
  });

  it('그 평면 앞에서 판에 먼저 닿으면 판 위 점(h=0)', () => {
    const p = aimPointFromRay(v3(0, 40, 60), v3(0, -1, -1), 1);
    expect(p).toEqual({ x: 0, y: -20, h: 0 });
  });

  it('좌석 1 시점은 상대 평면이 서버 y=−30', () => {
    const p = aimPointFromRay(v3(0, 30, -60), v3(0.1, -0.1, 1), 0);
    expect(p!.y).toBeCloseTo(-SEAT_GEOMETRY.anchorDistance);
    expect(p!.x).toBeCloseTo(9);
  });

  it('카메라가 상대 평면 너머에 있으면 판 위 점만 준다', () => {
    const p = aimPointFromRay(v3(0, 60, -80), v3(0, -1, 1), 1);
    expect(p).toEqual({ x: 0, y: 20, h: 0 });
  });

  it('위로 날아가 아무 데도 닿지 않으면 null', () => {
    expect(aimPointFromRay(v3(0, 40, 60), v3(0, 1, 1), 1)).toBeNull();
  });

  it('회전한 orbit 카메라의 화면 중앙 광선도 같은 규칙으로 교차한다', () => {
    const cs = createCameraState('default', 0);
    applyDrag(cs, -60, 40);
    for (let i = 0; i < 400; i++) stepCamera(cs, 1 / 60);
    const pos = orbitPosition(cs, 1, v3());
    const cam = new PerspectiveCamera(42, 16 / 9, 1, 900);
    cam.position.set(pos.x, pos.y, pos.z);
    cam.lookAt(cs.tx, cs.ty, cs.tz);
    cam.updateMatrixWorld();
    const rc = new Raycaster();
    rc.setFromCamera(new Vector2(0, 0), cam);
    const o = rc.ray.origin;
    const d = rc.ray.direction;
    const p = aimPointFromRay(o, d, 1);
    expect(p).not.toBeNull();
    // 화면 중앙은 orbit 목표점(판 위 조금 아래)을 지나므로 판 평면 교차점은 목표점 근처다
    expect(p!.h).toBe(0);
    const t = -o.y / d.y;
    expect(p!.x).toBeCloseTo(o.x + d.x * t);
    expect(p!.y).toBeCloseTo(-(o.z + d.z * t));
  });
});
