export const UNIQUE_VIOLATION = '23505';
export const CHECK_VIOLATION = '23514';

export type PgErrorLike = { code?: string; constraint?: string };

/** drizzle이 감싼 오류의 원인(cause)까지 내려가 PostgreSQL 오류를 찾는다. */
export function findPgError(error: unknown): PgErrorLike | undefined {
  for (let current = error; current && typeof current === 'object';) {
    const candidate = current as PgErrorLike & { cause?: unknown };
    if (typeof candidate.code === 'string') return candidate;
    current = candidate.cause;
  }
  return undefined;
}
