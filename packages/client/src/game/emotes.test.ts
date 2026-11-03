import { describe, it, expect, vi } from 'vitest';
import { EmoteController, emoteForKey, emoteAgeMs } from './emotes.ts';
import { emoteMotion } from './scene/emote-motion.ts';

describe('감정표현 입력', () => {
  it('숫자열·숫자패드 1~6만 순서대로 연결한다', () => {
    expect(['Digit1', 'Digit2', 'Digit3', 'Numpad4', 'Digit5', 'Digit6'].map(emoteForKey)).toEqual([
      'yawn',
      'taunt',
      'doze',
      'gg',
      'laugh',
      'surprise',
    ]);
    expect(emoteForKey('Digit0')).toBeNull();
    expect(emoteForKey('KeyE')).toBeNull();
  });
  it('활성 단계에서만 보내고 프레임 갱신 없이도 연속 입력을 3초 제한한다', async () => {
    let now = 100;
    const send = vi.fn().mockResolvedValue({ ok: true });
    const c = new EmoteController(send, () => now);
    c.update('a', 'waiting');
    await c.use('gg');
    expect(send).not.toHaveBeenCalled();
    c.update('a', 'aiming');
    await Promise.all([c.use('gg'), c.use('laugh')]);
    expect(send).toHaveBeenCalledTimes(1);
    now += 2999;
    await c.use('laugh');
    expect(send).toHaveBeenCalledTimes(1);
    now++;
    c.update('a', 'moving');
    await c.use('laugh');
    expect(send).toHaveBeenCalledTimes(2);
    now += 3000;
    c.update('a', 'finished');
    await c.use('gg');
    expect(send).toHaveBeenCalledTimes(2);
    c.update('b', 'resolving');
    await c.use('gg');
    expect(send).toHaveBeenLastCalledWith({ gameId: 'b', emote: 'gg' });
  });
  it('이전 경기 요청의 늦은 실패가 새 경기 쿨타임을 지우지 않는다', async () => {
    let reject!: (e: Error) => void;
    const send = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_, r) => {
            reject = r;
          }),
      )
      .mockResolvedValue({ ok: true });
    const c = new EmoteController(send, () => 100);
    c.update('old', 'aiming');
    const pending = c.use('gg');
    c.update('new', 'aiming');
    await c.use('laugh');
    reject(new Error('disconnected'));
    await pending;
    await c.use('gg');
    expect(send).toHaveBeenCalledTimes(2);
  });
  it('실패한 입력은 다시 보낼 수 있고 권한 측 쿨타임 거부는 제한을 유지한다', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, error: { code: 'INVALID_INPUT' } })
      .mockResolvedValue({ ok: false, error: { code: 'EMOTE_COOLDOWN' } });
    const c = new EmoteController(send, () => 100);
    c.update('a', 'aiming');
    await c.use('gg');
    expect(c.remainingMs()).toBe(0);
    await c.use('gg');
    expect(c.remainingMs()).toBe(3000);
  });
});

describe('감정표현 몸짓', () => {
  it('졸기는 1.5초 동안 고개를 두 번 숙이고 인사는 손을 흔든다', () => {
    expect(emoteMotion('doze', 375).pitch).toBeCloseTo(0.55);
    expect(emoteMotion('doze', 750).pitch).toBeCloseTo(0);
    expect(emoteMotion('doze', 1125).pitch).toBeCloseTo(0.55);
    expect(emoteMotion('doze', 1500).pitch).toBeCloseTo(0);
    expect(emoteMotion('gg', 300).wave).not.toBe(0);
    expect(emoteMotion('gg', 0).wave).toBe(0);
    expect(emoteMotion('yawn', 750).pitch).toBeLessThan(0);
  });
});

describe('감정표현 표시 시계', () => {
  it('경기 시계가 일시정지로 뒤처져도 수신부터 1.5초만 보인다', () => {
    const received = {
      gameId: 'a',
      seat: 0 as const,
      emote: 'gg' as const,
      atMs: 9000,
      receivedAtMs: 10000,
    };
    expect(emoteAgeMs(received, 10000, 2000)).toBe(0);
    expect(emoteAgeMs(received, 11499, 3499)).toBe(1499);
    expect(emoteAgeMs(received, 11500, 3500)).toBe(1500);
    // 수신 시각을 넣지 않는 합성 하네스는 명시한 권한 시각을 쓴다.
    expect(emoteAgeMs({ gameId: 'harness', seat: 1, emote: 'gg', atMs: 50 }, 500000, 100)).toBe(50);
  });
});
