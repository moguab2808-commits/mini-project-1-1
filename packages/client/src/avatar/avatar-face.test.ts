import { AVATAR_PARTS, DEFAULT_APPEARANCE, hairHiddenByHat, resolveAvatar } from '@alkkagi/shared';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { HAT_EXTENT, HAT_VIEWBOX, HatArt } from './AvatarAccessories.tsx';
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

/** 절대 좌표 경로(M·L·C·Q·H·V·Z)의 x·y 범위. 제어점을 포함하므로 실제 끝보다 크거나 같다 */
function pathBounds(d: string) {
  const b = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity };
  const put = (x: number | undefined, y: number | undefined) => {
    if (x !== undefined) {
      b.minX = Math.min(b.minX, x);
      b.maxX = Math.max(b.maxX, x);
    }
    if (y !== undefined) {
      b.minY = Math.min(b.minY, y);
      b.maxY = Math.max(b.maxY, y);
    }
  };
  for (const m of d.matchAll(/([MLCQHVZ])([^MLCQHVZ]*)/g)) {
    const nums = (m[2] ?? '').match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    if (m[1] === 'H') nums.forEach((x) => put(x, undefined));
    else if (m[1] === 'V') nums.forEach((y) => put(undefined, y));
    else for (let i = 0; i + 1 < nums.length; i += 2) put(nums[i], nums[i + 1]);
  }
  return b;
}

describe('모자를 쓴 2D 얼굴의 viewBox', () => {
  it('모자 경로의 바깥 끝에 가장 큰 두상 배율을 곱해도 viewBox 안이다(PR #99 리뷰)', () => {
    const maxSx = Math.max(...AVATAR_PARTS.headShape.map((h) => h.sx));
    const maxSy = Math.max(...AVATAR_PARTS.headShape.map((h) => h.sy));
    let halfWidth = 0;
    let top = 0;
    for (const hat of AVATAR_PARTS.hat) {
      if (hat.kind === 'none') continue;
      const svg = renderToStaticMarkup(createElement(HatArt, { hat }));
      for (const [, d] of svg.matchAll(/ d="([^"]+)"/g)) {
        const b = pathBounds(d ?? '');
        halfWidth = Math.max(halfWidth, Math.abs(b.minX), Math.abs(b.maxX));
        top = Math.max(top, -b.minY);
      }
    }
    expect(halfWidth).toBeLessThanOrEqual(HAT_EXTENT.halfWidth);
    expect(top).toBeLessThanOrEqual(HAT_EXTENT.top);
    const v = HAT_VIEWBOX;
    expect(v.x).toBeLessThanOrEqual(-HAT_EXTENT.halfWidth * maxSx);
    expect(v.x + v.size).toBeGreaterThanOrEqual(HAT_EXTENT.halfWidth * maxSx);
    expect(v.y).toBeLessThanOrEqual(-HAT_EXTENT.top * maxSy);
    expect(v.y + v.size).toBeGreaterThanOrEqual(50 * maxSy);
  });
});
