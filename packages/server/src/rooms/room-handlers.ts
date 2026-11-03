// 방 Socket.IO 명령(`room:*`)을 서비스에 연결한다. 입력 검증·빈도 제한·ack 변환만 하고 규칙은 RoomService가 가진다.
import type { Socket } from 'socket.io';
import type { z } from 'zod';
import { RoomCreateSchema, RoomJoinSchema, type RoomAck } from '@alkkagi/shared';
import { RoomError, roomErrors } from './errors.ts';
import type { JoinRateLimiter } from './join-limiter.ts';
import type { KeyedMutex } from './keyed-mutex.ts';
import type { RoomService } from './room-service.ts';

export type RoomHandlerDeps = {
  service: RoomService;
  mutex: KeyedMutex<number>;
  joinLimiter: JoinRateLimiter;
  onError?: (error: unknown) => void;
};

type Ack = (response: RoomAck<Record<string, unknown>>) => void;

function parse<S extends z.ZodType>(schema: S, payload: unknown): z.infer<S> {
  const result = schema.safeParse(payload);
  if (!result.success) throw roomErrors.invalidInput();
  return result.data;
}

function toFailure(error: unknown, onError?: (error: unknown) => void): RoomAck {
  if (error instanceof RoomError) {
    return { ok: false, error: { code: error.code, message: error.message } };
  }
  onError?.(error);
  return {
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: '서버에서 오류가 발생했다.' },
  };
}

/** 소켓 하나에 방 명령을 등록한다. 연결이 끊기면 방에서 나간 것으로 처리한다. */
export function registerRoomHandlers(socket: Socket, userId: number, deps: RoomHandlerDeps): void {
  const { service, mutex, joinLimiter } = deps;
  // 이 소켓이 방을 만들거나 들어간 적이 있는가. 로비에만 있던 소켓의 끊김이 다른 소켓의 방을 건드리지 않게 한다.
  let touchedRoom = false;

  const on = (
    event: string,
    run: (payload: unknown) => Promise<Record<string, unknown> | void>,
    options: { beforeQueue?: () => void } = {},
  ): void => {
    socket.on(event, (payload: unknown, ack?: unknown) => {
      const reply = typeof ack === 'function' ? (ack as Ack) : () => undefined;
      void (async () => {
        try {
          options.beforeQueue?.();
          const extra = await mutex.run(userId, () => run(payload));
          reply({ ok: true, ...extra });
        } catch (error) {
          reply(toFailure(error, deps.onError));
        }
      })();
    });
  };

  on('room:create', async (payload) => {
    const input = parse(RoomCreateSchema, payload);
    touchedRoom = true;
    return { roomId: await service.create(userId, input) };
  });

  on(
    'room:join',
    async (payload) => {
      const input = parse(RoomJoinSchema, payload);
      touchedRoom = true;
      return { roomId: await service.join(userId, input) };
    },
    {
      beforeQueue: () => {
        if (!joinLimiter.tryConsume(userId)) throw roomErrors.rateLimited();
      },
    },
  );

  on('room:quickJoin', async () => {
    touchedRoom = true;
    return { roomId: await service.quickJoin(userId) };
  });

  on('room:leave', async () => {
    await service.leave(userId, { reason: 'leave_button' });
  });

  socket.on('disconnect', () => {
    if (!touchedRoom) return;
    // 접속 대체로 끊겼으면 서버 로그에 `session_replaced`로 남긴다(ConnectionRegistry가 표시한다).
    const reason =
      socket.data.leaveReason === 'session_replaced' ? 'session_replaced' : 'disconnect';
    mutex
      .run(userId, () => service.leave(userId, { reason }))
      .catch((error: unknown) => {
        deps.onError?.(error);
      });
  });
}
