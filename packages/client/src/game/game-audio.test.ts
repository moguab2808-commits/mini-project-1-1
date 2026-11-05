// 경기 소리 판단(DEC-084). 실행: 루트에서 npm test
import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { EMOTE_IDS, HAZARD_KINDS } from '@alkkagi/shared';
import {
  EMOTE_SFX,
  HAZARD_SFX,
  countdownSecond,
  detectStoneSounds,
  resultSfx,
} from './game-audio.ts';
import { SFX } from '../audio/sfx.ts';

const st = (id: number, x: number, y: number, h = 0) => ({ id, ownerId: 0 as const, x, y, h });
const fresh = () => ({
  touching: new Set<string>(),
  captured: new Set<number>(),
  pits: [] as { x: number; y: number }[],
  magnets: [] as { x: number; y: number }[],
});

describe('알 소리 추정', () => {
  test('빠르게 다가와 닿으면 한 번만 딱 소리를 내고, 붙어 있는 동안은 다시 내지 않는다', () => {
    const c = fresh();
    const a = detectStoneSounds(
      [st(1, 0, 0), st(2, 5, 0)],
      [st(1, 2.5, 0), st(2, 5, 0)],
      1 / 30,
      c,
    );
    assert.deepEqual(
      a.map((s) => s.kind),
      ['clack'],
    );
    const b = detectStoneSounds(
      [st(1, 2.5, 0), st(2, 5, 0)],
      [st(1, 2.6, 0), st(2, 5.2, 0)],
      1 / 30,
      c,
    );
    assert.equal(b.length, 0);
  });

  test('느리게 스치거나 멀리 있으면 소리가 없다', () => {
    assert.equal(
      detectStoneSounds(
        [st(1, 0, 0), st(2, 2.5, 0)],
        [st(1, 0.05, 0), st(2, 2.5, 0)],
        1 / 30,
        fresh(),
      ).length,
      0,
    );
    assert.equal(
      detectStoneSounds([st(1, 0, 0), st(2, 9, 0)], [st(1, 3, 0), st(2, 9, 0)], 1 / 30, fresh())
        .length,
      0,
    );
  });

  test('사라진 알은 구멍 안이면 pit, 아니면 fall', () => {
    const c = fresh();
    c.pits.push({ x: 10, y: 10 });
    const s = detectStoneSounds([st(1, 10, 10), st(2, -25, 0)], [], 1 / 30, c);
    assert.deepEqual(s.map((x) => x.kind).sort(), ['fall', 'pit']);
  });

  test('떠오름·착지', () => {
    assert.deepEqual(
      detectStoneSounds([st(1, 0, 0, 0)], [st(1, 1, 0, 1)], 1 / 30, fresh()).map((s) => s.kind),
      ['lift'],
    );
    assert.deepEqual(
      detectStoneSounds([st(1, 0, 0, 1)], [st(1, 1, 0, 0)], 1 / 30, fresh()).map((s) => s.kind),
      ['land'],
    );
  });

  test('자석 범위로 움직여 들어온 알은 한 번만 빨려 드는 소리를 낸다', () => {
    const c = fresh();
    c.magnets.push({ x: 0, y: 0 });
    const a = detectStoneSounds([st(1, 10, 0)], [st(1, 8, 0)], 1 / 30, c);
    assert.deepEqual(
      a.map((s) => s.kind),
      ['magnet_suck'],
    );
    assert.equal(detectStoneSounds([st(1, 8, 0)], [st(1, 6, 0)], 1 / 30, c).length, 0);
    // 멈춰 있던 알은 소리가 없다
    assert.equal(detectStoneSounds([st(2, 3, 0)], [st(2, 3, 0)], 1 / 30, fresh()).length, 0);
  });
});

describe('소리 대응표', () => {
  test('방해요소 19종·감정표현 6종 모두 있는 효과음에 이어진다', () => {
    for (const k of HAZARD_KINDS) assert.ok(HAZARD_SFX[k] in SFX, k);
    for (const e of EMOTE_IDS) assert.ok(EMOTE_SFX[e] in SFX, e);
  });

  test('결과 효과음은 내 좌석 기준이다', () => {
    assert.equal(resultSfx({ winnerId: 0 }, 0), 'win');
    assert.equal(resultSfx({ winnerId: 0 }, 1), 'lose');
    assert.equal(resultSfx({ winnerId: null }, 1), 'draw');
  });

  test('남은 시간 째깍은 5초부터 1초까지 초마다 한 번', () => {
    assert.equal(countdownSecond(6000, null), null);
    assert.equal(countdownSecond(4900, null), 5);
    assert.equal(countdownSecond(4500, 5), null);
    assert.equal(countdownSecond(3990, 5), 4);
    assert.equal(countdownSecond(10, 2), 1);
    assert.equal(countdownSecond(0, 1), null);
  });
});
