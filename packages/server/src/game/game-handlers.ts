// 경기 Socket.IO 명령을 GameService에 연결한다. 사용자 번호는 소켓이 인증한 세션 사용자만 쓰고
// 입력으로 받지 않는다. 입력 검증·좌석 변환·판정은 서비스와 런타임이 맡고 여기서는 ack 변환만 한다.
import type { Socket } from 'socket.io';
import type { CommandResult } from '@alkkagi/shared';
import type { GameService } from './game-service.ts';

const INTERNAL: CommandResult = {
  ok: false,
  error: { code: 'INTERNAL_ERROR', message: '서버에서 오류가 발생했다' },
};

export type GameHandlerDeps = {
  game: GameService;
  onError?: (error: unknown) => void;
};

export function registerGameHandlers(socket: Socket, userId: number, deps: GameHandlerDeps): void {
  const { game } = deps;

  /** 응답이 있는 명령: 처리 중 예외가 나도 ack는 항상 `CommandResult`로 돌려준다. */
  const command = (
    event: string,
    run: (payload: unknown) => Promise<CommandResult> | CommandResult,
  ): void => {
    socket.on(event, (payload: unknown, ack?: unknown) => {
      void (async () => {
        let result: CommandResult;
        try {
          result = await run(payload);
        } catch (error) {
          deps.onError?.(error);
          result = INTERNAL;
        }
        if (typeof ack === 'function') (ack as (r: CommandResult) => void)(result);
      })();
    });
  };

  /** 응답 없는 volatile 입력: 오류는 로그만 남기고 버린다. */
  const stream = (event: string, run: (payload: unknown) => void): void => {
    socket.on(event, (payload: unknown) => {
      try {
        run(payload);
      } catch (error) {
        deps.onError?.(error);
      }
    });
  };

  command('shot:submit', (payload) => game.submitShot(userId, payload));
  command('hazard:use', (payload) => game.useHazard(userId, payload));
  command('board:rotate', (payload) => game.rotateBoard(userId, payload));
  command('game:forfeit', (payload) => game.forfeit(userId, payload));
  command('rematch:request', (payload) => game.requestRematch(userId, payload));
  stream('hazard:aim', (payload) => {
    game.aimHazard(userId, payload);
  });
  stream('aim:update', (payload) => {
    game.relayAim(userId, payload);
  });
}
