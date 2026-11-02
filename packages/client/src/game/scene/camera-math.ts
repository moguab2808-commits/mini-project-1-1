// 카메라의 순수 계산: 구면 좌표 orbit, 시점 프리셋, 오른쪽 드래그·휠, 조준점(aimPoint) 광선 교차.
// three·React에 의존하지 않는다. 좌표는 월드(cm)이며 scene-math.ts의 대응(서버 (x, y) → 월드 (x, −y))을 따른다.
import { SEAT_GEOMETRY, type Seat } from '@alkkagi/shared';
import type { CameraPreset } from './scene-contract.ts';
import { clamp, damp, type V3 } from './rig-math.ts';

export const PHI_MIN = 0.02;
export const PHI_MAX = 1.45;
export const R_MIN = 40;
export const R_MAX = 200;
/** 1인칭 고개 돌리기 한도(라디안) */
export const FP_YAW_MAX = 1.1;
export const FP_PITCH_MAX = 0.6;
/** 오른쪽 버튼을 이만큼(px) 넘게 움직이면 클릭이 아니라 회전이다 */
export const DRAG_CLICK_PX = 6;

export interface OrbitTarget {
  theta: number;
  phi: number;
  r: number;
  tx: number;
  ty: number;
  tz: number;
}

export interface CameraState extends OrbitTarget {
  /** 목표값(프리셋·드래그·휠이 바꾸고 현재값이 따라간다) */
  goal: OrbitTarget;
  /** 1인칭 비율 0~1 */
  fpBlend: number;
  fpOn: boolean;
  /**
   * 눈높이 위로 올리는 비율 0~1. default 시점은 1(눈보다 조금 높고 조금 뒤),
   * first는 0(눈 위치). 1인칭 계열이라 내 몸은 숨기고 팔만 보인다(DEC-036)
   */
  fpLift: number;
  fpLiftGoal: number;
  /** 1인칭 고개 돌리기(드래그) */
  fpYaw: number;
  fpPitch: number;
}

/** 좌석의 "내 쪽" 방위각. θ=0은 카메라가 +Z(좌석 0 쪽)에 있다 */
export function seatTheta(seat: Seat): number {
  return seat === 0 ? 0 : Math.PI;
}

/**
 * 프리셋 → orbit 목표. first는 1인칭이므로 orbit 목표는 default와 같게 두고 fpOn으로 구분한다.
 * default는 first와 같은 1인칭 계열이며 fpLift=1로 눈보다 조금 높은 곳에서 내려다본다.
 * orbit 목표는 1인칭에서 다른 시점으로 옮길 때의 출발점으로만 쓴다.
 */
export function presetOrbit(preset: CameraPreset, seat: Seat): OrbitTarget {
  const t0 = seatTheta(seat);
  const s = seat === 0 ? 1 : -1;
  switch (preset) {
    case 'top':
      return { theta: t0, phi: PHI_MIN, r: 112, tx: 0, ty: 0, tz: 0 };
    case 'side':
      return { theta: t0 + Math.PI / 2, phi: 1.0, r: 108, tx: 0, ty: -2, tz: 0 };
    case 'opponent':
      return { theta: t0 + Math.PI, phi: 0.66, r: 102, tx: 0, ty: 1, tz: 9 * s };
    case 'first':
    case 'default':
      return { theta: t0, phi: 0.66, r: 102, tx: 0, ty: 1, tz: -9 * s };
  }
}

export function createCameraState(preset: CameraPreset, seat: Seat): CameraState {
  const g = presetOrbit(preset, seat);
  const fp = isEyePreset(preset);
  const lift = preset === 'default' ? 1 : 0;
  return {
    ...g,
    goal: { ...g },
    fpBlend: fp ? 1 : 0,
    fpOn: fp,
    fpLift: lift,
    fpLiftGoal: lift,
    fpYaw: 0,
    fpPitch: 0,
  };
}

/**
 * default(눈보다 조금 높은 시점)에서 드래그·휠을 하면 자유 orbit으로 넘어간다.
 * orbit 목표는 default의 머리 뒤 위 위치라 화면이 이어지듯 옮겨 간다. first는 고개 돌리기를 유지한다.
 */
function leaveDefaultEye(cs: CameraState): void {
  if (cs.fpOn && cs.fpLiftGoal > 0.5) cs.fpOn = false;
}

/** 캐릭터 눈 위치 기준 시점인가(default·first) */
export function isEyePreset(preset: CameraPreset): boolean {
  return preset === 'default' || preset === 'first';
}

/** cur에서 target과 같은 각 중 가장 가까운 값(한 바퀴 넘게 돌지 않게) */
export function nearestAngle(cur: number, target: number): number {
  const t = Math.PI * 2;
  const d = ((((target - cur) % t) + t * 1.5) % t) - Math.PI;
  return cur + d;
}

/** 프리셋 적용: 목표를 바꾸고 고개 돌리기를 초기화한다 */
export function applyPreset(cs: CameraState, preset: CameraPreset, seat: Seat): void {
  const g = presetOrbit(preset, seat);
  g.theta = nearestAngle(cs.theta, g.theta);
  cs.goal = g;
  cs.fpOn = isEyePreset(preset);
  if (cs.fpOn) cs.fpLiftGoal = preset === 'default' ? 1 : 0;
  cs.fpYaw = 0;
  cs.fpPitch = 0;
}

/** 오른쪽 드래그(px). 1인칭이면 고개를 돌리고, 아니면 orbit을 돈다 */
export function applyDrag(cs: CameraState, dx: number, dy: number): void {
  leaveDefaultEye(cs);
  if (cs.fpOn) {
    cs.fpYaw = clamp(cs.fpYaw - dx * 0.004, -FP_YAW_MAX, FP_YAW_MAX);
    cs.fpPitch = clamp(cs.fpPitch - dy * 0.003, -FP_PITCH_MAX, FP_PITCH_MAX);
    return;
  }
  cs.goal.theta -= dx * 0.008;
  cs.goal.phi = clamp(cs.goal.phi - dy * 0.006, PHI_MIN, PHI_MAX);
}

/** 휠. 1인칭에서는 무시한다(배치 모드 무시는 호출 쪽이 판단). 바뀌었으면 true */
export function applyWheel(cs: CameraState, deltaY: number): boolean {
  leaveDefaultEye(cs);
  if (cs.fpOn) return false;
  cs.goal.r = clamp(cs.goal.r * (1 + clamp(deltaY, -200, 200) * 0.001), R_MIN, R_MAX);
  return true;
}

/** 현재값이 목표값을 따라간다 */
export function stepCamera(cs: CameraState, dt: number, rate = 6): void {
  cs.theta = damp(cs.theta, cs.goal.theta, rate, dt);
  cs.phi = damp(cs.phi, cs.goal.phi, rate, dt);
  cs.r = damp(cs.r, cs.goal.r, rate, dt);
  cs.tx = damp(cs.tx, cs.goal.tx, rate, dt);
  cs.ty = damp(cs.ty, cs.goal.ty, rate, dt);
  cs.tz = damp(cs.tz, cs.goal.tz, rate, dt);
  cs.fpBlend = damp(cs.fpBlend, cs.fpOn ? 1 : 0, 4, dt);
  if (Math.abs(cs.fpBlend - (cs.fpOn ? 1 : 0)) < 1e-3) cs.fpBlend = cs.fpOn ? 1 : 0;
  cs.fpLift = damp(cs.fpLift, cs.fpLiftGoal, 4, dt);
}

/** default 시점이 눈 위치에서 올라가는 높이·뒤로 물러나는 거리(cm), 줄이는 화각(°) */
export const EYE_LIFT = { up: 16, back: 24, fovLess: 4 } as const;

/** 좁은 화면에서는 판이 잘리지 않게 뒤로 물러난다 */
export function aspectDistanceScale(aspect: number): number {
  return aspect < 1.3 ? 1 + (1.3 - Math.max(0.3, aspect)) * 0.8 : 1;
}

/** 구면 좌표 → 카메라 위치(월드). phi는 +Y에서 잰 극각, theta=0은 +Z */
export function orbitPosition(o: OrbitTarget, rScale: number, out: V3): V3 {
  const r = o.r * rScale;
  const sp = Math.sin(o.phi);
  out.x = o.tx + r * sp * Math.sin(o.theta);
  out.y = o.ty + r * Math.cos(o.phi);
  out.z = o.tz + r * sp * Math.cos(o.theta);
  return out;
}

/** 오른쪽 버튼 클릭·드래그 구분 */
export interface RightDrag {
  active: boolean;
  dragging: boolean;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
}

export function createRightDrag(): RightDrag {
  return { active: false, dragging: false, startX: 0, startY: 0, lastX: 0, lastY: 0 };
}

export function dragDown(d: RightDrag, x: number, y: number): void {
  d.active = true;
  d.dragging = false;
  d.startX = d.lastX = x;
  d.startY = d.lastY = y;
}

/** 움직임을 반영하고 회전에 쓸 변위를 돌려준다(아직 클릭 범위면 null) */
export function dragMove(d: RightDrag, x: number, y: number): { dx: number; dy: number } | null {
  if (!d.active) return null;
  if (!d.dragging && Math.hypot(x - d.startX, y - d.startY) > DRAG_CLICK_PX) {
    d.dragging = true;
  }
  if (!d.dragging) return null;
  const r = { dx: x - d.lastX, dy: y - d.lastY };
  d.lastX = x;
  d.lastY = y;
  return r;
}

/** 놓기: 회전 없이 놓았으면 'click' */
export function dragUp(d: RightDrag): 'click' | 'drag' | 'none' {
  if (!d.active) return 'none';
  const r = d.dragging ? 'drag' : 'click';
  d.active = false;
  d.dragging = false;
  return r;
}

/**
 * 후레쉬·물총 조준점. 광선이 상대 좌석의 세로 평면(서버 y = ±anchorDistance, 월드 Z = ∓)과 만나는 점,
 * 그 전에 판 평면(월드 Y = 0)에 닿으면 판 위 점(h=0). 둘 다 없으면 null. 결과는 서버 좌표(x, y, h).
 * 카메라가 상대 평면 너머에 있으면(상대 쪽 시점) 평면 교차는 쓰지 않고 판 위 점만 준다.
 * 좌석은 판 돌리기와 무관하게 고정이므로 표시 회전(deltaDeg)은 반영하지 않는다.
 */
export function aimPointFromRay(
  origin: V3,
  dir: V3,
  oppSeat: Seat,
): { x: number; y: number; h: number } | null {
  const planeZ = oppSeat === 0 ? SEAT_GEOMETRY.anchorDistance : -SEAT_GEOMETRY.anchorDistance;
  let tSeat = Infinity;
  // 카메라가 상대 평면 너머(상대 뒤)에 있으면 그 평면은 쓰지 않는다: 내 쪽에서 상대 쪽으로 가는 광선만 맞는다
  const mySide = oppSeat === 0 ? origin.z < planeZ : origin.z > planeZ;
  if (mySide && Math.abs(dir.z) > 1e-9) {
    const t = (planeZ - origin.z) / dir.z;
    if (t > 0) tSeat = t;
  }
  let tBoard = Infinity;
  if (Math.abs(dir.y) > 1e-9) {
    const t = -origin.y / dir.y;
    if (t > 0) tBoard = t;
  }
  const t = Math.min(tSeat, tBoard);
  if (!Number.isFinite(t)) return null;
  const x = origin.x + dir.x * t;
  const z = origin.z + dir.z * t;
  const h = t === tBoard ? 0 : origin.y + dir.y * t;
  return { x, y: -z, h };
}
