// 방 생성·입장(입장하면 바로 시작)·퇴장과 `room:state`·`room:closed` 전송. 소켓 이벤트 연결은 room-handlers.ts가 맡는다.
import type { LeaveReason } from '@alkkagi/game-runtime';
import type { RoomClosed, RoomCreate, RoomJoin, RoomState, RoomSummary } from '@alkkagi/shared';
import { findUserById, toMe } from '../auth/users.ts';
import type { Db } from '../db/pool.ts';
import type { ConnectionRegistry } from '../realtime/connections.ts';
import { roomErrors } from './errors.ts';
import {
  claimGuestSeat,
  claimRandomPublicRoom,
  clearGuestOf,
  deleteRoomById,
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
  /**
   * 상대가 입장해 `status`가 `playing`이 된 직후(시작 커밋)에 불린다. 경기 서버(IMPL-009)가 경기를 여는 자리다.
   * 던지면 입장을 되돌린다(`#undoJoin`).
   */
  onStarted?: (view: RoomView) => Promise<void> | void;
  /**
   * 사용자가 방을 나갈 때 불린다(연결 끊김·접속 대체 포함). `playing`인 방은 DB 정리 **앞**에 불려
   * 경기 서버가 기권패 처리와 전적 저장을 끝내게 하고(DATABASE 방 생명주기), `waiting`인 방은 DB 정리 뒤에 불린다.
   */
  onLeave?: (info: { room: RoomRow; userId: number; reason: LeaveReason }) => Promise<void> | void;
};

export type LeaveOptions = {
  /** 이탈 사유(서버 로그 `leave`). 기본은 나가기 버튼이다. 재도전 15초 만료도 나가기와 같게 처리한다 */
  reason?: LeaveReason;
  /** 나가는 본인에게도 `room:closed`로 알릴 사유(재도전 15초 만료의 `rematch_timeout`, DEC-041) */
  notifySelf?: RoomClosed['reason'];
  /** 방장이 나가 방이 닫힐 때 참여자에게 보낼 사유. 기본은 `host_left` */
  guestReason?: RoomClosed['reason'];
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
    await this.#startOnJoin(joined);
    return joined.id;
  }

  async quickJoin(userId: number): Promise<number> {
    await this.#assertFree(userId);
    const joined = await claimRandomPublicRoom(this.db, userId);
    if (!joined) throw roomErrors.roomNotFound();
    await this.#startOnJoin(joined);
    return joined.id;
  }

  /**
   * 나가기(연결 끊김 포함). 방에 없으면 아무것도 하지 않는다.
   * 방장이면 방을 지우고 참여자에게 `room:closed`를, 참여자면 `guest_id`만 비우고 방장에게 `room:state`를 보낸다.
   * 경기 중(`playing`)이면 `onLeave`가 기권패 처리·전적 저장을 끝낸 뒤에 방을 정리한다. 대기 중인 방장의 방을
   * 지우려는 사이에 상대가 입장했다면 지우기가 0행이 되고, 시작 커밋 뒤 이탈로 다시 처리한다.
   */
  async leave(userId: number, options: LeaveOptions = {}): Promise<void> {
    const reason = options.reason ?? 'leave_button';
    for (;;) {
      const room = await findRoomOf(this.db, userId);
      if (!room) return;
      const isHost = room.hostId === userId;
      if (room.status === 'playing') {
        await this.hooks.onLeave?.({ room, userId, reason });
      }
      const removed = isHost
        ? await deleteRoomOfHost(this.db, userId, room.status as 'waiting' | 'playing')
        : await clearGuestOf(this.db, userId);
      if (!removed) {
        if (room.status === 'playing') return; // 방이 이미 사라졌다
        continue; // 대기 중이던 방에 상대가 입장했다: 시작 커밋 뒤 이탈로 다시 본다
      }
      if (room.status !== 'playing') {
        await this.hooks.onLeave?.({ room: removed, userId, reason });
      }
      if (isHost) this.#announceClosed(removed, userId, options);
      else {
        if (options.notifySelf) this.#emitClosed(userId, removed.id, options.notifySelf);
        await this.#publishState(removed.id);
      }
      return;
    }
  }

  /** 방장이 나가 방이 닫혔다. 참여자에게(그리고 요청이 있으면 본인에게) `room:closed`를 보낸다. */
  #announceClosed(closed: RoomRow, hostId: number, options: LeaveOptions): void {
    if (closed.guestId !== null) {
      this.#emitClosed(closed.guestId, closed.id, options.guestReason ?? 'host_left');
    }
    if (options.notifySelf) this.#emitClosed(hostId, closed.id, options.notifySelf);
  }

  #emitClosed(userId: number, roomId: number, reason: RoomClosed['reason']): void {
    const payload: RoomClosed = { roomId, reason };
    this.registry.get(userId)?.emit('room:closed', payload);
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
   * 경기 서버(IMPL-009)가 연결하는 `onStarted`를 부른다. 입장 문장이 돌려준 행으로 스냅샷을 만들어
   * 쓰므로, 그 사이에 방장이 나가 방이 지워져도 시작 처리는 건너뛰지 않는다(그 이탈은 시작 뒤 이탈이다).
   * 알림 순서는 `room:state` → `onStarted` → 호출자의 ack다(API 문서의 이벤트 순서).
   */
  async #startOnJoin(joined: RoomRow): Promise<void> {
    const [host, guest] = await Promise.all([
      findUserById(this.db, joined.hostId),
      findUserById(this.db, joined.guestId!),
    ]);
    if (!host || !guest) return; // 사용자 행은 지워지지 않는다(FK restrict)
    const view: RoomView = { room: joined, host, guest };
    this.#emitState(view);
    try {
      await this.hooks.onStarted?.(view);
    } catch (error) {
      await this.#undoJoin(joined);
      throw error;
    }
  }

  /**
   * 경기를 열지 못했다(`onStarted` 실패): 입장을 되돌려 방을 대기 상태로 돌리고 방장에게 알린다.
   * 입장자는 ack의 `INTERNAL_ERROR`로 실패를 안다. 되돌리기도 실패하면 경기 없는 방이 남지 않게 방을 닫는다.
   */
  async #undoJoin(joined: RoomRow): Promise<void> {
    try {
      const reverted = await clearGuestOf(this.db, joined.guestId!);
      if (reverted) await this.#publishState(reverted.id);
    } catch {
      try {
        const closed = await deleteRoomById(this.db, joined.id);
        if (closed) this.#emitClosed(closed.hostId, closed.id, 'host_left');
      } catch {
        // 두 번째 실패는 원래 오류를 그대로 올려 로그로 남긴다.
      }
    }
  }

  async #publishState(roomId: number): Promise<void> {
    const view = await loadRoomView(this.db, roomId);
    if (view) this.#emitState(view);
  }

  /** 방 안 사용자 각각에게 `room:state`를 보낸다. `code`는 비공개 방의 방장에게만 담는다. */
  #emitState(view: RoomView): void {
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
