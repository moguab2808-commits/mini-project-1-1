// 캐릭터 몸짓의 순수 계산: 좌석 좌표 변환, 몸 숙이기 탐색, 팔 2관절 IK, 머리 바라보기, 포즈 보간,
// 발사(튕기기) 감지, 반응 재생 목록. three·React에 의존하지 않아 단위 테스트할 수 있다.
//
// 좌석 로컬 좌표(cm): 원점은 좌석 기준점(SEAT_GEOMETRY.anchorDistance) 바로 아래 판 윗면 높이,
// +Z는 판 중심 쪽, +Y는 위, 캐릭터의 오른쪽은 −X다. 좌석 0은 월드 +Z(서버 −y) 쪽, 좌석 1은 −Z 쪽에 앉는다.
// 월드 대응은 scene-math.ts와 같다: 서버 (x, y, h) → 월드 (X = x, Y = h, Z = −y).
import { SEAT_GEOMETRY, type Seat } from '@alkkagi/shared';
import type { CharacterPose, ReactionKind, Reaction } from './scene-contract.ts';

export interface V3 {
  x: number;
  y: number;
  z: number;
}

export const v3 = (x = 0, y = 0, z = 0): V3 => ({ x, y, z });

export function setV(o: V3, x: number, y: number, z: number): V3 {
  o.x = x;
  o.y = y;
  o.z = z;
  return o;
}

export function copyV(o: V3, a: V3): V3 {
  return setV(o, a.x, a.y, a.z);
}

export function distV(a: V3, b: V3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** 각도를 (−π, π]로 접는다 */
export function wrapPi(a: number): number {
  const t = Math.PI * 2;
  let r = (a + Math.PI) % t;
  if (r < 0) r += t;
  return r - Math.PI;
}

/** 프레임 속도와 무관한 지수 감쇠. rate는 1/s */
export function damp(cur: number, target: number, rate: number, dt: number): number {
  return cur + (target - cur) * (1 - Math.exp(-rate * dt));
}

/** 각도용 지수 감쇠: 짧은 쪽으로 돈다 */
export function dampAngle(cur: number, target: number, rate: number, dt: number): number {
  return cur + wrapPi(target - cur) * (1 - Math.exp(-rate * dt));
}

export function dampV(cur: V3, target: V3, rate: number, dt: number): V3 {
  const k = 1 - Math.exp(-rate * dt);
  cur.x += (target.x - cur.x) * k;
  cur.y += (target.y - cur.y) * k;
  cur.z += (target.z - cur.z) * k;
  return cur;
}

// ───────── 좌석 좌표 ─────────

const A = SEAT_GEOMETRY.anchorDistance;

/** 좌석 기준점의 월드 Z. 좌석 0은 +Z */
export function seatWorldZ(seat: Seat): number {
  return seat === 0 ? A : -A;
}

/** 월드 → 좌석 로컬. 좌석 0 루트는 (0,0,+A)에서 Y축 π 회전, 좌석 1 루트는 (0,0,−A)에서 회전 없음 */
export function worldToSeat(seat: Seat, w: V3, out: V3): V3 {
  return seat === 0 ? setV(out, -w.x, w.y, A - w.z) : setV(out, w.x, w.y, w.z + A);
}

export function seatToWorld(seat: Seat, l: V3, out: V3): V3 {
  return seat === 0 ? setV(out, -l.x, l.y, A - l.z) : setV(out, l.x, l.y, l.z - A);
}

/** 서버 좌표(x, y, h) → 좌석 로컬 */
export function serverToSeat(seat: Seat, x: number, y: number, h: number, out: V3): V3 {
  return seat === 0 ? setV(out, -x, h, A + y) : setV(out, x, h, A - y);
}

/** 서버 기준 방향각(라디안) → 좌석 로컬 수평 방향 (x, z) */
export function serverDirToSeat(seat: Seat, angle: number, out: V3): V3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return seat === 0 ? setV(out, -c, 0, s) : setV(out, c, 0, -s);
}

// ───────── 몸 구조(좌석 로컬 cm) ─────────

export const RIG = {
  /** 쉬는 자세의 엉덩이(몸통 회전 중심) */
  hip: v3(0, -34, -5),
  /** 일어설 때 엉덩이가 움직이는 양(rise=1) */
  riseOffset: v3(0, 6, 5),
  /** 몸통 좌표계에서 엉덩이 → 오른쪽 어깨. 왼쪽은 x 부호 반대. 쉬는 자세 어깨 = (∓7.5, 10, 0) */
  shoulder: v3(-7.5, 44, 5),
  /** 몸통 좌표계에서 엉덩이 → 목. 머리 중심은 목에서 headUp 위 = (0, 24, 0) = SEAT_GEOMETRY.headHeight */
  neck: v3(0, 48, 5),
  headUp: 10,
  headRadius: 8.5,
  upperArm: 14,
  foreArm: 14,
  /** 손바닥 중심에서 손목까지 */
  wristBack: 2.5,
  leanMax: 0.5,
  yawMax: 0.4,
} as const;

export const ARM_LEN = RIG.upperArm + RIG.foreArm;

/**
 * Euler 'YXZ' 회전(three의 rotation.order = 'YXZ'와 같음). 몸통 좌표계 벡터를 좌석 로컬로 돌린다.
 * pitch(+)는 앞으로 숙임(+Y가 +Z 쪽으로), yaw(+)는 +X 쪽으로 돌기.
 */
export function rotateYXZ(v: V3, pitch: number, yaw: number, roll: number, out: V3): V3 {
  // Rz
  const cz = Math.cos(roll);
  const sz = Math.sin(roll);
  const x1 = v.x * cz - v.y * sz;
  const y1 = v.x * sz + v.y * cz;
  const z1 = v.z;
  // Rx
  const cx = Math.cos(pitch);
  const sx = Math.sin(pitch);
  const y2 = y1 * cx - z1 * sx;
  const z2 = y1 * sx + z1 * cx;
  // Ry
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  return setV(out, x1 * cy + z2 * sy, y2, -x1 * sy + z2 * cy);
}

export interface BodyState {
  lean: number;
  yaw: number;
  roll: number;
  rise: number;
  /** 엉덩이 추가 높이(통통 튀기 등) */
  bob: number;
}

export function hipPos(body: BodyState, out: V3): V3 {
  return setV(
    out,
    RIG.hip.x,
    RIG.hip.y + RIG.riseOffset.y * body.rise + body.bob,
    RIG.hip.z + RIG.riseOffset.z * body.rise,
  );
}

const _t = v3();
/** 어깨 위치(좌석 로컬). side −1은 오른쪽, +1은 왼쪽 */
export function shoulderPos(body: BodyState, side: -1 | 1, out: V3): V3 {
  setV(_t, RIG.shoulder.x * -side, RIG.shoulder.y, RIG.shoulder.z);
  rotateYXZ(_t, body.lean, body.yaw, body.roll, out);
  const hx = out.x;
  const hy = out.y;
  const hz = out.z;
  hipPos(body, out);
  out.x += hx;
  out.y += hy;
  out.z += hz;
  return out;
}

export function headCenter(body: BodyState, out: V3): V3 {
  setV(_t, RIG.neck.x, RIG.neck.y + RIG.headUp, RIG.neck.z);
  rotateYXZ(_t, body.lean, body.yaw, body.roll, out);
  const hx = out.x;
  const hy = out.y;
  const hz = out.z;
  hipPos(body, out);
  out.x += hx;
  out.y += hy;
  out.z += hz;
  return out;
}

export interface ReachResult {
  /** 0~1 숙임 정도. 0이면 편하게 닿는다 */
  p: number;
  lean: number;
  rise: number;
  yaw: number;
  /** 다 숙여도 닿지 않으면 false (이때 lean·rise는 최대) */
  ok: boolean;
}

const _body: BodyState = { lean: 0, yaw: 0, roll: 0, rise: 0, bob: 0 };
const _s = v3();
const _w = v3();

/** 숙임 정도 p(0~1) → lean·rise. 반쯤 숙인 뒤부터 엉덩이를 들고 일어선다 */
export function leanRiseOf(p: number): { lean: number; rise: number } {
  return { lean: p * RIG.leanMax, rise: clamp((p - 0.45) / 0.55, 0, 1) };
}

/**
 * 오른손을 hand(좌석 로컬, 손바닥 중심)에 두려면 얼마나 숙이고 일어서야 하는지 찾는다(시안 reachPose).
 * fwd는 손이 향하는 방향(손목은 손바닥 뒤 wristBack). 다 숙여도 안 닿으면 ok=false, 최대 자세를 돌려준다.
 */
export function reachPose(hand: V3, fwd: V3, out: ReachResult): ReachResult {
  setV(
    _w,
    hand.x - fwd.x * RIG.wristBack,
    hand.y - fwd.y * RIG.wristBack,
    hand.z - fwd.z * RIG.wristBack,
  );
  const yaw = clamp(Math.atan2(_w.x, Math.max(1, _w.z)) * 0.35, -RIG.yawMax, RIG.yawMax);
  for (let i = 0; i <= 20; i++) {
    const p = i / 20;
    _body.lean = p * RIG.leanMax;
    _body.rise = clamp((p - 0.45) / 0.55, 0, 1);
    _body.yaw = yaw;
    _body.roll = 0;
    _body.bob = 0;
    shoulderPos(_body, -1, _s);
    if (distV(_s, _w) <= ARM_LEN * 0.97) {
      out.p = p;
      out.lean = _body.lean;
      out.rise = _body.rise;
      out.yaw = yaw;
      out.ok = true;
      return out;
    }
  }
  out.p = 1;
  out.lean = RIG.leanMax;
  out.rise = 1;
  out.yaw = yaw;
  out.ok = false;
  return out;
}

export interface ArmSolution {
  elbow: V3;
  /** 실제 손목(팔이 다 뻗어도 안 닿으면 목표에서 어깨 쪽으로 당겨진다) */
  wrist: V3;
  /** 목표에 못 미쳐 쭉 뻗은 채 멈췄는가 */
  clamped: boolean;
}

export function createArmSolution(): ArmSolution {
  return { elbow: v3(), wrist: v3(), clamped: false };
}

/**
 * 2관절 IK(시안 updateArm). 어깨 S에서 손목 목표 W까지 위팔 l1·아래팔 l2로 잇는다.
 * pole은 팔꿈치가 굽는 쪽 힌트(정규화 불필요). 팔은 늘어나지 않으므로 안 닿으면 쭉 뻗은 데서 멈춘다.
 */
export function solveArm(
  S: V3,
  W: V3,
  l1: number,
  l2: number,
  pole: V3,
  out: ArmSolution,
): ArmSolution {
  let dx = W.x - S.x;
  let dy = W.y - S.y;
  let dz = W.z - S.z;
  let d = Math.hypot(dx, dy, dz);
  if (d < 1e-6) {
    dx = 0;
    dy = -1;
    dz = 0;
    d = 1e-6;
  } else {
    dx /= d;
    dy /= d;
    dz /= d;
  }
  const maxD = (l1 + l2) * 0.999;
  const minD = Math.abs(l1 - l2) + 1e-3;
  out.clamped = d > maxD;
  d = clamp(d, minD, maxD);
  setV(out.wrist, S.x + dx * d, S.y + dy * d, S.z + dz * d);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  // pole을 팔 방향에 수직으로
  const pd = pole.x * dx + pole.y * dy + pole.z * dz;
  let px = pole.x - dx * pd;
  let py = pole.y - dy * pd;
  let pz = pole.z - dz * pd;
  let pl = Math.hypot(px, py, pz);
  if (pl < 1e-6) {
    // 힌트가 팔과 평행하면 아래쪽을 쓴다
    px = 0;
    py = -1;
    pz = 0;
    const q = -dy;
    px -= dx * q;
    py -= dy * q;
    pz -= dz * q;
    pl = Math.hypot(px, py, pz) || 1;
  }
  px /= pl;
  py /= pl;
  pz /= pl;
  setV(out.elbow, S.x + dx * a + px * h, S.y + dy * a + py * h, S.z + dz * a + pz * h);
  return out;
}

/** 머리 중심에서 목표를 바라보는 yaw·pitch(좌석 로컬). pitch(+)는 아래를 본다 */
export function lookAngles(
  head: V3,
  target: V3,
  out: { yaw: number; pitch: number },
): { yaw: number; pitch: number } {
  const dx = target.x - head.x;
  const dy = target.y - head.y;
  const dz = target.z - head.z;
  out.yaw = Math.atan2(dx, dz);
  out.pitch = Math.atan2(-dy, Math.hypot(dx, dz));
  return out;
}

// ───────── 조준 손 위치 ─────────

/** 알 반지름 + 손가락 여유: 손바닥 중심이 알 중심에서 떨어지는 기본 거리 */
export const HAND_BEHIND = 3.4;
/** 세기 100일 때 손을 뒤로 당기는 양 */
export const HAND_PULL = 5;
/** 손바닥 중심 높이(판 윗면 기준) */
export const HAND_AIM_H = 2.2;

/**
 * 조준 손 목표(좌석 로컬): 알 뒤(방향의 반대쪽)에 손을 둔다. charge면 세기만큼 더 당긴다.
 * 알이 maxReach보다 멀면 기준점 쪽으로 당겨 "손이 안 닿는" 자세가 되게 한다.
 */
export function aimHandTarget(stone: V3, dir: V3, pull01: number, reachable: boolean, out: V3): V3 {
  const back = HAND_BEHIND + HAND_PULL * clamp(pull01, 0, 1);
  setV(out, stone.x - dir.x * back, HAND_AIM_H, stone.z - dir.z * back);
  const r = Math.hypot(out.x, out.z);
  const lim = SEAT_GEOMETRY.maxReach * 0.9;
  if (!reachable && r > lim) {
    out.x *= lim / r;
    out.z *= lim / r;
    out.y = HAND_AIM_H + 3;
  }
  return out;
}

/** 기준점에서 알까지 수평 거리로 본 조준 어려움 0~1 */
export function strainOf(stone: V3): number {
  const d = Math.hypot(stone.x, stone.z);
  return clamp(
    (d - SEAT_GEOMETRY.comfortReach) / (SEAT_GEOMETRY.maxReach - SEAT_GEOMETRY.comfortReach),
    0,
    1,
  );
}

// ───────── 포즈 보간 ─────────

export interface SmoothPose {
  mode: CharacterPose['mode'];
  stoneId: number | null;
  angle: number;
  power: number;
  kind: CharacterPose['kind'] | null;
  target: V3;
  hasTarget: boolean;
  /** 이 포즈가 처음 들어온 뒤로 값이 있었는가 */
  primed: boolean;
}

export function createSmoothPose(): SmoothPose {
  return {
    mode: 'idle',
    stoneId: null,
    angle: 0,
    power: 0,
    kind: null,
    target: v3(),
    hasTarget: false,
    primed: false,
  };
}

/**
 * 20Hz 안팎으로 오는 포즈를 부드럽게 따라간다. 모드·알·방해요소 종류는 즉시 바꾸고,
 * 각·세기·조준점만 지수 감쇠로 보간한다(알이 바뀌거나 처음이면 바로 맞춘다).
 */
export function stepSmoothPose(
  sp: SmoothPose,
  pose: CharacterPose | null,
  dt: number,
  rate = 14,
): SmoothPose {
  if (!pose) {
    sp.mode = 'idle';
    sp.power = damp(sp.power, 0, rate, dt);
    return sp;
  }
  const newStone = (pose.stoneId ?? null) !== sp.stoneId;
  sp.mode = pose.mode;
  sp.kind = pose.kind ?? null;
  sp.stoneId = pose.stoneId ?? null;
  if (pose.angle !== undefined) {
    sp.angle = !sp.primed || newStone ? pose.angle : dampAngle(sp.angle, pose.angle, rate, dt);
    sp.angle = wrapPi(sp.angle);
  }
  const p = pose.power ?? 0;
  sp.power = !sp.primed ? p : damp(sp.power, p, rate, dt);
  if (pose.target) {
    // 서버 좌표 그대로 둔다(x, y, h)
    if (!sp.hasTarget) setV(sp.target, pose.target.x, pose.target.y, pose.target.h);
    else {
      const k = 1 - Math.exp(-rate * 0.8 * dt);
      sp.target.x += (pose.target.x - sp.target.x) * k;
      sp.target.y += (pose.target.y - sp.target.y) * k;
      sp.target.z += (pose.target.h - sp.target.z) * k;
    }
    sp.hasTarget = true;
  } else sp.hasTarget = false;
  sp.primed = true;
  return sp;
}

// ───────── 발사 감지 ─────────

/** 알이 "움직이기 시작했다"고 보는 속도(cm/s) */
export const FLICK_ONSET_SPEED = 25;
/** 조준이 끝난 뒤 이 시간 안에 조준하던 알이 움직이면 발사로 본다 */
export const FLICK_WINDOW_SEC = 0.8;
const FLICK_COOLDOWN_SEC = 1.2;

export interface FlickDetector {
  lastAimStone: number | null;
  lastAimSec: number;
  lastFlickSec: number;
}

export function createFlickDetector(): FlickDetector {
  return { lastAimStone: null, lastAimSec: -1e9, lastFlickSec: -1e9 };
}

export interface FlickInput {
  nowSec: number;
  mode: CharacterPose['mode'];
  stoneId: number | null;
  /** 마지막으로 조준한 알의 현재 속도(cm/s). 없으면 0 */
  aimedSpeed: number;
  /** 이 좌석의 알 중 이번 프레임에 정지 → 빠른 움직임으로 바뀐 알(없으면 null) */
  onsetStoneId: number | null;
  /** 이 좌석의 차례인가 */
  active: boolean;
}

/**
 * 튕기기 연출을 시작할 알 id를 돌려준다(없으면 null).
 * 1) 조준·충전 중이거나 조준이 끝난 직후(FLICK_WINDOW_SEC)에 조준하던 알이 움직이면 발사.
 * 2) 그 밖에 내 차례에 내 알 하나가 정지에서 빠르게 움직이기 시작하면 발사(조준 중계가 늦은 경우).
 */
export function stepFlick(fd: FlickDetector, input: FlickInput): number | null {
  const aiming = input.mode === 'aim' || input.mode === 'charge';
  if (aiming && input.stoneId !== null) {
    fd.lastAimStone = input.stoneId;
    fd.lastAimSec = input.nowSec;
  }
  if (input.nowSec - fd.lastFlickSec < FLICK_COOLDOWN_SEC) return null;
  if (
    fd.lastAimStone !== null &&
    input.nowSec - fd.lastAimSec <= FLICK_WINDOW_SEC &&
    input.aimedSpeed > FLICK_ONSET_SPEED
  ) {
    const id = fd.lastAimStone;
    fd.lastFlickSec = input.nowSec;
    fd.lastAimStone = null;
    return id;
  }
  if (input.onsetStoneId !== null && input.active && !aiming) {
    fd.lastFlickSec = input.nowSec;
    fd.lastAimStone = null;
    return input.onsetStoneId;
  }
  return null;
}

// ───────── 반응 ─────────

export type GestureName =
  'neutral' | 'cheer' | 'sad' | 'shock' | 'taunt' | 'laugh' | 'relief' | 'think';

export interface GestureStep {
  gesture: GestureName;
  /** 반응 시작부터의 시각(초) */
  at: number;
}

/** 반응 종류 → 몸짓 순서. 마지막 단계는 항상 neutral(약 2초 뒤, 승패는 조금 길게) */
export function reactionSteps(kind: ReactionKind): GestureStep[] {
  switch (kind) {
    case 'great':
    case 'win':
      return [
        { gesture: 'cheer', at: 0 },
        { gesture: 'neutral', at: kind === 'win' ? 3.5 : 2.2 },
      ];
    case 'miss':
    case 'lose':
      return [
        { gesture: 'sad', at: 0 },
        { gesture: 'neutral', at: kind === 'lose' ? 3.5 : 2.2 },
      ];
    case 'own':
      return [
        { gesture: 'shock', at: 0 },
        { gesture: 'sad', at: 0.7 },
        { gesture: 'neutral', at: 2.3 },
      ];
    case 'trade':
      return [
        { gesture: 'relief', at: 0 },
        { gesture: 'neutral', at: 2.2 },
      ];
    case 'taunt':
      return [
        { gesture: 'taunt', at: 0 },
        { gesture: 'laugh', at: 1.1 },
        { gesture: 'neutral', at: 2.3 },
      ];
    case 'shocked':
    case 'hit':
      return [
        { gesture: 'shock', at: 0 },
        { gesture: 'neutral', at: 2.0 },
      ];
    case 'draw':
      return [
        { gesture: 'shock', at: 0 },
        { gesture: 'neutral', at: 3.0 },
      ];
  }
}

/** 시각 t(초)의 몸짓 */
export function gestureAt(steps: readonly GestureStep[], t: number): GestureName {
  let g: GestureName = 'neutral';
  for (const s of steps) if (t >= s.at) g = s.gesture;
  return g;
}

export interface ReactionTracker {
  seen: Set<number>;
}

export function createReactionTracker(): ReactionTracker {
  return { seen: new Set() };
}

/**
 * 처음 보는 반응만 골라 좌석별 최신 하나씩 돌려준다([좌석 0, 좌석 1]).
 * 본 id는 기억해 다시 재생하지 않는다.
 */
export function takeNewReactions(
  tr: ReactionTracker,
  reactions: readonly Reaction[],
): [Reaction | null, Reaction | null] {
  const out: [Reaction | null, Reaction | null] = [null, null];
  for (const r of reactions) {
    if (tr.seen.has(r.id)) continue;
    tr.seen.add(r.id);
    out[r.seat] = r;
  }
  if (tr.seen.size > 512) {
    // 오래된 id 정리: 현재 배열에 있는 것만 남긴다
    const keep = new Set(reactions.map((r) => r.id));
    tr.seen = keep;
  }
  return out;
}
