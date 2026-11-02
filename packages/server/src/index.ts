import { createAppServer } from './app.ts';
import { loadConfig } from './config.ts';
import { createPool } from './db/pool.ts';

const config = loadConfig();
const pool = createPool(config.databaseUrl);
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
