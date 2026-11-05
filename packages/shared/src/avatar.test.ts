import { describe, expect, it } from 'vitest';
import {
  APPEARANCE_CHOICES,
  APPEARANCE_KEYS,
  AVATAR_PARTS,
  AppearanceSchema,
  DEFAULT_APPEARANCE,
  hairHiddenByHat,
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

describe('안경·모자·옷(DEC-078)', () => {
  it('항목은 10개이고 안경·모자는 0번이 없음, 옷은 0번이 기본 티다', () => {
    expect(APPEARANCE_KEYS).toHaveLength(10);
    expect(AVATAR_PARTS.glasses[0]?.shape).toBe('none');
    expect(AVATAR_PARTS.hat[0]?.kind).toBe('none');
    expect(AVATAR_PARTS.outfit[0]).toMatchObject({ kind: 'tee', color: null });
  });

  it('7항목만 있던 예전 저장값은 새 세 항목을 0으로 읽는다', () => {
    const legacy = {
      headShape: 1,
      hair: 2,
      eyebrows: 3,
      eyes: 4,
      nose: 1,
      lips: 2,
      skinTone: 3,
    };
    expect(normalizeAppearance(legacy)).toEqual({ ...legacy, glasses: 0, hat: 0, outfit: 0 });
  });

  it('요청 검사는 10항목 모두 필요하고 범위 밖·여분 필드를 거부한다', () => {
    const noHat = Object.fromEntries(
      Object.entries(DEFAULT_APPEARANCE).filter(([k]) => k !== 'hat'),
    );
    expect(AppearanceSchema.safeParse(noHat).success).toBe(false);
    expect(AppearanceSchema.safeParse(DEFAULT_APPEARANCE).success).toBe(true);
    expect(AppearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, outfit: 5 }).success).toBe(false);
    expect(AppearanceSchema.safeParse({ ...DEFAULT_APPEARANCE, scarf: 0 }).success).toBe(false);
  });

  it('모자를 쓰면 짧은 머리·뾰족머리는 가리고 단발·긴 머리·대머리는 가리지 않는다', () => {
    const hat = AVATAR_PARTS.hat[1] as (typeof AVATAR_PARTS.hat)[number];
    const none = AVATAR_PARTS.hat[0] as (typeof AVATAR_PARTS.hat)[number];
    const hidden = AVATAR_PARTS.hair.filter((h) => hairHiddenByHat(h, hat)).map((h) => h.style);
    expect(hidden.sort()).toEqual(['crop', 'spiky']);
    expect(AVATAR_PARTS.hair.some((h) => hairHiddenByHat(h, none))).toBe(false);
  });
});
