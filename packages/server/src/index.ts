import { createAppServer } from './app.ts';
import { loadConfig } from './config.ts';
import { createDb, createPool } from './db/pool.ts';
import { clearRooms } from './rooms/room-store.ts';

const config = loadConfig();
const pool = createPool(config.databaseUrl);
// 재시작으로 연결·경기가 사라졌으므로 남은 방은 유령 방이다(DATABASE 방 생명주기).
await clearRooms(createDb(pool));
const server = createAppServer({
  pool,
  sessionSecret: config.sessionSecret,
  isProduction: config.isProduction,
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
