import { HAZARD_TUNING, PHYSICS, type BoardDefinition, type Seat } from '@alkkagi/shared';
import { circleVsObb, insideBoard, rotate, type Obb } from './geometry.ts';

export interface Stone {
  id: number;
  owner: Seat;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 지면 위 높이. 0보다 크거나 airborne이면 떠 있는 알이다 */
  h: number;
  vz: number;
  airborne: boolean;
  alive: boolean;
  /** 자석에 붙잡혀 도는 중(DEC-082). 이 동안 다른 힘·충돌·판정을 받지 않는다 */
  orbit?: MagnetOrbit;
}

/** 자석에 붙잡힌 알의 나선 궤도 상태 */
export interface MagnetOrbit {
  cx: number;
  cy: number;
  /** 붙잡힌 순간 중심과의 거리·각, 높이 */
  r0: number;
  a0: number;
  h0: number;
  /** 회전 방향(+1 반시계, −1 시계). 들어올 때의 돌던 방향을 따른다 */
  dir: 1 | -1;
  /** 붙잡힌 뒤 경과(초) */
  t: number;
}

export interface StickyArea {
  cx: number;
  cy: number;
  radius: number;
}

/** 방향 반전 구역. 같은 알에는 한 번만 발동한다 */
export interface ReverseZone extends StickyArea {
  /** 지난 스텝에 중심이 안에 있던 알 */
  inside: Set<number>;
  /** 이미 뒤집힌 알 */
  done: Set<number>;
}

export interface Mine {
  cx: number;
  cy: number;
  exploded: boolean;
}

/** 이동 장애물: 이번 틱 위치와 속도. 권한 측이 매 틱 갱신한다 */
export interface MovingWall {
  wall: Obb;
  vx: number;
  vy: number;
}

/**
 * 물리 세계. 추가 10종의 필드는 없으면 효과가 없는 것이다(AI 미리보기는 일부만 채운다).
 * 판에 놓는 효과는 **움직이는 지면 알**(스텝 시작 속도 ≥ 정지 판정 속도, 떠 있지 않음)에만 힘을 준다.
 */
export interface World {
  board: BoardDefinition;
  stones: Stone[];
  walls: Obb[];
  stickies: StickyArea[];
  magnets?: StickyArea[];
  /** 중력 구역 정사각형과 미끄러지는 방향 단위 벡터 */
  gravityZones?: Array<{ zone: Obb; dx: number; dy: number }>;
  /** 미끄럼 장판 원. 중심이 안에 있는 지면 알의 지면 감속에 배율을 곱한다(끈끈이 추가 감속에는 곱하지 않는다) */
  iceAreas?: StickyArea[];
  reverseZones?: ReverseZone[];
  mines?: Mine[];
  pits?: StickyArea[];
  movingWalls?: MovingWall[];
  /** 좌석별 알 질량(알 무게 변화). 기본 1 */
  massBySeat?: [number, number];
}

export const DT = 1 / PHYSICS.tickHz;

export function launch(stone: Stone, angle: number, power: number): void {
  const speed = PHYSICS.maxShotSpeed * Math.sqrt(power / 100);
  stone.vx = Math.cos(angle) * speed;
  stone.vy = Math.sin(angle) * speed;
  if (power >= PHYSICS.liftPower) {
    const H = (PHYSICS.liftMaxHeight * (power - PHYSICS.liftBase)) / (100 - PHYSICS.liftBase);
    stone.vz = Math.sqrt(2 * PHYSICS.gravity * H);
    stone.airborne = true;
  }
}

/** 점이 회전한 직사각형 안인가 */
function insideObb(x: number, y: number, o: Obb): boolean {
  const [lx, ly] = rotate(x - o.cx, y - o.cy, -o.angle);
  return Math.abs(lx) <= o.halfLen && Math.abs(ly) <= o.halfThick;
}

function inPit(w: World, s: Stone): boolean {
  return (w.pits ?? []).some((p) => Math.hypot(s.x - p.cx, s.y - p.cy) <= p.radius);
}

/** 0→1 부드러운 진행 */
function smooth(u: number): number {
  return u * u * (3 - 2 * u);
}

/** 붙잡힌 알을 한 스텝 돌린다. 시간이 다 되면 멈춘다 */
function advanceOrbit(w: World, s: Stone): void {
  const o = s.orbit!;
  o.t += DT;
  const T = HAZARD_TUNING.magnetOrbitSeconds;
  if (o.t >= T - 1e-9) {
    finishOrbit(w, s);
    return;
  }
  const u = o.t / T;
  const r = o.r0 * (1 - smooth(u));
  const a = o.a0 + o.dir * 2 * Math.PI * HAZARD_TUNING.magnetOrbitTurnsPerSec * o.t;
  s.x = o.cx + Math.cos(a) * r;
  s.y = o.cy + Math.sin(a) * r;
  s.h = o.h0 * Math.max(0, 1 - o.t / 0.4);
  s.vx = s.vy = s.vz = 0;
}

/**
 * 궤도를 끝내고 중심에 세운다. 중심에 다른 알·벽이 있으면 가까운 빈자리(알 지름 간격의 육각 고리)를
 * 마지막 회전 각에서부터 찾아 겹치지 않게 둔다. 다른 알은 밀지 않는다.
 */
function finishOrbit(w: World, s: Stone): void {
  const o = s.orbit!;
  s.orbit = undefined;
  s.vx = s.vy = s.vz = 0;
  s.h = 0;
  s.airborne = false;
  const R = PHYSICS.stoneRadius;
  const gap = 2 * R + 1e-3;
  const others = w.stones.filter((t) => t !== s && t.alive && !t.airborne && !t.orbit);
  const free = (x: number, y: number) =>
    insideBoard(w.board, x, y) &&
    !others.some((t) => Math.hypot(t.x - x, t.y - y) < gap - 1e-6) &&
    !w.walls.some((wall) => circleVsObb(x, y, R, wall)) &&
    !inPit(w, { ...s, x, y });
  const aEnd =
    o.a0 +
    o.dir * 2 * Math.PI * HAZARD_TUNING.magnetOrbitTurnsPerSec * HAZARD_TUNING.magnetOrbitSeconds;
  for (let ring = 0; ring < 8; ring++) {
    const n = ring === 0 ? 1 : ring * 6;
    for (let k = 0; k < n; k++) {
      const a = aEnd + (k * 2 * Math.PI) / n;
      const x = o.cx + Math.cos(a) * ring * gap;
      const y = o.cy + Math.sin(a) * ring * gap;
      if (free(x, y)) {
        s.x = x;
        s.y = y;
        return;
      }
    }
  }
  s.x = o.cx;
  s.y = o.cy;
}

/** 고정 스텝 하나. 제거된 알의 id를 돌려준다. */
export function stepPhysics(w: World): number[] {
  const removed: number[] = [];
  const live = w.stones.filter((s) => s.alive).sort((a, b) => a.id - b.id);
  const R = PHYSICS.stoneRadius;
  // 판에 놓는 효과는 스텝 시작 때 움직이던 지면 알에만 적용한다
  const moving = new Set(
    live
      .filter((s) => !s.airborne && Math.hypot(s.vx, s.vy) >= PHYSICS.settleSpeed)
      .map((s) => s.id),
  );
  const ice = w.iceAreas ?? [];

  // 0. 자석 궤도: 붙잡힌 알은 정해진 나선을 따라 돌고 다 돌면 중심에 멈춘다
  for (const s of live) {
    if (s.orbit) advanceOrbit(w, s);
  }

  // 1. 가속(자석·중력 구역)·감속·중력, 2. 이동
  for (const s of live) {
    if (s.orbit) continue;
    // 자석·중력 구역: 움직이는 지면 알과 떠 있는 알 모두에 적용한다
    if (s.airborne || moving.has(s.id)) {
      // 자석(DEC-082): 범위에 닿으면 붙잡아 속도를 버리고 나선 궤도로 돌린다. 이 스텝의 나머지 힘은 받지 않는다
      const m = (w.magnets ?? []).find((f) => Math.hypot(f.cx - s.x, f.cy - s.y) <= f.radius);
      if (m) {
        const rx = s.x - m.cx;
        const ry = s.y - m.cy;
        s.orbit = {
          cx: m.cx,
          cy: m.cy,
          r0: Math.hypot(rx, ry),
          a0: Math.atan2(ry, rx),
          h0: Math.max(0, s.h),
          dir: rx * s.vy - ry * s.vx < 0 ? -1 : 1,
          t: 0,
        };
        s.vx = s.vy = s.vz = 0;
        s.airborne = false;
        continue;
      }
      for (const g of w.gravityZones ?? []) {
        if (insideObb(s.x, s.y, g.zone)) {
          s.vx += g.dx * HAZARD_TUNING.gravityAccel * DT;
          s.vy += g.dy * HAZARD_TUNING.gravityAccel * DT;
        }
      }
    }
    if (s.airborne) {
      s.vz -= PHYSICS.gravity * DT;
      s.h += s.vz * DT;
    } else {
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > 0) {
        const onIce = ice.some((a) => Math.hypot(s.x - a.cx, s.y - a.cy) <= a.radius);
        let decel: number = PHYSICS.friction * (onIce ? HAZARD_TUNING.iceFrictionMultiplier : 1);
        for (const a of w.stickies) {
          if (Math.hypot(s.x - a.cx, s.y - a.cy) <= a.radius) {
            decel += HAZARD_TUNING.stickyExtraFriction;
            break;
          }
        }
        const nsp = Math.max(0, sp - decel * DT);
        s.vx *= nsp / sp;
        s.vy *= nsp / sp;
      }
    }
    s.x += s.vx * DT;
    s.y += s.vy * DT;
  }

  // 붙잡혀 도는 알은 벽·알·폭탄·반전·구멍 판정에서 빠진다
  const ground = live.filter((s) => !s.airborne && !s.orbit);

  // 3. 알–벽
  for (const s of ground) {
    for (const wall of w.walls) {
      const hit = circleVsObb(s.x, s.y, R, wall);
      if (!hit) continue;
      s.x += hit.nx * hit.depth;
      s.y += hit.ny * hit.depth;
      const vn = s.vx * hit.nx + s.vy * hit.ny;
      if (vn < 0) {
        s.vx -= (1 + PHYSICS.wallRestitution) * vn * hit.nx;
        s.vy -= (1 + PHYSICS.wallRestitution) * vn * hit.ny;
      }
    }
  }

  // 3b. 알–이동 장애물: 움직이는 지면 알만. 벽 속도를 뺀 상대 속도로 반사한다. 멈춘 알은 통과한다
  for (const s of ground) {
    if (!moving.has(s.id)) continue;
    for (const mw of w.movingWalls ?? []) {
      const hit = circleVsObb(s.x, s.y, R, mw.wall);
      if (!hit) continue;
      s.x += hit.nx * hit.depth;
      s.y += hit.ny * hit.depth;
      const vn = (s.vx - mw.vx) * hit.nx + (s.vy - mw.vy) * hit.ny;
      if (vn < 0) {
        s.vx -= (1 + PHYSICS.wallRestitution) * vn * hit.nx;
        s.vy -= (1 + PHYSICS.wallRestitution) * vn * hit.ny;
      }
    }
  }

  // 4. 알–알 (지면 알끼리만, id 순). 질량비를 반영한다(알 무게 변화)
  const mass = (s: Stone) => w.massBySeat?.[s.owner] ?? 1;
  for (let i = 0; i < ground.length; i++) {
    for (let j = i + 1; j < ground.length; j++) {
      const a = ground[i]!;
      const b = ground[j]!;
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= 2 * R) continue;
      if (d === 0) {
        dx = 1;
        dy = 0;
      } else {
        dx /= d;
        dy /= d;
      }
      const ia = 1 / mass(a);
      const ib = 1 / mass(b);
      const share = ia / (ia + ib);
      const overlap = 2 * R - d;
      a.x -= dx * overlap * share;
      a.y -= dy * overlap * share;
      b.x += dx * overlap * (1 - share);
      b.y += dy * overlap * (1 - share);
      const vrel = (a.vx - b.vx) * dx + (a.vy - b.vy) * dy;
      if (vrel > 0) {
        const jn = ((1 + PHYSICS.stoneRestitution) * vrel) / (ia + ib);
        a.vx -= jn * ia * dx;
        a.vy -= jn * ia * dy;
        b.vx += jn * ib * dx;
        b.vy += jn * ib * dy;
      }
    }
  }

  // 4b. 폭탄: 움직이는 지면 알이 닿으면 폭발 반경 안의 지면 알(멈춘 알 포함)을 바깥으로 민다
  for (const mine of w.mines ?? []) {
    if (mine.exploded) continue;
    const touched = ground.some(
      (s) =>
        moving.has(s.id) &&
        Math.hypot(s.x - mine.cx, s.y - mine.cy) <= R + HAZARD_TUNING.mineRadius,
    );
    if (!touched) continue;
    mine.exploded = true;
    for (const s of ground) {
      const dx = s.x - mine.cx;
      const dy = s.y - mine.cy;
      const d = Math.hypot(dx, dy);
      if (d > HAZARD_TUNING.mineBlastRadius) continue;
      const add = HAZARD_TUNING.mineBlastSpeed * (1 - d / HAZARD_TUNING.mineBlastRadius);
      const [ux, uy] = d > 1e-9 ? [dx / d, dy / d] : [1, 0];
      s.vx += ux * add;
      s.vy += uy * add;
    }
  }

  // 4c. 방향 반전 구역: 움직이는 지면 알의 중심이 처음 들어온 스텝에 속도를 뒤집는다(구역·알마다 한 번)
  for (const z of w.reverseZones ?? []) {
    const nowInside = new Set<number>();
    for (const s of ground) {
      if (Math.hypot(s.x - z.cx, s.y - z.cy) > z.radius) continue;
      nowInside.add(s.id);
      if (moving.has(s.id) && !z.inside.has(s.id) && !z.done.has(s.id)) {
        s.vx = -s.vx;
        s.vy = -s.vy;
        z.done.add(s.id);
      }
    }
    z.inside = nowInside;
  }

  // 5. 지면 알의 판 이탈·구멍
  for (const s of ground) {
    if (!insideBoard(w.board, s.x, s.y) || inPit(w, s)) {
      s.alive = false;
      removed.push(s.id);
    }
  }

  // 6. 착지와 착지 지점의 판 이탈·구멍
  for (const s of live) {
    if (s.alive && s.airborne && s.h <= 0 && s.vz < 0) {
      s.h = 0;
      s.vz = 0;
      s.airborne = false;
      if (!insideBoard(w.board, s.x, s.y) || inPit(w, s)) {
        s.alive = false;
        removed.push(s.id);
      }
    }
  }
  return removed;
}

/** 정지 판정 대상인가: 살아 있는 모든 알이 느리고 지면에 있다 */
export function allSlow(w: World): boolean {
  for (const s of w.stones) {
    if (!s.alive) continue;
    if (s.airborne || s.orbit) return false;
    if (Math.hypot(s.vx, s.vy) >= PHYSICS.settleSpeed) return false;
  }
  return true;
}

/** 시간 상한 도달: 모든 알을 정지시키고 떠 있는 알은 그 자리에 착지시킨다. 제거된 알 id를 돌려준다. */
export function forceStop(w: World): number[] {
  const removed: number[] = [];
  for (const s of w.stones) {
    if (s.alive && s.orbit) finishOrbit(w, s);
  }
  for (const s of w.stones) {
    if (!s.alive) continue;
    s.vx = s.vy = s.vz = 0;
    if (s.airborne) {
      s.airborne = false;
      s.h = 0;
      if (!insideBoard(w.board, s.x, s.y) || inPit(w, s)) {
        s.alive = false;
        removed.push(s.id);
      }
    }
  }
  return removed;
}

export function stopAll(w: World): void {
  for (const s of w.stones) {
    s.vx = 0;
    s.vy = 0;
  }
}

/** 발사 한 번의 진행 시간과 정지 판정 누적 시간(초). 발사마다 새로 만든다 */
export interface MotionClock {
  elapsed: number;
  settle: number;
}

export type MotionOutcome = 'moving' | 'settled' | 'forced';

/**
 * 움직이는 판을 한 틱 진행하고 정지 판정을 한다: 물리 → 경과 시간 → 정지 판정 → 시간 상한.
 * 권한 측(`Game`)과 AI 미리보기(`previewShot`)가 이 함수 하나를 써서 정지 시점·결과가 어긋나지 않게 한다.
 * 정지하면 속도를 0으로(`settled`), 시간 상한이면 떠 있는 알을 착지시킨다(`forced`).
 */
export function advanceMotion(
  w: World,
  clock: MotionClock,
): { outcome: MotionOutcome; removed: number[] } {
  const removed = stepPhysics(w);
  clock.elapsed += DT;
  clock.settle = allSlow(w) ? clock.settle + DT : 0;
  if (clock.settle >= PHYSICS.settleSeconds) {
    stopAll(w);
    return { outcome: 'settled', removed };
  }
  if (clock.elapsed >= PHYSICS.maxSimSeconds) {
    removed.push(...forceStop(w));
    return { outcome: 'forced', removed };
  }
  return { outcome: 'moving', removed };
}
