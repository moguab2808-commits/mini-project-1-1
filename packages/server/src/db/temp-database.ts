import { randomBytes } from 'node:crypto';
import type pg from 'pg';
import { runMigrations } from './migrate.ts';
import { createPool } from './pool.ts';

export function withDatabase(url: string, database: string): string {
  const u = new URL(url);
  u.pathname = `/${database}`;
  return u.toString();
}

export type TempDatabase = { pool: pg.Pool; drop(): Promise<void> };

/**
 * 개발 DB의 데이터를 건드리지 않도록 임시 데이터베이스를 만들어 마이그레이션을 적용한다.
 * DB 검증 테스트(*.db.test.ts)만 쓴다. drop()이 풀을 닫고 데이터베이스를 지운다.
 */
export async function createTempDatabase(baseUrl: string): Promise<TempDatabase> {
  const name = `alkkagi_test_${randomBytes(4).toString('hex')}`;
  const admin = createPool(baseUrl, { max: 1 });
  await admin.query(`CREATE DATABASE ${name}`);
  await admin.end();

  const pool = createPool(withDatabase(baseUrl, name), { max: 4 });
  await runMigrations(pool);

  return {
    pool,
    async drop() {
      await pool.end();
      const cleanup = createPool(baseUrl, { max: 1 });
      await cleanup.query(`DROP DATABASE IF EXISTS ${name}`);
      await cleanup.end();
    },
  };
}
