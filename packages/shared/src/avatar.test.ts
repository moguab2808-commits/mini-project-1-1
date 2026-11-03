import { describe, expect, it } from 'vitest';
import {
  APPEARANCE_CHOICES,
  APPEARANCE_KEYS,
  AVATAR_PARTS,
  DEFAULT_APPEARANCE,
  normalizeAppearance,
  randomAppearance,
  resolveAvatar,
} from './avatar.ts';

describe('사람 아바타 외형', () => {
  it('고정 기본 외형은 모든 항목 0이다', () => {
    for (const k of APPEARANCE_KEYS) expect(DEFAULT_APPEARANCE[k]).toBe(0);
  });

  it('항목마다 선택지가 5개 정의돼 있다', () => {
    for (const k of APPEARANCE_KEYS) expect(AVATAR_PARTS[k], k).toHaveLength(APPEARANCE_CHOICES);
  });

  it('머리카락에 대머리, 눈썹에 눈썹 없음이 있다', () => {
    expect(AVATAR_PARTS.hair.some((h) => h.style === 'bald')).toBe(true);
    expect(AVATAR_PARTS.eyebrows.some((b) => b.d === null)).toBe(true);
  });

  it('저장값을 읽을 때 없는 필드·범위 밖 값은 0으로 읽는다', () => {
    expect(normalizeAppearance({ hair: 3, eyes: 9, nose: 'x' })).toEqual({
      ...DEFAULT_APPEARANCE,
      hair: 3,
    });
    expect(normalizeAppearance(null)).toEqual(DEFAULT_APPEARANCE);
  });

  it('무작위 외형은 범위 안이고 같은 난수면 같다', () => {
    let s = 1;
    const rand = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const a = randomAppearance(rand);
    for (const k of APPEARANCE_KEYS) {
      expect(a[k]).toBeGreaterThanOrEqual(0);
      expect(a[k]).toBeLessThan(APPEARANCE_CHOICES);
    }
    s = 1;
    expect(randomAppearance(rand)).toEqual(a);
    expect(resolveAvatar(a).hair).toBe(AVATAR_PARTS.hair[a.hair]);
  });
});
