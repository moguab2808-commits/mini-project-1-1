import { SEAT_GEOMETRY } from '@alkkagi/shared';
import { PerspectiveCamera, Raycaster, Vector2 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  FP_YAW_MAX,
  aimPointFromRay,
  applyDrag,
  applyPreset,
  createCameraState,
  createRightDrag,
  dragDown,
  dragMove,
  dragUp,
  orbitPosition,
  presetOrbit,
  releaseLook,
  stepCamera,
  stunRoll,
} from './camera-math.ts';
import { v3 } from './rig-math.ts';

describe('시점 수학', () => {
  it('구면 좌표: theta=0은 +Z, phi=0은 바로 위', () => {
    const p = orbitPosition({ theta: 0, phi: Math.PI / 2, r: 10, tx: 0, ty: 0, tz: 0 }, 1, v3());
    expect(p.z).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(0);
    const top = orbitPosition({ theta: 0, phi: 0, r: 10, tx: 1, ty: 2, tz: 3 }, 1, v3());
    expect(top.y).toBeCloseTo(12);
    expect(top.x).toBeCloseTo(1);
  });

  it('default 시점의 기준 orbit은 내 쪽(좌석 0은 +Z, 좌석 1은 −Z)에 있다', () => {
    for (const seat of [0, 1] as const) {
      const p = orbitPosition(presetOrbit('default', seat), 1, v3());
      const side = seat === 0 ? 1 : -1;
      expect(p.z * side).toBeGreaterThan(SEAT_GEOMETRY.anchorDistance);
      expect(p.y).toBeGreaterThan(SEAT_GEOMETRY.headHeight);
    }
  });

  it('default와 first는 모두 눈 위치 기준이고 높이만 다르다', () => {
    const cs = createCameraState('default', 0);
    expect(cs.fpOn).toBe(true);
    expect(cs.fpBlend).toBe(1);
    expect(cs.fpLift).toBe(1);
    applyPreset(cs, 'first', 0);
    expect(cs.fpLiftGoal).toBe(0);
    for (let i = 0; i < 300; i++) stepCamera(cs, 1 / 60);
    expect(cs.fpLift).toBeCloseTo(0, 3);
    expect(cs.fpBlend).toBe(1);
  });

  it('오른쪽 드래그는 기본 시점에서도 고개를 돌리고(자유 회전 없음), 놓으면 정면으로 돌아온다', () => {
    const cs = createCameraState('default', 1);
    const theta = cs.goal.theta;
    applyDrag(cs, 100, 40);
    expect(cs.fpOn).toBe(true);
    expect(cs.goal.theta).toBe(theta);
    expect(cs.fpYaw).toBeLessThan(0);
    expect(cs.fpPitch).toBeLessThan(0);
    for (let i = 0; i < 60; i++) stepCamera(cs, 1 / 60);
    expect(cs.fpYaw).toBeLessThan(0); // 누르고 있는 동안 유지
    releaseLook(cs);
    for (let i = 0; i < 300; i++) stepCamera(cs, 1 / 60);
    expect(cs.fpYaw).toBe(0);
    expect(cs.fpPitch).toBe(0);
    applyDrag(cs, -100000, 0);
    expect(cs.fpYaw).toBe(FP_YAW_MAX);
  });

  it('기절 화면 회전은 0에서 시작해 한 바퀴(2π)로 끝난다', () => {
    expect(stunRoll(0)).toBe(0);
    expect(stunRoll(0.5)).toBeCloseTo(Math.PI);
    expect(stunRoll(1)).toBeCloseTo(Math.PI * 2);
    expect(stunRoll(2)).toBeCloseTo(Math.PI * 2);
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

  it('기울인 orbit 카메라의 화면 중앙 광선도 같은 규칙으로 교차한다', () => {
    const cs = createCameraState('default', 0);
    cs.theta += 0.5;
    cs.phi = 0.4;
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
