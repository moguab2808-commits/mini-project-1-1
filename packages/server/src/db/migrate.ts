import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type pg from 'pg';

export const MIGRATIONS_FOLDER = fileURLToPath(new URL('../../drizzle', import.meta.url));

// 적용한 마이그레이션은 기록 테이블에 남으므로 다시 실행해도 새로 만들 것이 없으면 아무것도 하지 않는다.
export async function runMigrations(
  pool: pg.Pool,
  migrationsSchema?: string,
  migrationsFolder: string = MIGRATIONS_FOLDER,
): Promise<void> {
  await migrate(drizzle(pool), { migrationsFolder, migrationsSchema });
}
