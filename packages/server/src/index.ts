import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppServer } from './app.ts';
import { loadConfig } from './config.ts';
import { createDb, createPool } from './db/pool.ts';
import { clearRooms } from './rooms/room-store.ts';

const config = loadConfig();
const pool = createPool(config.databaseUrl);
// 재시작으로 연결·경기가 사라졌으므로 남은 방은 유령 방이다(DATABASE 방 생명주기).
// 정리에 실패하면 서버를 시작하지 않는다(OPERATIONS). 연결 문자열이 섞일 수 있어 메시지만 남긴다.
try {
  await clearRooms(createDb(pool));
} catch (error) {
  console.error(
    'rooms 정리에 실패해 서버를 시작하지 않는다:',
    error instanceof Error ? error.message : error,
  );
  await pool.end().catch(() => undefined);
  process.exit(1);
}
// src와 dist 모두 packages/server 아래라 클라이언트 빌드가 같은 상대 경로에 있다.
const staticDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
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
