import { describe, expect, it } from 'vitest';
import { BOARDS } from '@alkkagi/shared';
import { makeWall } from './geometry.ts';
import { previewShot, type PreviewStone } from './preview.ts';

const board = BOARDS.standard;

describe('previewShot', () => {
  it('정면으로 세게 치면 가장자리 근처 상대 알이 떨어진다', () => {
    const stones: PreviewStone[] = [
      { id: 1, ownerId: 0, x: 0, y: 10 },
      { id: 2, ownerId: 1, x: 0, y: 19 },
    ];
    const r = previewShot({ board, stones, stoneId: 1, angle: Math.PI / 2, power: 60 });
    expect(r.removed).toContain(2);
    expect(r.stones.find((s) => s.id === 2)).toBeUndefined();
    // 입력은 바뀌지 않는다
    expect(stones[1]).toEqual({ id: 2, ownerId: 1, x: 0, y: 19 });
  });

  it('벽이 있으면 같은 발사에도 상대 알이 남는다', () => {
    const stones: PreviewStone[] = [
      { id: 1, ownerId: 0, x: 0, y: 4 },
      { id: 2, ownerId: 1, x: 0, y: 19 },
    ];
    const free = previewShot({ board, stones, stoneId: 1, angle: Math.PI / 2, power: 60 });
    const walled = previewShot({
      board,
      stones,
      walls: [makeWall(0, 11, 'horizontal')],
      stoneId: 1,
      angle: Math.PI / 2,
      power: 60,
    });
    expect(free.removed).toContain(2);
    expect(walled.removed).not.toContain(2);
  });

  it('없는 알이면 아무 일도 없다', () => {
    const stones: PreviewStone[] = [{ id: 2, ownerId: 1, x: 0, y: 19 }];
    const r = previewShot({ board, stones, stoneId: 9, angle: 0, power: 50 });
    expect(r.removed).toEqual([]);
    expect(r.stones).toEqual(stones);
  });
});
