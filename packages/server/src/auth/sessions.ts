import type { Request } from 'express';
import type pg from 'pg';

/** 로그인 성공 시 세션 고정 공격을 막으려고 새 세션 ID를 발급하고 사용자 번호를 담는다. */
export function startSession(req: Request, userId: number): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((regenerateError) => {
      if (regenerateError) return reject(regenerateError as Error);
      req.session.userId = userId;
      req.session.save((saveError) => (saveError ? reject(saveError as Error) : resolve()));
    });
  });
}

export function endSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error as Error) : resolve()));
  });
}

/**
 * 같은 사용자의 다른 세션 행을 모두 삭제하고 지운 세션 ID를 돌려준다(현재 세션은 남긴다).
 * 세션 테이블은 users와 FK로 묶지 않아 sess JSON의 userId로 찾는다(DATABASE).
 */
export async function deleteOtherSessions(
  pool: pg.Pool,
  userId: number,
  currentSid: string,
): Promise<string[]> {
  const result = await pool.query<{ sid: string }>(
    `DELETE FROM session WHERE (sess ->> 'userId') = $1 AND sid <> $2 RETURNING sid`,
    [String(userId), currentSid],
  );
  return result.rows.map((row) => row.sid);
}
