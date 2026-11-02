// 약 30Hz 스냅샷을 모아 렌더 프레임마다 짧은 지연 보간으로 알 위치를 샘플링한다.
// 판 돌리기로 좌표계가 바뀌는 스냅샷 사이는 최신 스냅샷의 좌표계로 환산해 보간하므로
// 회전 순간 알이 현(弦)을 가로지르며 튀지 않는다. React·three에 의존하지 않는다.
import { PHYSICS } from '@alkkagi/shared';
import { DEG, rotateDeg } from './scene-math.ts';

export interface SnapStone {
  id: number;
  owner: 0 | 1;
  x: number;
  y: number;
  h: number;
  /** 직전 스냅샷 대비 속도(cm/s). 그 스냅샷의 좌표계 기준 */
  vx: number;
  vy: number;
}

export interface Snapshot {
  tickMs: number;
  rotDeg: number;
  stones: SnapStone[];
  index: Map<number, number>;
}

export interface RemovedStone {
  id: number;
  owner: 0 | 1;
  /** 최신 스냅샷 좌표계 */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 이 시각(서버 틱 ms)에 사라진다 */
  atMs: number;
}

export interface SnapshotState {
  gameId: string | null;
  snaps: Snapshot[];
  pending: RemovedStone[];
  /** 렌더 시계(서버 틱 ms). 스냅샷이 없으면 NaN */
  clockMs: number;
}

export interface SampledStone {
  id: number;
  owner: 0 | 1;
  x: number;
  y: number;
  h: number;
}

/** 보간 지연(ms). 30Hz 스냅샷 간격(약 33ms)보다 약간 길다. */
export const INTERP_DELAY_MS = 45;
const MAX_SNAPS = 16;
const MAX_SPEED = 160;

export function createSnapshotState(): SnapshotState {
  return { gameId: null, snaps: [], pending: [], clockMs: Number.NaN };
}

export interface SnapshotInput {
  gameId: string;
  serverTick: number;
  boardRotationDeg: number;
  stones: ReadonlyArray<{ id: number; ownerId: 0 | 1; x: number; y: number; h: number }>;
}

export function latestSnapshot(state: SnapshotState): Snapshot | null {
  return state.snaps[state.snaps.length - 1] ?? null;
}

/** 최신 스냅샷의 판 회전(도). 없으면 0 */
export function latestRotation(state: SnapshotState): number {
  return latestSnapshot(state)?.rotDeg ?? 0;
}

/** 스냅샷을 추가한다. 오래된 틱은 버리고 같은 틱은 교체한다. 받아들였으면 true. */
export function pushSnapshot(state: SnapshotState, view: SnapshotInput): boolean {
  if (state.gameId !== view.gameId) {
    state.gameId = view.gameId;
    state.snaps.length = 0;
    state.pending.length = 0;
    state.clockMs = Number.NaN;
  }
  const tickMs = (view.serverTick * 1000) / PHYSICS.tickHz;
  let last = latestSnapshot(state);
  if (last && tickMs < last.tickMs) return false;
  if (last && tickMs === last.tickMs) {
    state.snaps.pop();
    last = latestSnapshot(state);
  }
  const dt = last ? (tickMs - last.tickMs) / 1000 : 0;
  const frameShift = last ? view.boardRotationDeg - last.rotDeg : 0;
  const stones: SnapStone[] = [];
  const index = new Map<number, number>();
  for (const s of view.stones) {
    let vx = 0;
    let vy = 0;
    const li = last?.index.get(s.id);
    const prev = li === undefined ? undefined : last?.stones[li];
    if (prev && dt > 1e-6) {
      const [px, py] = rotateDeg(prev.x, prev.y, frameShift);
      vx = (s.x - px) / dt;
      vy = (s.y - py) / dt;
      const sp = Math.hypot(vx, vy);
      if (sp > MAX_SPEED) {
        vx = (vx / sp) * MAX_SPEED;
        vy = (vy / sp) * MAX_SPEED;
      }
    }
    index.set(s.id, stones.length);
    stones.push({ id: s.id, owner: s.ownerId, x: s.x, y: s.y, h: s.h, vx, vy });
  }
  if (last) {
    for (const p of last.stones) {
      if (index.has(p.id)) continue;
      const [x, y] = rotateDeg(p.x, p.y, frameShift);
      const [vx, vy] = rotateDeg(p.vx, p.vy, frameShift);
      state.pending.push({ id: p.id, owner: p.owner, x, y, vx, vy, atMs: tickMs });
    }
  }
  state.snaps.push({ tickMs, rotDeg: view.boardRotationDeg, stones, index });
  if (state.snaps.length > MAX_SNAPS) state.snaps.splice(0, state.snaps.length - MAX_SNAPS);
  if (Number.isNaN(state.clockMs)) state.clockMs = tickMs;
  return true;
}

/**
 * 렌더 시계를 dtMs만큼 진행한다. 시계는 최신 스냅샷을 넘지 않으므로 정지하면 정확한 위치에 선다.
 * 스트림이 지연으로 뒤처지면 (최신 − 지연)까지 서서히 따라잡고, 크게 벗어나면 즉시 맞춘다.
 */
export function advanceClock(state: SnapshotState, dtMs: number, delayMs = INTERP_DELAY_MS): void {
  const last = latestSnapshot(state);
  if (!last) return;
  if (Number.isNaN(state.clockMs)) state.clockMs = last.tickMs;
  let c = state.clockMs + dtMs;
  const err = last.tickMs - delayMs - c;
  if (err > 250) c = last.tickMs - delayMs;
  else if (err > 0) c += err * 0.1;
  state.clockMs = Math.min(c, last.tickMs);
}

/** 렌더 시계가 지난 제거 알을 꺼낸다(낙하 시작용). */
export function takeDueRemovals(state: SnapshotState, out: RemovedStone[]): void {
  let w = 0;
  for (const r of state.pending) {
    if (r.atMs <= state.clockMs) out.push(r);
    else state.pending[w++] = r;
  }
  state.pending.length = w;
}

/**
 * 렌더 시계 시점의 알 위치를 out에 채우고 개수를 돌려준다(최신 스냅샷 좌표계).
 * out의 객체는 재사용한다.
 */
export function sampleStones(state: SnapshotState, out: SampledStone[]): number {
  const snaps = state.snaps;
  const last = latestSnapshot(state);
  if (!last) return 0;
  const t = state.clockMs;
  let bi = -1;
  for (let i = 0; i < snaps.length; i++) {
    const sn = snaps[i];
    if (sn && sn.tickMs > t) {
      bi = i;
      break;
    }
  }
  let n = 0;
  const put = (id: number, owner: 0 | 1, x: number, y: number, h: number) => {
    let o = out[n];
    if (!o) {
      o = { id: 0, owner: 0, x: 0, y: 0, h: 0 };
      out[n] = o;
    }
    o.id = id;
    o.owner = owner;
    o.x = x;
    o.y = y;
    o.h = h;
    n++;
  };
  const a = bi > 0 ? snaps[bi - 1] : undefined;
  const b = bi >= 0 ? snaps[bi] : undefined;
  if (!b || !a) {
    const only = !b ? last : b;
    const r = (last.rotDeg - only.rotDeg) * DEG;
    const c = Math.cos(r);
    const s = Math.sin(r);
    for (const st of only.stones)
      put(st.id, st.owner, st.x * c - st.y * s, st.x * s + st.y * c, st.h);
    return n;
  }
  const span = b.tickMs - a.tickMs;
  const alpha = span > 0 ? (t - a.tickMs) / span : 1;
  const rA = (last.rotDeg - a.rotDeg) * DEG;
  const rB = (last.rotDeg - b.rotDeg) * DEG;
  const cA = Math.cos(rA);
  const sA = Math.sin(rA);
  const cB = Math.cos(rB);
  const sB = Math.sin(rB);
  const dtA = (t - a.tickMs) / 1000;
  for (const sb of b.stones) {
    const ai = a.index.get(sb.id);
    const sa = ai === undefined ? undefined : a.stones[ai];
    const bx = sb.x * cB - sb.y * sB;
    const by = sb.x * sB + sb.y * cB;
    if (!sa) {
      put(sb.id, sb.owner, bx, by, sb.h);
      continue;
    }
    const ax = sa.x * cA - sa.y * sA;
    const ay = sa.x * sA + sa.y * cA;
    put(
      sb.id,
      sb.owner,
      ax + (bx - ax) * alpha,
      ay + (by - ay) * alpha,
      sa.h + (sb.h - sa.h) * alpha,
    );
  }
  // b에서 사라지는 알은 낙하가 시작될 때까지 직전 속도로 조금 더 나아간다.
  for (const sa of a.stones) {
    if (b.index.has(sa.id)) continue;
    const ax = sa.x * cA - sa.y * sA;
    const ay = sa.x * sA + sa.y * cA;
    const vx = sa.vx * cA - sa.vy * sA;
    const vy = sa.vx * sA + sa.vy * cA;
    put(sa.id, sa.owner, ax + vx * dtA, ay + vy * dtA, sa.h);
  }
  return n;
}
