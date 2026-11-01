import {
  HAZARDS,
  HAZARD_KINDS,
  HAZARD_TUNING,
  PHYSICS,
  RULES,
  type BoardDefinition,
  type BoardId,
  type CommandResult,
  type GameErrorCode,
  type GameForfeit,
  type GameOver,
  type GameView,
  type HazardGranted,
  type HazardKind,
  type HazardParams,
  type HazardTriggered,
  type HazardUse,
  type Seat,
  type ShotSubmit,
  type TurnChange,
} from '@alkkagi/shared';
import {
  boardOf,
  clampInside,
  circleVsObb,
  insideBoard,
  makeWall,
  obbCorners,
  obbOverlap,
  rotate,
  spawnPositions,
  type Obb,
} from './geometry.ts';
import { Prng, deriveSeed } from './prng.ts';
import {
  DT,
  allSlow,
  forceStop,
  launch,
  stepPhysics,
  stopAll,
  type Stone,
  type World,
} from './physics.ts';

export interface GameConfig {
  gameId: string;
  board: BoardId;
  pieceCount: number;
  /** 경기 난수 시드. 클라이언트에 보내지 않는다 */
  seed: number;
  /** 경기 시작 시각(주입한 시계 기준 ms) */
  startMs: number;
  /** 지정하지 않으면 시드 난수로 정한다 */
  firstSeat?: Seat;
}

/** 방 큐가 붙이는 명령 봉투. seat는 서버가 연결에서 변환한 값이다. */
export interface Envelope {
  seat: Seat;
  observedAtMs: number;
}

export type CoreEvent =
  | { type: 'hazard:granted'; toSeat: Seat; payload: HazardGranted }
  | { type: 'hazard:triggered'; payload: HazardTriggered }
  | { type: 'turn:change'; payload: TurnChange }
  | { type: 'game:over'; payload: GameOver };

type Phase = 'waiting' | 'aiming' | 'moving' | 'resolving' | 'finished';

interface Effect {
  id: number;
  kind: HazardKind;
  source: Seat;
  target: Seat;
  startsAtMs: number;
  expiresAtMs: number;
  params?: HazardParams;
  wall?: Obb;
  sticky?: { cx: number; cy: number; radius: number };
  blindPattern?: number;
}

interface PlayerState {
  held: { instanceId: string; kind: HazardKind; round: number } | null;
  gauge: number;
  overheated: boolean;
  cooldownEndsAtMs: number | null;
  timeoutStreak: number;
  random: { rng: Prng; grantedAtMs: number; interval: number; nextAtMs: number } | null;
}

const TICK_MS = 1000 / PHYSICS.tickHz;
const other = (s: Seat): Seat => (s === 0 ? 1 : 0);

function fail(code: GameErrorCode, message: string): CommandResult {
  return { ok: false, error: { code, message } };
}

const OK: CommandResult = { ok: true };

export class Game {
  readonly gameId: string;
  readonly boardId: BoardId;
  readonly board: BoardDefinition;
  readonly pieceCount: number;

  private readonly seed: number;
  private readonly startMs: number;
  private readonly firstSeat: Seat;
  private readonly grantRng: Prng;
  private readonly shakeRng: Prng;
  private readonly visualRng: Prng;

  private phase: Phase = 'waiting';
  private tick = 0;
  private now: number;
  private revision = 0;
  private completedTurns = 0;
  private turnCounter = 0;
  private grantCounter = 0;
  private effectCounter = 0;
  private boardRotationDeg = 0;
  private result: GameOver | null = null;

  private active: Seat = 0;
  private turnId = 0;
  private deadlineMs = 0;
  private shotCommitted = false;
  private simElapsed = 0;
  private settleTimer = 0;

  private readonly world: World;
  private effects: Effect[] = [];
  private readonly players: [PlayerState, PlayerState];
  private events: CoreEvent[] = [];

  constructor(config: GameConfig) {
    this.gameId = config.gameId;
    this.boardId = config.board;
    this.board = boardOf(config.board);
    this.pieceCount = config.pieceCount;
    this.seed = config.seed >>> 0;
    this.startMs = config.startMs;
    this.now = config.startMs;
    this.grantRng = new Prng(deriveSeed(this.seed, 1));
    this.shakeRng = new Prng(deriveSeed(this.seed, 2));
    this.visualRng = new Prng(deriveSeed(this.seed, 3));
    this.firstSeat = config.firstSeat ?? (new Prng(deriveSeed(this.seed, 4)).int(2) as Seat);

    const stones: Stone[] = [];
    let id = 0;
    for (const seat of [0, 1] as const) {
      for (const [x, y] of spawnPositions(this.board, seat, this.pieceCount)) {
        stones.push({
          id: id++,
          owner: seat,
          x,
          y,
          vx: 0,
          vy: 0,
          h: 0,
          vz: 0,
          airborne: false,
          alive: true,
        });
      }
    }
    this.world = { board: this.board, stones, walls: [], stickies: [] };
    const blank = (): PlayerState => ({
      held: null,
      gauge: 0,
      overheated: false,
      cooldownEndsAtMs: null,
      timeoutStreak: 0,
      random: null,
    });
    this.players = [blank(), blank()];
  }

  // ───────── 진행 ─────────

  /** 경기 시작: 방해요소 지급 → 첫 턴. 시작 시 phase는 waiting에서 aiming이 된다. */
  start(): void {
    if (this.phase !== 'waiting') return;
    this.revision++;
    this.grantAll(false);
    this.active = this.firstSeat;
    this.startTurn('start');
  }

  /** 주입한 시각까지 고정 틱을 진행하고 시간 기반 정산을 한다. */
  advanceTo(nowMs: number): void {
    if (this.phase === 'waiting' || this.phase === 'finished') return;
    while (this.startMs + (this.tick + 1) * TICK_MS <= nowMs + 1e-9) {
      this.tick++;
      const t = this.startMs + this.tick * TICK_MS;
      this.settleTime(t);
      if (this.isFinished) return;
      this.physicsTick();
      if (this.isFinished) return;
    }
    this.settleTime(nowMs);
  }

  /** 쌓인 이벤트를 비운다. 순서는 발생 순서다. */
  drainEvents(): CoreEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  get isFinished(): boolean {
    return this.phase === 'finished';
  }

  // ───────── 명령 ─────────

  submitShot(env: Envelope, cmd: ShotSubmit): CommandResult {
    this.advanceTo(env.observedAtMs);
    if (!(cmd.power > 0 && cmd.power <= 100) || !Number.isFinite(cmd.angle)) {
      return fail('INVALID_INPUT', '발사 값이 범위 밖이다');
    }
    if (this.phase !== 'aiming' && this.phase !== 'moving') {
      return fail('GAME_NOT_ACTIVE', '진행 중인 경기가 없다');
    }
    if (cmd.gameId !== this.gameId || cmd.turnId !== this.turnId) {
      return fail('STALE_TURN', '낡은 턴의 발사다');
    }
    if (env.seat !== this.active) return fail('NOT_YOUR_TURN', '내 턴이 아니다');
    if (this.shotCommitted) return fail('SHOT_ALREADY_SUBMITTED', '이미 발사했다');
    const stone = this.world.stones.find((s) => s.id === cmd.stoneId);
    if (!stone || !stone.alive || stone.owner !== env.seat) {
      return fail('INVALID_STONE', '쓸 수 없는 알이다');
    }
    if (this.isStunned(env.seat, env.observedAtMs)) return fail('PLAYER_STUNNED', '기절 중이다');

    launch(stone, cmd.angle, cmd.power);
    this.shotCommitted = true;
    this.players[env.seat].timeoutStreak = 0;
    this.phase = 'moving';
    this.simElapsed = 0;
    this.settleTimer = 0;
    this.revision++;
    return OK;
  }

  useHazard(env: Envelope, cmd: HazardUse): CommandResult {
    this.advanceTo(env.observedAtMs);
    if (this.phase !== 'aiming' && this.phase !== 'moving') {
      return fail('GAME_NOT_ACTIVE', '진행 중인 경기가 없다');
    }
    const p = this.players[env.seat];
    if (cmd.gameId !== this.gameId || !p.held || p.held.instanceId !== cmd.hazardInstanceId) {
      return fail('STALE_HAZARD', '보유한 방해요소가 아니다');
    }
    const meta = HAZARDS[p.held.kind];
    const now = env.observedAtMs;
    if (meta.category === 'random') return fail('HAZARD_NOT_USABLE', '직접 쓸 수 없다');
    if (meta.category === 'fatigue' && p.overheated)
      return fail('HAZARD_OVERHEATED', '과열 중이다');
    if (meta.category === 'cooldown' && p.cooldownEndsAtMs !== null && now < p.cooldownEndsAtMs) {
      return fail('HAZARD_COOLDOWN', '쿨타임 중이다');
    }

    let wall: Obb | undefined;
    let sticky: Effect['sticky'];
    if (meta.kind === 'wall') {
      const t = cmd.target;
      const step = HAZARD_TUNING.gridStep;
      const onGrid = (v: number) => Math.abs(v - Math.round(v / step) * step) <= 1e-6;
      if (!t || !t.orientation || !onGrid(t.x) || !onGrid(t.y)) {
        return fail('HAZARD_INVALID_TARGET', '벽 위치·방향이 맞지 않다');
      }
      wall = makeWall(t.x, t.y, t.orientation);
      if (!this.wallPlaceable(wall)) return fail('HAZARD_INVALID_TARGET', '벽을 놓을 수 없다');
    } else if (meta.kind === 'sticky') {
      const t = cmd.target;
      if (!t) return fail('HAZARD_INVALID_TARGET', '끈끈이 위치가 없다');
      sticky = { cx: t.x, cy: t.y, radius: HAZARD_TUNING.stickyDiameter / 2 };
      if (!this.stickyPlaceable(sticky))
        return fail('HAZARD_INVALID_TARGET', '끈끈이를 놓을 수 없다');
    }

    // ── 검증 통과: 여기서부터 상태·난수를 바꾼다 ──
    if (meta.category === 'fatigue') {
      p.gauge = Math.min(HAZARD_TUNING.fatigueMax, p.gauge + (meta.fatigueCost ?? 0));
      if (p.gauge >= HAZARD_TUNING.fatigueMax) p.overheated = true;
    } else {
      p.cooldownEndsAtMs = now + (meta.cooldownMs ?? 0);
    }
    const params: HazardParams | undefined =
      wall && cmd.target
        ? { x: wall.cx, y: wall.cy, orientation: cmd.target.orientation, angleDeg: 0 }
        : sticky
          ? { x: sticky.cx, y: sticky.cy }
          : meta.kind === 'board_spin'
            ? { angleDeg: HAZARD_TUNING.boardSpinDeg }
            : undefined;
    const eff = this.addEffect(meta.kind, env.seat, other(env.seat), now, meta.durationMs, params);
    if (wall) eff.wall = wall;
    if (sticky) eff.sticky = sticky;
    if (meta.kind === 'flashlight' || meta.kind === 'water_gun') {
      eff.blindPattern = this.visualRng.int(0x7fffffff);
    }
    this.syncWorld();
    if (meta.kind === 'board_spin') this.applyBoardSpin();
    else if (meta.kind === 'desk_shake') this.applyDeskShake();
    this.emitTriggered(eff, 'start');
    this.revision++;
    return OK;
  }

  forfeit(env: Envelope, cmd: GameForfeit): CommandResult {
    this.advanceTo(env.observedAtMs);
    if (this.phase === 'waiting' || this.phase === 'finished' || cmd.gameId !== this.gameId) {
      return fail('GAME_NOT_ACTIVE', '진행 중인 경기가 없다');
    }
    this.finish(other(env.seat), 'forfeit');
    return OK;
  }

  // ───────── 뷰 ─────────

  /** 허용 목록 방식으로 새로 만든 플레이어별 뷰. 상대 비공개 정보를 넣지 않는다. */
  getViewFor(seat: Seat): GameView {
    const now = this.now;
    const p = this.players[seat];
    const held = p.held;
    const meta = held ? HAZARDS[held.kind] : null;
    const cooldownActive = p.cooldownEndsAtMs !== null && now < p.cooldownEndsAtMs;
    const inPlay = this.phase === 'aiming' || this.phase === 'moving';
    const usable =
      !!meta &&
      inPlay &&
      meta.category !== 'random' &&
      !(meta.category === 'fatigue' && p.overheated) &&
      !(meta.category === 'cooldown' && cooldownActive);
    const blindEff = this.effects.find(
      (e) =>
        (e.kind === 'flashlight' || e.kind === 'water_gun') &&
        e.target === seat &&
        e.startsAtMs <= now &&
        now < e.expiresAtMs,
    );
    return {
      gameId: this.gameId,
      serverTick: this.tick,
      serverNowMs: now,
      revision: this.revision,
      phase: this.phase,
      turnId: this.turnId,
      round: this.round,
      activePlayerId: this.active,
      deadlineMs: this.deadlineMs,
      boardRotationDeg: this.boardRotationDeg,
      stones: this.world.stones
        .filter((s) => s.alive)
        .map((s) => ({ id: s.id, ownerId: s.owner, x: s.x, y: s.y, h: s.h })),
      effects: this.effects.map((e) => ({
        kind: e.kind,
        targetSeat: e.target,
        startsAtMs: e.startsAtMs,
        expiresAtMs: e.expiresAtMs,
        ...(e.params ? { params: { ...e.params } } : {}),
      })),
      result: this.result
        ? { ...this.result, remainingStones: [...this.result.remainingStones] }
        : null,
      private: {
        held: held
          ? { hazardInstanceId: held.instanceId, kind: held.kind, round: held.round }
          : null,
        fatigueGauge: meta?.category === 'fatigue' ? p.gauge : null,
        overheated: meta?.category === 'fatigue' ? p.overheated : false,
        cooldownEndsAtMs:
          meta?.category === 'cooldown' && cooldownActive ? p.cooldownEndsAtMs : null,
        usable,
        timeoutStreak: p.timeoutStreak,
        ...(blindEff && blindEff.blindPattern !== undefined
          ? {
              blind: {
                kind: blindEff.kind as 'flashlight' | 'water_gun',
                startsAtMs: blindEff.startsAtMs,
                expiresAtMs: blindEff.expiresAtMs,
                maxCoverage: HAZARD_TUNING.blindMaxCoverage,
                pattern: blindEff.blindPattern,
              },
            }
          : {}),
      },
    };
  }

  /** 테스트용: 난수 스트림 상태(거부된 명령이 난수를 바꾸지 않는지 확인) */
  debugPrngStates(): number[] {
    return [
      this.grantRng.state,
      this.shakeRng.state,
      this.visualRng.state,
      ...this.players.map((p) => p.random?.rng.state ?? -1),
    ];
  }

  /** 테스트용: 서버만 쓰는 내부 상태 */
  debugState() {
    return {
      phase: this.phase,
      completedTurns: this.completedTurns,
      stones: this.world.stones.map((s) => ({ ...s })),
      walls: this.world.walls.map((w) => ({ ...w })),
      players: this.players.map((p) => ({
        held: p.held ? { ...p.held } : null,
        gauge: p.gauge,
        overheated: p.overheated,
        cooldownEndsAtMs: p.cooldownEndsAtMs,
        timeoutStreak: p.timeoutStreak,
      })),
      effects: this.effects.map((e) => ({ ...e })),
    };
  }

  /** 테스트용: 알 위치를 직접 설정한다 */
  debugSetStone(id: number, x: number, y: number, alive = true, vx = 0, vy = 0): void {
    const s = this.world.stones.find((st) => st.id === id);
    if (s) Object.assign(s, { x, y, alive, vx, vy });
  }

  /** 테스트용: 보유 방해요소를 지정한다(랜덤 스트림은 정상 지급과 같은 방식으로 만든다) */
  debugGrant(seat: Seat, kind: HazardKind): void {
    this.grantOne(seat, false, kind);
  }

  // ───────── 내부: 턴·라운드 ─────────

  private get round(): number {
    return Math.floor(this.completedTurns / 2) + 1;
  }

  private startTurn(reason: TurnChange['reason']): void {
    this.turnId = ++this.turnCounter;
    this.shotCommitted = false;
    this.deadlineMs = this.now + RULES.turnSeconds * 1000;
    this.phase = 'aiming';
    this.revision++;
    this.events.push({
      type: 'turn:change',
      payload: {
        gameId: this.gameId,
        turnId: this.turnId,
        round: this.round,
        activePlayerId: this.active,
        deadlineMs: this.deadlineMs,
        serverNowMs: this.now,
        reason,
      },
    });
  }

  /** 종료 판정 → 교체 지급 → 다음 턴 주인 변경 → 새 턴 */
  private resolveTurn(reason: 'resolved' | 'timeout'): void {
    this.phase = 'resolving';
    this.completedTurns++;
    const [n0, n1] = this.remaining();
    if (n0 === 0 || n1 === 0) {
      this.finish(n0 === 0 && n1 === 0 ? null : n0 === 0 ? 1 : 0, 'all_stones_out');
      return;
    }
    if (this.completedTurns >= 2 * RULES.finalRound) {
      this.finish(n0 === n1 ? null : n0 > n1 ? 0 : 1, 'final_round');
      return;
    }
    if (
      this.completedTurns % 2 === 0 &&
      (RULES.grantRounds as readonly number[]).includes(this.round)
    ) {
      this.grantAll(true);
    }
    this.active = other(this.active);
    this.startTurn(reason);
  }

  private remaining(): [number, number] {
    const n: [number, number] = [0, 0];
    for (const s of this.world.stones) if (s.alive) n[s.owner]++;
    return n;
  }

  private finish(winner: Seat | null, reason: GameOver['reason']): void {
    if (this.phase === 'finished') return;
    this.phase = 'finished';
    this.revision++;
    this.result = {
      gameId: this.gameId,
      winnerId: winner,
      reason,
      remainingStones: this.remaining(),
      rematchDeadlineMs: null,
    };
    this.events.push({ type: 'game:over', payload: { ...this.result } });
  }

  // ───────── 내부: 시간 정산·물리 틱 ─────────

  private settleTime(t: number): void {
    if (t > this.now) this.now = t;
    // 랜덤형 자동 발동
    for (const seat of [0, 1] as const) {
      const p = this.players[seat];
      while (p.random && p.held && p.random.nextAtMs <= t) {
        this.fireRandom(seat, p.random.nextAtMs);
      }
    }
    // 효과 만료
    this.expireEffects(t);
    // 턴 마감 (정확히 마감 시각이면 시간초과가 우선)
    if (this.phase === 'aiming' && !this.shotCommitted && t >= this.deadlineMs) {
      const p = this.players[this.active];
      p.timeoutStreak++;
      if (p.timeoutStreak >= RULES.timeoutForfeitStreak) {
        this.finish(other(this.active), 'timeout_forfeit');
      } else {
        this.resolveTurn('timeout');
      }
    }
  }

  private physicsTick(): void {
    for (const p of this.players) {
      if (p.gauge > 0) {
        p.gauge = Math.max(0, p.gauge - HAZARD_TUNING.fatigueDecayPerSec * DT);
        if (p.gauge === 0) p.overheated = false;
      }
    }
    if (this.phase !== 'moving') return;
    stepPhysics(this.world);
    this.simElapsed += DT;
    this.revision++;
    this.settleTimer = allSlow(this.world) ? this.settleTimer + DT : 0;
    if (this.settleTimer >= PHYSICS.settleSeconds) {
      stopAll(this.world);
      this.resolveTurn('resolved');
    } else if (this.simElapsed >= PHYSICS.maxSimSeconds) {
      forceStop(this.world);
      this.resolveTurn('resolved');
    }
  }

  // ───────── 내부: 방해요소 ─────────

  private grantAll(replaced: boolean): void {
    for (const seat of [0, 1] as const) this.grantOne(seat, replaced);
  }

  private grantOne(seat: Seat, replaced: boolean, forceKind?: HazardKind): void {
    const p = this.players[seat];
    if (replaced) this.clearEffectsFrom(seat);
    const kind = forceKind ?? HAZARD_KINDS[this.grantRng.int(HAZARD_KINDS.length)]!;
    const instanceId = `${this.gameId}-h${++this.grantCounter}`;
    p.held = { instanceId, kind, round: this.round };
    p.gauge = 0;
    p.overheated = false;
    p.cooldownEndsAtMs = null;
    if (HAZARDS[kind].category === 'random') {
      const rng = new Prng(deriveSeed(this.seed, 100 + this.grantCounter));
      const interval = HAZARD_TUNING.randomIntervalMs;
      p.random = {
        rng,
        grantedAtMs: this.now,
        interval: 0,
        nextAtMs: this.now + rng.next() * (interval - 1000),
      };
    } else {
      p.random = null;
    }
    this.events.push({
      type: 'hazard:granted',
      toSeat: seat,
      payload: {
        gameId: this.gameId,
        hazardInstanceId: instanceId,
        kind,
        round: this.round,
        replaced,
      },
    });
  }

  private fireRandom(seat: Seat, at: number): void {
    const p = this.players[seat];
    const r = p.random!;
    const kind = p.held!.kind;
    const meta = HAZARDS[kind];
    const params: HazardParams =
      kind === 'wind'
        ? { directionRad: r.rng.next() * 2 * Math.PI }
        : { multiplier: HAZARD_TUNING.barSpeedMultiplier };
    const eff = this.addEffect(kind, seat, other(seat), at, meta.durationMs, params);
    this.emitTriggered(eff, 'start');
    r.interval++;
    r.nextAtMs =
      r.grantedAtMs +
      r.interval * HAZARD_TUNING.randomIntervalMs +
      r.rng.next() * (HAZARD_TUNING.randomIntervalMs - 1000);
    this.revision++;
  }

  private addEffect(
    kind: HazardKind,
    source: Seat,
    target: Seat,
    startsAtMs: number,
    durationMs: number,
    params?: HazardParams,
  ): Effect {
    const eff: Effect = {
      id: ++this.effectCounter,
      kind,
      source,
      target,
      startsAtMs,
      expiresAtMs: startsAtMs + durationMs,
      ...(params ? { params } : {}),
    };
    this.effects.push(eff);
    return eff;
  }

  private emitTriggered(eff: Effect, phase: 'start' | 'end'): void {
    this.events.push({
      type: 'hazard:triggered',
      payload: {
        gameId: this.gameId,
        kind: eff.kind,
        phase,
        sourceSeat: eff.source,
        targetSeat: eff.target,
        startsAtMs: eff.startsAtMs,
        expiresAtMs: eff.expiresAtMs,
        ...(eff.params ? { params: { ...eff.params } } : {}),
      },
    });
  }

  private expireEffects(t: number): void {
    const gone = this.effects.filter((e) => e.expiresAtMs <= t);
    if (gone.length === 0) return;
    this.effects = this.effects.filter((e) => e.expiresAtMs > t);
    for (const e of gone) this.emitTriggered(e, 'end');
    this.syncWorld();
    this.revision++;
  }

  /** 교체 때 이전 방해요소의 지속 효과를 지운다. 이미 판·알에 반영된 즉시 효과는 되돌리지 않는다. */
  private clearEffectsFrom(seat: Seat): void {
    const gone = this.effects.filter((e) => e.source === seat);
    if (gone.length === 0) return;
    this.effects = this.effects.filter((e) => e.source !== seat);
    for (const e of gone) this.emitTriggered({ ...e, expiresAtMs: this.now }, 'end');
    this.syncWorld();
  }

  private isStunned(seat: Seat, t: number): boolean {
    return this.effects.some(
      (e) => e.kind === 'stun' && e.target === seat && e.startsAtMs <= t && t < e.expiresAtMs,
    );
  }

  private syncWorld(): void {
    this.world.walls = this.effects.flatMap((e) => (e.wall ? [e.wall] : []));
    this.world.stickies = this.effects.flatMap((e) => (e.sticky ? [e.sticky] : []));
  }

  private groundStones(): Stone[] {
    return this.world.stones.filter((s) => s.alive && !s.airborne);
  }

  private wallPlaceable(w: Obb): boolean {
    if (!obbCorners(w).every(([x, y]) => insideBoard(this.board, x, y))) return false;
    if (this.groundStones().some((s) => circleVsObb(s.x, s.y, PHYSICS.stoneRadius, w)))
      return false;
    if (this.world.walls.some((o) => obbOverlap(w, o))) return false;
    const pseudo = (a: { cx: number; cy: number; radius: number }) =>
      circleVsObb(a.cx, a.cy, a.radius, w) !== null;
    return !this.world.stickies.some(pseudo);
  }

  private stickyPlaceable(a: { cx: number; cy: number; radius: number }): boolean {
    if (!insideBoard(this.board, a.cx, a.cy, a.radius)) return false;
    if (
      this.groundStones().some(
        (s) => Math.hypot(s.x - a.cx, s.y - a.cy) < a.radius + PHYSICS.stoneRadius,
      )
    ) {
      return false;
    }
    if (this.world.walls.some((w) => circleVsObb(a.cx, a.cy, a.radius, w))) return false;
    return !this.world.stickies.some(
      (o) => Math.hypot(o.cx - a.cx, o.cy - a.cy) < o.radius + a.radius,
    );
  }

  /** 판 중심 기준 시계 방향 회전. 알·속도·벽·끈끈이를 함께 돌리고 알을 판 안에 유지한다. */
  private applyBoardSpin(): void {
    const rad = -(HAZARD_TUNING.boardSpinDeg * Math.PI) / 180;
    for (const s of this.world.stones) {
      if (!s.alive) continue;
      [s.x, s.y] = rotate(s.x, s.y, rad);
      [s.vx, s.vy] = rotate(s.vx, s.vy, rad);
    }
    for (const e of this.effects) {
      if (e.wall) {
        [e.wall.cx, e.wall.cy] = rotate(e.wall.cx, e.wall.cy, rad);
        e.wall.angle += rad;
        if (e.params) {
          e.params.x = e.wall.cx;
          e.params.y = e.wall.cy;
          e.params.angleDeg = (e.wall.angle * 180) / Math.PI;
        }
      }
      if (e.sticky) {
        [e.sticky.cx, e.sticky.cy] = rotate(e.sticky.cx, e.sticky.cy, rad);
        if (e.params) {
          e.params.x = e.sticky.cx;
          e.params.y = e.sticky.cy;
        }
      }
    }
    this.boardRotationDeg += HAZARD_TUNING.boardSpinDeg;
    this.keepInsideAndSeparate();
  }

  /** 알마다 독립으로 방향·거리를 뽑아 옮긴다(알 id 순) */
  private applyDeskShake(): void {
    for (const s of [...this.world.stones].sort((a, b) => a.id - b.id)) {
      if (!s.alive) continue;
      const dir = this.shakeRng.next() * 2 * Math.PI;
      const dist = this.shakeRng.next() * HAZARD_TUNING.deskShakeMaxDistance;
      s.x += Math.cos(dir) * dist;
      s.y += Math.sin(dir) * dist;
    }
    this.keepInsideAndSeparate();
  }

  /** 효과로 옮긴 알을 판 안으로 되돌리고 겹침을 푼다. 이 효과 자체로 알을 제거하지 않는다. */
  private keepInsideAndSeparate(): void {
    const R = PHYSICS.stoneRadius;
    for (let pass = 0; pass < 20; pass++) {
      for (const s of this.world.stones) {
        if (s.alive) [s.x, s.y] = clampInside(this.board, s.x, s.y);
      }
      let moved = false;
      const g = this.groundStones().sort((a, b) => a.id - b.id);
      for (let i = 0; i < g.length; i++) {
        for (let j = i + 1; j < g.length; j++) {
          const a = g[i]!;
          const b = g[j]!;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d >= 2 * R - 1e-9) continue;
          if (d === 0) {
            dx = 1;
            dy = 0;
          } else {
            dx /= d;
            dy /= d;
          }
          const push = (2 * R - d) / 2 + 1e-6;
          a.x -= dx * push;
          a.y -= dy * push;
          b.x += dx * push;
          b.y += dy * push;
          moved = true;
        }
      }
      if (!moved) break;
    }
    for (const s of this.world.stones) {
      if (s.alive) [s.x, s.y] = clampInside(this.board, s.x, s.y);
    }
  }
}
