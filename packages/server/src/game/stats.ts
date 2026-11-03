// 경기 종료 저장(DATABASE "경기 종료 저장"): 두 사용자의 total_games·wins·losses만 한 트랜잭션에서 갱신한다.
import { asc, inArray, sql } from 'drizzle-orm';
import type { Seat } from '@alkkagi/shared';
import type { Db } from '../db/pool.ts';
import { users } from '../db/schema.ts';

/**
 * 승자는 total_games·wins, 패자는 total_games·losses를 올리고 무승부(`winnerSeat`가 null)는 두 사람의
 * total_games만 올린다. 무승부 수는 저장하지 않고 `total_games - wins - losses`로 계산한다.
 * 두 행을 id 오름차순으로 `FOR UPDATE` 잠근 뒤 갱신해 동시 종료의 교착을 막는다.
 * 같은 경기를 두 번 저장하지 않는 것은 호출한 쪽의 `finishOnce`가 맡는다.
 */
export async function recordResult(
  db: Db,
  userIds: readonly [number, number],
  winnerSeat: Seat | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .select({ id: users.id })
      .from(users)
      .where(inArray(users.id, [...userIds]))
      .orderBy(asc(users.id))
      .for('update');
    for (const seat of [0, 1] as const) {
      const won = winnerSeat === seat;
      const lost = winnerSeat !== null && !won;
      await tx
        .update(users)
        .set({
          totalGames: sql`${users.totalGames} + 1`,
          ...(won ? { wins: sql`${users.wins} + 1` } : {}),
          ...(lost ? { losses: sql`${users.losses} + 1` } : {}),
        })
        .where(sql`${users.id} = ${userIds[seat]}`);
    }
  });
}
