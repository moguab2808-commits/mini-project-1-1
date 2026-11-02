import { createServer, type Server as HttpServer } from 'node:http';
import connectPgSimple from 'connect-pg-simple';
import express, { type Express, type RequestHandler } from 'express';
import session from 'express-session';
import type pg from 'pg';
import type { Server as SocketServer } from 'socket.io';
import { createAuthRouter } from './auth/router.ts';
import { createAuthRateLimiter } from './auth/rate-limit.ts';
import { errorHandler } from './auth/errors.ts';
import './auth/session-types.ts';
import { createDb } from './db/pool.ts';
import { ConnectionRegistry } from './realtime/connections.ts';
import { createRealtime } from './realtime/socket.ts';
import { createRequireAuth } from './auth/require-auth.ts';
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
  /** 방 이벤트가 경기 서버(IMPL-009)에 알리는 자리. 상대가 입장해 시작 커밋이 끝난 직후 불린다. */
  roomHooks?: RoomHooks;
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
  const roomService = new RoomService(db, registry, options.roomHooks);
  const roomDeps = {
    service: roomService,
    mutex: new KeyedMutex<number>(),
    joinLimiter: new JoinRateLimiter(),
    onError: (error: unknown) => {
      console.error('방 명령 처리 오류:', error instanceof Error ? error.message : error);
    },
  };
  const { io } = createRealtime(httpServer, sessionMiddleware, registry, (socket, userId) => {
    registerRoomHandlers(socket, userId, roomDeps);
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
      await io.close();
      if (httpServer.listening) {
        await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      }
      await store.close();
    },
  };
}
