import type { RequestHandler } from 'express';
import type { Server as HttpServer } from 'node:http';
import { Server, type Socket } from 'socket.io';
import { ConnectionRegistry } from './connections.ts';

type SessionRequest = { session?: { userId?: number }; sessionID?: string };

export type Realtime = { io: Server; registry: ConnectionRegistry };

/**
 * Socket.IO 서버를 붙인다. 핸드셰이크 요청에 세션 미들웨어를 적용해 같은 세션 쿠키로 사용자를
 * 인증하고, 로그인하지 않았으면 연결을 거부한다. 같은 출처라 CORS를 열지 않는다.
 */
export function createRealtime(
  httpServer: HttpServer,
  sessionMiddleware: RequestHandler,
  registry = new ConnectionRegistry(),
  onConnection?: (socket: Socket, userId: number) => void,
): Realtime {
  const io = new Server(httpServer);
  io.engine.use(sessionMiddleware);

  io.use((socket, next) => {
    const request = socket.request as SessionRequest;
    const userId = request.session?.userId;
    if (userId === undefined || !request.sessionID) {
      return next(new Error('UNAUTHENTICATED'));
    }
    socket.data.userId = userId;
    socket.data.sid = request.sessionID;
    next();
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId as number;
    registry.register(userId, socket);
    socket.on('disconnect', () => registry.unregister(userId, socket));
    onConnection?.(socket, userId);
  });

  return { io, registry };
}
