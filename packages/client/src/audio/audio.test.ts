// 소리 엔진의 순수 부분(DEC-084). 실행: 루트에서 npm test
import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { THEME_IDS } from '@alkkagi/shared';
import { RequestStack, volumeToGain } from './engine.ts';
import { SOUND_FILES } from './files.ts';
import { SFX } from './sfx.ts';
import { TRACKS, composeMelody, stepsPerBar, type TrackId } from './music.ts';

describe('엔진', () => {
  test('요청은 우선순위가 높은 것(같으면 나중)을 고르고, 거두면 앞의 요청으로 돌아간다', () => {
    const r = new RequestStack<string>();
    const lobby = r.push('lobby', 0);
    assert.equal(r.top(), 'lobby');
    const game = r.push('beach', 10);
    r.push('lobby', 0);
    assert.equal(r.top(), 'beach');
    r.remove(game);
    assert.equal(r.top(), 'lobby');
    r.remove(lobby);
    assert.equal(r.top(), 'lobby');
  });

  test('음량 곡선은 0~1이고 0은 무음', () => {
    assert.equal(volumeToGain(0), 0);
    assert.equal(volumeToGain(100), 1);
    assert.equal(volumeToGain(150), 1);
    assert.ok(volumeToGain(50) < 0.5);
  });
});

describe('작곡', () => {
  test('곡마다 16마디 선율이 결정적으로 만들어지고 마디 안에 있다', () => {
    for (const id of Object.keys(TRACKS) as TrackId[]) {
      const def = TRACKS[id];
      const a = composeMelody(def);
      assert.deepEqual(composeMelody(def), a, id);
      const total = 16 * stepsPerBar(def);
      assert.ok(a.length > 30, `${id}: ${a.length}`);
      for (const n of a) {
        assert.ok(n.step >= 0 && n.step < total && n.len > 0, `${id} ${JSON.stringify(n)}`);
        assert.ok(n.pitch > -24 && n.pitch < 36, `${id} 음역 ${n.pitch}`);
      }
    }
  });
});

describe('녹음 파일 등록부', () => {
  const pub = fileURLToPath(new URL('../../public', import.meta.url));
  test('등록한 파일이 모두 있고, 효과음은 100KB 이하이며 키가 실제 소리·곡·테마다', () => {
    let total = 0;
    for (const [key, url] of Object.entries(SOUND_FILES)) {
      const path = `${pub}${url}`;
      assert.ok(existsSync(path), `${key}: ${path}`);
      const size = statSync(path).size;
      total += size;
      if (key.startsWith('music:')) assert.ok(key.slice(6) in TRACKS, key);
      else if (key.startsWith('ambience:'))
        assert.ok((THEME_IDS as readonly string[]).includes(key.slice(9)), key);
      else {
        assert.ok(key in SFX, key);
        assert.ok(size <= 100_000, `${key} ${size}B`);
      }
    }
    // 소리 파일 전체(에셋 전체 5MB 한도 안, TECH_STACK)
    assert.ok(total < 3_500_000, `${total}B`);
  });
});
