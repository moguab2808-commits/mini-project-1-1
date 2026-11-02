import { Game, type CoreEvent, type Envelope } from '@alkkagi/game-core';
import {
  GameForfeitSchema,
  HazardUseSchema,
  PHYSICS,
  RULES,
  ShotSubmitSchema,
  type BoardId,
  type CommandResult,
  type GameForfeit,
  type GameOver,
  type GameStart,
  type GameView,
  type HazardUse,
  type Seat,
  type ShotSubmit,
} from '@alkkagi/shared';
import type {
  LeaveReason,
  RuntimeEventMap,
  RuntimeLogEntry,
  RuntimeOptions,
  GameLike,
  SendOptions,
} from './types.ts';

export const TICK_MS = 1000 / PHYSICS.tickHz;
/** 한 번에 따라잡는 최대 지연(0.25초). 넘는 지연은 버리고 `tick_skipped`로 남긴다. */
export const MAX_CATCH_UP_MS = 250;
/** 알 이동 중 스냅샷 주기: 초당 30회(GAME 전송·실행 초기값) */
export const SNAPSHOT_HZ = 30;
const SNAPSHOT_EVERY_TICKS = Math.round(PHYSICS.tickHz / SNAPSHOT_HZ);

const NOT_ACTIVE: CommandResult = {
  ok: false,
  error: { code: 'GAME_NOT_ACTIVE', message: '진행 중인 경기가 없다' },
};
const INVALID: CommandResult = {
  ok: false,
  error: { code: 'INVALID_INPUT', message: '명령 값이 올바르지 않다' },
};

export interface PlayerSeed {
  nickname: string;
  characterId: GameStart['players'][0]['characterId'];
}

export interface StartGameConfig {
  gameId: string;
  board: BoardId;
  pieceCount: number;
  /** 경기 난수 시드. 클라이언트에 보내지 않는다 */
  seed: number;
  players: [PlayerSeed, PlayerSeed];
  firstSeat?: Seat;
}

interface Queued {
  ingressSeq: number;
  observedAtMs: number;
  seat: Seat;
  kind: 'shot' | 'hazard_use' | 'forfeit';
  /** 큐에 넣을 때 이미 거부된 입력이면 결과가 들어 있다 */
  rejected?: CommandResult;
  done?: boolean;
  run: (env: Envelope) => CommandResult;
  resolve: (result: CommandResult) => void;
}

interface Sent {
  revision: number;
  phase: GameView['phase'] | null;
  tick: number;
}

/**
 * 방 하나의 경기 실행기. 명령 큐·고정 틱 스케줄러·플레이어별 뷰 배포를 맡고
 * 시계·전송·로거·종료 콜백은 주입받는다. 서버·워커가 같은 코드를 쓴다.
 *
 * - 방 단위 단일 큐: 명령마다 `ingressSeq`(재도전으로 새 경기가 시작돼도 0으로 되돌리지 않음)와
 *   `observedAtMs`를 붙이고 틱마다 순번대로 처리한다.
 * - 틱 순서: 시간 정산 → 대기 명령 → 물리 → 이벤트·뷰 전송.
 * - 틱이 `MAX_CATCH_UP_MS`보다 밀리면 넘는 시간은 버린다. 경기 시각(`gameNow`)은
 *   단조 시각에서 버린 시간을 뺀 값이라 마감·효과 만료도 같이 밀린다.
 */
export class RoomRuntime {
  private readonly opts: RuntimeOptions;
  private game: GameLike | null = null;
  private queue: Queued[] = [];
  private ingressSeq = 0;
  private skippedMs = 0;
  private lastStepMono = 0;
  private lastGameMs = 0;
  private nextTickMono = 0;
  private cancelTimer: (() => void) | null = null;
  private sent: [Sent, Sent] = [freshSent(), freshSent()];
  private inflight: Queued[] = [];
  private finished = false;
  private closed = false;
  private rematchDeadlineMs: number | null = null;

  constructor(options: RuntimeOptions) {
    this.opts = options;
  }

  /** 진행 중인 경기가 있는지(시작 커밋 이후, 종료 전) */
  get isRunning(): boolean {
    return this.game !== null && !this.finished && !this.closed;
  }

  /** 경기를 시작한다. `game:start`와 첫 이벤트를 보내고 틱을 시작한다. */
  startGame(config: StartGameConfig): void {
    if (this.closed) throw new Error('닫힌 런타임이다');
    if (this.isRunning) throw new Error('이미 진행 중인 경기가 있다');
    this.stopTimer();
    const mono = this.opts.clock.now();
    for (const q of this.queue) q.resolve(NOT_ACTIVE);
    this.queue = [];
    this.rematchDeadlineMs = null;
    this.finished = false;
    this.sent = [freshSent(), freshSent()];
    this.skippedMs = 0;
    this.lastStepMono = mono;
    this.lastGameMs = mono;
    const gameConfig = {
      gameId: config.gameId,
      board: config.board,
      pieceCount: config.pieceCount,
      seed: config.seed,
      startMs: mono,
      firstSeat: config.firstSeat,
    };
    this.game = this.opts.createGame ? this.opts.createGame(gameConfig) : new Game(gameConfig);
    this.game.start();
    this.log({ event: 'start_commit', gameId: config.gameId, result: 'ok' });

    for (const seat of [0, 1] as const) {
      const view = this.viewFor(seat);
      this.send(
        seat,
        'game:start',
        {
          gameId: config.gameId,
          seat,
          players: [
            { seat: 0, ...config.players[0] },
            { seat: 1, ...config.players[1] },
          ],
          board: config.board,
          pieceCount: config.pieceCount,
          finalRound: RULES.finalRound,
          turnSeconds: RULES.turnSeconds,
          view,
        },
        { volatile: false },
      );
      this.markSent(seat, view);
    }
    this.flushEvents();
    this.nextTickMono = mono + TICK_MS;
    this.scheduleNext();
  }

  submitShot(seat: Seat, cmd: ShotSubmit): Promise<CommandResult> {
    const parsed = ShotSubmitSchema.safeParse(cmd);
    return this.enqueue(seat, 'shot', parsed.success, (game, env) =>
      game.submitShot(env, parsed.data as ShotSubmit),
    );
  }

  useHazard(seat: Seat, cmd: HazardUse): Promise<CommandResult> {
    const parsed = HazardUseSchema.safeParse(cmd);
    return this.enqueue(seat, 'hazard_use', parsed.success, (game, env) =>
      game.useHazard(env, parsed.data as HazardUse),
    );
  }

  forfeit(seat: Seat, cmd: GameForfeit): Promise<CommandResult> {
    const parsed = GameForfeitSchema.safeParse(cmd);
    return this.enqueue(seat, 'forfeit', parsed.success, (game, env) =>
      game.forfeit(env, parsed.data as GameForfeit),
    );
  }

  /**
   * 이탈·끊김·접속 대체. 같은 큐의 기권 명령으로 처리하므로 동시 이탈은 먼저 관찰된 쪽이 진다.
   * 진행 중인 경기가 없으면(시작 커밋 전·종료 후) 기권패 없이 `GAME_NOT_ACTIVE`를 돌려준다.
   */
  leave(seat: Seat, reason: LeaveReason): Promise<CommandResult> {
    const game = this.game;
    this.log({
      event: 'leave',
      gameId: game?.gameId ?? '',
      seat,
      result: reason,
    });
    if (!game || this.finished || this.closed) return Promise.resolve(NOT_ACTIVE);
    return this.forfeit(seat, { gameId: game.gameId });
  }

  /** 타이머를 멈춘다. 방을 닫을 때 부른다. */
  dispose(): void {
    this.closed = true;
    this.stopTimer();
    for (const q of this.queue) q.resolve(NOT_ACTIVE);
    this.queue = [];
  }

  // ───────── 내부 ─────────

  private gameNow(): number {
    return this.opts.clock.now() - this.skippedMs;
  }

  private enqueue(
    seat: Seat,
    kind: Queued['kind'],
    valid: boolean,
    apply: (game: GameLike, env: Envelope) => CommandResult,
  ): Promise<CommandResult> {
    const ingressSeq = this.ingressSeq++;
    const game = this.game;
    if (!game || this.finished || this.closed) {
      this.log({
        event: kind,
        gameId: game?.gameId ?? '',
        ingressSeq,
        seat,
        result: 'GAME_NOT_ACTIVE',
      });
      return Promise.resolve(NOT_ACTIVE);
    }
    return new Promise<CommandResult>((resolve) => {
      this.queue.push({
        ingressSeq,
        observedAtMs: this.gameNow(),
        seat,
        kind,
        rejected: valid ? undefined : INVALID,
        run: (env) => apply(game, env),
        resolve,
      });
    });
  }

  private step = (): void => {
    this.cancelTimer = null;
    const game = this.game;
    if (!game || this.finished || this.closed) return;
    const mono = this.opts.clock.now();
    try {
      this.runStep(game, mono);
    } catch (error) {
      // 한 틱의 오류가 틱 루프를 멈추거나 대기 명령을 영원히 붙잡지 않게 한다.
      this.report(error);
      for (const q of this.inflight) if (!q.done) this.settle(q, NOT_ACTIVE);
    } finally {
      this.inflight = [];
      if (this.finished || this.closed) {
        this.stopTimer();
      } else {
        this.nextTickMono += TICK_MS;
        if (this.nextTickMono < mono) this.nextTickMono = mono;
        this.scheduleNext();
      }
    }
  };

  private runStep(game: GameLike, mono: number): void {
    const elapsed = mono - this.lastStepMono;
    if (elapsed > MAX_CATCH_UP_MS) {
      const dropped = elapsed - MAX_CATCH_UP_MS;
      this.skippedMs += dropped;
      this.log({
        event: 'tick_skipped',
        gameId: game.gameId,
        result: String(Math.round(dropped)),
      });
    }
    this.lastStepMono = mono;
    const now = mono - this.skippedMs;

    // 대기 명령: ingressSeq 순. 거부된 명령도 순번을 소비하지만 상태는 바꾸지 않는다.
    const queued = this.queue;
    this.queue = [];
    this.inflight = queued;
    for (const q of queued) {
      if (this.finished) {
        this.settle(q, NOT_ACTIVE);
        continue;
      }
      const observed = Math.min(Math.max(q.observedAtMs, this.lastGameMs), now);
      const result = q.rejected ?? q.run({ seat: q.seat, observedAtMs: observed });
      this.lastGameMs = observed;
      this.log({
        event: q.kind,
        gameId: game.gameId,
        ingressSeq: q.ingressSeq,
        seat: q.seat,
        result: result.ok ? 'ok' : result.error.code,
      });
      this.settle(q, result);
      this.checkFinished(game);
    }

    if (!this.finished) {
      game.advanceTo(now);
      this.lastGameMs = now;
    }
    this.flushEvents();
    this.checkFinished(game);

    this.publishViews(game);
  }

  private settle(q: Queued, result: CommandResult): void {
    q.done = true;
    q.resolve(result);
  }

  private report(error: unknown): void {
    try {
      this.opts.onError?.(error);
    } catch {
      // 오류 보고가 다시 던져도 틱 루프는 계속 돈다.
    }
  }

  private send<K extends keyof RuntimeEventMap>(
    seat: Seat,
    type: K,
    payload: RuntimeEventMap[K],
    options: SendOptions,
  ): void {
    try {
      this.opts.transport.send(seat, type, payload, options);
    } catch (error) {
      this.report(error);
    }
  }

  private checkFinished(game: GameLike): void {
    if (this.finished || !game.isFinished) return;
    this.finished = true;
  }

  private scheduleNext(): void {
    const delay = Math.max(0, this.nextTickMono - this.opts.clock.now());
    this.cancelTimer = this.opts.clock.setTimer(this.step, delay);
  }

  private stopTimer(): void {
    this.cancelTimer?.();
    this.cancelTimer = null;
  }

  /** 쌓인 코어 이벤트를 순서대로 전송·로그하고 개수를 돌려준다. 종료 이벤트가 있으면 콜백을 부른다. */
  private flushEvents(): number {
    const game = this.game;
    if (!game) return 0;
    const events = game.drainEvents();
    for (const e of events) this.deliver(game, e);
    return events.length;
  }

  private deliver(game: GameLike, e: CoreEvent): void {
    const gameId = game.gameId;
    switch (e.type) {
      case 'hazard:granted':
        this.send(e.toSeat, 'hazard:granted', e.payload, {
          volatile: false,
        });
        return;
      case 'hazard:triggered':
        this.log({ event: 'hazard_trigger', gameId, result: e.payload.kind });
        this.broadcast('hazard:triggered', e.payload);
        return;
      case 'turn:change':
        this.log({
          event: 'turn_start',
          gameId,
          turnId: e.payload.turnId,
          seat: e.payload.activePlayerId,
        });
        this.broadcast('turn:change', e.payload);
        return;
      case 'game:over': {
        const payload = this.withRematch(e.payload);
        this.log({ event: 'game_over', gameId, reason: payload.reason });
        this.broadcast('game:over', payload);
        try {
          this.opts.onFinished?.(payload);
        } catch (error) {
          this.report(error);
        }
        return;
      }
    }
  }

  private broadcast<K extends keyof RuntimeEventMap>(type: K, payload: RuntimeEventMap[K]): void {
    for (const seat of [0, 1] as const) {
      this.send(seat, type, payload, { volatile: false });
    }
  }

  private withRematch(result: GameOver): GameOver {
    const w = this.opts.rematchWindowMs;
    if (w === undefined || result.rematchDeadlineMs !== null) return result;
    this.rematchDeadlineMs ??= this.gameNow() + w;
    return { ...result, rematchDeadlineMs: this.rematchDeadlineMs };
  }

  private viewFor(seat: Seat): GameView {
    const view = this.game!.getViewFor(seat);
    return view.result ? { ...view, result: this.withRematch(view.result) } : view;
  }

  private markSent(seat: Seat, view: GameView): void {
    this.sent[seat] = {
      revision: view.revision,
      phase: view.phase,
      tick: view.serverTick,
    };
  }

  /**
   * 플레이어별 `game:state` 전송. 뷰는 보낼 때만 만든다(`meta()`로 먼저 가린다).
   * - 알 이동 중: 초당 30회 volatile. 첫 프레임은 바로 보낸다.
   * - 그 밖: revision·phase가 바뀌면 이벤트가 없어도 신뢰 전송한다. 이동이 끝나 phase가 바뀌면 최종 스냅샷이 된다.
   * - revision이 이미 보낸 것보다 작은 뷰는 보내지 않는다.
   */
  private publishViews(game: GameLike): void {
    const m = game.meta();
    const last0 = this.sent[0];
    if (m.phase === 'moving') {
      const first = last0.phase !== 'moving';
      if (!first && m.tick - last0.tick < SNAPSHOT_EVERY_TICKS) return;
    } else if (m.revision === last0.revision && m.phase === last0.phase) {
      return;
    }

    for (const seat of [0, 1] as const) {
      const view = this.viewFor(seat);
      const last = this.sent[seat];
      if (view.revision < last.revision) continue;
      const moving = view.phase === 'moving';
      this.send(seat, 'game:state', view, { volatile: moving });
      this.markSent(seat, view);
    }
  }

  private log(entry: Omit<RuntimeLogEntry, 'mono'>): void {
    const logger = this.opts.logger;
    if (!logger) return;
    const game = this.game;
    logger.log({
      mono: this.opts.clock.now(),
      serverTick: game?.meta().tick,
      ...entry,
    });
  }
}

function freshSent(): Sent {
  return { revision: -1, phase: null, tick: -Infinity };
}
