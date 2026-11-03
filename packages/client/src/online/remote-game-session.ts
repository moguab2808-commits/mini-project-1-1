import type { Socket } from 'socket.io-client';
import type {
  AimUpdate,
  BoardRotate,
  CommandResult,
  GameForfeit,
  HazardAim,
  HazardUse,
  Seat,
  ShotSubmit,
} from '@alkkagi/shared';
import type { GameEventMap, GameSession } from '../session/game-session.ts';
import { SocketRequests } from './socket-requests.ts';

const EVENTS = [
  'game:start',
  'hazard:granted',
  'game:state',
  'hazard:triggered',
  'turn:change',
  'game:over',
  'rematch:state',
  'aim:state',
] as const;
const NOT_ACTIVE: CommandResult = {
  ok: false,
  error: { code: 'GAME_NOT_ACTIVE', message: '세션이 닫혔다' },
};
type Handler = (payload: never) => void;

/** 방마다 하나. 이벤트 필터만 적용하고 payload와 ack는 변환하지 않는다. */
export class RemoteGameSession implements GameSession {
  readonly mode = 'online';
  private readonly requests: SocketRequests;
  private readonly handlers = new Map<keyof GameEventMap, Set<Handler>>();
  private readonly offs: (() => void)[] = [];
  private readonly seenGames = new Set<string>();
  private gameId: string | null = null;
  private revision = -1;
  private finished = false;
  private closed = false;

  constructor(
    private readonly socket: Socket,
    readonly playerId: Seat,
    private readonly leaveRoom: () => void,
  ) {
    this.requests = new SocketRequests(socket);
    for (const type of EVENTS) {
      const listener = (payload: GameEventMap[typeof type]) => this.receive(type, payload);
      socket.on(type, listener);
      this.offs.push(() => {
        socket.off(type, listener);
      });
    }
  }

  submitShot(cmd: ShotSubmit): Promise<CommandResult> {
    return this.command('shot:submit', cmd);
  }
  useHazard(cmd: HazardUse): Promise<CommandResult> {
    return this.command('hazard:use', cmd);
  }
  forfeit(cmd: GameForfeit): Promise<CommandResult> {
    return this.command('game:forfeit', cmd);
  }
  rotateBoard(cmd: BoardRotate): Promise<CommandResult> {
    return this.command('board:rotate', cmd);
  }
  requestRematch(gameId: string): Promise<CommandResult> {
    return this.command('rematch:request', { gameId });
  }
  aimHazard(cmd: HazardAim): void {
    if (!this.closed && this.socket.connected) this.socket.volatile.emit('hazard:aim', cmd);
  }
  sendAim(update: AimUpdate): void {
    if (!this.closed && this.socket.connected) this.socket.volatile.emit('aim:update', update);
  }
  on<K extends keyof GameEventMap>(
    type: K,
    handler: (payload: GameEventMap[K]) => void,
  ): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(handler);
    return () => {
      set.delete(handler);
    };
  }

  /** RoomClient가 방 폐쇄·연결 종료 때 호출한다. 이미 나간 방에는 leave를 다시 보내지 않는다. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.requests.close();
    for (const off of this.offs) off();
    this.handlers.clear();
  }
  dispose(): void {
    if (this.closed) return;
    this.close();
    this.leaveRoom();
  }
  private command(event: string, payload: unknown): Promise<CommandResult> {
    return this.requests.send(event, payload, NOT_ACTIVE);
  }
  private receive<K extends keyof GameEventMap>(type: K, payload: GameEventMap[K]): void {
    if (this.closed) return;
    if (type === 'game:start') {
      const start = payload as GameEventMap['game:start'];
      if (start.seat !== this.playerId || this.seenGames.has(start.gameId)) return;
      this.seenGames.add(start.gameId);
      this.gameId = start.gameId;
      this.revision = start.view.revision;
      this.finished = false;
    } else {
      if (payload.gameId !== this.gameId) return;
      if (this.finished && type !== 'rematch:state') return;
      if (type === 'game:state') {
        const view = payload as GameEventMap['game:state'];
        if (view.revision <= this.revision) return;
        this.revision = view.revision;
      }
      if (type === 'game:over') this.finished = true;
    }
    for (const handler of this.handlers.get(type) ?? []) handler(payload as never);
  }
}
