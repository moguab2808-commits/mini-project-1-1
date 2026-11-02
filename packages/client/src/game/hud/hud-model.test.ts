import { describe, expect, it } from 'vitest';
import type { GameOver, GameView, RematchState } from '@alkkagi/shared';
import {
  blindCoverage,
  blindStrength,
  dropletsFor,
  outcomeFor,
  rematchUi,
  remainingSeconds,
  roundLabel,
  stoneDots,
  windArrowRotationDeg,
} from './hud-model.ts';
import { heldHazardState } from '../aim/hazard-state.ts';

const result = (over: Partial<GameOver> = {}): GameOver => ({
  gameId: 'g',
  winnerId: 0,
  reason: 'all_stones_out',
  remainingStones: [3, 0],
  rematchDeadlineMs: 20000,
  ...over,
});

const rematch = (over: Partial<RematchState> = {}): RematchState => ({
  gameId: 'g',
  myRequested: false,
  opponentRequested: false,
  deadlineMs: 20000,
  outcome: 'pending',
  ...over,
});

function view(over: Partial<GameView> = {}, priv: Partial<GameView['private']> = {}): GameView {
  return {
    gameId: 'g',
    serverTick: 0,
    serverNowMs: 10000,
    revision: 1,
    phase: 'aiming',
    turnId: 1,
    round: 1,
    activePlayerId: 0,
    deadlineMs: 40000,
    boardRotationDeg: 0,
    stones: [
      { id: 0, ownerId: 0, x: 0, y: 0, h: 0 },
      { id: 1, ownerId: 0, x: 1, y: 0, h: 0 },
      { id: 2, ownerId: 1, x: 2, y: 0, h: 0 },
    ],
    effects: [],
    result: null,
    private: {
      held: null,
      fatigueGauge: null,
      overheated: false,
      cooldownEndsAtMs: null,
      usable: false,
      timeoutStreak: 0,
      ...priv,
    },
    ...over,
  };
}

describe('HUD 표시값', () => {
  it('남은 초는 올림하고 0 아래로 내려가지 않는다', () => {
    expect(remainingSeconds(31000, 1000)).toBe(30);
    expect(remainingSeconds(31000, 1001)).toBe(30);
    expect(remainingSeconds(1000, 5000)).toBe(0);
  });

  it('최종 라운드를 따로 표시한다', () => {
    expect(roundLabel(view({ round: 3 }), 10)).toBe('라운드 3 / 10');
    expect(roundLabel(view({ round: 10 }), 10)).toBe('최종 라운드');
  });

  it('결과를 내 좌석 기준 승·패·무로 바꾼다', () => {
    expect(outcomeFor(result({ winnerId: 0 }), 0)).toBe('win');
    expect(outcomeFor(result({ winnerId: 0 }), 1)).toBe('lose');
    expect(outcomeFor(result({ winnerId: null }), 1)).toBe('draw');
  });

  it('남은 알 점', () => {
    expect(stoneDots(view(), 0, 5)).toEqual([true, true, false, false, false]);
    expect(stoneDots(view(), 1, 3)).toEqual([true, false, false]);
  });

  it('후공 화면은 바람 화살표를 180도 돌려 그린다', () => {
    expect(windArrowRotationDeg(0, 0)).toBeCloseTo(0);
    expect(Math.abs(windArrowRotationDeg(0, 1))).toBeCloseTo(180);
    expect(windArrowRotationDeg(Math.PI / 2, 0)).toBeCloseTo(-90);
  });
});

describe('재도전 안내', () => {
  it('상대가 요청했으면 안내하고 카운트를 센다', () => {
    const ui = rematchUi(result(), rematch({ opponentRequested: true }), 10000);
    expect(ui).toMatchObject({
      canRequest: true,
      showRequest: true,
      message: '상대가 재도전을 원해요',
      secondsLeft: 10,
    });
  });

  it('내가 눌렀으면 버튼을 막고 기다림을 안내한다', () => {
    const ui = rematchUi(result(), rematch({ myRequested: true }), 12000);
    expect(ui.canRequest).toBe(false);
    expect(ui.message).toContain('기다리');
    expect(ui.secondsLeft).toBe(8);
  });

  it('expired면 안내 후 나가기만 남는다', () => {
    const ui = rematchUi(result(), rematch({ outcome: 'expired' }), 21000);
    expect(ui.showRequest).toBe(false);
    expect(ui.canRequest).toBe(false);
    expect(ui.message).toContain('지났');
  });

  it('rematch:state 전에는 결과의 기한을 쓴다', () => {
    const ui = rematchUi(result(), null, 15000);
    expect(ui).toMatchObject({ showRequest: true, secondsLeft: 5 });
  });
});

describe('시야 가림', () => {
  const flash = {
    kind: 'flashlight' as const,
    startsAtMs: 1000,
    expiresAtMs: 3000,
    maxCoverage: 0.7,
    pattern: 7,
  };
  const water = { ...flash, kind: 'water_gun' as const, expiresAtMs: 4000 };

  it('후레쉬는 0.2초 동안 밝아지고 마지막 0.5초 동안 옅어진다', () => {
    expect(blindStrength(flash, 900)).toBe(0);
    expect(blindStrength(flash, 1100)).toBeCloseTo(0.5);
    expect(blindStrength(flash, 2000)).toBe(1);
    expect(blindStrength(flash, 2750)).toBeCloseTo(0.5);
    expect(blindStrength(flash, 3000)).toBe(0);
  });

  it('물총은 마지막 1초 동안 옅어진다', () => {
    expect(blindStrength(water, 2000)).toBe(1);
    expect(blindStrength(water, 3500)).toBeCloseTo(0.5);
  });

  it('가림 면적은 70%를 넘지 않는다', () => {
    expect(blindCoverage({ ...flash, maxCoverage: 0.95 }, 2000)).toBeCloseTo(0.7);
    expect(blindCoverage(flash, 2000)).toBeCloseTo(0.7);
  });

  it('물방울 배치는 같은 pattern이면 같다', () => {
    expect(dropletsFor(5, 0.7)).toEqual(dropletsFor(5, 0.7));
    expect(dropletsFor(5, 0.7)).not.toEqual(dropletsFor(6, 0.7));
  });
});

describe('보유 방해요소 칸 상태', () => {
  it('피로도 게이지는 서버 시각 이후 초당 5씩 줄여 이어 계산한다', () => {
    const v = view(
      {},
      {
        held: { hazardInstanceId: 'h', kind: 'flashlight', round: 1 },
        fatigueGauge: 40,
        usable: true,
      },
    );
    expect(heldHazardState(v, 10000)?.gauge).toBeCloseTo(40);
    expect(heldHazardState(v, 14000)?.gauge).toBeCloseTo(20);
    expect(heldHazardState(v, 30000)?.gauge).toBe(0);
  });

  it('과열은 게이지가 0이 되면 풀리고 그 전에는 사용 불가다', () => {
    const v = view(
      {},
      {
        held: { hazardInstanceId: 'h', kind: 'flashlight', round: 1 },
        fatigueGauge: 100,
        overheated: true,
      },
    );
    expect(heldHazardState(v, 10000)).toMatchObject({ overheated: true, usable: false });
    expect(heldHazardState(v, 30000)).toMatchObject({ overheated: false, usable: true });
  });

  it('쿨타임은 남은 초를 올림하고 사용 불가다', () => {
    const v = view(
      {},
      { held: { hazardInstanceId: 'h', kind: 'wall', round: 1 }, cooldownEndsAtMs: 20500 },
    );
    expect(heldHazardState(v, 10000)).toMatchObject({ cooldownRemainingSec: 11, usable: false });
    expect(heldHazardState(v, 21000)).toMatchObject({ cooldownRemainingSec: null, usable: true });
  });

  it('랜덤형은 항상 사용 불가이고 보유가 없으면 null이다', () => {
    const v = view({}, { held: { hazardInstanceId: 'h', kind: 'wind', round: 1 } });
    expect(heldHazardState(v, 10000)?.usable).toBe(false);
    expect(heldHazardState(view(), 10000)).toBeNull();
  });
});
