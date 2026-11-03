import { describe, expect, it } from 'vitest';
import { BOARDS } from '@alkkagi/shared';
import { makeWall } from './geometry.ts';
import { Prng } from './prng.ts';
import {
  isOnWallGrid,
  isWallPlaceable,
  planFakeWalls,
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

  it('끈끈이: 원이 판 안이고 벽·다른 설치물과 겹치지 않아야 한다(알과는 겹쳐도 된다, DEC-057)', () => {
    expect(isPlacementValid('sticky', 0, 0, 'horizontal', world())).toBe(true);
    expect(isPlacementValid('sticky', 20, 0, 'horizontal', world())).toBe(false);
    expect(isPlacementValid('sticky', 0, -8, 'horizontal', world())).toBe(true);
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

  it('가짜벽: 선택한 진짜와 두 무작위 벽은 모두 알·설치물·서로를 피하고 같은 시드에서 같다', () => {
    const w = world({
      walls: [makeWall(0, 8.8, 'vertical')],
      stickies: [{ cx: -15, cy: 0, radius: 3 }],
    });
    const run = (seed: number) => {
      const rng = new Prng(seed);
      return planFakeWalls(0, 0, 'horizontal', w, () => rng.next());
    };
    const planned = run(71)!;
    expect(planned).toHaveLength(3);
    expect(planned[0]).toEqual(makeWall(0, 0, 'horizontal'));
    expect(run(71)).toEqual(planned);
    expect(run(72)).not.toEqual(planned);
    for (let i = 0; i < planned.length; i++) {
      expect(
        isWallPlaceable(planned[i]!, {
          ...w,
          walls: [...w.walls, ...planned.filter((_, j) => j !== i)],
        }),
      ).toBe(true);
    }
  });

  it('가짜벽은 판 밖·알 위 진짜 위치와 추가 두 곳이 없는 판을 거부한다', () => {
    expect(planFakeWalls(22, 0, 'horizontal', world(), () => 0.5)).toBeNull();
    expect(planFakeWalls(0, -11, 'horizontal', world(), () => 0.5)).toBeNull();
    const tiny: PlacementWorld = {
      ...world({ stones: [-3, -2, -1, 1, 2, 3].map((n) => ({ x: 0, y: n * 2.2 })) }),
      board: { id: 'standard', shape: 'square', size: 14 },
    };
    expect(isPlacementValid('fake_wall', 0, 0, 'horizontal', tiny)).toBe(true);
    expect(planFakeWalls(0, 0, 'horizontal', tiny, () => 0.5)).toBeNull();
  });

  it('효과 params에서 벽을 복원한다', () => {
    const w = wallFromParams({ x: 1, y: 2, angleDeg: 90 })!;
    expect(w.angle).toBeCloseTo(Math.PI / 2);
    expect(wallFromParams({ y: 1 })).toBeNull();
  });
});
