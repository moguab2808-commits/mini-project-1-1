// 좌석 기하: 손이 닿는 거리와 후레쉬·물총 조준 판정(DEC-036, docs/design/GAME.md "방해요소 수치").
// 권한 측(game-core)과 클라이언트 조준 표시가 같은 함수를 쓴다. 좌석은 판과 함께 돌지 않으므로
// 모든 좌표는 현재(회전이 반영된) 판 좌표계 cm다.
import { HAZARD_TUNING, SEAT_GEOMETRY, type Seat } from '@alkkagi/shared';

export interface Reach {
  /** 좌석 기준점(어깨)에서 알 중심까지 수평 거리(cm) */
  distance: number;
  /** 조준 어려움 0~1. comfortReach 이하 0, maxReach 이상 1 */
  strain: number;
  /** maxReach 이하면 칠 수 있다 */
  reachable: boolean;
}

export interface Point3 {
  x: number;
  y: number;
  /** 판 윗면 기준 높이 */
  h: number;
}

/** 좌석 0은 −y 쪽, 좌석 1은 +y 쪽 */
const sideOf = (seat: Seat): number => (seat === 0 ? -1 : 1);

/** 좌석 기준점(어깨)의 판 좌표 */
export function seatAnchor(seat: Seat): { x: number; y: number } {
  return { x: 0, y: sideOf(seat) * SEAT_GEOMETRY.anchorDistance };
}

/** 그 좌석에서 판 위 점 (x, y)까지 손이 닿는지 */
export function reachOf(seat: Seat, x: number, y: number): Reach {
  const a = seatAnchor(seat);
  const distance = Math.hypot(x - a.x, y - a.y);
  const { comfortReach, maxReach } = SEAT_GEOMETRY;
  const strain = Math.min(1, Math.max(0, (distance - comfortReach) / (maxReach - comfortReach)));
  return { distance, strain, reachable: distance <= maxReach + 1e-9 };
}

/** 후레쉬·물총을 든 손의 위치: 기준점에서 판 중심 쪽으로 handForward, 높이 handHeight */
export function handPoint(seat: Seat): Point3 {
  const s = sideOf(seat);
  return {
    x: 0,
    y: s * (SEAT_GEOMETRY.anchorDistance - SEAT_GEOMETRY.handForward),
    h: SEAT_GEOMETRY.handHeight,
  };
}

/** 그 좌석 캐릭터의 얼굴 중심 */
export function facePoint(seat: Seat): Point3 {
  return { x: 0, y: sideOf(seat) * SEAT_GEOMETRY.anchorDistance, h: SEAT_GEOMETRY.headHeight };
}

/**
 * `source` 좌석이 손에서 `aim` 방향으로 쏜 발동 영역(원뿔)이 상대 얼굴에 맞는지.
 * 손→조준점 방향과 손→상대 얼굴 방향의 각이 blindBeamHalfAngleDeg 이하면 맞은 것이다.
 */
export function beamHitsFace(source: Seat, aim: Point3): boolean {
  const hand = handPoint(source);
  const face = facePoint(source === 0 ? 1 : 0);
  const ax = aim.x - hand.x;
  const ay = aim.y - hand.y;
  const ah = aim.h - hand.h;
  const fx = face.x - hand.x;
  const fy = face.y - hand.y;
  const fh = face.h - hand.h;
  const la = Math.hypot(ax, ay, ah);
  const lf = Math.hypot(fx, fy, fh);
  if (!(la > 1e-9) || !(lf > 1e-9)) return false;
  const cos = (ax * fx + ay * fy + ah * fh) / (la * lf);
  return cos >= Math.cos((HAZARD_TUNING.blindBeamHalfAngleDeg * Math.PI) / 180) - 1e-12;
}
