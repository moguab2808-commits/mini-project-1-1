import { HAZARD_TUNING, PHYSICS, type BoardDefinition, type Seat } from '@alkkagi/shared';
import { circleVsObb, insideBoard, type Obb } from './geometry.ts';

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
}

export interface StickyArea {
  cx: number;
  cy: number;
  radius: number;
}

export interface World {
  board: BoardDefinition;
  stones: Stone[];
  walls: Obb[];
  stickies: StickyArea[];
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

/** 고정 스텝 하나. 제거된 알의 id를 돌려준다. */
export function stepPhysics(w: World): number[] {
  const removed: number[] = [];
  const live = w.stones.filter((s) => s.alive).sort((a, b) => a.id - b.id);
  const R = PHYSICS.stoneRadius;

  // 1. 감속·중력, 2. 이동
  for (const s of live) {
    if (s.airborne) {
      s.vz -= PHYSICS.gravity * DT;
      s.h += s.vz * DT;
    } else {
      const sp = Math.hypot(s.vx, s.vy);
      if (sp > 0) {
        let decel: number = PHYSICS.friction;
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

  const ground = live.filter((s) => !s.airborne);

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

  // 4. 알–알 (지면 알끼리만, id 순)
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
      const overlap = 2 * R - d;
      a.x -= (dx * overlap) / 2;
      a.y -= (dy * overlap) / 2;
      b.x += (dx * overlap) / 2;
      b.y += (dy * overlap) / 2;
      const vrel = (a.vx - b.vx) * dx + (a.vy - b.vy) * dy;
      if (vrel > 0) {
        const j2 = ((1 + PHYSICS.stoneRestitution) * vrel) / 2;
        a.vx -= j2 * dx;
        a.vy -= j2 * dy;
        b.vx += j2 * dx;
        b.vy += j2 * dy;
      }
    }
  }

  // 5. 지면 알의 판 이탈
  for (const s of ground) {
    if (!insideBoard(w.board, s.x, s.y)) {
      s.alive = false;
      removed.push(s.id);
    }
  }

  // 6. 착지와 착지 지점의 판 이탈
  for (const s of live) {
    if (s.alive && s.airborne && s.h <= 0 && s.vz < 0) {
      s.h = 0;
      s.vz = 0;
      s.airborne = false;
      if (!insideBoard(w.board, s.x, s.y)) {
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
    if (s.airborne) return false;
    if (Math.hypot(s.vx, s.vy) >= PHYSICS.settleSpeed) return false;
  }
  return true;
}

/** 시간 상한 도달: 모든 알을 정지시키고 떠 있는 알은 그 자리에 착지시킨다. 제거된 알 id를 돌려준다. */
export function forceStop(w: World): number[] {
  const removed: number[] = [];
  for (const s of w.stones) {
    if (!s.alive) continue;
    s.vx = s.vy = s.vz = 0;
    if (s.airborne) {
      s.airborne = false;
      s.h = 0;
      if (!insideBoard(w.board, s.x, s.y)) {
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
