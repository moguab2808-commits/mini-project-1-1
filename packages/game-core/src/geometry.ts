import {
  BOARDS,
  HAZARD_TUNING,
  PHYSICS,
  type BoardDefinition,
  type BoardId,
  type Seat,
} from '@alkkagi/shared';

export function boardOf(id: BoardId): BoardDefinition {
  return BOARDS[id];
}

/** 점이 판 영역 안(경계 포함, 허용 오차 적용)인가 */
export function insideBoard(def: BoardDefinition, x: number, y: number, margin = 0): boolean {
  const eps = PHYSICS.boundaryEpsilon;
  if (def.shape === 'square') {
    const lim = def.size / 2 - margin + eps;
    return Math.abs(x) <= lim && Math.abs(y) <= lim;
  }
  return Math.hypot(x, y) <= def.diameter / 2 - margin + eps;
}

/** 판 밖의 점을 경계에서 boundaryInset만큼 안쪽으로 되돌린다. 안쪽이면 그대로 둔다. */
export function clampInside(def: BoardDefinition, x: number, y: number): [number, number] {
  if (insideBoard(def, x, y)) return [x, y];
  const inset = PHYSICS.boundaryInset;
  if (def.shape === 'square') {
    const lim = def.size / 2 - inset;
    return [Math.max(-lim, Math.min(lim, x)), Math.max(-lim, Math.min(lim, y))];
  }
  const lim = def.diameter / 2 - inset;
  const d = Math.hypot(x, y);
  return [(x / d) * lim, (y / d) * lim];
}

/** 선공(좌석 0) 알의 초기 위치. 후공은 판 중심 대칭이다. */
export function spawnPositions(
  def: BoardDefinition,
  seat: Seat,
  count: number,
): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  if (def.shape === 'square') {
    const half = def.size / 2;
    const y = -half + def.size / 4;
    for (let i = 0; i < count; i++) out.push([-half + ((i + 1) * def.size) / (count + 1), y]);
  } else {
    const r = def.diameter / 2;
    const arcR = r - def.diameter / 4;
    // 같은 거리의 호 위에 같은 간격. 호 길이 간격은 기본판 9개 배치(4.6)와 같게 둔다.
    const step = 4.6 / arcR;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (i - (count - 1) / 2) * step;
      out.push([arcR * Math.cos(a), arcR * Math.sin(a)]);
    }
  }
  return seat === 0 ? out : out.map(([x, y]) => [-x, -y]);
}

export function rotate(x: number, y: number, rad: number): [number, number] {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [x * c - y * s, x * s + y * c];
}

/** 회전한 직사각형(벽) */
export interface Obb {
  cx: number;
  cy: number;
  angle: number;
  halfLen: number;
  halfThick: number;
}

export function makeWall(cx: number, cy: number, orientation: 'horizontal' | 'vertical'): Obb {
  return {
    cx,
    cy,
    angle: orientation === 'horizontal' ? 0 : Math.PI / 2,
    halfLen: HAZARD_TUNING.wallLength / 2,
    halfThick: HAZARD_TUNING.wallThickness / 2,
  };
}

export function obbCorners(o: Obb): Array<[number, number]> {
  const pts: Array<[number, number]> = [
    [-o.halfLen, -o.halfThick],
    [o.halfLen, -o.halfThick],
    [o.halfLen, o.halfThick],
    [-o.halfLen, o.halfThick],
  ];
  return pts.map(([x, y]) => {
    const [rx, ry] = rotate(x, y, o.angle);
    return [rx + o.cx, ry + o.cy];
  });
}

/** 원과 직사각형의 접촉. 겹치면 원을 밀어낼 법선(직사각형 → 원)과 깊이를 돌려준다. */
export function circleVsObb(
  cx: number,
  cy: number,
  r: number,
  o: Obb,
): { nx: number; ny: number; depth: number } | null {
  const [lx, ly] = rotate(cx - o.cx, cy - o.cy, -o.angle);
  const px = Math.max(-o.halfLen, Math.min(o.halfLen, lx));
  const py = Math.max(-o.halfThick, Math.min(o.halfThick, ly));
  let dx = lx - px;
  let dy = ly - py;
  const d = Math.hypot(dx, dy);
  if (d > 0) {
    if (d >= r) return null;
    dx /= d;
    dy /= d;
    const [nx, ny] = rotate(dx, dy, o.angle);
    return { nx, ny, depth: r - d };
  }
  // 중심이 직사각형 안: 가까운 변 쪽으로 민다.
  const ox = o.halfLen - Math.abs(lx);
  const oy = o.halfThick - Math.abs(ly);
  const [nx, ny] =
    ox < oy ? rotate(Math.sign(lx) || 1, 0, o.angle) : rotate(0, Math.sign(ly) || 1, o.angle);
  return { nx, ny, depth: Math.min(ox, oy) + r };
}

/** 분리축 정리로 두 직사각형이 겹치는지 */
export function obbOverlap(a: Obb, b: Obb): boolean {
  const ca = obbCorners(a);
  const cb = obbCorners(b);
  const axes = [a.angle, a.angle + Math.PI / 2, b.angle, b.angle + Math.PI / 2].map(
    (t) => [Math.cos(t), Math.sin(t)] as const,
  );
  for (const [ax, ay] of axes) {
    const pa = ca.map(([x, y]) => x * ax + y * ay);
    const pb = cb.map(([x, y]) => x * ax + y * ay);
    if (Math.max(...pa) <= Math.min(...pb) || Math.max(...pb) <= Math.min(...pa)) return false;
  }
  return true;
}
