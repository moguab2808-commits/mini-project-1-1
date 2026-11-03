import { describe, expect, it } from 'vitest';
import { DEFAULT_APPEARANCE, type GameStart } from '@alkkagi/shared';
import type { GameEventMap, GameSession } from '../session/game-session.ts';
import { emoteAgeMs } from './emotes.ts';
import { GameStore } from './game-store.ts';

function setup() {
  const listeners = new Map<string, (event: never) => void>();
  const session = {
    playerId: 0,
    on: (type: string, listener: (event: never) => void) => {
      listeners.set(type, listener);
      return () => listeners.delete(type);
    },
  } as unknown as GameSession;
  let nowMs = 100;
  const store = new GameStore(session, () => nowMs);
  const emit = <K extends keyof GameEventMap>(type: K, event: GameEventMap[K]) =>
    listeners.get(type)?.(event as never);
  const start: GameStart = {
    gameId: 'g',
    seat: 0,
    board: 'standard',
    theme: 'bar',
    pieceCount: 5,
    finalRound: 10,
    turnSeconds: 30,
    players: [
      { seat: 0, nickname: 'a', appearance: DEFAULT_APPEARANCE },
      { seat: 1, nickname: 'b', appearance: DEFAULT_APPEARANCE },
    ],
    view: {
      gameId: 'g',
      serverTick: 0,
      serverNowMs: 100,
      revision: 1,
      phase: 'aiming',
      turnId: 1,
      round: 1,
      activePlayerId: 0,
      deadlineMs: 30100,
      boardRotationDeg: 0,
      stones: [],
      stoneCounts: [5, 5],
      effects: [],
      result: null,
      private: {
        held: null,
        fatigueGauge: 0,
        overheated: false,
        cooldownEndsAtMs: null,
        usable: false,
        timeoutStreak: 0,
      },
    },
  };
  return {
    store,
    emit,
    start,
    setNow: (ms: number) => {
      nowMs = ms;
    },
  };
}

describe('GameStore 감정표현', () => {
  it('일시정지 뒤 오래된 상태 시계와 무관하게 수신 시각으로 표시 수명을 잰다', () => {
    const { store, emit, start, setNow } = setup();
    emit('game:start', start);
    setNow(10000);
    emit('emote:shown', { gameId: 'g', seat: 0, emote: 'gg', atMs: 8000 });
    const event = store.getState().emotes[0]!;
    expect(event.receivedAtMs).toBe(10000);
    emit('game:state', { ...start.view, revision: 2, serverNowMs: 200 });
    expect(emoteAgeMs(event, 10000, store.serverNow())).toBe(0);
    setNow(11500);
    expect(emoteAgeMs(event, 11500, store.serverNow())).toBe(1500);
    store.dispose();
  });
  it('수신 뒤 양쪽 좌석 표현만 갱신하고 늦은 이벤트·다른 경기·결과 뒤 이벤트를 무시한다', () => {
    const { store, emit, start } = setup();
    const event = { gameId: 'g', seat: 1 as const, emote: 'gg' as const, atMs: 200 };
    emit('emote:shown', event);
    expect(store.getState().emotes).toEqual([null, null]);
    emit('game:start', start);
    const view = store.getState().view;
    let notified = 0;
    store.subscribe(() => notified++);
    emit('emote:shown', event);
    expect(store.getState().emotes).toEqual([null, { ...event, receivedAtMs: 100 }]);
    expect(store.getState().view).toBe(view);
    emit('emote:shown', { ...event, atMs: 199 });
    emit('emote:shown', { ...event, gameId: 'old', atMs: 999 });
    expect(notified).toBe(1);
    emit('game:over', {
      gameId: 'g',
      winnerId: 0,
      reason: 'forfeit',
      remainingStones: [5, 5],
      rematchDeadlineMs: null,
    });
    emit('emote:shown', { ...event, atMs: 999 });
    expect(store.getState().emotes).toEqual([null, null]);
    emit('game:start', { ...start, gameId: 'g2', view: { ...start.view, gameId: 'g2' } });
    emit('emote:shown', { ...event, gameId: 'g2', atMs: 100 });
    expect(store.getState().emotes[1]?.atMs).toBe(100);
    store.dispose();
  });
});
