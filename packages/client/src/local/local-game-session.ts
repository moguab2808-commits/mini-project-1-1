// 로컬 2인 모드의 GameSession. 창마다 하나씩 만들고 SharedWorker 권한 측과 MessagePort로 통신한다.
import type {
  AimUpdate,
  BoardRotate,
  CommandResult,
  GameForfeit,
  HazardAim,
  HazardUse,
  Seat,
  ShotSubmit,
  BoardId,
} from '@alkkagi/shared';
import type { GameEventMap, GameMode, GameSession } from '../session/game-session.ts';
import type { ClientMessage, LocalCommand, RejectReason, WorkerMessage } from './messages.ts';

/** `MessagePort`에서 세션이 쓰는 부분 */
export interface SessionPort {
  postMessage(message: ClientMessage): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  close?(): void;
  start?(): void;
}

export interface LocalGameSessionOptions {
  seat: Seat;
  board?: BoardId;
  pieceCount?: number;
  /** 하트비트 ping 주기(ms). 0이면 보내지 않는다. 기본 2000. */
  heartbeatMs?: number;
  /** AI 대전: 화면 표시용 내 정보 */
  profile?: { nickname?: string; characterId?: string };
}

export class LocalSessionRejectedError extends Error {
  constructor(readonly reason: RejectReason) {
    super(`로컬 세션 연결 거부: ${reason}`);
    this.name = 'LocalSessionRejectedError';
  }
}

type AnyHandler = (event: never) => void;

export class LocalGameSession implements GameSession {
  readonly mode: GameMode = 'local';
  readonly playerId: Seat;
  private readonly port: SessionPort;
  private readonly handlers = new Map<keyof GameEventMap, Set<AnyHandler>>();
  private readonly pending = new Map<number, (result: CommandResult) => void>();
  private nextId = 1;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private disposed = false;
  private readonly ready: Promise<void>;

  /**
   * 포트를 받아 `hello`를 보내고 `welcome`을 기다린다. `ready`가 거부되면(좌석 사용 중 등)
   * `LocalSessionRejectedError`다. 같은 포트로 이벤트가 먼저 도착해도 놓치지 않도록
   * 구독은 `ready`를 기다리지 않고 생성 직후부터 가능하다.
   */
  constructor(port: SessionPort, options: LocalGameSessionOptions) {
    this.playerId = options.seat;
    this.port = port;
    this.ready = new Promise<void>((resolve, reject) => {
      port.onmessage = (event) => {
        const msg = event.data as WorkerMessage;
        if (msg.t === 'welcome') resolve();
        else if (msg.t === 'rejected') reject(new LocalSessionRejectedError(msg.reason));
        else this.receive(msg);
      };
    });
    port.start?.();
    port.postMessage({
      t: 'hello',
      seat: options.seat,
      board: options.board,
      pieceCount: options.pieceCount,
      profile: options.profile,
    });
    const every = options.heartbeatMs ?? 2000;
    if (every > 0) {
      this.heartbeat = setInterval(() => {
        this.port.postMessage({ t: 'ping' });
      }, every);
    }
  }

  /** 권한 측이 좌석을 받아들이면 이행한다. */
  connect(): Promise<void> {
    return this.ready;
  }

  submitShot(cmd: ShotSubmit): Promise<CommandResult> {
    return this.command('shot', cmd);
  }

  useHazard(cmd: HazardUse): Promise<CommandResult> {
    return this.command('hazard', cmd);
  }

  forfeit(cmd: GameForfeit): Promise<CommandResult> {
    return this.command('forfeit', cmd);
  }

  requestRematch(gameId: string): Promise<CommandResult> {
    return this.command('rematch', { gameId });
  }

  rotateBoard(cmd: BoardRotate): Promise<CommandResult> {
    return this.command('rotate', cmd);
  }

  aimHazard(cmd: HazardAim): void {
    if (!this.disposed) this.port.postMessage({ t: 'hazardAim', payload: cmd });
  }

  sendAim(update: AimUpdate): void {
    if (!this.disposed) this.port.postMessage({ t: 'aim', payload: update });
  }

  on<K extends keyof GameEventMap>(type: K, handler: (event: GameEventMap[K]) => void): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }

  /** 창을 닫거나 이동할 때 부른다. 진행 중이면 권한 측이 이 좌석을 기권패로 처리한다. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.port.postMessage({ t: 'bye' });
    this.port.onmessage = null;
    this.port.close?.();
    for (const resolve of this.pending.values()) resolve(DISPOSED);
    this.pending.clear();
  }

  private command(kind: LocalCommand['kind'], payload: unknown) {
    if (this.disposed) return Promise.resolve(DISPOSED);
    const id = this.nextId++;
    return new Promise<CommandResult>((resolve) => {
      this.pending.set(id, resolve);
      this.port.postMessage({ t: 'cmd', id, kind, payload });
    });
  }

  private receive(msg: WorkerMessage): void {
    if (msg.t === 'result') {
      const resolve = this.pending.get(msg.id);
      this.pending.delete(msg.id);
      resolve?.(msg.result);
    } else if (msg.t === 'event') {
      for (const handler of this.handlers.get(msg.type) ?? []) {
        (handler as (event: unknown) => void)(msg.payload);
      }
    }
  }
}

const DISPOSED: CommandResult = {
  ok: false,
  error: { code: 'GAME_NOT_ACTIVE', message: '세션이 닫혔다' },
};
