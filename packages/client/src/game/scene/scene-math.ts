// 장면의 순수 좌표·판정 계산. React·three에 의존하지 않아 단위 테스트할 수 있다.
//
// 좌표 대응: 서버 기준 (x, y) → 월드 (X = x, Z = -y), 높이는 월드 Y. 서버의 반시계 회전 φ는
// three의 `rotation.y = φ`와 같다. 선공(seat 0)의 알은 y<0이므로 Z>0, 즉 카메라(+Z) 쪽에 놓인다.
// 후공 화면은 카메라를 -Z 쪽에 두므로 좌표를 따로 뒤집지 않고 월드 좌표만으로 서버 좌표를 얻는다.
import type { Seat } from '@alkkagi/shared';

export const DEG = Math.PI / 180;

/** 판 평면(월드 Y)의 높이. 판 윗면이 0이다. */
export const BOARD_TOP_Y = 0;
/** 알 모양: 납작한 구. 지름 2.2cm, 높이는 지름의 0.45배 */
export const STONE_FLATNESS = 0.45;
/** 가까운 알을 고를 때 알 반지름에 더하는 여유 cm */
export const PICK_MARGIN = 0.7;

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** 각도(도)만큼 반시계 회전. */
export function rotateDeg(x: number, y: number, deg: number): [number, number] {
  const r = deg * DEG;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [x * c - y * s, x * s + y * c];
}

/** 각도를 (-180, 180]로 접는다. */
export function wrapDeg(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

/**
 * 광선이 수평면(월드 Y = planeY)과 만나는 점. 평행하거나 평면이 광선 뒤쪽이면 null.
 * dir은 정규화하지 않아도 된다.
 */
export function rayPlaneHit(origin: Vec3, dir: Vec3, planeY: number): Vec3 | null {
  if (Math.abs(dir.y) < 1e-9) return null;
  const t = (planeY - origin.y) / dir.y;
  if (t < 0) return null;
  return { x: origin.x + dir.x * t, y: planeY, z: origin.z + dir.z * t };
}

/**
 * 판 평면 위 월드 점을 서버 기준 좌표(cm)로 바꾼다.
 * 알·설치물·조준은 "최신 스냅샷 좌표계"를 월드 Y축으로 deltaDeg(= 표시 회전 − 최신 회전)만큼
 * 돌린 그룹 안에 그려지므로, 역변환은 −deltaDeg 회전 + Z 부호 반전이다.
 */
export function worldToServer(worldX: number, worldZ: number, deltaDeg: number): [number, number] {
  return rotateDeg(worldX, -worldZ, -deltaDeg);
}

/** 서버 기준 좌표를 월드 (X, Z)로. 회전 그룹 안(deltaDeg=0)이면 X=x, Z=-y다. */
export function serverToWorld(x: number, y: number, deltaDeg: number): [number, number] {
  const [rx, ry] = rotateDeg(x, y, deltaDeg);
  return [rx, -ry];
}

export interface PickCandidate {
  id: number;
  /** 월드 좌표의 알 중심(떠 있으면 높이 반영) */
  x: number;
  y: number;
  z: number;
}

/**
 * 광선에 가장 가까운 알. 광선과 알 중심의 거리가 radius 이하인 것 중 최소.
 * 떠 있는 알은 중심 높이가 반영되어 있으므로 화면에서 보이는 알을 그대로 집는다.
 */
export function pickStoneByRay(
  origin: Vec3,
  dir: Vec3,
  candidates: readonly PickCandidate[],
  count: number,
  radius: number,
): number | null {
  const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const dx = dir.x / len;
  const dy = dir.y / len;
  const dz = dir.z / len;
  let best: number | null = null;
  let bestD2 = radius * radius;
  for (let i = 0; i < count; i++) {
    const c = candidates[i];
    if (!c) continue;
    const vx = c.x - origin.x;
    const vy = c.y - origin.y;
    const vz = c.z - origin.z;
    const t = vx * dx + vy * dy + vz * dz;
    if (t < 0) continue;
    const d2 = vx * vx + vy * vy + vz * vz - t * t;
    if (d2 <= bestD2) {
      bestD2 = d2;
      best = c.id;
    }
  }
  return best;
}

/**
 * 표시 판 각도가 목표 각도로 부드럽게 다가간다. 오차에 비례해 느려지되 최소 속도를 두어 끝까지 도달한다.
 * 판 돌리기 연출(약 1초, 45도)에 맞춘 값이다.
 */
export function approachAngle(current: number, target: number, dtSec: number): number {
  const err = target - current;
  if (err === 0) return target;
  const step = Math.max(Math.abs(err) * 5 * dtSec, 30 * dtSec);
  if (step >= Math.abs(err)) return target;
  return current + Math.sign(err) * step;
}

export interface CameraRig {
  px: number;
  py: number;
  pz: number;
  tx: number;
  ty: number;
  tz: number;
  fov: number;
}

/**
 * 내 알이 있는 쪽에서 판을 비스듬히 내려다보는 고정 시점. seat 1은 Z를 뒤집어 180도 돌린 시점이다.
 * 가로가 좁은 화면에서는 판이 잘리지 않도록 뒤로 물러난다.
 */
export function cameraRig(mySeat: Seat, aspect: number): CameraRig {
  const sign = mySeat === 0 ? 1 : -1;
  const narrow = aspect < 1.6 ? 1.6 / Math.max(aspect, 0.3) : 1;
  const k = 1 + (narrow - 1) * 0.75;
  return {
    px: 0,
    py: 52 * k,
    pz: sign * 50 * k,
    tx: 0,
    ty: -4,
    tz: -sign * 13,
    fov: 44,
  };
}

/** 책상 흔들림 변위(cm). progress 0~1, 시간이 지날수록 줄어든다. */
export function deskShakeOffset(
  progress: number,
  elapsedSec: number,
  maxDistance: number,
): [number, number] {
  if (progress < 0 || progress >= 1) return [0, 0];
  const env = (1 - progress) * (1 - progress);
  return [
    Math.sin(elapsedSec * 71) * maxDistance * env,
    Math.sin(elapsedSec * 53 + 1.3) * maxDistance * env * 0.7,
  ];
}

/** 세기(0~100)에 따른 막대 색: 초록 → 노랑 → 빨강. 0xRRGGBB */
export function powerColor(power: number): number {
  const p = Math.min(100, Math.max(0, power)) / 100;
  const r = p < 0.5 ? Math.round(80 + 350 * p) : 255;
  const g = p < 0.5 ? 220 : Math.round(220 - 400 * (p - 0.5));
  return (r << 16) | (Math.max(40, g) << 8) | 60;
}
