// 벽·끈끈이 배치 가능 판정. 권한 측(`Game.useHazard`)과 클라이언트 미리보기가 같은 기하 조건을 쓰도록 한 곳에 둔다.
// 순수 함수이며 상태를 바꾸지 않는다.
import { HAZARD_TUNING, PHYSICS, type BoardDefinition } from '@alkkagi/shared';
import {
  circleVsObb,
  insideBoard,
  makeWall,
  obbCorners,
  obbOverlap,
  type Obb,
} from './geometry.ts';

export interface PlacementCircle {
  cx: number;
  cy: number;
  radius: number;
}

/** 배치 판정에 필요한 현재 판 상태. `stones`는 지면에 있는 살아 있는 알만 넣는다(떠 있는 알은 충돌하지 않는다). */
export interface PlacementWorld {
  board: BoardDefinition;
  stones: ReadonlyArray<{ x: number; y: number }>;
  walls: ReadonlyArray<Obb>;
  stickies: ReadonlyArray<PlacementCircle>;
}

/** 값을 벽 격자(알 지름 간격, 판 중심 기준)에 스냅한다. */
export function snapToWallGrid(v: number): number {
  const step = HAZARD_TUNING.gridStep;
  const snapped = Math.round(v / step) * step;
  return snapped === 0 ? 0 : snapped; // -0 방지
}

/** 값이 벽 격자 위에 있는가(허용 오차 1e-6) */
export function isOnWallGrid(v: number): boolean {
  const step = HAZARD_TUNING.gridStep;
  return Math.abs(v - Math.round(v / step) * step) <= 1e-6;
}

/** 벽 후보가 판 안이고 알·기존 벽·끈끈이와 겹치지 않는가 */
export function isWallPlaceable(wall: Obb, world: PlacementWorld): boolean {
  if (!obbCorners(wall).every(([x, y]) => insideBoard(world.board, x, y))) return false;
  if (world.stones.some((s) => circleVsObb(s.x, s.y, PHYSICS.stoneRadius, wall))) return false;
  if (world.walls.some((o) => obbOverlap(wall, o))) return false;
  return !world.stickies.some((a) => circleVsObb(a.cx, a.cy, a.radius, wall) !== null);
}

/** 끈끈이 후보가 판 안이고 알·기존 벽·끈끈이와 겹치지 않는가 */
export function isStickyPlaceable(area: PlacementCircle, world: PlacementWorld): boolean {
  if (!insideBoard(world.board, area.cx, area.cy, area.radius)) return false;
  if (
    world.stones.some(
      (s) => Math.hypot(s.x - area.cx, s.y - area.cy) < area.radius + PHYSICS.stoneRadius,
    )
  ) {
    return false;
  }
  if (world.walls.some((w) => circleVsObb(area.cx, area.cy, area.radius, w))) return false;
  return !world.stickies.some(
    (o) => Math.hypot(o.cx - area.cx, o.cy - area.cy) < o.radius + area.radius,
  );
}

/** 벽·끈끈이 후보 하나의 배치 가능 여부. 벽은 격자 위인지도 본다. */
export function isPlacementValid(
  kind: 'wall' | 'sticky',
  x: number,
  y: number,
  orientation: 'horizontal' | 'vertical',
  world: PlacementWorld,
): boolean {
  if (kind === 'wall') {
    if (!isOnWallGrid(x) || !isOnWallGrid(y)) return false;
    return isWallPlaceable(makeWall(x, y, orientation), world);
  }
  return isStickyPlaceable({ cx: x, cy: y, radius: HAZARD_TUNING.stickyDiameter / 2 }, world);
}

/** 공개 뷰의 효과 `params`(x, y, angleDeg 또는 orientation)로 벽 직사각형을 복원한다. */
export function wallFromParams(params: {
  x?: number;
  y?: number;
  orientation?: 'horizontal' | 'vertical';
  angleDeg?: number;
}): Obb | null {
  if (params.x === undefined || params.y === undefined) return null;
  const wall = makeWall(params.x, params.y, params.orientation ?? 'horizontal');
  if (params.angleDeg !== undefined) wall.angle = (params.angleDeg * Math.PI) / 180;
  return wall;
}
