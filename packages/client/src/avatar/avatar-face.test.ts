import { AVATAR_PARTS, DEFAULT_APPEARANCE, hairHiddenByHat, resolveAvatar } from '@alkkagi/shared';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AvatarFace } from './AvatarFace.tsx';

const face = (over: Partial<typeof DEFAULT_APPEARANCE>) =>
  renderToStaticMarkup(
    createElement(AvatarFace, { appearance: { ...DEFAULT_APPEARANCE, ...over } }),
  );

describe('2D 얼굴의 안경·모자(DEC-078)', () => {
  it('기본 외형(안경·모자 없음)에는 모자·안경 색이 그려지지 않는다', () => {
    const svg = face({});
    for (const g of AVATAR_PARTS.glasses)
      if (g.shape !== 'none') expect(svg).not.toContain(g.frame);
    for (const h of AVATAR_PARTS.hat) if (h.kind !== 'none') expect(svg).not.toContain(h.color);
  });

  it('안경을 고르면 그 테 색이, 모자를 고르면 그 모자 색이 그려진다', () => {
    AVATAR_PARTS.glasses.forEach((g, i) => {
      if (g.shape !== 'none') expect(face({ glasses: i })).toContain(g.frame);
    });
    AVATAR_PARTS.hat.forEach((h, i) => {
      if (h.kind !== 'none') expect(face({ hat: i })).toContain(h.color);
    });
  });

  it('모자를 쓰면 짧은 머리·뾰족머리의 앞머리를 그리지 않고 단발·긴 머리는 그린다', () => {
    AVATAR_PARTS.hair.forEach((hair, i) => {
      if (hair.style === 'bald') return;
      const hat = AVATAR_PARTS.hat[1];
      if (!hat) throw new Error('hat 1 missing');
      const withHat = face({ hair: i, hat: 1 });
      const hidden = hairHiddenByHat(hair, hat);
      // 앞머리 경로 길이로 구분한다(모자 색과 겹치지 않는 머리색 기준)
      expect(withHat.includes(hair.front ?? '')).toBe(!hidden);
      expect(face({ hair: i }).includes(hair.front ?? '')).toBe(true);
    });
  });

  it('옷은 2D 얼굴에 그려지지 않는다', () => {
    const base = face({});
    AVATAR_PARTS.outfit.forEach((_, i) => {
      expect(face({ outfit: i })).toBe(base);
    });
    expect(resolveAvatar({ ...DEFAULT_APPEARANCE, outfit: 3 }).outfit.kind).toBe('stripe');
  });
});
