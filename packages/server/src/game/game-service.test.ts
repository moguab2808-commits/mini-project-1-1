import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeClock } from '@alkkagi/game-runtime';
import type { GameOver } from '@alkkagi/shared';
import type { ConnectionRegistry } from '../realtime/connections.ts';
import type { RoomView } from '../rooms/room-store.ts';
import { GameService } from './game-service.ts';

const view: RoomView = {
  room: {
    id: 1,
    title: '방',
    hostId: 10,
    guestId: 11,
    isPublic: true,
    code: null,
    board: 'standard',
    pieceCount: 5,
    status: 'playing',
  },
  host: { id: 10, nickname: '가', characterId: 'bear' } as RoomView['host'],
  guest: { id: 11, nickname: '나', characterId: 'cat' } as RoomView['host'],
};
const clock: RuntimeClock = {
  now: () => Date.now(),
  setTimer: (cb, ms) => {
    const id = setTimeout(cb, ms);
    return () => clearTimeout(id);
  },
};
afterEach(() => vi.useRealTimers());

describe('시작 준비 중 이탈 경합 (PR #63 리뷰)', () => {
  it('시작이 5초 넘게 지연돼도 기다린 뒤 기권하고 최종 뷰 → null 마감 결과 순서로 보낸다', async () => {
    vi.useFakeTimers();
    const sent: { type: string; payload: unknown }[] = [];
    const socket = { emit: (type: string, payload: unknown) => sent.push({ type, payload }) };
    const registry = { get: () => socket } as unknown as ConnectionRegistry;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const finished = vi.fn();
    const logs: { event: string; ingressSeq: number }[] = [];
    const game = new GameService({
      registry,
      clock,
      beforeStart: () => gate,
      leaveRoom: vi.fn(),
      onFinished: finished,
      logSink: (line) => {
        logs.push(JSON.parse(line) as (typeof logs)[number]);
      },
    });
    const started = game.hooks.onStarted!(view);
    let left = false;
    const leaving = Promise.resolve(
      game.hooks.onLeave!({ room: view.room, userId: 11, reason: 'disconnect' }),
    ).then(() => {
      left = true;
    });
    await vi.advanceTimersByTimeAsync(6000);
    expect(left).toBe(false);
    expect(sent).toEqual([]);
    release();
    await started;
    await vi.advanceTimersByTimeAsync(20);
    await leaving;
    expect(finished).toHaveBeenCalledOnce();
    const over = sent.find((e) => e.type === 'game:over')!.payload as GameOver;
    expect(over).toMatchObject({ winnerId: 0, reason: 'forfeit', rematchDeadlineMs: null });
    const overIndex = sent.findIndex((e) => e.type === 'game:over');
    expect(sent.slice(0, overIndex).some((e) => e.type === 'game:state')).toBe(true);
    expect(sent.slice(overIndex + 1).some((e) => e.type === 'game:state')).toBe(false);
    expect(logs.find((e) => e.event === 'start_commit')!.ingressSeq).toBeLessThan(
      logs.find((e) => e.event === 'leave')!.ingressSeq,
    );
    expect(game.requestRematch(10, { gameId: over.gameId })).toMatchObject({
      ok: false,
      error: { code: 'REMATCH_NOT_AVAILABLE' },
    });
    game.dispose();
  });

  it('시작 준비 실패도 이탈 대기를 풀고 경기와 전적을 만들지 않는다', async () => {
    vi.useFakeTimers();
    let reject!: (error: Error) => void;
    const gate = new Promise<void>((_, fail) => {
      reject = fail;
    });
    const finished = vi.fn();
    const game = new GameService({
      registry: { get: () => undefined } as unknown as ConnectionRegistry,
      clock,
      beforeStart: () => gate,
      leaveRoom: vi.fn(),
      onFinished: finished,
      logSink: () => {},
    });
    const started = Promise.resolve(game.hooks.onStarted!(view)).catch((error: unknown) => error);
    const leaving = game.hooks.onLeave!({ room: view.room, userId: 10, reason: 'leave_button' });
    reject(new Error('시작 실패'));
    expect(await started).toBeInstanceOf(Error);
    await leaving;
    expect(finished).not.toHaveBeenCalled();
    expect(await game.forfeit(10, { gameId: 'none' })).toMatchObject({ ok: false });
    game.dispose();
  });
});
