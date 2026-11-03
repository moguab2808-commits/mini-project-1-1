// 실행: 루트에서 npm test (Vitest)
import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  EMOTE_IDS,
  EmoteSendSchema,
  EmoteShownSchema,
  HazardUseSchema,
  ShotSubmitSchema,
} from './protocol.ts';

const base = { gameId: 'g', turnId: 1, stoneId: 0, angle: 0, power: 50 };

test('발사 각도는 (−π, π]만, 세기는 0 초과 100 이하만 받는다', () => {
  assert.equal(ShotSubmitSchema.safeParse(base).success, true);
  assert.equal(ShotSubmitSchema.safeParse({ ...base, angle: Math.PI }).success, true);
  for (const angle of [-Math.PI, Math.PI + 0.001, NaN, Infinity]) {
    assert.equal(ShotSubmitSchema.safeParse({ ...base, angle }).success, false, String(angle));
  }
  for (const power of [0, -1, 100.001, NaN]) {
    assert.equal(ShotSubmitSchema.safeParse({ ...base, power }).success, false, String(power));
  }
  assert.equal(ShotSubmitSchema.safeParse({ ...base, power: 100 }).success, true);
});

test('방해요소 사용 입력은 사용자 번호를 받지 않는다', () => {
  const r = HazardUseSchema.safeParse({ gameId: 'g', hazardInstanceId: 'h', userId: 9 });
  assert.equal(r.success, true);
  assert.equal('userId' in (r.data as object), false);
  assert.equal(HazardUseSchema.safeParse({ gameId: 'g' }).success, false);
});

test('감정표현은 승인된 6종만 받고 사용자·좌석 위조 필드를 받지 않는다', () => {
  for (const emote of EMOTE_IDS) {
    assert.equal(EmoteSendSchema.safeParse({ gameId: 'g', emote }).success, true);
    assert.equal(
      EmoteShownSchema.safeParse({ gameId: 'g', emote, seat: 1, atMs: 100 }).success,
      true,
    );
  }
  for (const cmd of [
    { gameId: '', emote: 'gg' },
    { gameId: 'g', emote: 'dance' },
    { gameId: 'g', emote: 'gg', seat: 1 },
  ]) {
    assert.equal(EmoteSendSchema.safeParse(cmd).success, false);
  }
});
