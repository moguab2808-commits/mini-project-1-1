import { describe, expect, it } from 'vitest';
import { BOARDS } from '@alkkagi/shared';
import { makeWall } from './geometry.ts';
import {
  isOnWallGrid,
  isPlacementValid,
  snapToWallGrid,
  wallFromParams,
  type PlacementWorld,
} from './placement.ts';

const world = (over: Partial<PlacementWorld> = {}): PlacementWorld => ({
  board: BOARDS.standard,
  stones: [{ x: 0, y: -11.5 }],
  walls: [],
  stickies: [],
  ...over,
});

describe('배치 판정', () => {
  it('격자 스냅은 2.2cm 간격이다', () => {
    expect(snapToWallGrid(1.2)).toBeCloseTo(2.2);
    expect(snapToWallGrid(1.0)).toBeCloseTo(0);
    expect(Object.is(snapToWallGrid(-0.3), 0)).toBe(true);
    expect(isOnWallGrid(4.4)).toBe(true);
    expect(isOnWallGrid(3)).toBe(false);
  });

  it('벽: 판 안 빈 격자는 가능, 알·판 밖·기존 벽과 겹치면 불가', () => {
    expect(isPlacementValid('wall', 0, 0, 'horizontal', world())).toBe(true);
    expect(isPlacementValid('wall', 0, -11.0, 'horizontal', world())).toBe(false);
    expect(isPlacementValid('wall', 22, 0, 'horizontal', world())).toBe(false);
    expect(isPlacementValid('wall', 1, 0, 'horizontal', world())).toBe(false); // 격자 밖
    const walls = [makeWall(0, 0, 'horizontal')];
    expect(isPlacementValid('wall', 0, 0, 'vertical', world({ walls }))).toBe(false);
  });

  it('끈끈이: 반지름 4.4 원이 판 안이고 알·벽과 겹치지 않아야 한다', () => {
    expect(isPlacementValid('sticky', 0, 0, 'horizontal', world())).toBe(true);
    expect(isPlacementValid('sticky', 20, 0, 'horizontal', world())).toBe(false);
    expect(isPlacementValid('sticky', 0, -8, 'horizontal', world())).toBe(false);
    expect(
      isPlacementValid(
        'sticky',
        0,
        0,
        'horizontal',
        world({ walls: [makeWall(0, 2, 'horizontal')] }),
      ),
    ).toBe(false);
    expect(
      isPlacementValid(
        'sticky',
        0,
        0,
        'horizontal',
        world({ stickies: [{ cx: 5, cy: 0, radius: 4.4 }] }),
      ),
    ).toBe(false);
  });

  it('효과 params에서 벽을 복원한다', () => {
    const w = wallFromParams({ x: 1, y: 2, angleDeg: 90 })!;
    expect(w.angle).toBeCloseTo(Math.PI / 2);
    expect(wallFromParams({ y: 1 })).toBeNull();
  });
});
