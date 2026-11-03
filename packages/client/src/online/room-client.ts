import { io, type Socket } from 'socket.io-client';
import type {
  RoomAck,
  RoomClosed,
  RoomCreate,
  RoomJoin,
  RoomState,
  SessionReplaced,
} from '@alkkagi/shared';
import { GameStore } from '../game/game-store.ts';
import { RemoteGameSession } from './remote-game-session.ts';
import { SocketRequests } from './socket-requests.ts';

export interface OnlineMatch {
  session: RemoteGameSession;
  store: GameStore;
}
export interface RoomClientState {
  room: RoomState | null;
  match: OnlineMatch | null;
}
export interface RoomClientOptions {
  onLoginRequired: (reason: 'disconnect' | 'connect_error' | SessionReplaced['reason']) => void;
  onRoomClosed?: (event: RoomClosed) => void;
  /** 소켓 연결이 완료됐다. 화면은 이 뒤부터 방 명령을 보낼 수 있다(IMPL-012). */
  onConnected?: () => void;
}
const UNAVAILABLE: RoomAck<{ roomId: number }> = {
  ok: false,
  error: { code: 'INTERNAL_ERROR', message: '연결이 종료됐다' },
};

/** 로비 연결을 소유한다. room:state 중 동기적으로 세션·스토어를 만들어 시작 이벤트를 놓치지 않는다. */
export class RoomClient {
  private state: RoomClientState = { room: null, match: null };
  private readonly listeners = new Set<() => void>();
  private readonly closedRooms = new Set<number>();
  private readonly requests: SocketRequests;
  private readonly offs: (() => void)[] = [];
  private terminated = false;
  private entering = false;

  constructor(
    private readonly socket: Socket,
    private readonly options: RoomClientOptions,
  ) {
    this.requests = new SocketRequests(socket);
    const on = <T>(event: string, handler: (payload: T) => void) => {
      socket.on(event, handler);
      this.offs.push(() => {
        socket.off(event, handler);
      });
    };
    on<RoomState>('room:state', (room) => {
      if (this.terminated || this.closedRooms.has(room.roomId)) return;
      if (this.state.room && this.state.room.roomId !== room.roomId) return;
      let match = this.state.match;
      if (!match) {
        const session = new RemoteGameSession(socket, room.isHost ? 0 : 1, () => {
          void this.leave();
        });
        match = { session, store: new GameStore(session) };
      }
      this.set({ room, match });
    });
    on<RoomClosed>('room:closed', (event) => {
      this.closedRooms.add(event.roomId);
      if (this.state.room?.roomId === event.roomId) {
        this.clearRoom();
        options.onRoomClosed?.(event);
      }
    });
    on<SessionReplaced>('session:replaced', (event) => this.end(event.reason));
    on('connect', () => {
      options.onConnected?.();
    });
    on('disconnect', () => this.end('disconnect'));
    on('connect_error', () => this.end('connect_error'));
  }

  getState = (): RoomClientState => this.state;
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  create(input: RoomCreate): Promise<RoomAck<{ roomId: number }>> {
    return this.enter('room:create', input);
  }
  join(input: RoomJoin): Promise<RoomAck<{ roomId: number }>> {
    return this.enter('room:join', input);
  }
  quickJoin(): Promise<RoomAck<{ roomId: number }>> {
    return this.enter('room:quickJoin', {});
  }

  async leave(): Promise<RoomAck> {
    if (!this.state.room) return { ok: true };
    this.closedRooms.add(this.state.room.roomId);
    this.clearRoom();
    return this.requests.send<RoomAck>('room:leave', {}, UNAVAILABLE);
  }
  /** 연결 전에 구독을 준비하기 위해 factory는 autoConnect:false를 쓴다. */
  connect(): void {
    if (!this.terminated) this.socket.connect();
  }
  dispose(): void {
    if (this.terminated) return;
    // leave를 보낸 뒤 끊는다. 서버의 disconnect도 같은 이탈 처리를 보장한다.
    void this.leave();
    this.shutdown();
  }
  private async enter(event: string, payload: unknown): Promise<RoomAck<{ roomId: number }>> {
    if (this.entering || this.state.room) {
      return { ok: false, error: { code: 'ALREADY_IN_ROOM', message: '이미 방에 참여 중이다' } };
    }
    this.entering = true;
    try {
      const result = await this.requests.send(event, payload, UNAVAILABLE);
      if (!result.ok) {
        // onStarted 실패 때 playing의 room:state가 먼저 올 수 있다(API 순서 규칙 8).
        const room = this.getState().room;
        if (room) this.closedRooms.add(room.roomId);
        this.clearRoom();
        return result;
      }
      if (this.closedRooms.has(result.roomId) || this.terminated) {
        return { ok: false, error: { code: 'ROOM_NOT_FOUND', message: '방이 닫혔다' } };
      }
      return result;
    } finally {
      this.entering = false;
    }
  }
  private end(reason: Parameters<RoomClientOptions['onLoginRequired']>[0]): void {
    if (this.terminated) return;
    this.shutdown();
    this.options.onLoginRequired(reason);
  }
  private shutdown(): void {
    this.terminated = true;
    this.requests.close();
    this.clearRoom();
    for (const off of this.offs) off();
    this.socket.disconnect();
    this.listeners.clear();
  }
  private clearRoom(): void {
    this.state.match?.session.close();
    this.state.match?.store.dispose();
    this.set({ room: null, match: null });
  }
  private set(state: RoomClientState): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
}

/** 같은 출처의 세션 쿠키로 인증한다. 자동 재접속은 하지 않는다. */
export function createRoomClient(options: RoomClientOptions): RoomClient {
  return new RoomClient(
    io({ autoConnect: false, reconnection: false, withCredentials: true }),
    options,
  );
}
