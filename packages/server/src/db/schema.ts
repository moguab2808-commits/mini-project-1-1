import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  json,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

// 제약 이름은 서버가 위반한 제약을 구분해 오류 코드로 매핑하는 데 쓴다(DATABASE 방 생명주기).
export const ROOM_CONSTRAINTS = {
  hostUnique: 'rooms_host_id_unique',
  guestUnique: 'rooms_guest_id_unique',
  codeUnique: 'rooms_code_unique',
} as const;

export const users = pgTable(
  'users',
  {
    id: serial('id').primaryKey(),
    // 앱이 NFC로 정규화해 저장한다. 대소문자 무시 중복은 아래 lower() 유니크 인덱스가 막는다.
    nickname: varchar('nickname', { length: 12 }).notNull(),
    // argon2id 해시값이다(원문 아님). 컬럼명이 원문처럼 보이므로 주의한다.
    password: text('password').notNull(),
    // 캐릭터 값은 앱(Zod)만 검사하고 DB CHECK는 두지 않는다.
    characterId: varchar('character_id', { length: 16 }).notNull(),
    // 승·패·무 모두 포함한다. 무 = total_games - wins - losses.
    totalGames: integer('total_games').notNull().default(0),
    wins: integer('wins').notNull().default(0),
    losses: integer('losses').notNull().default(0),
  },
  (t) => [
    uniqueIndex('users_nickname_lower_idx').on(sql`lower(${t.nickname})`),
    check('users_total_games_nonneg', sql`${t.totalGames} >= 0`),
    check('users_wins_nonneg', sql`${t.wins} >= 0`),
    check('users_losses_nonneg', sql`${t.losses} >= 0`),
    check('users_record_within_total', sql`${t.wins} + ${t.losses} <= ${t.totalGames}`),
  ],
);

export const rooms = pgTable(
  'rooms',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 20 }).notNull(),
    // 한 사용자가 방을 둘 만들지 못한다.
    hostId: integer('host_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' })
      .unique(ROOM_CONSTRAINTS.hostUnique),
    // 상대가 없으면 null이다(null은 여러 개 허용). 한 사용자가 두 방의 참여자가 되지 못한다.
    guestId: integer('guest_id')
      .references(() => users.id, { onDelete: 'restrict' })
      .unique(ROOM_CONSTRAINTS.guestUnique),
    isPublic: boolean('is_public').notNull(),
    // 비공개 방 입장 코드다. 사용자 비밀번호가 아니므로 해시하지 않고 그대로 저장한다.
    code: varchar('code', { length: 6 }).unique(ROOM_CONSTRAINTS.codeUnique),
    pieceCount: integer('piece_count').notNull().default(5),
    // 판 값은 앱(Zod)만 검사한다.
    board: varchar('board', { length: 16 }).notNull(),
    // 방 테마(DEC-051). 판처럼 값은 앱(Zod)만 검사한다. 기본값이 있어 기존 행과 충돌하지 않는다.
    theme: varchar('theme', { length: 16 }).notNull().default('bar'),
    status: varchar('status', { length: 16 }).notNull().default('waiting'),
  },
  (t) => [
    check(
      'rooms_public_code',
      sql`(${t.isPublic} AND ${t.code} IS NULL) OR (NOT ${t.isPublic} AND ${t.code} IS NOT NULL)`,
    ),
    check('rooms_piece_count', sql`${t.pieceCount} IN (5, 7, 9)`),
    check('rooms_status', sql`${t.status} IN ('waiting', 'playing')`),
    check('rooms_not_own_guest', sql`${t.guestId} IS NULL OR ${t.guestId} <> ${t.hostId}`),
  ],
);

// connect-pg-simple 기본 스키마(table.sql)와 같다. 라이브러리의 자동 생성은 켜지 않고 마이그레이션으로 만든다.
// users와 FK로 묶지 않는다. sid의 `COLLATE "default"`는 데이터베이스 기본 콜레이션과 같아 생략했다.
export const session = pgTable(
  'session',
  {
    sid: varchar('sid').primaryKey(),
    sess: json('sess').notNull(),
    expire: timestamp('expire', { precision: 6 }).notNull(),
  },
  (t) => [index('IDX_session_expire').on(t.expire)],
);
