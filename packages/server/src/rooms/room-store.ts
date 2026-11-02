// `rooms` 테이블 접근. 방 생명주기의 DB 쪽 규칙은 docs/design/DATABASE.md의 "방 생명주기"를 따른다.
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import type { BoardId, RoomCreate } from '@alkkagi/shared';
import type { Db } from '../db/pool.ts';
import { CHECK_VIOLATION, UNIQUE_VIOLATION, findPgError } from '../db/pg-error.ts';
import { ROOM_CONSTRAINTS, rooms, users } from '../db/schema.ts';
import type { User } from '../auth/users.ts';
import { roomErrors } from './errors.ts';

export type RoomRow = typeof rooms.$inferSelect;
export type RoomView = { room: RoomRow; host: User; guest: User | null };

const OWN_GUEST_CHECK = 'rooms_not_own_guest';

/**
 * 쓰기 중 난 제약 위반을 방 오류로 바꾼다. 위반한 제약 이름으로 구분한다.
 * 한 사람 한 방(host_id·guest_id 유니크), 코드 중복, 자기 방의 참여자가 되려는 시도를 다룬다.
 */
function mapWriteError(error: unknown): unknown {
  const pg = findPgError(error);
  if (pg?.code === UNIQUE_VIOLATION) {
    if (pg.constraint === ROOM_CONSTRAINTS.codeUnique) return roomErrors.codeTaken();
    if (
      pg.constraint === ROOM_CONSTRAINTS.hostUnique ||
      pg.constraint === ROOM_CONSTRAINTS.guestUnique
    ) {
      return roomErrors.alreadyInRoom();
    }
  }
  if (pg?.code === CHECK_VIOLATION && pg.constraint === OWN_GUEST_CHECK) {
    return roomErrors.alreadyInRoom();
  }
  return error;
}

async function guarded<T>(task: Promise<T>): Promise<T> {
  try {
    return await task;
  } catch (error) {
    throw mapWriteError(error);
  }
}

export async function findRoomById(db: Db, roomId: number): Promise<RoomRow | undefined> {
  const [row] = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
  return row;
}

export async function findRoomByCode(db: Db, code: string): Promise<RoomRow | undefined> {
  const [row] = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
  return row;
}

/** 사용자가 방장이거나 참여자인 방 */
export async function findRoomOf(db: Db, userId: number): Promise<RoomRow | undefined> {
  const [row] = await db
    .select()
    .from(rooms)
    .where(or(eq(rooms.hostId, userId), eq(rooms.guestId, userId)))
    .limit(1);
  return row;
}

/** 방과 방장·참여자 사용자 행을 한 번에 읽는다. */
export async function loadRoomView(db: Db, roomId: number): Promise<RoomView | undefined> {
  const guestUser = alias(users, 'guest_user');
  const [row] = await db
    .select({ room: rooms, host: users, guest: guestUser })
    .from(rooms)
    .innerJoin(users, eq(users.id, rooms.hostId))
    .leftJoin(guestUser, eq(guestUser.id, rooms.guestId))
    .where(eq(rooms.id, roomId))
    .limit(1);
  return row;
}

export async function listRoomViews(db: Db): Promise<{ room: RoomRow; host: User }[]> {
  return db
    .select({ room: rooms, host: users })
    .from(rooms)
    .innerJoin(users, eq(users.id, rooms.hostId))
    .orderBy(asc(rooms.id));
}

export async function insertRoom(
  db: Db,
  hostId: number,
  input: RoomCreate & { board: BoardId },
): Promise<RoomRow> {
  const [row] = await guarded(
    db
      .insert(rooms)
      .values({
        title: input.title,
        hostId,
        isPublic: input.isPublic,
        code: input.isPublic ? null : (input.code ?? null),
        pieceCount: input.pieceCount,
        board: input.board,
      })
      .returning(),
  );
  return row!;
}

/**
 * 조건부 입장: 참여자가 비어 있고 대기 중일 때만 `guest_id`를 채우고 같은 문장에서 `playing`으로 바꾼다
 * (상대가 입장하면 바로 시작한다). 0행이면 `undefined`다. 비공개 방은 코드가 같을 때만 갱신한다.
 */
export async function claimGuestSeat(
  db: Db,
  roomId: number,
  userId: number,
  code: string | undefined,
): Promise<RoomRow | undefined> {
  const [row] = await guarded(
    db
      .update(rooms)
      .set({ guestId: userId, status: 'playing' })
      .where(
        and(
          eq(rooms.id, roomId),
          isNull(rooms.guestId),
          eq(rooms.status, 'waiting'),
          code === undefined
            ? eq(rooms.isPublic, true)
            : or(eq(rooms.isPublic, true), eq(rooms.code, code)),
        ),
      )
      .returning(),
  );
  return row;
}

/**
 * 즉시 참가: 대기 중인 공개 방 중 무작위 하나의 참여자 자리를 채우고 `playing`으로 바꾼다(한 문장).
 * 다른 요청이 이미 잠근 방은 건너뛰어(SKIP LOCKED) 동시에 즉시 참가해도 서로 다른 방이나 `undefined`가 된다.
 */
export async function claimRandomPublicRoom(db: Db, userId: number): Promise<RoomRow | undefined> {
  const [row] = await guarded(
    db
      .update(rooms)
      .set({ guestId: userId, status: 'playing' })
      .where(
        and(
          isNull(rooms.guestId),
          eq(rooms.status, 'waiting'),
          sql`${rooms.id} = (
            SELECT r.id FROM rooms r
            WHERE r.is_public AND r.guest_id IS NULL AND r.status = 'waiting'
            ORDER BY random() LIMIT 1
            FOR UPDATE SKIP LOCKED
          )`,
        ),
      )
      .returning(),
  );
  return row;
}

/** 방장이 나가 방을 지운다. 지운 방을 돌려준다(없으면 `undefined`). */
export async function deleteRoomOfHost(db: Db, userId: number): Promise<RoomRow | undefined> {
  const [row] = await db.delete(rooms).where(eq(rooms.hostId, userId)).returning();
  return row;
}

/** 참여자가 나간다. `guest_id`를 비우고 `playing`이었다면 같은 문장에서 `waiting`으로 돌린다. */
export async function clearGuestOf(db: Db, userId: number): Promise<RoomRow | undefined> {
  const [row] = await db
    .update(rooms)
    .set({ guestId: null, status: 'waiting' })
    .where(eq(rooms.guestId, userId))
    .returning();
  return row;
}

/** 서버 시작 때 모든 방을 지운다. 재시작으로 연결·경기가 사라졌는데 방만 남으면 유령 방이 보인다. */
export async function clearRooms(db: Db): Promise<void> {
  await db.delete(rooms);
}
