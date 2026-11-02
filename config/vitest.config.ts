import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['packages/*/src/**/*.test.ts'],
    // DB 검증 테스트(*.db.test.ts)는 npm run test:db로만 실행한다.
    exclude: ['**/node_modules/**', '**/*.db.test.ts'],
    environment: 'node',
  },
});
