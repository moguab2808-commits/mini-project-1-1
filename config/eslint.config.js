import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// 패키지 의존 경계(LOCAL 패키지 구성): client와 server는 서로, 하위 패키지는 상위 패키지를 참조하지 않는다.
const pkg = (name) => ({
  group: [`@alkkagi/${name}`, `@alkkagi/${name}/*`],
});
const forbid = (message, ...names) => ({
  'no-restricted-imports': [
    'error',
    { patterns: names.map((name) => ({ ...pkg(name), message })) },
  ],
});

// game-core는 순수 TypeScript다. 네트워크·DB·DOM·화면 라이브러리와 Node 입출력을 참조하지 않는다.
const IMPURE_MODULES = [
  'express',
  'express-*',
  'socket.io',
  'socket.io-*',
  'pg',
  'connect-pg-simple',
  'drizzle-orm',
  'drizzle-orm/*',
  'react',
  'react-dom',
  'react-dom/*',
  'three',
  'three/*',
  '@react-three/*',
];
// Node 입출력은 테스트 파일(node:assert 등)을 제외하고 막는다.
const NODE_IO_MODULES = ['node:*', 'http', 'https', 'net', 'fs', 'fs/promises'];
const IMPURE_GLOBALS = [
  'window',
  'document',
  'navigator',
  'localStorage',
  'sessionStorage',
  'fetch',
  'WebSocket',
  'XMLHttpRequest',
  'Worker',
  'SharedWorker',
  'MessagePort',
  'process',
].map((name) => ({ name, message: 'game-core는 네트워크·DB·DOM·Node 환경을 참조하지 않는다.' }));

export default tseslint.config(
  { ignores: ['**/dist/**', 'node_modules/**', '*.html'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['packages/client/**/*.{ts,tsx}'],
    rules: forbid('client는 server를 참조하지 않는다.', 'server'),
  },
  {
    files: ['packages/server/**/*.ts'],
    rules: forbid('server는 client를 참조하지 않는다.', 'client'),
  },
  {
    files: ['packages/shared/**/*.ts'],
    rules: forbid(
      'shared는 다른 패키지를 참조하지 않는다.',
      'client',
      'server',
      'game-core',
      'game-runtime',
    ),
  },
  {
    files: ['packages/game-runtime/**/*.ts'],
    rules: forbid('game-runtime은 client·server를 참조하지 않는다.', 'client', 'server'),
  },
  {
    files: ['packages/game-core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...['client', 'server', 'game-runtime'].map((name) => ({
              ...pkg(name),
              message: 'game-core는 shared 외 다른 패키지를 참조하지 않는다.',
            })),
            {
              group: [...IMPURE_MODULES, ...NODE_IO_MODULES],
              message: 'game-core는 네트워크·DB·DOM·Node 입출력을 참조하지 않는다.',
            },
          ],
        },
      ],
      'no-restricted-globals': ['error', ...IMPURE_GLOBALS],
    },
  },
  {
    files: ['packages/game-core/**/*.test.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...['client', 'server', 'game-runtime'].map((name) => ({
              ...pkg(name),
              message: 'game-core는 shared 외 다른 패키지를 참조하지 않는다.',
            })),
            {
              group: IMPURE_MODULES,
              message: 'game-core는 네트워크·DB·DOM 라이브러리를 참조하지 않는다.',
            },
          ],
        },
      ],
    },
  },
);
