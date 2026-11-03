import { EventEmitter } from 'node:events';
import type { Socket } from 'socket.io';
import { describe, expect, it, vi } from 'vitest';
import type { CommandResult } from '@alkkagi/shared';
import { toLogLine } from './game-log.ts';
import { registerGameHandlers } from './game-handlers.ts';
import type { GameService } from './game-service.ts';

/** 소켓 대역: 서버가 등록한 이벤트 핸들러만 부른다. */
function fakeSocket() {
  const emitter = new EventEmitter();
  return {
    socket: emitter as unknown as Socket,
    fire: (event: string, payload: unknown, ack?: unknown) => emitter.emit(event, payload, ack),
  };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('경기 소켓 핸들러', () => {
  it('명령 처리 중 예외가 나면 ack는 INTERNAL_ERROR인 CommandResult다', async () => {
    const onError = vi.fn();
    const game = {
      submitShot: () => Promise.reject(new Error('boom')),
    } as unknown as GameService;
    const { socket, fire } = fakeSocket();
    registerGameHandlers(socket, 7, { game, onError });
    const ack = vi.fn();
    fire('shot:submit', {}, ack);
    await settle();
    expect(ack).toHaveBeenCalledWith({
      ok: false,
      error: { code: 'INTERNAL_ERROR', message: expect.any(String) as string },
    });
    expect(onError).toHaveBeenCalledOnce();
  });

  it('사용자 번호는 세션의 값만 서비스에 넘기고 입력의 값은 쓰지 않는다', async () => {
    const calls: unknown[][] = [];
    const ok: CommandResult = { ok: true };
    const game = {
      useHazard: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve(ok);
      },
    } as unknown as GameService;
    const { socket, fire } = fakeSocket();
    registerGameHandlers(socket, 7, { game });
    const ack = vi.fn();
    const payload = { gameId: 'g', hazardInstanceId: 'h', userId: 99, seat: 1 };
    fire('hazard:use', payload, ack);
    await settle();
    expect(calls[0]?.[0]).toBe(7);
    expect(ack).toHaveBeenCalledWith(ok);
  });

  it('ack가 없는 호출과 응답 없는 입력의 예외는 서버를 멈추지 않는다', async () => {
    const onError = vi.fn();
    const game = {
      forfeit: () => Promise.resolve({ ok: true }),
      relayAim: () => {
        throw new Error('boom');
      },
    } as unknown as GameService;
    const { socket, fire } = fakeSocket();
    registerGameHandlers(socket, 7, { game, onError });
    expect(() => {
      fire('game:forfeit', { gameId: 'g' });
      fire('aim:update', {});
    }).not.toThrow();
    await settle();
    expect(onError).toHaveBeenCalledOnce();
  });
});

describe('서버 로그 줄', () => {
  const context = { roomId: 3, userIdOf: (seat: 0 | 1) => (seat === 0 ? 10 : 11) };

  it('허용된 키만 담고 좌석을 사용자 번호로 바꾼다', () => {
    const line = toLogLine(
      {
        event: 'leave',
        mono: 5,
        gameId: null,
        ingressSeq: 2,
        seat: 1,
        reason: 'disconnect',
      },
      context,
    );
    expect(line).toMatchObject({
      roomId: 3,
      gameId: null,
      userId: 11,
      ingressSeq: 2,
      reason: 'disconnect',
    });
    expect(Object.keys(line)).not.toContain('seat');
    expect(new Date(line.ts).toISOString()).toBe(line.ts);
  });

  it('좌석이 없는 항목에는 사용자 번호를 넣지 않는다', () => {
    const line = toLogLine({ event: 'tick_skipped', mono: 1, gameId: 'g', result: '300' }, context);
    expect(line.userId).toBeUndefined();
    expect(line.result).toBe('300');
  });
});
