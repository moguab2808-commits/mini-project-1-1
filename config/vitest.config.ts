import { defineConfig } from 'vitest/config';

// DB 검증 테스트가 로컬 .env의 DATABASE_URL을 읽는다. 파일이 없으면 해당 테스트는 건너뛴다.
try {
  process.loadEnvFile('.env');
} catch {
  // .env 없음
}

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    environment: 'node',
  },
});
