// 정적 에셋 용량(TECH_STACK 용량 한도: 에셋 전체 5MB, 1MB = 1,000,000B). 실행: 루트에서 npm test
import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const pub = fileURLToPath(new URL('../../public', import.meta.url));

const sizeOf = (dir: string): number =>
  readdirSync(dir, { withFileTypes: true }).reduce((sum, e) => {
    const p = join(dir, e.name);
    return sum + (e.isDirectory() ? sizeOf(p) : statSync(p).size);
  }, 0);

describe('정적 에셋', () => {
  test('로그인 배경 영상·포스터가 있고 영상은 1MB 이하다(IMPL-030)', () => {
    const video = join(pub, 'videos/login-bg.mp4');
    assert.ok(existsSync(video), video);
    assert.ok(existsSync(join(pub, 'images/login-bg-poster.webp')));
    assert.ok(statSync(video).size <= 1_000_000, `${statSync(video).size}B`);
  });

  test('public 전체가 5MB 한도 안이다', () => {
    const total = sizeOf(pub);
    assert.ok(total < 5_000_000, `${total}B`);
  });
});
