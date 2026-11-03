import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runMigrations } from './migrate.ts';
import { createPool, POOL_IDLE_TIMEOUT_MS } from './pool.ts';

// 실제 PostgreSQL이 필요하다. DATABASE_URL이 없으면 건너뛴다.
// 개발 DB의 데이터를 건드리지 않도록 임시 데이터베이스를 만들어 쓰고 끝나면 지운다.
const baseUrl = process.env.DATABASE_URL;

function withDatabase(url: string, database: string): string {
  const u = new URL(url);
  u.pathname = `/${database}`;
  return u.toString();
}

async function expectViolation(
  pool: pg.Pool,
  sql: string,
  params: unknown[],
  code: string,
  constraint?: string,
) {
  const err = await pool.query(sql, params).then(
    () => null,
    (e: unknown) => e as pg.DatabaseError,
  );
  expect(err, `거부돼야 한다: ${sql}`).not.toBeNull();
  expect(err?.code).toBe(code);
  if (constraint) expect(err?.constraint).toBe(constraint);
}

const UNIQUE = '23505';
const CHECK = '23514';
const FK = '23503';

describe.skipIf(!baseUrl)('DB 스키마·마이그레이션', () => {
  const dbName = `alkkagi_test_${randomBytes(4).toString('hex')}`;
  let pool: pg.Pool;

  const addUser = (nickname: string) =>
    pool.query<{ id: number }>(
      `INSERT INTO users (nickname, password) VALUES ($1, 'hash') RETURNING id`,
      [nickname],
    );

  beforeAll(async () => {
    const admin = createPool(baseUrl!, { max: 1 });
    await admin.query(`CREATE DATABASE ${dbName}`);
    await admin.end();
    pool = createPool(withDatabase(baseUrl!, dbName), { max: 2 });
    await runMigrations(pool);
  }, 60_000);

  afterAll(async () => {
    await pool?.end();
    const admin = createPool(baseUrl!, { max: 1 });
    await admin.query(`DROP DATABASE IF EXISTS ${dbName}`);
    await admin.end();
  }, 60_000);

  describe('정상', () => {
    it('users·rooms·session 테이블이 생기고 닉네임에 lower() 유니크 인덱스가 있다', async () => {
      const tables = await pool.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
      );
      expect(tables.rows.map((r) => r.table_name)).toEqual(
        expect.arrayContaining(['users', 'rooms', 'session']),
      );

      const idx = await pool.query<{ indexdef: string }>(
        `SELECT indexdef FROM pg_indexes WHERE indexname = 'users_nickname_lower_idx'`,
      );
      expect(idx.rows[0]?.indexdef).toMatch(
        /CREATE UNIQUE INDEX .*\(lower\(\(nickname\)::text\)\)/,
      );
    });

    it('session 테이블이 connect-pg-simple 기본 스키마(sid·sess·expire, PK, expire 인덱스)와 같다', async () => {
      const cols = await pool.query<{
        column_name: string;
        data_type: string;
        is_nullable: string;
        datetime_precision: number | null;
      }>(
        `SELECT column_name, data_type, is_nullable, datetime_precision FROM information_schema.columns
         WHERE table_name = 'session' ORDER BY column_name`,
      );
      expect(cols.rows).toEqual([
        {
          column_name: 'expire',
          data_type: 'timestamp without time zone',
          is_nullable: 'NO',
          datetime_precision: 6,
        },
        { column_name: 'sess', data_type: 'json', is_nullable: 'NO', datetime_precision: null },
        {
          column_name: 'sid',
          data_type: 'character varying',
          is_nullable: 'NO',
          datetime_precision: null,
        },
      ]);
      const pk = await pool.query(
        `SELECT 1 FROM pg_constraint WHERE conname = 'session_pkey' AND contype = 'p'`,
      );
      expect(pk.rowCount).toBe(1);
      const idx = await pool.query(
        `SELECT 1 FROM pg_indexes WHERE tablename = 'session' AND indexname = 'IDX_session_expire'`,
      );
      expect(idx.rowCount).toBe(1);
    });

    it('유효한 사용자·공개 방·비공개 방이 들어간다', async () => {
      const a = (await addUser('정상A')).rows[0]!.id;
      const b = (await addUser('정상B')).rows[0]!.id;
      const c = (await addUser('정상C')).rows[0]!.id;
      await pool.query(
        `INSERT INTO rooms (title, host_id, is_public, board) VALUES ('공개', $1, true, 'b1')`,
        [a],
      );
      await pool.query(
        `INSERT INTO rooms (title, host_id, is_public, code, board) VALUES ('비공개', $1, false, 'ABC234', 'b1')`,
        [b],
      );
      // guest_id는 null이 여러 개여도 된다. 위 두 방이 이미 그 경우다.
      await pool.query(`UPDATE rooms SET guest_id = $1 WHERE host_id = $2`, [c, a]);
    });
  });

  describe('오류: 제약 위반은 DB가 거부한다', () => {
    it('닉네임이 대소문자만 다르면 중복이다', async () => {
      await addUser('Dupe');
      await expectViolation(
        pool,
        `INSERT INTO users (nickname, password) VALUES ($1, 'h')`,
        ['dUPE'],
        UNIQUE,
        'users_nickname_lower_idx',
      );
    });

    it('음수 전적과 wins + losses > total_games를 거부한다', async () => {
      const ins = `INSERT INTO users (nickname, password, total_games, wins, losses) VALUES ($1, 'h', $2, $3, $4)`;
      // total_games가 음수면 wins + losses <= total_games도 함께 깨져 어느 제약이 먼저 보고될지 정해져 있지 않다.
      await expectViolation(pool, ins, ['음수1', -1, 0, 0], CHECK);
      await expectViolation(pool, ins, ['음수2', 0, -1, 0], CHECK, 'users_wins_nonneg');
      await expectViolation(pool, ins, ['음수3', 0, 0, -1], CHECK, 'users_losses_nonneg');
      await expectViolation(pool, ins, ['초과', 3, 2, 2], CHECK, 'users_record_within_total');
      await pool.query(ins, ['무승부포함', 3, 1, 1]);
    });

    it('공개 방에 코드가 있거나 비공개 방에 코드가 없으면 거부한다', async () => {
      const host = (await addUser('코드검사')).rows[0]!.id;
      await expectViolation(
        pool,
        `INSERT INTO rooms (title, host_id, is_public, code, board) VALUES ('x', $1, true, 'ABC234', 'b1')`,
        [host],
        CHECK,
        'rooms_public_code',
      );
      await expectViolation(
        pool,
        `INSERT INTO rooms (title, host_id, is_public, board) VALUES ('x', $1, false, 'b1')`,
        [host],
        CHECK,
        'rooms_public_code',
      );
    });

    it('자기 방 입장(guest_id = host_id)을 거부한다', async () => {
      const host = (await addUser('자기방')).rows[0]!.id;
      await expectViolation(
        pool,
        `INSERT INTO rooms (title, host_id, guest_id, is_public, board) VALUES ('x', $1, $1, true, 'b1')`,
        [host],
        CHECK,
        'rooms_not_own_guest',
      );
    });

    it('알 개수·상태 값 제한과 사용자 FK를 지킨다', async () => {
      const host = (await addUser('값검사')).rows[0]!.id;
      await expectViolation(
        pool,
        `INSERT INTO rooms (title, host_id, is_public, piece_count, board) VALUES ('x', $1, true, 6, 'b1')`,
        [host],
        CHECK,
        'rooms_piece_count',
      );
      await expectViolation(
        pool,
        `INSERT INTO rooms (title, host_id, is_public, status, board) VALUES ('x', $1, true, 'done', 'b1')`,
        [host],
        CHECK,
        'rooms_status',
      );
      await expectViolation(
        pool,
        `INSERT INTO rooms (title, host_id, is_public, board) VALUES ('x', 999999, true, 'b1')`,
        [],
        FK,
      );
    });

    it('한 사용자가 방을 둘 만들거나 두 방의 참여자가 되거나 코드가 겹치면 제약 이름과 함께 거부한다', async () => {
      const h1 = (await addUser('유니크1')).rows[0]!.id;
      const h2 = (await addUser('유니크2')).rows[0]!.id;
      const g = (await addUser('유니크3')).rows[0]!.id;
      await pool.query(
        `INSERT INTO rooms (title, host_id, guest_id, is_public, board) VALUES ('r1', $1, $2, true, 'b1')`,
        [h1, g],
      );
      await expectViolation(
        pool,
        `INSERT INTO rooms (title, host_id, is_public, board) VALUES ('r', $1, true, 'b1')`,
        [h1],
        UNIQUE,
        'rooms_host_id_unique',
      );
      await expectViolation(
        pool,
        `INSERT INTO rooms (title, host_id, guest_id, is_public, board) VALUES ('r', $1, $2, true, 'b1')`,
        [h2, g],
        UNIQUE,
        'rooms_guest_id_unique',
      );
      await pool.query(
        `INSERT INTO rooms (title, host_id, is_public, code, board) VALUES ('p', $1, false, 'ZZZ999', 'b1')`,
        [h2],
      );
      const h3 = (await addUser('유니크4')).rows[0]!.id;
      await expectViolation(
        pool,
        `INSERT INTO rooms (title, host_id, is_public, code, board) VALUES ('p', $1, false, 'ZZZ999', 'b1')`,
        [h3],
        UNIQUE,
        'rooms_code_unique',
      );
    });
  });

  describe('예외', () => {
    it('마이그레이션을 다시 적용해도 오류가 없고 스키마가 그대로다', async () => {
      const before = await pool.query(
        `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`,
      );
      await expect(runMigrations(pool)).resolves.toBeUndefined();
      const after = await pool.query(
        `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'`,
      );
      expect(after.rows[0]).toEqual(before.rows[0]);
    });

    it('연결 풀의 유휴 시간이 Neon 비활성 중지(5분)보다 훨씬 짧다', () => {
      const p = createPool(baseUrl!, { max: 1 });
      expect(p.options.idleTimeoutMillis).toBe(POOL_IDLE_TIMEOUT_MS);
      expect(POOL_IDLE_TIMEOUT_MS).toBeLessThanOrEqual(30_000);
      void p.end();
    });
  });
});
