import { defineConfig } from 'tsup';

// 워크스페이스 패키지는 TS 소스로 소비하므로 번들에 포함한다.
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  noExternal: [/^@alkkagi\//],
  clean: true,
});
