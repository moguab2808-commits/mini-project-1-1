// AI 대전의 AI 컨트롤러 (docs/design/LOCAL.md "AI 대전", docs/design/GAME.md "AI 대전").
// 자기 좌석에 오는 이벤트(자기 GameView)만 받고, 사람과 같은 명령(`shot:submit`·`hazard:use`·
// `board:rotate`·`hazard:aim`)을 같은 검증 경로로 보낸다. 조준 오차·방해요소 사용 시점은 시드 난수로 정한다.
import {
  facePoint,
  isPlacementValid,
  previewShot,
  Prng,
  reachOf,
  rotate,
  snapToWallGrid,
  wallFromParams,
  type Obb,
  type PreviewStone,
} from '@alkkagi/game-core';
import type { RuntimeClock } from '@alkkagi/game-runtime';
import {
  BOARDS,
  HAZARD_TUNING,
  HAZARDS,
  PHYSICS,
  type AimUpdate,
  type BoardDefinition,
  type BoardRotate,
  type CommandResult,
  type GameStart,
  type GameView,
  type HazardAim,
  type HazardTarget,
  type HazardUse,
  type Seat,
  type ShotSubmit,
} from '@alkkagi/shared';
import type { GameEventMap } from '../session/game-session.ts';

/** AI가 쓰는 명령. 사람의 `GameSession`과 같은 명령·검증을 거친다 */
export interface AiActions {
  submitShot(cmd: ShotSubmit): Promise<CommandResult>;
  useHazard(cmd: HazardUse): Promise<CommandResult>;
  rotateBoard(cmd: BoardRotate): Promise<CommandResult>;
  aimHazard(cmd: HazardAim): void;
  sendAim(update: AimUpdate): void;
}

/** 1단계(보통) 수치. 기본값은 GAME.md "AI 대전" 초기값이다 */
export interface AiTuning {
  /** 턴 시작 후 발사까지 조준 시간 범위(ms) */
  aimDelayMinMs: number;
  aimDelayMaxMs: number;
  /** 각도 오차 표준편차(°) */
  angleSigmaDeg: number;
  /** 세기 오차 균등 범위(±) */
  powerJitter: number;
  /** 사람 턴 시작 후 방해요소를 쓰는 시각 범위(ms). 턴 마감 1초 전을 넘지 않는다 */
  hazardDelayMinMs: number;
  hazardDelayMaxMs: number;
  /** 후레쉬·물총을 유지하는 시간 범위(ms) */
  blindHoldMinMs: number;
  blindHoldMaxMs: number;
}

export const DEFAULT_AI_TUNING: AiTuning = {
  aimDelayMinMs: 1500,
  aimDelayMaxMs: 3000,
  angleSigmaDeg: 4,
  powerJitter: 8,
  hazardDelayMinMs: 1000,
  hazardDelayMaxMs: 8000,
  blindHoldMinMs: 1500,
  blindHoldMaxMs: 3500,
};

/** 후보 세기. 떠오름 세기(80) 아래로 두어 오차를 더해도 지면으로 친다 */
const CANDIDATE_POWERS = [20, 30, 45, 60, 70] as const;
/** 판 돌리기 후보(°). 0°에서 떨어뜨릴 알이 없을 때만 본다 */
const ROTATION_CANDIDATES = [45, -45, 90, -90, 180] as const;
/** 한 번에 보내는 기본 판 돌리기 각과 간격. 권한 측 한도(초당 90° + 15°) 안이다 */
const ROTATE_STEP_DEG = 15;
const ROTATE_STEP_MS = 170;
/** 한 턴에 판을 돌리는 최대 횟수 */
const MAX_ROTATIONS_PER_TURN = 2;
/** 남은 시간이 이보다 적으면 돌리지 않고 바로 친다 */
const MIN_TIME_TO_ROTATE_MS = 6000;
const BLIND_AIM_EVERY_MS = 100;
const RETRY_MS = 300;

export interface AiShotPlan {
  /** 먼저 돌릴 판 각도(°). 0이면 바로 친다 */
  rotateDeg: number;
  stoneId: number;
  angle: number;
  power: number;
  score: number;
}

export interface AiControllerOptions {
  seat: Seat;
  actions: AiActions;
  clock: RuntimeClock;
  seed: number;
  tuning?: Partial<AiTuning>;
  onError?: (error: unknown) => void;
}

type Timer = () => void;

export class AiController {
  private readonly seat: Seat;
  private readonly actions: AiActions;
  private readonly clock: RuntimeClock;
  private readonly rng: Prng;
  private readonly tuning: AiTuning;
  private readonly onError?: (error: unknown) => void;
  private start: GameStart | null = null;
  private view: GameView | null = null;
  /** 발사 계획을 세운 턴 */
  private shotTurn: { gameId: string; turnId: number } | null = null;
  private rotations = 0;
  /** 방해요소 사용을 계획한 사람 턴 */
  private hazardTurn: { gameId: string; turnId: number } | null = null;
  private readonly timers = new Set<Timer>();
  private disposed = false;

  constructor(options: AiControllerOptions) {
    this.seat = options.seat;
    this.actions = options.actions;
    this.clock = options.clock;
    this.rng = new Prng(options.seed);
    this.tuning = { ...DEFAULT_AI_TUNING, ...options.tuning };
    this.onError = options.onError;
  }

  /** 자기 좌석에 온 이벤트. 권한 측 전송이 이 좌석에만 보낸 것만 들어온다 */
  receive<K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]): void {
    if (this.disposed) return;
    if (type === 'game:start') {
      const start = payload as GameStart;
      this.clearTimers();
      this.start = start;
      this.shotTurn = null;
      this.hazardTurn = null;
      this.onView(start.view);
    } else if (type === 'game:state') {
      this.onView(payload as GameView);
    } else if (type === 'game:over') {
      this.clearTimers();
    }
  }

  dispose(): void {
    this.disposed = true;
    this.clearTimers();
  }

  // ───────── 턴 판단 ─────────

  private onView(view: GameView): void {
    if (!this.start || view.gameId !== this.start.gameId) return;
    this.view = view;
    if (view.phase !== 'aiming' || view.result) return;
    const turn = { gameId: view.gameId, turnId: view.turnId };
    if (view.activePlayerId === this.seat) {
      if (!sameTurn(this.shotTurn, turn)) {
        this.shotTurn = turn;
        this.rotations = 0;
        this.later(this.uniform(this.tuning.aimDelayMinMs, this.tuning.aimDelayMaxMs), () => {
          this.think(turn);
        });
      }
    } else if (!sameTurn(this.hazardTurn, turn)) {
      this.hazardTurn = turn;
      this.planHazard(view, turn);
    }
  }

  private isCurrent(turn: { gameId: string; turnId: number }, phase?: GameView['phase']): boolean {
    const v = this.view;
    return (
      !this.disposed &&
      v !== null &&
      v.result === null &&
      v.gameId === turn.gameId &&
      v.turnId === turn.turnId &&
      (phase === undefined || v.phase === phase)
    );
  }

  private think(turn: { gameId: string; turnId: number }): void {
    if (!this.isCurrent(turn, 'aiming') || this.view!.activePlayerId !== this.seat) return;
    const view = this.view!;
    const stunUntil = this.stunnedUntil(view);
    if (stunUntil !== null) {
      this.later(stunUntil - view.serverNowMs + 50, () => {
        this.think(turn);
      });
      return;
    }
    const remaining = view.deadlineMs - view.serverNowMs;
    const allowRotate =
      this.rotations < MAX_ROTATIONS_PER_TURN && remaining > MIN_TIME_TO_ROTATE_MS;
    const plan = planShot(view, this.boardDef(), this.seat, allowRotate, this.tuning);
    if (!plan) return; // 칠 알이 없다: 시간초과로 넘어간다
    if (plan.rotateDeg !== 0) {
      this.rotations += 1;
      void this.rotateBy(turn, plan.rotateDeg).then(() => {
        this.later(RETRY_MS, () => {
          this.think(turn);
        });
      });
      return;
    }
    this.fire(turn, plan);
  }

  private fire(turn: { gameId: string; turnId: number }, plan: AiShotPlan): void {
    const angle = wrapAngle(plan.angle + this.gaussian() * deg(this.tuning.angleSigmaDeg));
    const power = clamp(
      plan.power + this.uniform(-this.tuning.powerJitter, this.tuning.powerJitter),
      1,
      100,
    );
    this.actions.sendAim({
      gameId: turn.gameId,
      mode: 'charge',
      stoneId: plan.stoneId,
      angle,
      power,
      pull: power / 100,
    });
    void this.actions
      .submitShot({ gameId: turn.gameId, turnId: turn.turnId, stoneId: plan.stoneId, angle, power })
      .then((result) => {
        this.actions.sendAim({ gameId: turn.gameId, mode: 'idle' });
        if (result.ok) return;
        // 기절이 막 걸렸거나 판이 움직였다: 잠시 뒤 다시 판단한다
        if (result.error.code === 'PLAYER_STUNNED' || result.error.code === 'OUT_OF_REACH') {
          this.later(RETRY_MS, () => {
            this.think(turn);
          });
        }
      }, this.onError);
  }

  /** 기본 판 돌리기를 한도 안의 작은 각으로 나눠 보낸다 */
  private async rotateBy(
    turn: { gameId: string; turnId: number },
    totalDeg: number,
  ): Promise<void> {
    let left = totalDeg;
    this.actions.sendAim({ gameId: turn.gameId, mode: 'rotate' });
    while (Math.abs(left) > 1e-9 && this.isCurrent(turn, 'aiming')) {
      const delta = Math.sign(left) * Math.min(ROTATE_STEP_DEG, Math.abs(left));
      const result = await this.actions.rotateBoard({
        gameId: turn.gameId,
        turnId: turn.turnId,
        deltaDeg: delta,
      });
      if (!result.ok) break;
      left -= delta;
      if (Math.abs(left) > 1e-9) await this.wait(ROTATE_STEP_MS);
    }
    this.actions.sendAim({ gameId: turn.gameId, mode: 'idle' });
  }

  // ───────── 방해요소 ─────────

  /** 사람 턴 중 무작위 시각에 보유한 방해요소를 쓴다(사용 가능할 때) */
  private planHazard(view: GameView, turn: { gameId: string; turnId: number }): void {
    const held = view.private.held;
    if (!held || HAZARDS[held.kind].category === 'random') return;
    const latest = view.deadlineMs - view.serverNowMs - 1000;
    if (latest <= 0) return;
    const delay = Math.min(
      latest,
      this.uniform(this.tuning.hazardDelayMinMs, this.tuning.hazardDelayMaxMs),
    );
    this.later(delay, () => {
      this.useHazard(turn);
    });
  }

  private useHazard(turn: { gameId: string; turnId: number }): void {
    if (!this.isCurrent(turn)) return;
    const view = this.view!;
    if (view.activePlayerId === this.seat || view.phase === 'finished') return;
    const held = view.private.held;
    if (!held || !view.private.usable) return;
    const base = { gameId: view.gameId, hazardInstanceId: held.hazardInstanceId };
    const kind = held.kind;
    if (kind === 'flashlight' || kind === 'water_gun') {
      this.holdBlind(base, kind);
      return;
    }
    let cmd: HazardUse = base;
    if (kind === 'board_spin') {
      cmd = { ...base, direction: this.rng.next() < 0.5 ? -1 : 1 };
    } else if (kind === 'wall' || kind === 'sticky') {
      const target = placementTarget(view, this.boardDef(), this.seat, kind, this.rng);
      if (!target) return;
      cmd = { ...base, target };
    }
    void this.actions.useHazard(cmd).catch(this.onError);
  }

  /** 후레쉬·물총: 상대 얼굴 쪽을 조준해 발동하고 잠시 유지한 뒤 놓는다 */
  private holdBlind(
    base: { gameId: string; hazardInstanceId: string },
    kind: 'flashlight' | 'water_gun',
  ): void {
    const face = facePoint(other(this.seat));
    const aimPoint = () => ({
      x: face.x + this.gaussian() * 1.2,
      y: face.y,
      h: face.h + this.gaussian() * 1.2,
    });
    const first = aimPoint();
    const holdMs = this.uniform(this.tuning.blindHoldMinMs, this.tuning.blindHoldMaxMs);
    this.actions.sendAim({ gameId: base.gameId, mode: 'hold_hazard', kind, target: first });
    void this.actions.useHazard({ ...base, target: first }).then((result) => {
      if (!result.ok) {
        this.actions.sendAim({ gameId: base.gameId, mode: 'idle' });
        return;
      }
      const endAt = this.clock.now() + holdMs;
      const tick = (): void => {
        if (this.disposed || !this.view || this.view.gameId !== base.gameId || this.view.result) {
          return;
        }
        if (this.clock.now() >= endAt) {
          this.actions.aimHazard({ ...base, target: aimPoint(), active: false });
          this.actions.sendAim({ gameId: base.gameId, mode: 'idle' });
          return;
        }
        const target = aimPoint();
        this.actions.aimHazard({ ...base, target, active: true });
        this.actions.sendAim({ gameId: base.gameId, mode: 'hold_hazard', kind, target });
        this.later(BLIND_AIM_EVERY_MS, tick);
      };
      this.later(BLIND_AIM_EVERY_MS, tick);
    }, this.onError);
  }

  // ───────── 보조 ─────────

  private boardDef(): BoardDefinition {
    return BOARDS[this.start!.board];
  }

  private stunnedUntil(view: GameView): number | null {
    let until: number | null = null;
    for (const e of view.effects) {
      if (
        e.kind === 'stun' &&
        e.targetSeat === this.seat &&
        e.startsAtMs <= view.serverNowMs &&
        view.serverNowMs < e.expiresAtMs
      ) {
        until = Math.max(until ?? 0, e.expiresAtMs);
      }
    }
    return until;
  }

  private uniform(min: number, max: number): number {
    return min + this.rng.next() * (max - min);
  }

  /** 표준정규분포(Box–Muller) */
  private gaussian(): number {
    const u = 1 - this.rng.next();
    const v = this.rng.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  private later(delayMs: number, fn: () => void): void {
    const cancel = this.clock.setTimer(
      () => {
        this.timers.delete(cancel);
        if (this.disposed) return;
        try {
          fn();
        } catch (error) {
          this.onError?.(error);
        }
      },
      Math.max(0, delayMs),
    );
    this.timers.add(cancel);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.later(ms, resolve);
    });
  }

  private clearTimers(): void {
    for (const cancel of this.timers) cancel();
    this.timers.clear();
  }
}

// ───────── 순수 계산(테스트 대상) ─────────

interface Field {
  stones: PreviewStone[];
  walls: Obb[];
  stickies: Array<{ x: number; y: number }>;
}

function fieldOf(view: GameView): Field {
  const walls: Obb[] = [];
  const stickies: Array<{ x: number; y: number }> = [];
  for (const e of view.effects) {
    if (e.expiresAtMs <= view.serverNowMs || !e.params) continue;
    if (e.kind === 'wall') {
      const w = wallFromParams(e.params);
      if (w) walls.push(w);
    } else if (e.kind === 'sticky' && e.params.x !== undefined && e.params.y !== undefined) {
      stickies.push({ x: e.params.x, y: e.params.y });
    }
  }
  return {
    stones: view.stones
      .filter((s) => s.h <= 0)
      .map((s) => ({ id: s.id, ownerId: s.ownerId, x: s.x, y: s.y })),
    walls,
    stickies,
  };
}

function rotateField(field: Field, degrees: number): Field {
  if (degrees === 0) return field;
  const rad = deg(degrees);
  return {
    stones: field.stones.map((s) => {
      const [x, y] = rotate(s.x, s.y, rad);
      return { ...s, x, y };
    }),
    walls: field.walls.map((w) => {
      const [cx, cy] = rotate(w.cx, w.cy, rad);
      return { ...w, cx, cy, angle: w.angle + rad };
    }),
    stickies: field.stickies.map((s) => {
      const [x, y] = rotate(s.x, s.y, rad);
      return { x, y };
    }),
  };
}

/** 판 가장자리까지 거리(cm). 작을수록 떨어지기 쉽다 */
function edgeDistance(board: BoardDefinition, x: number, y: number): number {
  if (board.shape === 'square') return board.size / 2 - Math.max(Math.abs(x), Math.abs(y));
  return board.diameter / 2 - Math.hypot(x, y);
}

function boardHalf(board: BoardDefinition): number {
  return board.shape === 'square' ? board.size / 2 : board.diameter / 2;
}

/** 계획 오차: 조준 오차를 감안해 평가한다 */
export interface PlanNoise {
  angleSigmaDeg: number;
  powerJitter: number;
}

/** 오차 없이 평가한 상위 후보 중 이만큼만 오차 표본으로 다시 평가한다 */
const ROBUST_TOP_K = 12;
/** 이 기대 점수 이상이면 판을 돌려 보지 않고 바로 친다(상대 알 하나를 꽤 확실히 떨어뜨림) */
const GOOD_ENOUGH_SCORE = 6;

/**
 * 자기 뷰로 이번 턴의 발사를 고른다. 손 닿는 내 알 × 상대 알 × 후보 세기를 같은 물리로 미리 돌려
 * 상대 알을 많이 떨어뜨리고 내 알을 덜 잃는 발사를 고른다. 상위 후보는 조준 오차(각도 ±σ, 세기 ±폭)를
 * 더한 표본의 평균 점수로 다시 평가해 빗나가면 내 알이 떨어지는 무리한 발사를 피한다.
 * 0°에서 마땅한 발사가 없거나 칠 알이 없으면 `allowRotate`일 때 판을 돌린 경우도 본다.
 * 칠 수 있는 알이 전혀 없으면 null이다.
 */
export function planShot(
  view: GameView,
  board: BoardDefinition,
  seat: Seat,
  allowRotate: boolean,
  noise: PlanNoise = DEFAULT_AI_TUNING,
): AiShotPlan | null {
  const base = fieldOf(view);
  const best = bestAt(base, board, seat, 0, noise);
  if (best && best.score >= GOOD_ENOUGH_SCORE) return best;
  if (!allowRotate) return best;
  let chosen = best;
  for (const rot of ROTATION_CANDIDATES) {
    const plan = bestAt(rotateField(base, rot), board, seat, rot, noise);
    if (plan && (!chosen || plan.score > chosen.score)) chosen = plan;
  }
  return chosen;
}

function bestAt(
  field: Field,
  board: BoardDefinition,
  seat: Seat,
  rot: number,
  noise: PlanNoise,
): AiShotPlan | null {
  const mine = field.stones.filter((s) => s.ownerId === seat && reachOf(seat, s.x, s.y).reachable);
  const theirs = field.stones.filter((s) => s.ownerId !== seat);
  if (mine.length === 0) return null;
  // 돌리는 데 드는 시간·위험만큼 조금 깎는다
  const penalty = (Math.abs(rot) / 45) * 1.5;
  const evaluate = (stoneId: number, angle: number, power: number): number => {
    const result = previewShot({
      board,
      stones: field.stones,
      walls: field.walls,
      stickies: field.stickies,
      stoneId,
      angle,
      power,
    });
    return scoreOf(result.stones, result.removed, field.stones, board, seat);
  };
  const candidates: Array<{ stoneId: number; angle: number; power: number; score: number }> = [];
  for (const s of mine) {
    const shots =
      theirs.length === 0
        ? // 상대 알이 없으면(경기 끝 직전) 판 중심 쪽으로 약하게 친다
          [{ angle: Math.atan2(-s.y, -s.x), power: CANDIDATE_POWERS[0] as number }]
        : theirs.flatMap((o) =>
            CANDIDATE_POWERS.map((power) => ({ angle: Math.atan2(o.y - s.y, o.x - s.x), power })),
          );
    for (const shot of shots) {
      candidates.push({ stoneId: s.id, ...shot, score: evaluate(s.id, shot.angle, shot.power) });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const da = deg(noise.angleSigmaDeg);
  const dp = noise.powerJitter;
  const samples: Array<[number, number]> = [
    [0, 0],
    [da, 0],
    [-da, 0],
    [2 * da, 0],
    [-2 * da, 0],
    [0, dp],
    [0, -dp],
  ];
  let best: AiShotPlan | null = null;
  for (const c of candidates.slice(0, ROBUST_TOP_K)) {
    let sum = c.score;
    for (const [a, p] of samples.slice(1)) {
      sum += evaluate(c.stoneId, wrapAngle(c.angle + a), clamp(c.power + p, 1, 100));
    }
    const score = sum / samples.length - penalty;
    if (!best || score > best.score) {
      best = { rotateDeg: rot, stoneId: c.stoneId, angle: c.angle, power: c.power, score };
    }
  }
  return best;
}

function scoreOf(
  after: PreviewStone[],
  removed: number[],
  before: PreviewStone[],
  board: BoardDefinition,
  seat: Seat,
): number {
  const owner = new Map(before.map((s) => [s.id, s.ownerId]));
  let score = 0;
  for (const id of removed) score += owner.get(id) === seat ? -12 : 10;
  // 동점 정리: 남은 상대 알은 가장자리에 가까울수록, 내 알은 안쪽일수록 좋다
  const half = boardHalf(board);
  for (const s of after) {
    const closeness = 1 - clamp(edgeDistance(board, s.x, s.y) / half, 0, 1);
    score += s.ownerId === seat ? -0.5 * closeness : closeness;
  }
  return score;
}

/**
 * 벽·끈끈이 위치: 내 알에서 가장 가까운 상대 알 쪽으로 조금 떨어진 빈 자리 후보 중 무작위.
 * 벽은 격자에 스냅하고 그 방향을 가로막도록 놓는다. 놓을 곳이 없으면 null이다.
 */
export function placementTarget(
  view: GameView,
  board: BoardDefinition,
  seat: Seat,
  kind: 'wall' | 'sticky',
  rng: Prng,
): HazardTarget | null {
  const field = fieldOf(view);
  const world = {
    board,
    stones: field.stones,
    walls: field.walls,
    stickies: field.stickies.map((s) => ({
      cx: s.x,
      cy: s.y,
      radius: HAZARD_TUNING.stickyDiameter / 2,
    })),
  };
  const mine = field.stones.filter((s) => s.ownerId === seat);
  const theirs = field.stones.filter((s) => s.ownerId !== seat);
  const candidates: HazardTarget[] = [];
  const gap =
    kind === 'wall'
      ? 2 * PHYSICS.stoneRadius + HAZARD_TUNING.wallThickness
      : HAZARD_TUNING.stickyDiameter / 2 + PHYSICS.stoneRadius + 0.2;
  for (const s of mine) {
    const threat = nearest(s, theirs) ?? { x: -s.x, y: -s.y };
    const dx = threat.x - s.x;
    const dy = threat.y - s.y;
    const len = Math.hypot(dx, dy) || 1;
    const x = s.x + (dx / len) * gap;
    const y = s.y + (dy / len) * gap;
    if (kind === 'wall') {
      const orientation = Math.abs(dx) > Math.abs(dy) ? 'vertical' : 'horizontal';
      const gx = snapToWallGrid(x);
      const gy = snapToWallGrid(y);
      if (isPlacementValid('wall', gx, gy, orientation, world)) {
        candidates.push({ x: gx, y: gy, orientation });
      }
    } else if (isPlacementValid('sticky', x, y, 'horizontal', world)) {
      candidates.push({ x, y });
    }
  }
  if (candidates.length === 0) return null;
  return candidates[rng.int(candidates.length)]!;
}

function nearest<T extends { x: number; y: number }>(
  p: { x: number; y: number },
  list: T[],
): T | null {
  let best: T | null = null;
  let bestD = Infinity;
  for (const q of list) {
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bestD) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

function sameTurn(
  a: { gameId: string; turnId: number } | null,
  b: { gameId: string; turnId: number },
): boolean {
  return a !== null && a.gameId === b.gameId && a.turnId === b.turnId;
}

const other = (seat: Seat): Seat => (seat === 0 ? 1 : 0);
const deg = (d: number): number => (d * Math.PI) / 180;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** (−π, π]로 맞춘다 */
function wrapAngle(a: number): number {
  let r = a % (2 * Math.PI);
  if (r <= -Math.PI) r += 2 * Math.PI;
  if (r > Math.PI) r -= 2 * Math.PI;
  return r;
}
