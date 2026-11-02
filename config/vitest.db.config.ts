import { defineConfig } from 'vitest/config';

// DB 검증 테스트 전용 설정이다. `npm run test:db`로만 실행하며 로컬 .env의 DATABASE_URL을 읽는다.
// 공유 Neon 개발 DB에 임시 데이터베이스를 만들어 컴퓨트가 깨어나므로 기본 `npm test`에는 포함하지 않는다.
process.loadEnvFile('.env');

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.db.test.ts'],
    environment: 'node',
    // 원격 DB(Neon) 왕복 지연이 흔들려 기본 5초로는 간헐적으로 시간 초과가 난다.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
