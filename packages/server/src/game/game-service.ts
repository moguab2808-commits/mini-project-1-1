// 온라인 대전 서버(IMPL-009). 방마다 `RoomRuntime` 하나를 두고 Socket.IO 전송·서버 시계·사용자↔좌석 맵을
// 주입해 경기를 진행한다. 이탈·접속 대체의 기권패 변환, 재도전 15초, 서버 로그를 맡는다.
// 경기 종료 처리(전적 저장 등)는 `onFinished` 옵션이며 경기당 한 번만(`finishOnce`) 불린다.
// 방(DB) 규칙은 RoomService가 가지며, 이 서비스는 `RoomHooks`(onStarted·onLeave)로 끼어든다.
import { randomInt, randomUUID } from 'node:crypto';
import {
  RoomRuntime,
  type LeaveReason,
  type RuntimeClock,
  type RuntimeEventMap,
} from '@alkkagi/game-runtime';
import {
  RematchRequestSchema,
  type BoardId,
  type CharacterId,
  type CommandResult,
  type GameOver,
  type RematchState,
  type Seat,
} from '@alkkagi/shared';
import type { ConnectionRegistry } from '../realtime/connections.ts';
import type { LeaveOptions, RoomHooks } from '../rooms/room-service.ts';
import type { RoomView } from '../rooms/room-store.ts';
import { stdoutSink, toLogLine, type GameLogSink } from './game-log.ts';

/** 재도전 대기 시간. 결과 화면에서 이 시간 안에 누르지 않으면 나가기와 같게 처리한다(PRD 게임 화면). */
export const REMATCH_WINDOW_MS = 15_000;
/** 시작 커밋 직후 이탈이 경기 생성을 기다리는 최대 시간. 경기 생성은 보통 즉시 끝난다. */
const START_WAIT_MS = 5_000;

const NOT_ACTIVE: CommandResult = {
  ok: false,
  error: { code: 'GAME_NOT_ACTIVE', message: '진행 중인 경기가 없다' },
};
const INVALID: CommandResult = {
  ok: false,
  error: { code: 'INVALID_INPUT', message: '명령 값이 올바르지 않다' },
};
const REMATCH_NOT_AVAILABLE: CommandResult = {
  ok: false,
  error: { code: 'REMATCH_NOT_AVAILABLE', message: '재도전할 수 없다' },
};
const INTERNAL: CommandResult = {
  ok: false,
  error: { code: 'INTERNAL_ERROR', message: '서버에서 오류가 발생했다' },
};
const OK: CommandResult = { ok: true };

const realClock: RuntimeClock = {
  now: () => Math.round(performance.timeOrigin + performance.now()),
  setTimer: (callback, delayMs) => {
    const id = setTimeout(callback, delayMs);
    return () => {
      clearTimeout(id);
    };
  },
};

type Player = { nickname: string; characterId: CharacterId };
type Rematch = {
  gameId: string;
  deadlineMs: number;
  requested: [boolean, boolean];
  cancel: () => void;
};
type Deferred = { promise: Promise<void>; resolve: () => void };

/** `idle`: 진행 중인 경기가 없다(시작 전·참여자가 나가 대기). `over`: 결과 화면(재도전 대기)이다. */
type Phase = 'idle' | 'running' | 'over';

interface Session {
  readonly roomId: number;
  runtime: RoomRuntime;
  phase: Phase;
  /** 좌석 0은 방장, 1은 참여자. 사용자 번호는 서버 안에서만 쓰고 이벤트에 싣지 않는다(DEC-030) */
  userIds: [number | null, number | null];
  players: [Player, Player] | null;
  config: { board: BoardId; pieceCount: number } | null;
  /** 시작 커밋 뒤 경기 생성이 끝났는가. 그 사이의 이탈이 기다린다 */
  started: Deferred;
  /** `finishOnce`: 종료 처리 전에 경기 id를 넣어 같은 경기를 두 번 처리하지 않는다 */
  finishedGames: Set<string>;
  /** 경기 종료 처리(`onFinished`). 기권패 처리 뒤 방을 정리하기 전에 끝까지 기다린다 */
  finishing: Promise<void>;
  rematch: Rematch | null;
}

export type GameServiceOptions = {
  registry: ConnectionRegistry;
  /** 재도전 만료 때 누르지 않은 사람을 나가기와 같게 처리한다. 사용자별 직렬화는 호출한 쪽이 맡는다. */
  leaveRoom: (userId: number, options: LeaveOptions) => Promise<void>;
  /**
   * 경기가 끝났다(정상 종료·기권·시간초과). 전적 저장이 끼는 자리이며 경기당 한 번만 불린다.
   * 이탈로 끝난 경기는 이 처리가 끝난 뒤에 방을 정리한다(DATABASE 방 생명주기). 던져도 방 정리는 계속된다.
   */
  onFinished?: (info: FinishedGame) => Promise<void> | void;
  clock?: RuntimeClock;
  logSink?: GameLogSink;
  rematchWindowMs?: number;
  onError?: (error: unknown) => void;
};

export type FinishedGame = {
  roomId: number;
  /** 좌석 0(방장)·1(참여자)의 사용자 번호 */
  userIds: [number, number];
  result: GameOver;
};

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

export class GameService {
  readonly #opts: GameServiceOptions;
  readonly #clock: RuntimeClock;
  readonly #sink: GameLogSink;
  readonly #sessions = new Map<number, Session>();
  readonly #byUser = new Map<number, { session: Session; seat: Seat }>();

  /** RoomService에 끼워 넣는 훅 */
  readonly hooks: RoomHooks;

  constructor(options: GameServiceOptions) {
    this.#opts = options;
    this.#clock = options.clock ?? realClock;
    this.#sink = options.logSink ?? stdoutSink;
    this.hooks = {
      onStarted: (view) => this.#onStarted(view),
      onLeave: (info) => this.#onLeave(info.room, info.userId, info.reason),
    };
  }

  // ───────── 경기 명령(소켓 → 런타임). 사용자 번호는 입력이 아니라 세션이 정한 좌석으로만 바꾼다 ─────────

  submitShot(userId: number, payload: unknown): Promise<CommandResult> {
    return this.#command(userId, (rt, seat) => rt.submitShot(seat, payload as never));
  }

  useHazard(userId: number, payload: unknown): Promise<CommandResult> {
    return this.#command(userId, (rt, seat) => rt.useHazard(seat, payload as never));
  }

  rotateBoard(userId: number, payload: unknown): Promise<CommandResult> {
    return this.#command(userId, (rt, seat) => rt.rotateBoard(seat, payload as never));
  }

  forfeit(userId: number, payload: unknown): Promise<CommandResult> {
    return this.#command(userId, (rt, seat) => rt.forfeit(seat, payload as never));
  }

  /** 응답 없는 명령이다. 결과는 무시한다. */
  aimHazard(userId: number, payload: unknown): void {
    const ref = this.#byUser.get(userId);
    if (ref) void ref.session.runtime.aimHazard(ref.seat, payload as never);
  }

  relayAim(userId: number, payload: unknown): void {
    const ref = this.#byUser.get(userId);
    if (ref) ref.session.runtime.relayAim(ref.seat, payload);
  }

  async #command(
    userId: number,
    run: (runtime: RoomRuntime, seat: Seat) => Promise<CommandResult>,
  ): Promise<CommandResult> {
    const ref = this.#byUser.get(userId);
    if (!ref) return NOT_ACTIVE;
    try {
      return await run(ref.session.runtime, ref.seat);
    } catch (error) {
      this.#opts.onError?.(error);
      return INTERNAL;
    }
  }

  // ───────── 재도전 ─────────

  requestRematch(userId: number, payload: unknown): CommandResult {
    const parsed = RematchRequestSchema.safeParse(payload);
    if (!parsed.success) return INVALID;
    const ref = this.#byUser.get(userId);
    const rematch = ref?.session.rematch;
    if (
      !ref ||
      !rematch ||
      rematch.gameId !== parsed.data.gameId ||
      this.#clock.now() >= rematch.deadlineMs
    ) {
      return REMATCH_NOT_AVAILABLE;
    }
    const { session, seat } = ref;
    rematch.requested[seat] = true;
    if (!(rematch.requested[0] && rematch.requested[1])) {
      this.#publishRematch(session, rematch, 'pending');
      return OK;
    }
    rematch.cancel();
    session.rematch = null;
    this.#publishRematch(session, rematch, 'accepted');
    try {
      this.#startGame(session);
    } catch (error) {
      this.#opts.onError?.(error);
      return INTERNAL;
    }
    return OK;
  }

  #openRematch(session: Session, result: GameOver): void {
    if (result.rematchDeadlineMs === null) return;
    const deadlineMs = result.rematchDeadlineMs;
    const gameId = result.gameId;
    const cancel = this.#clock.setTimer(
      () => {
        this.#expireRematch(session, gameId);
      },
      Math.max(0, deadlineMs - this.#clock.now()),
    );
    session.rematch = { gameId, deadlineMs, requested: [false, false], cancel };
  }

  /** 15초가 지났다. 재도전하기를 누르지 않은 사람을 나가기와 같게 처리한다(DEC-041). */
  #expireRematch(session: Session, gameId: string): void {
    const rematch = session.rematch;
    if (!rematch || rematch.gameId !== gameId) return;
    session.rematch = null;
    this.#publishRematch(session, rematch, 'expired');
    const [hostId, guestId] = session.userIds;
    const [hostRequested, guestRequested] = rematch.requested;
    let task: Promise<void> | null = null;
    if (!hostRequested && hostId !== null) {
      // 방장이 누르지 않았으면 방이 닫힌다. 참여자가 눌렀으면 방장이 나간 것(`host_left`)이다.
      task = this.#opts.leaveRoom(hostId, {
        notifySelf: 'rematch_timeout',
        guestReason: guestRequested ? 'host_left' : 'rematch_timeout',
      });
    } else if (!guestRequested && guestId !== null) {
      task = this.#opts.leaveRoom(guestId, { notifySelf: 'rematch_timeout' });
    }
    task?.catch((error: unknown) => {
      this.#opts.onError?.(error);
    });
  }

  #publishRematch(session: Session, rematch: Rematch, outcome: RematchState['outcome']): void {
    for (const seat of [0, 1] as const) {
      this.#publishRematchTo(session, rematch, seat, outcome);
    }
  }

  #publishRematchTo(
    session: Session,
    rematch: Rematch,
    seat: Seat,
    outcome: RematchState['outcome'],
  ): void {
    const payload: RematchState = {
      gameId: rematch.gameId,
      myRequested: rematch.requested[seat],
      opponentRequested: rematch.requested[seat === 0 ? 1 : 0],
      deadlineMs: rematch.deadlineMs,
      outcome,
    };
    this.#emitTo(session.userIds[seat], 'rematch:state', payload);
  }

  // ───────── RoomHooks ─────────

  /**
   * 상대가 입장해 시작 커밋이 났다. 입장 UPDATE가 돌려준 스냅샷으로 경기를 열므로 그 사이에 방장이 나가
   * 방이 지워져도 건너뛰지 않는다(그 이탈은 `#onLeave`가 시작 뒤 이탈로 처리한다). 던지면 RoomService가
   * 입장을 되돌린다.
   */
  async #onStarted(view: RoomView): Promise<void> {
    const { room, host, guest } = view;
    const session = this.#sessionOf(room.id);
    try {
      if (!guest) throw new Error('참여자가 없는 방은 시작할 수 없다');
      session.userIds = [host.id, guest.id];
      session.players = [
        { nickname: host.nickname, characterId: host.characterId as CharacterId },
        { nickname: guest.nickname, characterId: guest.characterId as CharacterId },
      ];
      session.config = { board: room.board as BoardId, pieceCount: room.pieceCount };
      this.#byUser.set(host.id, { session, seat: 0 });
      this.#byUser.set(guest.id, { session, seat: 1 });
      this.#startGame(session);
    } catch (error) {
      this.#discard(session);
      throw error;
    } finally {
      session.started.resolve();
    }
  }

  /**
   * 사용자가 방을 나간다. 경기 중이면 그 좌석의 기권패로 바꿔 전적 저장까지 끝낸다(RoomService가 이 뒤에
   * 방을 정리한다). 시작 커밋 직후라 경기가 아직 열리지 않았다면 열릴 때까지 기다린다. 대기실의 이탈은
   * 경기 없이 `leave` 로그(`gameId: null`)만 남긴다.
   */
  async #onLeave(room: RoomView['room'], userId: number, reason: LeaveReason): Promise<void> {
    let session = this.#sessionOf(room.id);
    if (room.status === 'playing' && session.phase === 'idle') {
      await this.#waitStarted(session);
      session = this.#sessionOf(room.id); // 경기 생성이 실패해 버려졌을 수 있다
    }
    if (session.userIds[0] === null) session.userIds[0] = room.hostId;
    if (session.userIds[1] === null && room.guestId !== null) session.userIds[1] = room.guestId;
    const seat: Seat = userId === room.hostId ? 0 : 1;
    const wasRunning = session.phase === 'running';
    await session.runtime.leave(seat, reason);
    // 기권패 종료 처리(전적 저장 등)를 먼저 끝낸 뒤 방을 정리한다(DATABASE 방 생명주기).
    if (wasRunning) await session.finishing;

    // 결과 화면에서 나가면 재도전은 무산이다. 남은 사람에게 알린다.
    const rematch = session.rematch;
    if (rematch) {
      rematch.cancel();
      session.rematch = null;
      this.#publishRematchTo(session, rematch, seat === 0 ? 1 : 0, 'expired');
    }

    this.#byUser.delete(userId);
    if (seat === 0) {
      this.#discard(session);
    } else {
      // 참여자가 나가 방장이 다시 대기한다. 다음 입장자의 시작 커밋을 기다린다.
      session.phase = 'idle';
      session.userIds[1] = null;
      session.players = null;
      session.started = deferred();
    }
  }

  async #waitStarted(session: Session): Promise<void> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, START_WAIT_MS);
      timer.unref();
    });
    try {
      await Promise.race([session.started.promise, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  // ───────── 세션 ─────────

  #startGame(session: Session): void {
    const { players, config } = session;
    if (!players || !config) throw new Error('경기 설정이 없다');
    session.runtime.startGame({
      gameId: randomUUID(),
      board: config.board,
      pieceCount: config.pieceCount,
      seed: randomInt(0, 2 ** 32),
      players,
    });
    session.phase = 'running';
  }

  #onFinished(session: Session, result: GameOver): void {
    session.phase = 'over';
    // 처리 전에 설정한다. 실패해도 다시 처리하지 않는다(재시도로 두 번 반영되는 것이 한 판 누락보다 나쁘다)
    if (session.finishedGames.has(result.gameId)) return;
    session.finishedGames.add(result.gameId);
    const [host, guest] = session.userIds;
    const hook = this.#opts.onFinished;
    if (hook && host !== null && guest !== null) {
      session.finishing = Promise.resolve()
        .then(() => hook({ roomId: session.roomId, userIds: [host, guest], result }))
        .catch((error: unknown) => {
          this.#opts.onError?.(error);
        });
    }
    this.#openRematch(session, result);
  }

  #sessionOf(roomId: number): Session {
    const existing = this.#sessions.get(roomId);
    if (existing) return existing;
    const session: Session = {
      roomId,
      runtime: undefined as unknown as RoomRuntime, // 아래에서 곧바로 채운다(전송·로그가 세션을 참조한다)
      phase: 'idle',
      userIds: [null, null],
      players: null,
      config: null,
      started: deferred(),
      finishedGames: new Set(),
      finishing: Promise.resolve(),
      rematch: null,
    };
    session.runtime = new RoomRuntime({
      clock: this.#clock,
      transport: {
        send: (seat, type, payload, { volatile }) => {
          this.#emitTo(session.userIds[seat], type, payload, volatile);
        },
      },
      logger: {
        log: (entry) => {
          this.#sink(
            JSON.stringify(
              toLogLine(entry, { roomId, userIdOf: (seat) => session.userIds[seat] ?? undefined }),
            ),
          );
        },
      },
      onFinished: (result) => {
        this.#onFinished(session, result);
      },
      onError: this.#opts.onError,
      rematchWindowMs: this.#opts.rematchWindowMs ?? REMATCH_WINDOW_MS,
    });
    this.#sessions.set(roomId, session);
    return session;
  }

  /** 방이 닫히거나 경기를 열지 못했다. 타이머를 멈추고 매핑을 지운다. */
  #discard(session: Session): void {
    session.rematch?.cancel();
    session.rematch = null;
    session.runtime.dispose();
    for (const id of session.userIds) {
      if (id !== null && this.#byUser.get(id)?.session === session) this.#byUser.delete(id);
    }
    if (this.#sessions.get(session.roomId) === session) this.#sessions.delete(session.roomId);
  }

  #emitTo(
    userId: number | null,
    type: keyof RuntimeEventMap | 'rematch:state',
    payload: unknown,
    volatile = false,
  ): void {
    if (userId === null) return;
    const socket = this.#opts.registry.get(userId);
    if (!socket) return;
    (volatile ? socket.volatile : socket).emit(type, payload);
  }

  /** 서버를 닫을 때 모든 방의 틱·재도전 타이머를 멈춘다. */
  dispose(): void {
    for (const session of [...this.#sessions.values()]) this.#discard(session);
  }
}
