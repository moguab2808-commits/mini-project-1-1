import { randomInt } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { CharacterIdSchema, type CharacterId, type Me } from '@alkkagi/shared';
import type { Db, DbOrTx } from '../db/pool.ts';
import { users } from '../db/schema.ts';

export type User = typeof users.$inferSelect;

/** 대소문자를 무시한 닉네임 조회. `lower(nickname)` 유니크 인덱스를 탄다. */
export async function findUserByNickname(db: Db, nickname: string): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(sql`lower(${users.nickname}) = lower(${nickname})`)
    .limit(1);
  return user;
}

export async function findUserById(db: Db, id: number): Promise<User | undefined> {
  const [user] = await db
    .select()
    .from(users)
    .where(sql`${users.id} = ${id}`)
    .limit(1);
  return user;
}

export function randomCharacterId(): CharacterId {
  const ids = CharacterIdSchema.options;
  return ids[randomInt(ids.length)]!;
}

export async function insertUser(
  db: Db,
  values: { nickname: string; passwordHash: string; characterId: CharacterId },
): Promise<void> {
  await db.insert(users).values({
    nickname: values.nickname,
    password: values.passwordHash,
    characterId: values.characterId,
  });
}

export async function updateUserPassword(
  db: DbOrTx,
  id: number,
  passwordHash: string,
): Promise<void> {
  await db
    .update(users)
    .set({ password: passwordHash })
    .where(sql`${users.id} = ${id}`);
}

export async function updateUserCharacter(
  db: Db,
  id: number,
  characterId: CharacterId,
): Promise<User> {
  const [user] = await db
    .update(users)
    .set({ characterId })
    .where(sql`${users.id} = ${id}`)
    .returning();
  return user!;
}

/** 사용자 번호와 비밀번호 해시는 응답에 넣지 않는다. 무 = totalGames - wins - losses. */
export function toMe(user: User): Me {
  return {
    nickname: user.nickname,
    characterId: user.characterId as CharacterId,
    record: {
      totalGames: user.totalGames,
      wins: user.wins,
      losses: user.losses,
      draws: user.totalGames - user.wins - user.losses,
    },
  };
}
