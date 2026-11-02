import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.ts';

// Neon은 5분 동안 활동이 없으면 컴퓨트를 중지한다. 유휴 연결을 짧게 닫아 중지를 막지 않는다(OPERATIONS).
export const POOL_IDLE_TIMEOUT_MS = 10_000;
// 동시 접속 10명(5방) 규모라 연결을 적게 둔다.
export const POOL_MAX_CONNECTIONS = 5;

export function createPool(connectionString: string, options: pg.PoolConfig = {}): pg.Pool {
  return new pg.Pool({
    connectionString,
    max: POOL_MAX_CONNECTIONS,
    idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
    ...options,
  });
}

export function createDb(pool: pg.Pool) {
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;
