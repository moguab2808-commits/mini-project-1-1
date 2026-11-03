import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pg from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppServer, type AppServer } from './app.ts';

// 연결 풀은 요청이 DB를 건드릴 때만 연결하므로 이 테스트는 DB 없이 돌아간다.
describe('헬스체크·정적 파일·SPA fallback', () => {
  let dir: string;
  let pool: pg.Pool;
  let server: AppServer;

  beforeAll(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'alkkagi-static-'));
    mkdirSync(path.join(dir, 'assets'));
    writeFileSync(path.join(dir, 'index.html'), '<!doctype html><title>app</title>');
    writeFileSync(path.join(dir, 'assets', 'app.js'), 'console.log(1);');
    pool = new pg.Pool({ connectionString: 'postgres://unused:unused@127.0.0.1:1/unused' });
    server = createAppServer({
      pool,
      sessionSecret: 'x'.repeat(32),
      isProduction: false,
      staticDir: dir,
    });
  });

  afterAll(async () => {
    await server.close();
    await pool.end();
    rmSync(dir, { recursive: true, force: true });
  });

  const get = (url: string) => request(server.httpServer).get(url);

  it('/health는 DB 없이 200 { status: "ok" }를 돌려준다', async () => {
    const res = await get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('확장자 없는 경로는 index.html을 돌려준다', async () => {
    for (const url of ['/', '/lobby', '/room/abc']) {
      const res = await get(url).expect(200);
      expect(res.text).toContain('<title>app</title>');
    }
  });

  it('세션 쿠키가 있어도 정적 요청은 DB(세션 저장소)를 거치지 않는다', async () => {
    // 풀이 연결 불가라 세션 조회가 일어나면 200이 될 수 없다.
    await get('/lobby').set('Cookie', 'connect.sid=s%3Aabc.def').expect(200);
    await get('/assets/app.js').set('Cookie', 'connect.sid=s%3Aabc.def').expect(200);
  });

  it('있는 정적 자산은 그대로, 없는 정적 자산은 404다', async () => {
    await get('/assets/app.js').expect(200);
    const missing = await get('/assets/missing.js').expect(404);
    expect(missing.text).not.toContain('<title>app</title>');
  });

  it('/api 아래 없는 경로는 index.html로 대체하지 않고 404다', async () => {
    const res = await get('/api/unknown').expect(404);
    expect(res.text).not.toContain('<title>app</title>');
  });

  it('클라이언트 빌드가 없으면 정적 파일을 제공하지 않는다', async () => {
    const bare = createAppServer({
      pool,
      sessionSecret: 'x'.repeat(32),
      isProduction: false,
      staticDir: path.join(dir, 'none'),
    });
    await request(bare.httpServer).get('/lobby').expect(404);
    await request(bare.httpServer).get('/health').expect(200);
    await bare.close();
  });
});
