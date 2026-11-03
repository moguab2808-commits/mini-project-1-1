// 0002_user_appearance 마이그레이션이 동물 캐릭터를 쓰던 기존 행을 고정 기본 외형으로 바꾸는지 확인한다(IMPL-018).
// 실제 PostgreSQL이 필요하다. DATABASE_URL이 없으면 건너뛴다. 임시 데이터베이스를 만들어 쓰고 지운다.
import { randomBytes } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE } from '@alkkagi/shared';
import { MIGRATIONS_FOLDER, runMigrations } from './migrate.ts';
import { createPool } from './pool.ts';
import { withDatabase } from './temp-database.ts';

const baseUrl = process.env.DATABASE_URL;

/** 앞의 마이그레이션 n개만 담은 임시 폴더 */
function partialFolder(n: number): string {
  const dir = mkdtempSync(join(tmpdir(), 'alkkagi-mig-'));
  cpSync(MIGRATIONS_FOLDER, dir, { recursive: true });
  const journalPath = join(dir, 'meta', '_journal.json');
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: unknown[] };
  journal.entries = journal.entries.slice(0, n);
  writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}

describe.skipIf(!baseUrl)('users.appearance 마이그레이션', () => {
  const dbName = `alkkagi_test_${randomBytes(4).toString('hex')}`;
  let pool: pg.Pool;
  let folder: string;

  beforeAll(async () => {
    const admin = createPool(baseUrl!, { max: 1 });
    await admin.query(`CREATE DATABASE ${dbName}`);
    await admin.end();
    pool = createPool(withDatabase(baseUrl!, dbName), { max: 2 });
    folder = partialFolder(2);
    await runMigrations(pool, undefined, folder);
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
    if (folder) rmSync(folder, { recursive: true, force: true });
    const admin = createPool(baseUrl!, { max: 1 });
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.end();
  }, 60_000);

  it('기존 행은 고정 기본 외형이 되고 character_id 컬럼이 사라진다', async () => {
    await pool.query(
      `INSERT INTO users (nickname, password, character_id) VALUES ('곰', 'h', 'bear'), ('여우', 'h', 'fox')`,
    );
    await runMigrations(pool);
    const rows = await pool.query<{ nickname: string; appearance: unknown }>(
      `SELECT nickname, appearance FROM users ORDER BY id`,
    );
    expect(rows.rows).toEqual([
      { nickname: '곰', appearance: DEFAULT_APPEARANCE },
      { nickname: '여우', appearance: DEFAULT_APPEARANCE },
    ]);
    const cols = await pool.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'character_id'`,
    );
    expect(cols.rowCount).toBe(0);
    // 새 행도 기본 외형으로 들어간다
    await pool.query(`INSERT INTO users (nickname, password) VALUES ('새사람', 'h')`);
    const fresh = await pool.query(`SELECT appearance FROM users WHERE nickname = '새사람'`);
    expect(fresh.rows[0].appearance).toEqual(DEFAULT_APPEARANCE);
  });
});
