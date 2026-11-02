// 방 생성·입장(입장하면 바로 시작)·퇴장과 `room:state`·`room:closed` 전송. 소켓 이벤트 연결은 room-handlers.ts가 맡는다.
import type { RoomClosed, RoomCreate, RoomJoin, RoomState, RoomSummary } from '@alkkagi/shared';
import { toMe } from '../auth/users.ts';
import type { Db } from '../db/pool.ts';
import type { ConnectionRegistry } from '../realtime/connections.ts';
import { roomErrors } from './errors.ts';
import {
  claimGuestSeat,
  claimRandomPublicRoom,
  clearGuestOf,
  deleteRoomOfHost,
  findRoomByCode,
  findRoomById,
  findRoomOf,
  insertRoom,
  listRoomViews,
  loadRoomView,
  type RoomRow,
  type RoomView,
} from './room-store.ts';

export type RoomHooks = {
  /** 상대가 입장해 `status`가 `playing`이 된 직후(시작 커밋)에 불린다. 경기 서버(IMPL-009)가 경기를 여는 자리다. */
  onStarted?: (view: RoomView) => Promise<void> | void;
};

export class RoomService {
  constructor(
    private readonly db: Db,
    private readonly registry: ConnectionRegistry,
    private readonly hooks: RoomHooks = {},
  ) {}

  /** 로비 진입·새로고침 때 부르는 목록. 비공개 방의 코드와 사용자 번호는 넣지 않는다. */
  async list(): Promise<RoomSummary[]> {
    const views = await listRoomViews(this.db);
    return views.map(({ room, host }) => ({
      roomId: room.id,
      title: room.title,
      isPublic: room.isPublic,
      status: room.status as RoomSummary['status'],
      host: toMe(host),
    }));
  }

  async create(userId: number, input: RoomCreate): Promise<number> {
    await this.#assertFree(userId);
    const room = await insertRoom(this.db, userId, input);
    await this.#publishState(room.id);
    return room.id;
  }

  async join(userId: number, input: RoomJoin): Promise<number> {
    await this.#assertFree(userId);
    const target = await this.#resolveJoinTarget(input);
    const joined = await claimGuestSeat(
      this.db,
      target.id,
      userId,
      target.isPublic ? undefined : input.code,
    );
    if (!joined) throw await this.#whyNotJoinable(target.id);
    await this.#startOnJoin(joined.id);
    return joined.id;
  }

  async quickJoin(userId: number): Promise<number> {
    await this.#assertFree(userId);
    const joined = await claimRandomPublicRoom(this.db, userId);
    if (!joined) throw roomErrors.roomNotFound();
    await this.#startOnJoin(joined.id);
    return joined.id;
  }

  /**
   * 나가기(연결 끊김 포함). 방에 없으면 아무것도 하지 않는다.
   * 방장이면 방을 지우고 참여자에게 `room:closed`를, 참여자면 `guest_id`만 비우고 방장에게 `room:state`를 보낸다.
   * 경기 중 이탈의 기권패 저장은 경기 서버(IMPL-009)가 이 호출 앞에 끼워 넣는다.
   */
  async leave(userId: number): Promise<void> {
    const closed = await deleteRoomOfHost(this.db, userId);
    if (closed) {
      if (closed.guestId !== null) {
        const payload: RoomClosed = { reason: 'host_left' };
        this.registry.get(closed.guestId)?.emit('room:closed', payload);
      }
      return;
    }
    const left = await clearGuestOf(this.db, userId);
    if (left) await this.#publishState(left.id);
  }

  /** 한 사람 한 방. 이미 방장이거나 참여자면 새 방을 만들거나 입장할 수 없다. */
  async #assertFree(userId: number): Promise<void> {
    if (await findRoomOf(this.db, userId)) throw roomErrors.alreadyInRoom();
  }

  /**
   * 입장할 방을 찾는다. 비공개 방은 코드가 맞아야 하며, 코드 없이 방 id만 보내거나 코드가 다르면 `INVALID_CODE`다.
   * 코드가 틀릴 때 방 상태(가득 참·게임 중)를 알려 주지 않도록 코드 검사를 먼저 한다.
   */
  async #resolveJoinTarget(input: RoomJoin): Promise<RoomRow> {
    if (input.roomId !== undefined) {
      const room = await findRoomById(this.db, input.roomId);
      if (!room) throw roomErrors.roomNotFound();
      if (!room.isPublic && input.code !== room.code) throw roomErrors.invalidCode();
      return room;
    }
    const room = await findRoomByCode(this.db, input.code!);
    if (!room) throw roomErrors.invalidCode();
    return room;
  }

  /**
   * 조건부 입장이 0행일 때 방을 다시 읽어 이유를 가른다. 상대가 입장하면 바로 시작하므로
   * 상대가 있는 방은 항상 게임 중이다(`ROOM_PLAYING`).
   */
  async #whyNotJoinable(roomId: number): Promise<Error> {
    const room = await findRoomById(this.db, roomId);
    if (!room) return roomErrors.roomNotFound();
    if (room.status === 'playing' || room.guestId !== null) return roomErrors.roomPlaying();
    return roomErrors.roomNotFound();
  }

  /**
   * 입장이 곧 시작이다. 입장 문장이 `playing`까지 바꿨으므로(시작 커밋) 양쪽에 `room:state`를 보내고
   * 경기 서버(IMPL-009)가 연결하는 `onStarted`를 부른다.
   */
  async #startOnJoin(roomId: number): Promise<void> {
    await this.#publishState(roomId);
    const view = await loadRoomView(this.db, roomId);
    if (view) await this.hooks.onStarted?.(view);
  }

  /** 방 안 사용자 각각에게 `room:state`를 보낸다. `code`는 비공개 방의 방장에게만 담는다. */
  async #publishState(roomId: number): Promise<void> {
    const view = await loadRoomView(this.db, roomId);
    if (!view) return;
    const { room, host, guest } = view;
    const base = {
      roomId: room.id,
      title: room.title,
      isPublic: room.isPublic,
      pieceCount: room.pieceCount,
      board: room.board as RoomState['board'],
      status: room.status as RoomState['status'],
      host: toMe(host),
      guest: guest ? toMe(guest) : null,
    };
    const hostState: RoomState = {
      ...base,
      isHost: true,
      ...(room.code !== null ? { code: room.code } : {}),
    };
    this.registry.get(host.id)?.emit('room:state', hostState);
    if (guest) {
      const guestState: RoomState = { ...base, isHost: false };
      this.registry.get(guest.id)?.emit('room:state', guestState);
    }
  }
}
