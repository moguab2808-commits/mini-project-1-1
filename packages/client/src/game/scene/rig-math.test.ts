import { SEAT_GEOMETRY } from '@alkkagi/shared';
import { Euler, Object3D, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import {
  ARM_LEN,
  FLICK_ONSET_SPEED,
  RIG,
  aimHandTarget,
  createArmSolution,
  createFlickDetector,
  createReactionTracker,
  createSmoothPose,
  distV,
  gestureAt,
  headCenter,
  lookAngles,
  reachPose,
  reactionSteps,
  rotateYXZ,
  seatToWorld,
  serverDirToSeat,
  serverToSeat,
  shoulderPos,
  solveArm,
  stepFlick,
  stepSmoothPose,
  strainOf,
  takeNewReactions,
  v3,
  worldToSeat,
  wrapPi,
  type BodyState,
} from './rig-math.ts';

const rest: BodyState = { lean: 0, yaw: 0, roll: 0, rise: 0, bob: 0 };

describe('좌석 좌표', () => {
  it('좌석 루트 변환이 three의 루트 배치(좌석 0은 +Z에서 π 회전)와 같다', () => {
    for (const seat of [0, 1] as const) {
      const root = new Object3D();
      root.position.set(
        0,
        0,
        seat === 0 ? SEAT_GEOMETRY.anchorDistance : -SEAT_GEOMETRY.anchorDistance,
      );
      root.rotation.y = seat === 0 ? Math.PI : 0;
      root.updateMatrixWorld(true);
      const l = new Vector3(3, 5, 11);
      const w = root.localToWorld(l.clone());
      const mine = seatToWorld(seat, v3(3, 5, 11), v3());
      expect(mine.x).toBeCloseTo(w.x);
      expect(mine.y).toBeCloseTo(w.y);
      expect(mine.z).toBeCloseTo(w.z);
      const back = worldToSeat(seat, mine, v3());
      expect(back.x).toBeCloseTo(3);
      expect(back.z).toBeCloseTo(11);
    }
  });

  it('판 중심은 두 좌석 모두 앞쪽 anchorDistance에 있다', () => {
    for (const seat of [0, 1] as const) {
      const c = serverToSeat(seat, 0, 0, 0, v3());
      expect(c.x).toBeCloseTo(0);
      expect(c.z).toBeCloseTo(SEAT_GEOMETRY.anchorDistance);
    }
    // 좌석 0의 기준점(서버 y=−30)은 좌석 로컬 원점
    const a = serverToSeat(0, 0, -SEAT_GEOMETRY.anchorDistance, 0, v3());
    expect(a.z).toBeCloseTo(0);
  });

  it('서버 방향각을 좌석 로컬 방향으로 바꾼다: 상대 쪽(+y/−y)은 앞(+z)', () => {
    const d0 = serverDirToSeat(0, Math.PI / 2, v3());
    expect(d0.z).toBeCloseTo(1);
    const d1 = serverDirToSeat(1, -Math.PI / 2, v3());
    expect(d1.z).toBeCloseTo(1);
  });
});

describe('몸 구조', () => {
  it('rotateYXZ는 three Euler YXZ와 같다', () => {
    const v = new Vector3(-7.5, 44, 5);
    const e = new Euler(0.3, -0.2, 0.1, 'YXZ');
    const ref = v.clone().applyEuler(e);
    const r = rotateYXZ(v3(-7.5, 44, 5), 0.3, -0.2, 0.1, v3());
    expect(r.x).toBeCloseTo(ref.x);
    expect(r.y).toBeCloseTo(ref.y);
    expect(r.z).toBeCloseTo(ref.z);
  });

  it('쉬는 자세의 머리 중심은 SEAT_GEOMETRY의 얼굴 높이·기준점과 일치한다', () => {
    const h = headCenter(rest, v3());
    expect(h.y).toBeCloseTo(SEAT_GEOMETRY.headHeight);
    expect(h.z).toBeCloseTo(0);
    const r = shoulderPos(rest, -1, v3());
    const l = shoulderPos(rest, 1, v3());
    expect(r.x).toBeLessThan(0); // 오른쪽은 −X
    expect(l.x).toBeGreaterThan(0);
    expect(r.z).toBeCloseTo(0);
  });

  it('숙이면 어깨가 앞(판 쪽)으로 나온다', () => {
    const a = shoulderPos(rest, -1, v3());
    const b = shoulderPos({ ...rest, lean: 0.4, rise: 0.5 }, -1, v3());
    expect(b.z).toBeGreaterThan(a.z + 10);
  });
});

describe('숙이기 탐색(reachPose)', () => {
  const fwd = v3(0, 0, 1);
  it('가까운 알은 숙이지 않고, 먼 알일수록 더 숙인다', () => {
    const near = reachPose(v3(-4, 2, 12), fwd, { p: 0, lean: 0, rise: 0, yaw: 0, ok: false });
    const mid = reachPose(v3(-4, 2, 34), fwd, { p: 0, lean: 0, rise: 0, yaw: 0, ok: false });
    expect(near.ok).toBe(true);
    expect(near.p).toBe(0);
    expect(mid.ok).toBe(true);
    expect(mid.p).toBeGreaterThan(0);
    expect(mid.lean).toBeGreaterThan(0);
  });

  it('최대 사거리(maxReach) 안의 알은 숙이면 닿는다', () => {
    const r = reachPose(v3(0, 2.2, SEAT_GEOMETRY.maxReach), fwd, {
      p: 0,
      lean: 0,
      rise: 0,
      yaw: 0,
      ok: false,
    });
    expect(r.ok).toBe(true);
  });

  it('아주 먼 곳은 닿지 않고 최대 자세를 준다', () => {
    const r = reachPose(v3(0, 2, 80), fwd, { p: 0, lean: 0, rise: 0, yaw: 0, ok: true });
    expect(r.ok).toBe(false);
    expect(r.lean).toBe(RIG.leanMax);
    expect(r.rise).toBe(1);
  });
});

describe('팔 IK(solveArm)', () => {
  it('닿는 목표면 손목이 목표에 있고 두 마디 길이가 지켜진다', () => {
    const S = v3(0, 10, 0);
    const W = v3(-5, 0, 18);
    const out = solveArm(S, W, 14, 14, v3(-0.8, -1, -0.5), createArmSolution());
    expect(out.clamped).toBe(false);
    expect(distV(out.wrist, W)).toBeCloseTo(0);
    expect(distV(S, out.elbow)).toBeCloseTo(14);
    expect(distV(out.elbow, out.wrist)).toBeCloseTo(14);
  });

  it('안 닿으면 팔이 쭉 뻗은 채 목표 방향에서 멈춘다(늘어나지 않음)', () => {
    const S = v3(0, 10, 0);
    const W = v3(0, 10, 60);
    const out = solveArm(S, W, 14, 14, v3(0, -1, 0), createArmSolution());
    expect(out.clamped).toBe(true);
    expect(distV(S, out.wrist)).toBeLessThanOrEqual(ARM_LEN);
    expect(out.wrist.z).toBeGreaterThan(27);
    expect(out.wrist.x).toBeCloseTo(0);
  });

  it('팔꿈치는 pole 쪽으로 굽는다', () => {
    const out = solveArm(v3(0, 0, 0), v3(0, 0, 20), 14, 14, v3(-1, -1, 0), createArmSolution());
    expect(out.elbow.x).toBeLessThan(0);
    expect(out.elbow.y).toBeLessThan(0);
  });
});

describe('조준 손 위치', () => {
  it('알 뒤(방향 반대쪽)에 두고 세기만큼 더 당긴다', () => {
    const stone = v3(0, 0.5, 20);
    const dir = v3(0, 0, 1);
    const a = aimHandTarget(stone, dir, 0, true, v3());
    const b = aimHandTarget(stone, dir, 1, true, v3());
    expect(a.z).toBeLessThan(20);
    expect(b.z).toBeLessThan(a.z);
  });

  it('닿지 않는 알이면 손을 기준점 쪽으로 당겨 둔다', () => {
    const far = v3(0, 0.5, 60);
    const h = aimHandTarget(far, v3(0, 0, 1), 0, false, v3());
    expect(Math.hypot(h.x, h.z)).toBeLessThanOrEqual(SEAT_GEOMETRY.maxReach);
  });

  it('조준 어려움은 편한 거리 안에서 0, 최대 거리에서 1', () => {
    expect(strainOf(v3(0, 0, SEAT_GEOMETRY.comfortReach - 1))).toBe(0);
    expect(strainOf(v3(0, 0, SEAT_GEOMETRY.maxReach + 5))).toBe(1);
  });

  it('머리 바라보기 각: 아래 앞을 보면 pitch 양수', () => {
    const a = lookAngles(v3(0, 24, 0), v3(0, 0, 24), { yaw: 0, pitch: 0 });
    expect(a.pitch).toBeCloseTo(Math.PI / 4);
    expect(a.yaw).toBeCloseTo(0);
  });
});

describe('포즈 보간', () => {
  it('처음 값은 바로 맞추고 이후 각은 짧은 쪽으로 부드럽게 따라간다', () => {
    const sp = createSmoothPose();
    stepSmoothPose(sp, { mode: 'aim', stoneId: 2, angle: 3.0, power: 0 }, 1 / 60);
    expect(sp.angle).toBeCloseTo(3.0);
    // −3.0은 3.0에서 짧은 쪽(±π 경계를 넘어)으로 약 0.28rad 떨어져 있다
    stepSmoothPose(sp, { mode: 'aim', stoneId: 2, angle: -3.0, power: 0 }, 1 / 60);
    const d = Math.abs(wrapPi(sp.angle - 3.0));
    expect(d).toBeGreaterThan(0);
    expect(d).toBeLessThan(0.3);
    for (let i = 0; i < 120; i++) {
      stepSmoothPose(sp, { mode: 'aim', stoneId: 2, angle: -3.0, power: 0 }, 1 / 60);
    }
    expect(Math.abs(wrapPi(sp.angle + 3.0))).toBeLessThan(1e-3);
  });

  it('알이 바뀌면 각을 바로 맞추고, 모드는 즉시 바뀐다', () => {
    const sp = createSmoothPose();
    stepSmoothPose(sp, { mode: 'aim', stoneId: 1, angle: 0 }, 1 / 60);
    stepSmoothPose(sp, { mode: 'charge', stoneId: 4, angle: 1.2, power: 50 }, 1 / 60);
    expect(sp.mode).toBe('charge');
    expect(sp.angle).toBeCloseTo(1.2);
    expect(sp.power).toBeGreaterThan(0);
    expect(sp.power).toBeLessThan(50);
    stepSmoothPose(sp, null, 1 / 60);
    expect(sp.mode).toBe('idle');
  });

  it('조준점(target)을 보간한다', () => {
    const sp = createSmoothPose();
    stepSmoothPose(
      sp,
      { mode: 'hold_hazard', kind: 'flashlight', target: { x: 0, y: 30, h: 20 } },
      0.05,
    );
    expect(sp.target.z).toBe(20);
    stepSmoothPose(
      sp,
      { mode: 'hold_hazard', kind: 'flashlight', target: { x: 10, y: 30, h: 20 } },
      0.05,
    );
    expect(sp.target.x).toBeGreaterThan(0);
    expect(sp.target.x).toBeLessThan(10);
  });
});

describe('발사 감지', () => {
  const base = {
    mode: 'idle' as const,
    stoneId: null,
    aimedSpeed: 0,
    onsetStoneId: null,
    active: true,
  };

  it('충전 뒤 idle로 바뀌고 조준하던 알이 움직이면 그 알로 튕긴다', () => {
    const fd = createFlickDetector();
    expect(stepFlick(fd, { ...base, nowSec: 1, mode: 'charge', stoneId: 3 })).toBeNull();
    expect(stepFlick(fd, { ...base, nowSec: 1.1 })).toBeNull();
    expect(stepFlick(fd, { ...base, nowSec: 1.2, aimedSpeed: FLICK_ONSET_SPEED + 10 })).toBe(3);
    // 같은 발사로 두 번 튕기지 않는다
    expect(stepFlick(fd, { ...base, nowSec: 1.25, aimedSpeed: 80 })).toBeNull();
  });

  it('포즈가 아직 charge인데 알이 먼저 움직여도(중계 지연) 튕긴다', () => {
    const fd = createFlickDetector();
    stepFlick(fd, { ...base, nowSec: 1, mode: 'charge', stoneId: 5 });
    expect(
      stepFlick(fd, { ...base, nowSec: 1.03, mode: 'charge', stoneId: 5, aimedSpeed: 90 }),
    ).toBe(5);
  });

  it('조준이 끝난 지 오래면 조준 알 움직임으로 튕기지 않는다', () => {
    const fd = createFlickDetector();
    stepFlick(fd, { ...base, nowSec: 1, mode: 'aim', stoneId: 3 });
    expect(stepFlick(fd, { ...base, nowSec: 3, aimedSpeed: 90, active: false })).toBeNull();
  });

  it('조준 중계 없이 내 차례에 내 알이 갑자기 움직이면 튕긴다. 상대 차례면 무시', () => {
    const fd = createFlickDetector();
    expect(stepFlick(fd, { ...base, nowSec: 5, onsetStoneId: 2, active: false })).toBeNull();
    expect(stepFlick(fd, { ...base, nowSec: 5, onsetStoneId: 2, active: true })).toBe(2);
  });
});

describe('반응', () => {
  it('처음 보는 id만, 좌석별 최신 하나씩 돌려준다', () => {
    const tr = createReactionTracker();
    const a = takeNewReactions(tr, [
      { seat: 0, kind: 'great', id: 1 },
      { seat: 1, kind: 'shocked', id: 2 },
      { seat: 0, kind: 'win', id: 3 },
    ]);
    expect(a[0]?.id).toBe(3);
    expect(a[1]?.id).toBe(2);
    const b = takeNewReactions(tr, [
      { seat: 0, kind: 'win', id: 3 },
      { seat: 1, kind: 'lose', id: 4 },
    ]);
    expect(b[0]).toBeNull();
    expect(b[1]?.kind).toBe('lose');
  });

  it('종류별 몸짓: own은 shock → sad, 약 2초 뒤 neutral', () => {
    const s = reactionSteps('own');
    expect(gestureAt(s, 0.1)).toBe('shock');
    expect(gestureAt(s, 1.0)).toBe('sad');
    expect(gestureAt(s, 2.5)).toBe('neutral');
    expect(gestureAt(reactionSteps('great'), 0.5)).toBe('cheer');
    expect(gestureAt(reactionSteps('miss'), 0.5)).toBe('sad');
    expect(gestureAt(reactionSteps('trade'), 0.5)).toBe('relief');
    expect(gestureAt(reactionSteps('taunt'), 0.5)).toBe('taunt');
    expect(gestureAt(reactionSteps('taunt'), 1.5)).toBe('laugh');
    expect(gestureAt(reactionSteps('hit'), 0.5)).toBe('shock');
    expect(gestureAt(reactionSteps('win'), 3)).toBe('cheer');
    expect(gestureAt(reactionSteps('lose'), 3)).toBe('sad');
    expect(gestureAt(reactionSteps('draw'), 1)).toBe('shock');
    expect(gestureAt(reactionSteps('great'), 2.5)).toBe('neutral');
  });
});
