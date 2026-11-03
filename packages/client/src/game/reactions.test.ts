import { describe, expect, it } from 'vitest';
import type { GameOver, GameView, HazardTriggered } from '@alkkagi/shared';
import {
  MAX_REACTIONS,
  ReactionTracker,
  gameOverReactions,
  hazardReactions,
  settleReactions,
} from './reactions.ts';

function view(patch: Partial<GameView> & { counts?: [number, number] } = {}): GameView {
  const { counts = [3, 3], ...rest } = patch;
  const stones: GameView['stones'] = [];
  let id = 0;
  for (const seat of [0, 1] as const) {
    for (let i = 0; i < counts[seat]; i++)
      stones.push({ id: id++, ownerId: seat, x: i, y: 0, h: 0 });
  }
  return {
    gameId: 'g',
    serverTick: 0,
    serverNowMs: 0,
    revision: 1,
    phase: 'aiming',
    turnId: 1,
    round: 1,
    activePlayerId: 0,
    deadlineMs: 30000,
    boardRotationDeg: 0,
    stones,
    effects: [],
    result: null,
    stoneCounts: [counts[0], counts[1]],
    private: {
      held: null,
      fatigueGauge: null,
      overheated: false,
      cooldownEndsAtMs: null,
      usable: false,
      timeoutStreak: 0,
    },
    ...rest,
  };
}

const trig = (patch: Partial<HazardTriggered> = {}): HazardTriggered => ({
  gameId: 'g',
  kind: 'stun',
  phase: 'start',
  sourceSeat: 1,
  targetSeat: 0,
  startsAtMs: 0,
  expiresAtMs: 1000,
  ...patch,
});

const over = (patch: Partial<GameOver> = {}): GameOver => ({
  gameId: 'g',
  winnerId: 0,
  reason: 'all_stones_out',
  remainingStones: [2, 0],
  rematchDeadlineMs: null,
  ...patch,
});

describe('발사 결과 반응', () => {
  it('상대 알만 떨어뜨리면 great, 상대는 shocked', () => {
    expect(settleReactions(0, [3, 3], [3, 2])).toEqual([
      { seat: 0, kind: 'great' },
      { seat: 1, kind: 'shocked' },
    ]);
  });
  it('둘 다 떨어지면 trade, 상대는 shocked', () => {
    expect(settleReactions(1, [3, 3], [2, 2])).toEqual([
      { seat: 1, kind: 'trade' },
      { seat: 0, kind: 'shocked' },
    ]);
  });
  it('내 알만 떨어지면 own, 상대는 taunt', () => {
    expect(settleReactions(0, [3, 3], [2, 3])).toEqual([
      { seat: 0, kind: 'own' },
      { seat: 1, kind: 'taunt' },
    ]);
  });
  it('아무것도 못 떨어뜨리면 miss, 상대는 taunt', () => {
    expect(settleReactions(0, [3, 3], [3, 3])).toEqual([
      { seat: 0, kind: 'miss' },
      { seat: 1, kind: 'taunt' },
    ]);
  });
});

describe('방해요소·종료 반응', () => {
  it('나를 대상으로 시작한 방해요소만 hit', () => {
    expect(hazardReactions(trig(), 0)).toEqual([{ seat: 0, kind: 'hit' }]);
    expect(hazardReactions(trig({ targetSeat: 1 }), 0)).toEqual([]);
    expect(hazardReactions(trig({ phase: 'end' }), 0)).toEqual([]);
  });
  it('승패·무승부', () => {
    expect(gameOverReactions(over({ winnerId: 1 }))).toEqual([
      { seat: 1, kind: 'win' },
      { seat: 0, kind: 'lose' },
    ]);
    expect(gameOverReactions(over({ winnerId: null }))).toEqual([
      { seat: 0, kind: 'draw' },
      { seat: 1, kind: 'draw' },
    ]);
  });
});

describe('ReactionTracker', () => {
  it('aiming→moving→aiming 전이에서 이전 대비 남은 알 수로 반응을 만들고 id를 늘린다', () => {
    const t = new ReactionTracker(0);
    let calls = 0;
    t.subscribe(() => calls++);
    t.onView(view({ counts: [3, 3] }));
    t.onView(view({ phase: 'moving', counts: [3, 3] }));
    t.onView(view({ phase: 'moving', counts: [3, 2] }));
    expect(t.getReactions()).toEqual([]);
    t.onView(view({ phase: 'aiming', turnId: 2, activePlayerId: 1, counts: [3, 2] }));
    expect(t.getReactions()).toEqual([
      { seat: 0, kind: 'great', id: 1 },
      { seat: 1, kind: 'shocked', id: 2 },
    ]);
    expect(calls).toBe(1);
    // 같은 조준 단계 스냅샷이 반복돼도 다시 만들지 않는다
    t.onView(view({ phase: 'aiming', turnId: 2, activePlayerId: 1, counts: [3, 2] }));
    expect(t.getReactions()).toHaveLength(2);

    // 상대 발사가 빗나감
    t.onView(view({ phase: 'moving', turnId: 2, activePlayerId: 1, counts: [3, 2] }));
    t.onView(view({ phase: 'resolving', turnId: 2, activePlayerId: 1, counts: [3, 2] }));
    t.onView(view({ phase: 'aiming', turnId: 3, activePlayerId: 0, counts: [3, 2] }));
    expect(t.getReactions().slice(-2)).toEqual([
      { seat: 1, kind: 'miss', id: 3 },
      { seat: 0, kind: 'taunt', id: 4 },
    ]);
  });

  it('방해요소 hit과 종료 반응을 같은 번호 순서로 이어 붙인다', () => {
    const t = new ReactionTracker(1);
    t.onHazard(trig({ targetSeat: 1, sourceSeat: 0 }));
    t.onHazard(trig({ targetSeat: 0, sourceSeat: 1 })); // 상대 대상: 반응 없음
    t.onView(view({ counts: [1, 1] }));
    t.onView(view({ phase: 'moving', counts: [1, 1] }));
    // 결과가 종료 스냅샷보다 먼저 와도 마지막 발사 반응을 먼저 내보낸다
    t.onGameOver(over({ winnerId: 0, remainingStones: [1, 0] }));
    t.onGameOver(over({ winnerId: 0, remainingStones: [1, 0] })); // 중복 무시
    t.onView(view({ phase: 'finished', counts: [1, 0] }));
    expect(t.getReactions()).toEqual([
      { seat: 1, kind: 'hit', id: 1 },
      { seat: 0, kind: 'great', id: 2 },
      { seat: 1, kind: 'shocked', id: 3 },
      { seat: 0, kind: 'win', id: 4 },
      { seat: 1, kind: 'lose', id: 5 },
    ]);
  });

  it('최근 반응만 유지한다', () => {
    const t = new ReactionTracker(0);
    for (let i = 0; i < 10; i++) t.onHazard(trig());
    const list = t.getReactions();
    expect(list).toHaveLength(MAX_REACTIONS);
    expect(list.at(-1)!.id).toBe(10);
  });

  it('새 경기로 바뀌면 진행 중이던 발사를 버린다', () => {
    const t = new ReactionTracker(0);
    t.onView(view());
    t.onView(view({ phase: 'moving' }));
    t.onView(view({ gameId: 'g2', phase: 'aiming', counts: [3, 1] }));
    expect(t.getReactions()).toEqual([]);
  });
});
