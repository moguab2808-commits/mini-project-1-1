// 로컬 2인 모드 권한 측. SharedWorker 안에서 game-runtime + game-core로 경기를 진행한다
// (docs/design/LOCAL.md "로컬 2인 구성"). 포트·시계를 주입받아 워커 밖에서도 테스트할 수 있다.
import { RoomRuntime, type RuntimeClock } from '@alkkagi/game-runtime';
import {
  BOARD_IDS,
  RematchRequestSchema,
  SeatSchema,
  type BoardId,
  type CommandResult,
  type GameOver,
  type RematchState,
  type Seat,
} from '@alkkagi/shared';
import type { GameEventMap } from '../session/game-session.ts';
import type { ClientMessage, RejectReason, WorkerMessage } from './messages.ts';

/** `MessagePort`에서 권한 측이 쓰는 부분 */
export interface PortLike {
  postMessage(message: WorkerMessage): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  close?(): void;
}

export interface LocalAuthorityOptions {
  clock: RuntimeClock;
  /** [0, 1) 난수. 기본은 `Math.random`이며 경기 시드·gameId를 정한다. */
  random?: () => number;
  /** 이 시간(ms) 동안 ping·명령이 없으면 창이 닫힌 것으로 본다. 0이면 확인하지 않는다. */
  heartbeatTimeoutMs?: number;
  /** 재도전 대기 시간(ms) */
  rematchWindowMs?: number;
  onError?: (error: unknown) => void;
}

export const DEFAULT_HEARTBEAT_TIMEOUT_MS = 6000;
export const DEFAULT_REMATCH_WINDOW_MS = 15000;
const DEFAULT_BOARD: BoardId = 'standard';
const DEFAULT_PIECE_COUNT = 7;

const NOT_AVAILABLE: CommandResult = {
  ok: false,
  error: { code: 'REMATCH_NOT_AVAILABLE', message: '재도전할 수 없다' },
};
const INVALID: CommandResult = {
  ok: false,
  error: { code: 'INVALID_INPUT', message: '명령 값이 올바르지 않다' },
};

interface Connection {
  port: PortLike;
  seat: Seat;
  lastSeenMs: number;
}

interface Rematch {
  gameId: string;
  requested: [boolean, boolean];
  deadlineMs: number;
  cancelTimer: () => void;
  outcome: RematchState['outcome'];
}

export class LocalAuthority {
  private readonly opts: LocalAuthorityOptions;
  private readonly random: () => number;
  private runtime: RoomRuntime | null = null;
  private readonly seats: [Connection | null, Connection | null] = [null, null];
  /** 이탈한 좌석. 방이 비워질 때까지 다시 쓰지 않는다(기권패 뒤 재접속으로 경기를 덮지 않는다). */
  private readonly departed: [boolean, boolean] = [false, false];
  private config: { board: BoardId; pieceCount: number } | null = null;
  private gameCount = 0;
  private rematch: Rematch | null = null;
  private lastResult: GameOver | null = null;
  private cancelHeartbeat: (() => void) | null = null;

  constructor(options: LocalAuthorityOptions) {
    this.opts = options;
    this.random = options.random ?? Math.random;
  }

  /** 워커의 `connect` 이벤트가 준 포트를 받는다. 좌석은 첫 `hello`로 정해진다. */
  attach(port: PortLike): void {
    let conn: Connection | null = null;
    port.onmessage = (event) => {
      try {
        const msg = event.data as ClientMessage;
        if (!conn) {
          if (msg?.t === 'hello') conn = this.hello(port, msg);
          return;
        }
        this.handle(conn, msg);
      } catch (error) {
        this.opts.onError?.(error);
      }
    };
  }

  // ───────── 연결 ─────────

  private hello(port: PortLike, msg: Extract<ClientMessage, { t: 'hello' }>): Connection | null {
    const seat = SeatSchema.safeParse(msg.seat);
    if (!seat.success) return this.reject(port, 'INVALID_HELLO');
    if (this.seats[seat.data]) return this.reject(port, 'SEAT_TAKEN');
    if (this.departed[seat.data]) return this.reject(port, 'SEAT_DEPARTED');
    const conn: Connection = { port, seat: seat.data, lastSeenMs: this.opts.clock.now() };
    this.seats[seat.data] = conn;
    // 방 설정은 먼저 연결한 창이 정한다.
    if (!this.config) {
      this.config = {
        board: BOARD_IDS.includes(msg.board as BoardId) ? (msg.board as BoardId) : DEFAULT_BOARD,
        pieceCount: [5, 7, 9].includes(msg.pieceCount as number)
          ? (msg.pieceCount as number)
          : DEFAULT_PIECE_COUNT,
      };
    }
    port.postMessage({ t: 'welcome', seat: seat.data });
    this.armHeartbeat();
    if (this.seats[0] && this.seats[1] && this.gameCount === 0) this.startGame();
    return conn;
  }

  private reject(port: PortLike, reason: RejectReason): null {
    port.postMessage({ t: 'rejected', reason });
    return null;
  }

  private handle(conn: Connection, msg: ClientMessage): void {
    if (this.seats[conn.seat] !== conn) return; // 이미 이탈한 연결
    conn.lastSeenMs = this.opts.clock.now();
    switch (msg?.t) {
      case 'ping':
        return;
      case 'bye':
        this.depart(conn, 'disconnect');
        return;
      case 'cmd':
        this.command(conn, msg);
        return;
      case 'hazardAim':
        // 응답이 없는 이벤트: 결과는 버린다
        void this.runtime?.aimHazard(conn.seat, msg.payload as never);
        return;
      case 'aim':
        this.runtime?.relayAim(conn.seat, msg.payload);
        return;
      default:
        return;
    }
  }

  private command(conn: Connection, msg: Extract<ClientMessage, { t: 'cmd' }>): void {
    const runtime = this.runtime;
    let result: Promise<CommandResult>;
    if (msg.kind === 'rematch') {
      result = Promise.resolve(this.requestRematch(conn.seat, msg.payload));
    } else if (!runtime) {
      result = Promise.resolve<CommandResult>({
        ok: false,
        error: { code: 'GAME_NOT_ACTIVE', message: '진행 중인 경기가 없다' },
      });
    } else if (msg.kind === 'shot') {
      result = runtime.submitShot(conn.seat, msg.payload as never);
    } else if (msg.kind === 'hazard') {
      result = runtime.useHazard(conn.seat, msg.payload as never);
    } else if (msg.kind === 'forfeit') {
      result = runtime.forfeit(conn.seat, msg.payload as never);
    } else if (msg.kind === 'rotate') {
      result = runtime.rotateBoard(conn.seat, msg.payload as never);
    } else {
      result = Promise.resolve(INVALID);
    }
    void result.then((r) => this.send(conn.seat, { t: 'result', id: msg.id, result: r }));
  }

  /** 창 닫기·새로고침·응답 없음. 진행 중인 경기는 기권패로 끝난다. */
  private depart(conn: Connection, reason: 'disconnect'): void {
    if (this.seats[conn.seat] !== conn) return;
    this.seats[conn.seat] = null;
    this.departed[conn.seat] = true;
    conn.port.onmessage = null;
    conn.port.close?.();
    void this.runtime?.leave(conn.seat, reason);
    this.expireRematch(); // 상대가 나가면 재도전할 수 없다
    if (!this.seats[0] && !this.seats[1]) this.reset();
  }

  /** 두 창이 모두 닫히면 처음 상태로 돌아가 다음 `/local` 접속이 새 경기를 연다. */
  private reset(): void {
    this.runtime?.dispose();
    this.runtime = null;
    this.rematch?.cancelTimer();
    this.rematch = null;
    this.lastResult = null;
    this.config = null;
    this.gameCount = 0;
    this.departed[0] = false;
    this.departed[1] = false;
    this.cancelHeartbeat?.();
    this.cancelHeartbeat = null;
  }

  // ───────── 하트비트 ─────────

  private armHeartbeat(): void {
    const timeout = this.opts.heartbeatTimeoutMs ?? DEFAULT_HEARTBEAT_TIMEOUT_MS;
    if (timeout <= 0 || this.cancelHeartbeat) return;
    const check = (): void => {
      const now = this.opts.clock.now();
      for (const conn of this.seats) {
        if (conn && now - conn.lastSeenMs > timeout) this.depart(conn, 'disconnect');
      }
      this.cancelHeartbeat = this.seats[0] || this.seats[1] ? schedule() : null;
    };
    const schedule = (): (() => void) => this.opts.clock.setTimer(check, timeout / 3);
    this.cancelHeartbeat = schedule();
  }

  // ───────── 경기 ─────────

  private startGame(): void {
    const config = this.config ?? { board: DEFAULT_BOARD, pieceCount: DEFAULT_PIECE_COUNT };
    this.runtime ??= new RoomRuntime({
      clock: this.opts.clock,
      transport: {
        send: (seat, type, payload) => {
          this.send(seat, { t: 'event', type, payload } as WorkerMessage);
        },
      },
      onFinished: (result) => {
        this.lastResult = result;
        this.openRematch(result);
      },
      onError: this.opts.onError,
      rematchWindowMs: this.opts.rematchWindowMs ?? DEFAULT_REMATCH_WINDOW_MS,
    });
    this.gameCount += 1;
    this.rematch = null;
    this.runtime.startGame({
      gameId: `local-${String(this.gameCount)}`,
      board: config.board,
      pieceCount: config.pieceCount,
      seed: Math.floor(this.random() * 0x1_0000_0000),
      players: [
        { nickname: '플레이어 1', characterId: 'bear' },
        { nickname: '플레이어 2', characterId: 'cat' },
      ],
    });
  }

  // ───────── 재도전 ─────────

  private openRematch(result: GameOver): void {
    this.rematch?.cancelTimer();
    const deadlineMs = result.rematchDeadlineMs;
    if (deadlineMs === null) {
      this.rematch = null;
      return;
    }
    const delay = Math.max(0, deadlineMs - this.opts.clock.now());
    const cancelTimer = this.opts.clock.setTimer(() => {
      this.expireRematch();
    }, delay);
    this.rematch = {
      gameId: result.gameId,
      requested: [false, false],
      deadlineMs,
      cancelTimer,
      outcome: 'pending',
    };
  }

  private requestRematch(seat: Seat, payload: unknown): CommandResult {
    const parsed = RematchRequestSchema.safeParse(payload);
    if (!parsed.success) return INVALID;
    const r = this.rematch;
    const other: Seat = seat === 0 ? 1 : 0;
    if (
      !r ||
      r.outcome !== 'pending' ||
      r.gameId !== parsed.data.gameId ||
      this.opts.clock.now() >= r.deadlineMs ||
      !this.seats[other]
    ) {
      return NOT_AVAILABLE;
    }
    r.requested[seat] = true;
    if (r.requested[0] && r.requested[1]) {
      r.cancelTimer();
      r.outcome = 'accepted';
      this.publishRematch(r);
      this.rematch = null;
      this.startGame();
    } else {
      this.publishRematch(r);
    }
    return { ok: true };
  }

  /** 마감·상대 이탈로 재도전이 무산됐다. 로컬에는 방 대기실이 없으므로 상태만 알린다. */
  private expireRematch(): void {
    const r = this.rematch;
    if (!r || r.outcome !== 'pending') return;
    r.cancelTimer();
    r.outcome = 'expired';
    this.publishRematch(r);
    this.rematch = null;
  }

  private publishRematch(r: Rematch): void {
    for (const seat of [0, 1] as const) {
      const other: Seat = seat === 0 ? 1 : 0;
      this.send(seat, {
        t: 'event',
        type: 'rematch:state',
        payload: {
          gameId: r.gameId,
          myRequested: r.requested[seat],
          opponentRequested: r.requested[other],
          deadlineMs: r.deadlineMs,
          outcome: r.outcome,
        },
      });
    }
  }

  private send(seat: Seat, message: WorkerMessage): void {
    const conn = this.seats[seat];
    if (!conn) return;
    try {
      conn.port.postMessage(message);
    } catch (error) {
      this.opts.onError?.(error);
    }
  }

  /** 테스트·진단용: 마지막 종료 결과 */
  get finishedResult(): GameOver | null {
    return this.lastResult;
  }
}

export type { GameEventMap };
