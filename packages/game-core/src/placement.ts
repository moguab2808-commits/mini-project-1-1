// 설치물(벽·끈끈이·추가 위치형 8종) 배치 가능 판정. 권한 측(`Game.useHazard`)과 클라이언트 미리보기·AI가
// 같은 기하 조건을 쓰도록 한 곳에 둔다. 순수 함수이며 상태를 바꾸지 않는다.
// 규칙: docs/design/GAME.md "추가 방해요소 10종과 턴 교체"의 공통 규칙(DEC-057).
import {
  HAZARD_TUNING,
  PHYSICS,
  type BoardDefinition,
  type HazardKind,
  type HazardParams,
} from '@alkkagi/shared';
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

/** 설치물이 판 위에서 차지하는 영역 */
export type Footprint =
  { type: 'circle'; cx: number; cy: number; radius: number } | { type: 'obb'; obb: Obb };

/** 배치 판정에 필요한 현재 판 상태. `stones`는 지면에 있는 살아 있는 알만 넣는다(떠 있는 알은 충돌하지 않는다). */
export interface PlacementWorld {
  board: BoardDefinition;
  stones: ReadonlyArray<{ x: number; y: number }>;
  walls: ReadonlyArray<Obb>;
  stickies: ReadonlyArray<PlacementCircle>;
  /** 벽·끈끈이 밖의 설치물(자석·중력 구역·미끄럼 장판·방향 반전·폭탄·구멍·이동 장애물 경로) 차지 영역 */
  others?: ReadonlyArray<Footprint>;
}

/** 판 위 위치를 정해 놓는 방해요소 */
export const INSTALL_KINDS = [
  'wall',
  'sticky',
  'ice_floor',
  'magnet',
  'gravity_zone',
  'fake_wall',
  'reverse_zone',
  'mine',
  'pit',
  'moving_wall',
] as const satisfies readonly HazardKind[];
export type InstallKind = (typeof INSTALL_KINDS)[number];

export function isInstallKind(kind: HazardKind): kind is InstallKind {
  return (INSTALL_KINDS as readonly HazardKind[]).includes(kind);
}

/** 벽 격자에 스냅하는 종류(벽 계열) */
export function snapsToWallGrid(kind: InstallKind): boolean {
  return kind === 'wall' || kind === 'fake_wall' || kind === 'moving_wall';
}

/** 방향(가로·세로)을 고르는 종류 */
export function hasOrientation(kind: InstallKind): boolean {
  return snapsToWallGrid(kind);
}

/** 알과 겹쳐 놓을 수 없는 종류. 영역형과 이동 장애물 경로는 알과 겹쳐도 된다(DEC-057) */
function blocksStones(kind: InstallKind): boolean {
  return kind === 'wall' || kind === 'fake_wall' || kind === 'mine' || kind === 'pit';
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

/** 중력 구역 정사각형. 판 좌표계 축에 맞춰 놓고 판을 돌리면 함께 돈다 */
export function gravityZoneObb(x: number, y: number, angleRad = 0): Obb {
  const half = HAZARD_TUNING.gravityZoneSize / 2;
  return { cx: x, cy: y, angle: angleRad, halfLen: half, halfThick: half };
}

/** 이동 장애물 벽의 각(라디안)은 왕복 축에 수직이다. 축 각 = 벽 각 + π/2 */
export function movingWallAngle(orientation: 'horizontal' | 'vertical'): number {
  return orientation === 'horizontal' ? Math.PI / 2 : 0;
}

/** 이동 장애물이 왕복하며 쓸고 지나가는 직사각형. `wallAngle`은 벽의 각이다 */
export function movingWallSweep(x: number, y: number, wallAngle: number): Obb {
  return {
    cx: x,
    cy: y,
    angle: wallAngle + Math.PI / 2,
    halfLen: HAZARD_TUNING.movingWallAmplitude + HAZARD_TUNING.wallThickness / 2,
    halfThick: HAZARD_TUNING.wallLength / 2,
  };
}

/**
 * 이동 장애물의 지금 위치·속도. 가운데에서 축 + 방향으로 출발해 일정 속도로 ±진폭을 왕복한다.
 * 권한 측과 화면이 `startsAtMs`와 수치로 같은 위치를 계산한다.
 */
export function movingWallAt(
  x: number,
  y: number,
  wallAngle: number,
  startsAtMs: number,
  nowMs: number,
): { wall: Obb; vx: number; vy: number } {
  const A = HAZARD_TUNING.movingWallAmplitude;
  const P = HAZARD_TUNING.movingWallPeriodMs;
  const t = Math.max(0, nowMs - startsAtMs);
  const u = (t % P) / P;
  const tri = u < 0.25 ? 4 * u : u < 0.75 ? 2 - 4 * u : 4 * u - 4;
  const dir = u < 0.25 || u >= 0.75 ? 1 : -1;
  const speed = (4 * A) / (P / 1000);
  const ax = Math.cos(wallAngle + Math.PI / 2);
  const ay = Math.sin(wallAngle + Math.PI / 2);
  return {
    wall: {
      cx: x + ax * A * tri,
      cy: y + ay * A * tri,
      angle: wallAngle,
      halfLen: HAZARD_TUNING.wallLength / 2,
      halfThick: HAZARD_TUNING.wallThickness / 2,
    },
    vx: ax * speed * dir,
    vy: ay * speed * dir,
  };
}

/**
 * 클릭한 진짜 벽과 무작위 허상 두 곳을 함께 계획한다. 경기 상태·보관 난수는 바꾸지 않는다.
 * 후보를 섞은 뒤 가능한 쌍을 찾아, 한 후보가 남은 공간을 막아도 다른 쌍을 확인한다.
 */
export function planFakeWalls(
  x: number,
  y: number,
  orientation: 'horizontal' | 'vertical',
  world: PlacementWorld,
  random: () => number,
): Obb[] | null {
  if (!isPlacementValid('fake_wall', x, y, orientation, world)) return null;
  const real = makeWall(x, y, orientation);
  const withReal = { ...world, walls: [...world.walls, real] };
  const half = (world.board.shape === 'square' ? world.board.size : world.board.diameter) / 2;
  const edge = Math.floor(half / HAZARD_TUNING.gridStep);
  const candidates: Obb[] = [];
  for (let ix = -edge; ix <= edge; ix++) {
    for (let iy = -edge; iy <= edge; iy++) {
      const wall = makeWall(ix * HAZARD_TUNING.gridStep, iy * HAZARD_TUNING.gridStep, orientation);
      if (isWallPlaceable(wall, withReal)) candidates.push(wall);
    }
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }
  for (let i = 0; i < candidates.length - 1; i++) {
    const first = candidates[i]!;
    const withFirst = { ...withReal, walls: [...withReal.walls, first] };
    for (let j = i + 1; j < candidates.length; j++) {
      if (isWallPlaceable(candidates[j]!, withFirst)) return [real, first, candidates[j]!];
    }
  }
  return null;
}

const circle = (cx: number, cy: number, radius: number): Footprint => ({
  type: 'circle',
  cx,
  cy,
  radius,
});

/** 새 설치 후보의 차지 영역. 가짜벽은 선택한 진짜 벽만 미리 보인다. 격자 스냅은 호출 쪽이 한다 */
export function installFootprints(
  kind: InstallKind,
  x: number,
  y: number,
  orientation: 'horizontal' | 'vertical' = 'horizontal',
): Footprint[] {
  const T = HAZARD_TUNING;
  switch (kind) {
    case 'wall':
    case 'fake_wall':
      return [{ type: 'obb', obb: makeWall(x, y, orientation) }];
    case 'sticky':
      return [circle(x, y, T.stickyDiameter / 2)];
    case 'ice_floor':
      return [circle(x, y, T.iceFloorDiameter / 2)];
    case 'magnet':
      return [circle(x, y, T.magnetRadius)];
    case 'reverse_zone':
      return [circle(x, y, T.reverseZoneDiameter / 2)];
    case 'mine':
      return [circle(x, y, T.mineRadius)];
    case 'pit':
      return [circle(x, y, T.pitDiameter / 2)];
    case 'gravity_zone':
      return [{ type: 'obb', obb: gravityZoneObb(x, y) }];
    case 'moving_wall':
      return [{ type: 'obb', obb: movingWallSweep(x, y, movingWallAngle(orientation)) }];
  }
}

/**
 * 공개 효과(`kind`·`params`)의 차지 영역. 판 돌리기 뒤의 위치·각을 그대로 쓴다.
 * 벽(가짜벽 포함, 뷰에서는 모두 `wall`)·끈끈이는 `walls`·`stickies`로 따로 다루므로 여기서는 빼도 된다.
 */
export function effectFootprint(
  kind: HazardKind,
  params: HazardParams | undefined,
): Footprint | null {
  if (!params || params.x === undefined || params.y === undefined) return null;
  const { x, y } = params;
  const T = HAZARD_TUNING;
  const angle = ((params.angleDeg ?? 0) * Math.PI) / 180;
  switch (kind) {
    case 'wall': {
      const w = wallFromParams(params);
      return w ? { type: 'obb', obb: w } : null;
    }
    case 'sticky':
      return circle(x, y, T.stickyDiameter / 2);
    case 'ice_floor':
      return circle(x, y, T.iceFloorDiameter / 2);
    case 'magnet':
      return circle(x, y, T.magnetRadius);
    case 'reverse_zone':
      return circle(x, y, T.reverseZoneDiameter / 2);
    case 'mine':
      return circle(x, y, T.mineRadius);
    case 'pit':
      return circle(x, y, T.pitDiameter / 2);
    case 'gravity_zone':
      return { type: 'obb', obb: gravityZoneObb(x, y, angle) };
    case 'moving_wall':
      return { type: 'obb', obb: movingWallSweep(x, y, angle) };
    default:
      return null;
  }
}

function footprintInside(board: BoardDefinition, f: Footprint): boolean {
  if (f.type === 'circle') return insideBoard(board, f.cx, f.cy, f.radius);
  return obbCorners(f.obb).every(([x, y]) => insideBoard(board, x, y));
}

function footprintsOverlap(a: Footprint, b: Footprint): boolean {
  if (a.type === 'circle' && b.type === 'circle') {
    return Math.hypot(a.cx - b.cx, a.cy - b.cy) < a.radius + b.radius;
  }
  if (a.type === 'circle' && b.type === 'obb')
    return circleVsObb(a.cx, a.cy, a.radius, b.obb) !== null;
  if (a.type === 'obb' && b.type === 'circle')
    return circleVsObb(b.cx, b.cy, b.radius, a.obb) !== null;
  return obbOverlap((a as { obb: Obb }).obb, (b as { obb: Obb }).obb);
}

function existingFootprints(world: PlacementWorld): Footprint[] {
  return [
    ...world.walls.map((obb): Footprint => ({ type: 'obb', obb })),
    ...world.stickies.map((s) => circle(s.cx, s.cy, s.radius)),
    ...(world.others ?? []),
  ];
}

/** 차지 영역들이 판 안이고 다른 설치물과 겹치지 않으며, 필요하면 알과도 겹치지 않는가 */
function footprintsPlaceable(fs: Footprint[], world: PlacementWorld, noStones: boolean): boolean {
  if (!fs.every((f) => footprintInside(world.board, f))) return false;
  if (noStones) {
    const R = PHYSICS.stoneRadius;
    if (fs.some((f) => world.stones.some((s) => footprintsOverlap(f, circle(s.x, s.y, R))))) {
      return false;
    }
  }
  const existing = existingFootprints(world);
  return !fs.some((f) => existing.some((o) => footprintsOverlap(f, o)));
}

/** 벽 후보가 판 안이고 알·다른 설치물과 겹치지 않는가 */
export function isWallPlaceable(wall: Obb, world: PlacementWorld): boolean {
  return footprintsPlaceable([{ type: 'obb', obb: wall }], world, true);
}

/** 끈끈이 후보가 판 안이고 다른 설치물과 겹치지 않는가(알과는 겹쳐도 된다, DEC-057) */
export function isStickyPlaceable(area: PlacementCircle, world: PlacementWorld): boolean {
  return footprintsPlaceable([circle(area.cx, area.cy, area.radius)], world, false);
}

/**
 * 설치 후보 하나의 배치 가능 여부. 벽 계열은 격자 위인지도 본다.
 * 가짜벽은 클릭한 진짜 벽을 판정하고, 추가 두 벽은 권한 측이 전체 배치를 계획한다.
 */
export function isPlacementValid(
  kind: InstallKind,
  x: number,
  y: number,
  orientation: 'horizontal' | 'vertical',
  world: PlacementWorld,
): boolean {
  if (snapsToWallGrid(kind) && (!isOnWallGrid(x) || !isOnWallGrid(y))) return false;
  return footprintsPlaceable(installFootprints(kind, x, y, orientation), world, blocksStones(kind));
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

/**
 * 공개 뷰로 배치 판정 입력을 만든다(클라이언트 미리보기·AI). 권한 측과 같은 효과 목록에서 만든다.
 * 상대 뷰의 `stones`에는 분신술 허상이 섞일 수 있어 권한 측보다 엄격할 수는 있지만 느슨하지는 않다.
 */
export function placementWorldFromView(
  board: BoardDefinition,
  view: {
    stones: ReadonlyArray<{ x: number; y: number; h: number }>;
    effects: ReadonlyArray<{ kind: HazardKind; expiresAtMs: number; params?: HazardParams }>;
  },
  nowMs: number,
): PlacementWorld {
  const walls: Obb[] = [];
  const stickies: PlacementCircle[] = [];
  const others: Footprint[] = [];
  for (const e of view.effects) {
    if (e.expiresAtMs <= nowMs) continue;
    const f = effectFootprint(e.kind, e.params);
    if (!f) continue;
    if (e.kind === 'wall' && f.type === 'obb') walls.push(f.obb);
    else if (e.kind === 'sticky' && f.type === 'circle') stickies.push(f);
    else others.push(f);
  }
  return { board, stones: view.stones.filter((s) => s.h <= 0), walls, stickies, others };
}
