import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppServer } from './app.ts';
import { loadConfig } from './config.ts';
import { runMigrations } from './db/migrate.ts';
import { createDb, createPool } from './db/pool.ts';
import { clearRooms } from './rooms/room-store.ts';

// src와 dist 모두 packages/server 바로 아래라 마이그레이션 폴더·클라이언트 빌드가 같은 상대 경로에 있다.
const here = path.dirname(fileURLToPath(import.meta.url));

const config = loadConfig();
const pool = createPool(config.databaseUrl);
// 배포 시작 단계에서 마이그레이션을 적용한 뒤(DATABASE 마이그레이션), 재시작으로 연결·경기가 사라졌으므로
// 남은 방을 지운다(DATABASE 방 생명주기). 어느 쪽이든 실패하면 서버를 시작하지 않는다(OPERATIONS).
// 연결 문자열이 섞일 수 있어 메시지만 남긴다.
try {
  await runMigrations(pool, undefined, path.resolve(here, '../drizzle'));
  await clearRooms(createDb(pool));
} catch (error) {
  console.error(
    '마이그레이션·rooms 정리에 실패해 서버를 시작하지 않는다:',
    error instanceof Error ? error.message : error,
  );
  await pool.end().catch(() => undefined);
  process.exit(1);
}
const staticDir = path.resolve(here, '../../client/dist');
const server = createAppServer({
  pool,
  sessionSecret: config.sessionSecret,
  isProduction: config.isProduction,
  staticDir,
});

server.httpServer.listen(config.port, () => {
  console.log(`서버가 ${config.port}번 포트에서 실행 중이다.`);
});

async function shutdown() {
  await server.close();
  await pool.end();
  process.exit(0);
}
process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());
