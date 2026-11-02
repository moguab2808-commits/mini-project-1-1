import { createServer, type Server as HttpServer } from 'node:http';
import connectPgSimple from 'connect-pg-simple';
import express, { type Express, type RequestHandler } from 'express';
import session from 'express-session';
import type pg from 'pg';
import type { RuntimeClock } from '@alkkagi/game-runtime';
import type { Server as SocketServer } from 'socket.io';
import { createAuthRouter } from './auth/router.ts';
import { createAuthRateLimiter } from './auth/rate-limit.ts';
import { errorHandler } from './auth/errors.ts';
import './auth/session-types.ts';
import { createDb } from './db/pool.ts';
import { ConnectionRegistry } from './realtime/connections.ts';
import { createRealtime } from './realtime/socket.ts';
import { createRequireAuth } from './auth/require-auth.ts';
import { registerGameHandlers } from './game/game-handlers.ts';
import { GameService, type GameServiceOptions } from './game/game-service.ts';
import { recordResult } from './game/stats.ts';
import type { GameLogSink } from './game/game-log.ts';
import { JoinRateLimiter } from './rooms/join-limiter.ts';
import { KeyedMutex } from './rooms/keyed-mutex.ts';
import { registerRoomHandlers } from './rooms/room-handlers.ts';
import { RoomService, type RoomHooks } from './rooms/room-service.ts';
import { createRoomsRouter } from './rooms/router.ts';

const PgStoreType = connectPgSimple(session);

export const SESSION_COOKIE_NAME = 'connect.sid';

export type AppOptions = {
  pool: pg.Pool;
  sessionSecret: string;
  /** 운영이면 세션 쿠키에 secure를 붙인다. */
  isProduction: boolean;
  /** 경기 서버 훅(IMPL-009)보다 먼저 불린다. 테스트가 시작·이탈을 관찰하거나 지연·실패시키는 자리다. */
  roomHooks?: RoomHooks;
  /** 서버 로그 출력처. 기본은 stdout이다. */
  gameLogSink?: GameLogSink;
  /** 재도전 대기 시간(ms). 기본 15초다. */
  rematchWindowMs?: number;
  /** 경기 시계. 기본은 서버 단조 시계이며 테스트가 수동 시계를 넣는다. */
  clock?: RuntimeClock;
  /** 경기가 끝나 전적을 저장한 뒤 불린다. 테스트가 종료를 관찰하는 자리다. */
  onGameFinished?: GameServiceOptions['onFinished'];
};

export type AppServer = {
  app: Express;
  httpServer: HttpServer;
  io: SocketServer;
  registry: ConnectionRegistry;
  /** 세션 저장소. 만료 행 정리를 테스트에서 직접 호출할 수 있게 노출한다. */
  sessionStore: InstanceType<typeof PgStoreType>;
  /** HTTP·Socket.IO 연결과 세션 저장소의 정리 타이머를 닫는다. 연결 풀은 호출한 쪽이 닫는다. */
  close(): Promise<void>;
};

/**
 * Express 앱과 Socket.IO를 만든다. 연결 풀·시크릿·환경은 밖에서 주입받아 테스트에서 바꿔 끼울 수 있다.
 * 클라이언트와 서버는 같은 출처라 CORS를 열지 않는다.
 */
export function createAppServer(options: AppOptions): AppServer {
  const { pool, sessionSecret, isProduction } = options;
  const db = createDb(pool);

  const app = express();
  // Render 프록시 1단. secure 쿠키와 IP당 빈도 제한이 이에 의존한다(AUTH).
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  const PgStore = PgStoreType;
  // 만료는 쿠키 maxAge가 없으면 마지막 사용 후 1일이고 만료 행은 기본 15분 주기로 정리된다.
  // 테이블은 마이그레이션이 만들므로 자동 생성은 켜지 않는다.
  const store = new PgStore({
    pool,
    tableName: 'session',
    createTableIfMissing: false,
  });

  const sessionMiddleware: RequestHandler = session({
    name: SESSION_COOKIE_NAME,
    store,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    // maxAge를 두지 않아 브라우저를 닫으면 만료된다(DEC-028).
    cookie: { httpOnly: true, sameSite: 'lax', secure: isProduction },
  });

  const httpServer = createServer(app);
  const registry = new ConnectionRegistry();
  const mutex = new KeyedMutex<number>();
  const onGameError = (error: unknown) => {
    console.error('경기 처리 오류:', error instanceof Error ? error.message : error);
  };
  const gameService = new GameService({
    registry,
    beforeStart: options.roomHooks?.onStarted,
    // 재도전 만료 처리도 사용자의 다른 방 명령과 같은 줄에 세운다.
    leaveRoom: (userId, leaveOptions) =>
      mutex.run(userId, () => roomService.leave(userId, leaveOptions)),
    clock: options.clock,
    // 전적 저장 실패는 오류 로그만 남기고 반영을 포기한다. 이탈로 끝난 경기는 방 정리 앞에서 기다린다.
    onFinished: async (info) => {
      await recordResult(db, info.userIds, info.result.winnerId);
      await options.onGameFinished?.(info);
    },
    logSink: options.gameLogSink,
    rematchWindowMs: options.rematchWindowMs,
    onError: onGameError,
  });
  const roomService = new RoomService(db, registry, {
    onStarted: async (view) => {
      await gameService.hooks.onStarted?.(view);
    },
    onLeave: async (info) => {
      await options.roomHooks?.onLeave?.(info);
      await gameService.hooks.onLeave?.(info);
    },
  });
  const roomDeps = {
    service: roomService,
    mutex,
    joinLimiter: new JoinRateLimiter(),
    onError: (error: unknown) => {
      console.error('방 명령 처리 오류:', error instanceof Error ? error.message : error);
    },
  };
  const { io } = createRealtime(httpServer, sessionMiddleware, registry, (socket, userId) => {
    registerRoomHandlers(socket, userId, roomDeps);
    registerGameHandlers(socket, userId, { game: gameService, onError: onGameError });
  });

  // 빈도 제한은 본문 파싱보다 앞에 둬서 형식이 잘못된 요청도 센다.
  app.use('/api/auth', createAuthRateLimiter());
  app.use(express.json({ limit: '10kb' }));
  app.use(sessionMiddleware);

  const { auth, me } = createAuthRouter({
    db,
    registry,
    sessionCookieName: SESSION_COOKIE_NAME,
  });
  app.use('/api/auth', auth);
  app.use('/api/me', me);
  app.use('/api/rooms', createRoomsRouter(createRequireAuth(db), roomService));

  app.use(errorHandler);

  return {
    app,
    httpServer,
    io,
    registry,
    sessionStore: store,
    async close() {
      gameService.dispose();
      await io.close();
      if (httpServer.listening) {
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      }
      await store.close();
    },
  };
}
