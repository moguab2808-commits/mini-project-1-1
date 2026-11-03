import { runMigrations } from './migrate.ts';
import { createPool } from './pool.ts';

// 서버 번들에 실행 코드가 섞이지 않도록 `migrate.ts`와 분리했다.
// `npm run db:migrate -w @alkkagi/server`로 실행하며 값은 .env의 DATABASE_URL을 읽는다.
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
