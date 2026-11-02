import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type pg from 'pg';
import { createPool } from './pool.ts';

export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));

// 적용한 마이그레이션은 기록 테이블에 남으므로 다시 실행해도 새로 만들 것이 없으면 아무것도 하지 않는다.
export async function runMigrations(pool: pg.Pool, migrationsSchema?: string): Promise<void> {
  await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER, migrationsSchema });
}

// `npm run db:migrate -w @alkkagi/server`로 실행한다. 값은 .env의 DATABASE_URL을 읽는다.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL이 설정되지 않았다.');
    process.exit(1);
  }
  const pool = createPool(url);
  try {
    await runMigrations(pool);
    console.log('마이그레이션을 적용했다.');
  } finally {
    await pool.end();
  }
}
