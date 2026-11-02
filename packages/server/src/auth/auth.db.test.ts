import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAppServer, type AppServer } from '../app.ts';
import { createTempDatabase, type TempDatabase } from '../db/temp-database.ts';

// 실제 PostgreSQL(임시 DB)이 필요하다. `npm run test:db`로만 실행한다.
const baseUrl = process.env.DATABASE_URL;

const PASSWORD = 'correct-horse';
const CHARACTERS = ['bear', 'cat', 'fox', 'rabbit', 'owl', 'frog'];

describe.skipIf(!baseUrl)('인증 API·세션·Socket.IO 인증', () => {
  let tempDb: TempDatabase;
  let server: AppServer;
  let port: number;
  let ipSeq = 0;
  const openSockets: ClientSocket[] = [];

  // 테스트마다 다른 IP로 요청해 IP당 빈도 제한 카운터가 서로 섞이지 않게 한다(trust proxy 1).
  const nextIp = () => `10.0.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`;
  const api = () => request(server.httpServer);

  const signup = (ip: string, nickname: string, password = PASSWORD) =>
    api().post('/api/auth/signup').set('X-Forwarded-For', ip).send({ nickname, password });

  const login = (ip: string, nickname: string, password = PASSWORD) =>
    api().post('/api/auth/login').set('X-Forwarded-For', ip).send({ nickname, password });

  const cookieOf = (res: request.Response) =>
    (res.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;

  /** 가입하고 로그인해 세션 쿠키('이름=값')를 돌려준다. */
  async function signupAndLogin(nickname: string, password = PASSWORD) {
    const ip = nextIp();
    await signup(ip, nickname, password).expect(201);
    const res = await login(ip, nickname, password).expect(200);
    return { cookie: cookieOf(res), ip };
  }

  const me = (cookie?: string) => {
    const req = api().get('/api/me');
    return cookie ? req.set('Cookie', cookie) : req;
  };

  function openSocket(cookie?: string): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const socket = connect(`http://127.0.0.1:${port}`, {
        extraHeaders: cookie ? { cookie } : {},
        reconnection: false,
        forceNew: true,
      });
      openSockets.push(socket);
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (error) => reject(error));
    });
  }

  const once = (socket: ClientSocket, event: string) =>
    new Promise<void>((resolve) => socket.once(event, () => resolve()));

  beforeAll(async () => {
    tempDb = await createTempDatabase(baseUrl!);
    server = createAppServer({
      pool: tempDb.pool,
      sessionSecret: 'test-secret-test-secret-test-secret-0123',
      isProduction: false,
    });
    await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
    port = (server.httpServer.address() as AddressInfo).port;
  }, 60_000);

  afterAll(async () => {
    for (const socket of openSockets) socket.disconnect();
    await server?.close();
    await tempDb?.drop();
  }, 60_000);

  describe('정상', () => {
    it('가입은 세션을 만들지 않고 201 {}만 응답하며 비밀번호는 argon2id 해시로 저장한다', async () => {
      const res = await signup(nextIp(), 'SignupOk').expect(201);
      expect(res.body).toEqual({});
      expect(res.headers['set-cookie']).toBeUndefined();

      const row = await tempDb.pool.query<{ password: string }>(
        `SELECT password FROM users WHERE nickname = 'SignupOk'`,
      );
      expect(row.rows[0]?.password).toMatch(/^\$argon2id\$/);
      expect(row.rows[0]?.password).not.toContain(PASSWORD);
    });

    it('로그인하면 httpOnly 세션 쿠키(브라우저 종료 시 만료)와 Me가 돌아온다', async () => {
      const ip = nextIp();
      await signup(ip, '로그인성공').expect(201);
      const res = await login(ip, '로그인성공').expect(200);

      const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!;
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Lax/i);
      expect(cookie).not.toMatch(/Max-Age|Expires/i);

      expect(Object.keys(res.body)).toEqual(['user']);
      expect(res.body.user).toEqual({
        nickname: '로그인성공',
        characterId: expect.stringMatching(new RegExp(`^(${CHARACTERS.join('|')})$`)),
        record: { totalGames: 0, wins: 0, losses: 0, draws: 0 },
      });
      expect(JSON.stringify(res.body)).not.toMatch(/argon2|password|"id"/i);
    });

    it('GET /api/me는 로그인한 사용자를 돌려준다', async () => {
      const { cookie } = await signupAndLogin('내정보');
      const res = await me(cookie).expect(200);
      expect(res.body.user.nickname).toBe('내정보');
    });

    it('캐릭터를 바꾸면 바로 저장돼 /api/me에 반영된다', async () => {
      const { cookie } = await signupAndLogin('캐릭터변경');
      const res = await api()
        .patch('/api/me/character')
        .set('Cookie', cookie)
        .send({ characterId: 'owl' })
        .expect(200);
      expect(res.body.user.characterId).toBe('owl');
      expect((await me(cookie).expect(200)).body.user.characterId).toBe('owl');
    });

    it('세션은 마지막 사용 후 24시간 뒤 만료되고 만료된 행은 정리된다', async () => {
      const { cookie } = await signupAndLogin('세션만료');
      const row = await tempDb.pool.query<{ seconds: number }>(
        'SELECT extract(epoch FROM (expire - localtimestamp))::float AS seconds FROM session',
      );
      const seconds = Math.max(...row.rows.map((r) => r.seconds));
      expect(seconds).toBeGreaterThan(86_400 - 120);
      expect(seconds).toBeLessThanOrEqual(86_400);

      // 만료된 행을 넣고 정리 함수를 호출하면 지워지고 유효한 세션은 남는다.
      await tempDb.pool.query(
        `INSERT INTO session (sid, sess, expire) VALUES ('expired-sid', '{}', now() - interval '1 hour')`,
      );
      await new Promise<void>((resolve, reject) =>
        server.sessionStore.pruneSessions((error) => (error ? reject(error) : resolve())),
      );
      const left = await tempDb.pool.query(`SELECT 1 FROM session WHERE sid = 'expired-sid'`);
      expect(left.rowCount).toBe(0);
      await me(cookie).expect(200);
    });

    it('로그아웃하면 세션이 끝나고 세션이 없어도 204다', async () => {
      const { cookie, ip } = await signupAndLogin('로그아웃');
      await api()
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .set('X-Forwarded-For', ip)
        .expect(204);
      await me(cookie).expect(401);
      await api().post('/api/auth/logout').set('X-Forwarded-For', ip).expect(204);
    });

    it('비밀번호를 바꾸면 현재 세션만 남고 다른 세션과 그 Socket.IO 연결이 끝난다', async () => {
      const a = await signupAndLogin('비번변경');
      const bCookie = cookieOf(await login(a.ip, '비번변경').expect(200));

      const bSocket = await openSocket(bCookie);
      const replaced = once(bSocket, 'session:replaced');
      const disconnected = once(bSocket, 'disconnect');

      await api()
        .patch('/api/me/password')
        .set('Cookie', a.cookie)
        .send({ currentPassword: PASSWORD, newPassword: 'brand-new-pass' })
        .expect(204);

      await me(a.cookie).expect(200);
      await me(bCookie).expect(401);
      await replaced;
      await disconnected;
      expect(bSocket.connected).toBe(false);

      await login(a.ip, '비번변경', PASSWORD).expect(401);
      await login(a.ip, '비번변경', 'brand-new-pass').expect(200);
    });
  });

  describe('오류', () => {
    it('입력 형식이 틀리면 INVALID_INPUT 400이다', async () => {
      const ip = nextIp();
      const bad: Array<[string, object]> = [
        ['짧은 닉네임', { nickname: 'a', password: PASSWORD }],
        ['긴 닉네임', { nickname: 'a'.repeat(13), password: PASSWORD }],
        ['특수문자 닉네임', { nickname: 'a b!', password: PASSWORD }],
        ['짧은 비밀번호', { nickname: '정상닉', password: 'short' }],
        ['필드 누락', { nickname: '정상닉' }],
      ];
      for (const [name, body] of bad) {
        const res = await api().post('/api/auth/signup').set('X-Forwarded-For', ip).send(body);
        expect(res.status, name).toBe(400);
        expect(res.body.error.code, name).toBe('INVALID_INPUT');
      }
      const malformed = await api()
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .set('Content-Type', 'application/json')
        .send('{"nickname":');
      expect(malformed.status).toBe(400);
      expect(malformed.body.error.code).toBe('INVALID_INPUT');
    });

    it('닉네임 중복은 NICKNAME_TAKEN 409이고 대소문자·NFC 표기 차이를 무시한다', async () => {
      const ip = nextIp();
      await signup(ip, 'DupeName').expect(201);
      for (const same of ['dupename', 'DUPENAME', 'dUPEnAME']) {
        const res = await signup(ip, same).expect(409);
        expect(res.body.error.code).toBe('NICKNAME_TAKEN');
      }
      const nfd = '각각'; // 각각(분해형)
      await signup(ip, '각각').expect(201);
      expect((await signup(ip, nfd).expect(409)).body.error.code).toBe('NICKNAME_TAKEN');
    });

    it('같은 닉네임으로 동시에 가입하면 한 명만 성공한다', async () => {
      const results = await Promise.all(
        Array.from({ length: 5 }, () => signup(nextIp(), 'RaceName')),
      );
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(4);
      const rows = await tempDb.pool.query(
        `SELECT 1 FROM users WHERE lower(nickname) = 'racename'`,
      );
      expect(rows.rowCount).toBe(1);
    });

    it('닉네임 없음과 비밀번호 틀림은 같은 INVALID_CREDENTIALS 401이다', async () => {
      const ip = nextIp();
      await signup(ip, '실패검사').expect(201);
      const wrongPassword = await login(ip, '실패검사', 'wrong-password').expect(401);
      const noNickname = await login(ip, '없는닉네임').expect(401);
      expect(wrongPassword.body).toEqual(noNickname.body);
      expect(wrongPassword.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('세션이 없으면 UNAUTHENTICATED 401이다', async () => {
      const responses = [
        await api().get('/api/me'),
        await api()
          .patch('/api/me/password')
          .send({ currentPassword: 'x', newPassword: 'long-enough' }),
        await api().patch('/api/me/character').send({ characterId: 'cat' }),
      ];
      for (const res of responses) {
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe('UNAUTHENTICATED');
      }
    });

    it('현재 비밀번호가 틀리면 INVALID_CREDENTIALS 401이고 비밀번호·세션은 그대로다', async () => {
      const { cookie, ip } = await signupAndLogin('현재비번틀림');
      const res = await api()
        .patch('/api/me/password')
        .set('Cookie', cookie)
        .send({ currentPassword: 'not-the-password', newPassword: 'another-pass-1' })
        .expect(401);
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
      await me(cookie).expect(200);
      await login(ip, '현재비번틀림', PASSWORD).expect(200);
    });

    it('새 비밀번호가 8자 미만이거나 캐릭터 값이 없으면 INVALID_INPUT 400이다', async () => {
      const { cookie } = await signupAndLogin('입력검사');
      const short = await api()
        .patch('/api/me/password')
        .set('Cookie', cookie)
        .send({ currentPassword: PASSWORD, newPassword: 'short' })
        .expect(400);
      expect(short.body.error.code).toBe('INVALID_INPUT');
      const badCharacter = await api()
        .patch('/api/me/character')
        .set('Cookie', cookie)
        .send({ characterId: 'dragon' })
        .expect(400);
      expect(badCharacter.body.error.code).toBe('INVALID_INPUT');
    });
  });

  describe('예외', () => {
    it('/api/auth/*가 IP당 분당 20회를 넘으면 429 RATE_LIMITED와 Retry-After를 돌려준다', async () => {
      const ip = nextIp();
      for (let i = 0; i < 20; i++) {
        const res = await login(ip, '없는닉네임');
        expect(res.status, `${i + 1}번째`).toBe(401);
      }
      const limited = await login(ip, '없는닉네임').expect(429);
      expect(limited.body).toEqual({
        error: { code: 'RATE_LIMITED', message: expect.any(String) },
      });
      const retryAfter = Number(limited.headers['retry-after']);
      expect(retryAfter).toBeGreaterThanOrEqual(1);
      expect(retryAfter).toBeLessThanOrEqual(60);
      // signup·logout도 같은 카운터를 공유한다.
      await signup(ip, '제한후가입').expect(429);
      await api().post('/api/auth/logout').set('X-Forwarded-For', ip).expect(429);
      // 다른 IP와 인증 밖 경로(/api/me)는 영향이 없다.
      await login(nextIp(), '없는닉네임').expect(401);
      await api().get('/api/me').set('X-Forwarded-For', ip).expect(401);
    });

    it('로그인에 연속으로 실패해도 계정이 잠기지 않는다', async () => {
      const ip = nextIp();
      await signup(ip, '잠금없음').expect(201);
      for (let i = 0; i < 10; i++) {
        await login(ip, '잠금없음', `wrong-password-${i}`).expect(401);
      }
      await login(ip, '잠금없음', PASSWORD).expect(200);
    });

    it('로그인하지 않은 Socket.IO 연결은 거부한다', async () => {
      await expect(openSocket()).rejects.toThrow('UNAUTHENTICATED');
      await expect(openSocket('connect.sid=s%3Aforged.signature')).rejects.toThrow(
        'UNAUTHENTICATED',
      );
    });

    it('로그인한 사용자는 세션 쿠키로 Socket.IO에 연결된다', async () => {
      const { cookie } = await signupAndLogin('소켓연결');
      const socket = await openSocket(cookie);
      expect(socket.connected).toBe(true);
    });

    it('같은 계정의 새 연결은 기존 연결에 session:replaced를 보내고 끊는다', async () => {
      const { cookie, ip } = await signupAndLogin('중복접속');
      const secondCookie = cookieOf(await login(ip, '중복접속').expect(200));

      const first = await openSocket(cookie);
      const replaced = once(first, 'session:replaced');
      const disconnected = once(first, 'disconnect');

      const second = await openSocket(secondCookie);
      await replaced;
      await disconnected;
      expect(first.connected).toBe(false);
      expect(second.connected).toBe(true);
    });

    it('로그아웃하면 그 세션의 Socket.IO 연결이 끊긴다', async () => {
      const { cookie, ip } = await signupAndLogin('로그아웃소켓');
      const socket = await openSocket(cookie);
      const disconnected = once(socket, 'disconnect');
      await api()
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .set('X-Forwarded-For', ip)
        .expect(204);
      await disconnected;
      expect(socket.connected).toBe(false);
    });

    it('운영 설정에서는 프록시(X-Forwarded-Proto: https) 뒤에서 세션 쿠키에 Secure가 붙는다', async () => {
      const prod = createAppServer({
        pool: tempDb.pool,
        sessionSecret: 'test-secret-test-secret-test-secret-0123',
        isProduction: true,
      });
      try {
        const ip = nextIp();
        const body = { nickname: '운영쿠키', password: PASSWORD };
        const headers = { 'X-Forwarded-For': ip, 'X-Forwarded-Proto': 'https' };
        await request(prod.httpServer).post('/api/auth/signup').set(headers).send(body).expect(201);
        const res = await request(prod.httpServer)
          .post('/api/auth/login')
          .set(headers)
          .send(body)
          .expect(200);
        const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!;
        expect(cookie).toMatch(/Secure/i);
        expect(cookie).toMatch(/HttpOnly/i);
      } finally {
        await prod.close();
      }
    });
  });
});
