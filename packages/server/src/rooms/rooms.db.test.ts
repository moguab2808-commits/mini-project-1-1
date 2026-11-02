import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  RoomClosedSchema,
  RoomStateSchema,
  type RoomAck,
  type RoomErrorCode,
  type RoomState,
} from '@alkkagi/shared';
import { createAppServer, type AppServer } from '../app.ts';
import { createTempDatabase, type TempDatabase } from '../db/temp-database.ts';
import { createDb } from '../db/pool.ts';
import { clearRooms, type RoomView } from './room-store.ts';

// 실제 PostgreSQL(임시 DB)이 필요하다. `npm run test:db`로만 실행한다.
const baseUrl = process.env.DATABASE_URL;

const PASSWORD = 'correct-horse';

type Player = { name: string; socket: ClientSocket };
type Ack = RoomAck<{ roomId?: number }>;

const publicRoom = { title: '공개방', isPublic: true, pieceCount: 5, board: 'standard' };
const privateRoom = (code: string) => ({
  title: '비공개방',
  isPublic: false,
  pieceCount: 7,
  board: 'circle',
  code,
});

describe.skipIf(!baseUrl)('로비·방 (IMPL-008)', () => {
  let tempDb: TempDatabase;
  let server: AppServer;
  let port: number;
  let ipSeq = 0;
  let userSeq = 0;
  let sockets: ClientSocket[] = [];
  // 상대가 입장해 시작된 방. 경기 서버(IMPL-009)가 받을 `onStarted` 호출을 기록한다.
  const started: RoomView[] = [];

  // 인증 빈도 제한이 IP당 분당 20회라 사용자마다 다른 IP로 가입·로그인한다(trust proxy 1).
  const nextIp = () => `10.1.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`;
  const api = () => request(server.httpServer);

  async function loginAs(nickname: string): Promise<string> {
    const ip = nextIp();
    await api()
      .post('/api/auth/signup')
      .set('X-Forwarded-For', ip)
      .send({ nickname, password: PASSWORD })
      .expect(201);
    const res = await api()
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ nickname, password: PASSWORD })
      .expect(200);
    return (res.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
  }

  function openSocket(cookie: string): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const socket = connect(`http://127.0.0.1:${port}`, {
        extraHeaders: { cookie },
        reconnection: false,
        forceNew: true,
      });
      sockets.push(socket);
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', reject);
    });
  }

  async function player(): Promise<Player & { cookie: string }> {
    const name = `방유저${++userSeq}`;
    const cookie = await loginAs(name);
    return { name, cookie, socket: await openSocket(cookie) };
  }

  const emit = (socket: ClientSocket, event: string, payload?: unknown) =>
    new Promise<Ack>((resolve) => {
      socket.emit(event, payload, resolve);
    });

  const once = <T>(socket: ClientSocket, event: string) =>
    new Promise<T>((resolve) => socket.once(event, (payload: T) => resolve(payload)));

  const expectError = (ack: Ack, code: RoomErrorCode) => {
    expect(ack).toMatchObject({ ok: false, error: { code } });
  };

  const roomIdOf = (ack: Ack) => (ack as { roomId: number }).roomId;

  /** 방장이 방을 만든다. 비공개로 만들려면 `room`에 `privateRoom(code)`를 넘긴다. */
  async function createRoom(host: Player, room: object = publicRoom): Promise<number> {
    const ack = await emit(host.socket, 'room:create', room);
    expect(ack.ok).toBe(true);
    return roomIdOf(ack);
  }

  const roomRows = () =>
    tempDb.pool.query<{ id: number; guest_id: number | null; status: string }>(
      'SELECT id, guest_id, status FROM rooms ORDER BY id',
    );

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  beforeAll(async () => {
    tempDb = await createTempDatabase(baseUrl!);
    server = createAppServer({
      pool: tempDb.pool,
      sessionSecret: 'test-secret-test-secret-test-secret-0123',
      isProduction: false,
      roomHooks: { onStarted: (view) => void started.push(view) },
    });
    await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
    port = (server.httpServer.address() as AddressInfo).port;
  }, 60_000);

  afterEach(async () => {
    for (const socket of sockets) socket.disconnect();
    sockets = [];
    started.length = 0;
    await sleep(300); // 끊김 처리(방 나가기)가 끝난 뒤 남은 방을 비운다
    await tempDb.pool.query('DELETE FROM rooms');
  });

  afterAll(async () => {
    await server?.close();
    await tempDb?.drop();
  }, 60_000);

  describe('정상', () => {
    it('방장은 혼자 대기하고, 공개 방에 상대가 입장하면 곧바로 시작해 양쪽에 room:state가 간다', async () => {
      const host = await player();
      const guest = await player();

      const hostFirst = once<RoomState>(host.socket, 'room:state');
      const roomId = await createRoom(host);
      const first = RoomStateSchema.parse(await hostFirst);
      expect(first).toMatchObject({ isHost: true, guest: null, status: 'waiting', isPublic: true });
      expect(first.host.nickname).toBe(host.name);
      expect(first.code).toBeUndefined();
      expect(started).toHaveLength(0);

      const hostSees = once<RoomState>(host.socket, 'room:state');
      const guestSees = once<RoomState>(guest.socket, 'room:state');
      expect(await emit(guest.socket, 'room:join', { roomId })).toEqual({ ok: true, roomId });
      const [h, g] = [
        RoomStateSchema.parse(await hostSees),
        RoomStateSchema.parse(await guestSees),
      ];
      for (const state of [h, g]) {
        expect(state.host.nickname).toBe(host.name);
        expect(state.guest?.nickname).toBe(guest.name);
        expect(state.status).toBe('playing');
      }
      expect(h.isHost).toBe(true);
      expect(g.isHost).toBe(false);

      // 시작 버튼 없이 입장 문장 하나로 `playing`이 되고 경기 서버 훅이 한 번 불린다.
      expect((await roomRows()).rows[0]?.status).toBe('playing');
      expect(started).toHaveLength(1);
      expect(started[0]?.host.nickname).toBe(host.name);
      expect(started[0]?.guest?.nickname).toBe(guest.name);
    });

    it('즉시 참가는 대기 중인 공개 방만 고르고 입장하면 바로 시작한다', async () => {
      const privateHost = await player();
      const playingHost = await player();
      const playingGuest = await player();
      const openHost = await player();
      const joiner = await player();

      await createRoom(privateHost, privateRoom('ABCDEF'));
      const playingId = await createRoom(playingHost);
      await emit(playingGuest.socket, 'room:join', { roomId: playingId });
      const openId = await createRoom(openHost);

      const ack = await emit(joiner.socket, 'room:quickJoin');
      expect(ack).toEqual({ ok: true, roomId: openId });
      const rows = Object.fromEntries((await roomRows()).rows.map((r) => [r.id, r.status]));
      expect(rows[openId]).toBe('playing');
      expect(started.map((v) => v.room.id)).toEqual([playingId, openId]);
    });

    it('GET /api/rooms는 공개·비공개 방을 status와 함께 주고 비공개 방의 code·사용자 번호는 없다', async () => {
      const a = await player();
      const b = await player();
      const c = await player();
      const d = await player();
      await createRoom(a);
      await createRoom(b, privateRoom('K7M2QX'));
      await emit(c.socket, 'room:join', { code: 'K7M2QX' });
      await emit(c.socket, 'room:leave'); // 비공개 방은 다시 대기 중이 된다
      await emit(d.socket, 'room:quickJoin'); // 공개 방은 시작해 게임 중이 된다

      const res = await api().get('/api/rooms').set('Cookie', a.cookie).expect(200);
      expect(res.body.rooms).toHaveLength(2);
      const byTitle = Object.fromEntries(
        res.body.rooms.map((r: { title: string }) => [r.title, r]),
      );
      expect(byTitle['공개방']).toMatchObject({ isPublic: true, status: 'playing' });
      expect(byTitle['비공개방']).toMatchObject({ isPublic: false, status: 'waiting' });
      expect(byTitle['비공개방'].host.nickname).toBe(b.name);

      const text = JSON.stringify(res.body);
      expect(text).not.toContain('K7M2QX');
      expect(text).not.toMatch(/"(code|guest|hostId|guestId|id|pieceCount|board)"/);
      expect(Object.keys(byTitle['비공개방']).sort()).toEqual(
        ['host', 'isPublic', 'roomId', 'status', 'title'].sort(),
      );
    });

    it('GET /api/rooms는 로그인하지 않으면 401이다', async () => {
      const res = await api().get('/api/rooms').expect(401);
      expect(res.body).toEqual({ error: { code: 'UNAUTHENTICATED', message: expect.any(String) } });
    });

    it('비공개 방의 code는 방장의 room:state에만 있다', async () => {
      const host = await player();
      const guest = await player();
      const hostFirst = once<RoomState>(host.socket, 'room:state');
      await createRoom(host, privateRoom('HJKLMN'));
      expect((await hostFirst).code).toBe('HJKLMN');

      const hostSees = once<RoomState>(host.socket, 'room:state');
      const guestSees = once<RoomState>(guest.socket, 'room:state');
      expect(await emit(guest.socket, 'room:join', { code: 'HJKLMN' })).toMatchObject({ ok: true });
      expect((await hostSees).code).toBe('HJKLMN');
      const seenByGuest = await guestSees;
      expect(seenByGuest.code).toBeUndefined();
      expect(JSON.stringify(seenByGuest)).not.toContain('HJKLMN');
    });
  });

  describe('오류', () => {
    it('입력이 스키마를 만족하지 않으면 INVALID_INPUT이다', async () => {
      const host = await player();
      expectError(
        await emit(host.socket, 'room:create', { ...publicRoom, code: 'ABCDEF' }),
        'INVALID_INPUT',
      );
      expectError(
        await emit(host.socket, 'room:create', { ...publicRoom, isPublic: false }),
        'INVALID_INPUT',
      );
      expectError(
        await emit(host.socket, 'room:create', { ...publicRoom, title: '' }),
        'INVALID_INPUT',
      );
      expectError(
        await emit(host.socket, 'room:create', { ...publicRoom, pieceCount: 6 }),
        'INVALID_INPUT',
      );
      expectError(
        await emit(host.socket, 'room:create', { ...publicRoom, board: 'x' }),
        'INVALID_INPUT',
      );
      expectError(await emit(host.socket, 'room:create', 'nope'), 'INVALID_INPUT');
      expectError(await emit(host.socket, 'room:join', {}), 'INVALID_INPUT');
      expect((await roomRows()).rows).toHaveLength(0);
    });

    it('코드가 겹치는 방 생성은 CODE_TAKEN이다', async () => {
      const a = await player();
      const b = await player();
      await createRoom(a, privateRoom('ZZZZZZ'));
      expectError(await emit(b.socket, 'room:create', privateRoom('ZZZZZZ')), 'CODE_TAKEN');
    });

    it('이미 방장이거나 참여자면 만들기·입장·즉시 참가는 ALREADY_IN_ROOM이다', async () => {
      const host = await player();
      const other = await player();
      const guest = await player();
      const roomId = await createRoom(host);
      const otherRoomId = await createRoom(other);

      expectError(await emit(host.socket, 'room:create', publicRoom), 'ALREADY_IN_ROOM');
      expectError(await emit(host.socket, 'room:join', { roomId }), 'ALREADY_IN_ROOM');
      expectError(await emit(host.socket, 'room:quickJoin'), 'ALREADY_IN_ROOM');

      expect(await emit(guest.socket, 'room:join', { roomId })).toMatchObject({ ok: true });
      expectError(await emit(guest.socket, 'room:create', publicRoom), 'ALREADY_IN_ROOM');
      expectError(
        await emit(guest.socket, 'room:join', { roomId: otherRoomId }),
        'ALREADY_IN_ROOM',
      );
      expectError(await emit(guest.socket, 'room:quickJoin'), 'ALREADY_IN_ROOM');
    });

    it('없는 방·입장할 방이 없는 즉시 참가는 ROOM_NOT_FOUND이다', async () => {
      const p = await player();
      expectError(await emit(p.socket, 'room:join', { roomId: 999_999 }), 'ROOM_NOT_FOUND');
      expectError(await emit(p.socket, 'room:quickJoin'), 'ROOM_NOT_FOUND');
    });

    it('이미 상대가 입장해 시작된 방에 들어가면 ROOM_PLAYING이고 상대·상태는 바뀌지 않는다', async () => {
      const host = await player();
      const guest = await player();
      const third = await player();
      const roomId = await createRoom(host);
      await emit(guest.socket, 'room:join', { roomId });

      expectError(await emit(third.socket, 'room:join', { roomId }), 'ROOM_PLAYING');
      const [row] = (await roomRows()).rows;
      expect(row).toMatchObject({ status: 'playing' });
      expect(started).toHaveLength(1);
    });

    it('비공개 방은 코드가 틀리거나 방 id만 보내면 INVALID_CODE이고 방 상태를 알려 주지 않는다', async () => {
      const host = await player();
      const guest = await player();
      const third = await player();
      const roomId = await createRoom(host, privateRoom('QRSTUV'));

      expectError(await emit(third.socket, 'room:join', { code: 'AAAAAA' }), 'INVALID_CODE');
      expectError(await emit(third.socket, 'room:join', { code: 'abc' }), 'INVALID_CODE');
      expectError(await emit(third.socket, 'room:join', { roomId }), 'INVALID_CODE');
      expectError(
        await emit(third.socket, 'room:join', { roomId, code: 'AAAAAA' }),
        'INVALID_CODE',
      );

      await emit(guest.socket, 'room:join', { code: 'QRSTUV' });
      // 시작된 뒤에도 틀린 코드에는 ROOM_PLAYING이 아니라 INVALID_CODE다.
      expectError(
        await emit(third.socket, 'room:join', { roomId, code: 'AAAAAA' }),
        'INVALID_CODE',
      );
      expectError(await emit(third.socket, 'room:join', { code: 'QRSTUV' }), 'ROOM_PLAYING');
    });

    it('room:join이 분당 30회를 넘으면 RATE_LIMITED이고 재접속해도 이어서 센다', async () => {
      const p = await player();
      for (let i = 0; i < 30; i++) {
        expectError(await emit(p.socket, 'room:join', { roomId: 999_999 }), 'ROOM_NOT_FOUND');
      }
      expectError(await emit(p.socket, 'room:join', { roomId: 999_999 }), 'RATE_LIMITED');

      const again = await openSocket(p.cookie);
      expectError(await emit(again, 'room:join', { roomId: 999_999 }), 'RATE_LIMITED');
    });
  });

  describe('예외', () => {
    it('두 사용자가 동시에 같은 방에 입장하면 한 명만 성공하고 시작은 한 번만 일어난다', async () => {
      const host = await player();
      const a = await player();
      const b = await player();
      const roomId = await createRoom(host);

      const acks = await Promise.all([
        emit(a.socket, 'room:join', { roomId }),
        emit(b.socket, 'room:join', { roomId }),
      ]);
      expect(acks.filter((r) => r.ok)).toHaveLength(1);
      expectError(
        acks.find((r) => !r.ok)!,
        'ROOM_PLAYING',
      );
      expect((await roomRows()).rows[0]?.guest_id).not.toBeNull();
      expect(started).toHaveLength(1);
    });

    it('동시에 즉시 참가해도 한 방에는 한 명만 들어가고 시작은 한 번만 일어난다', async () => {
      const host = await player();
      const a = await player();
      const b = await player();
      await createRoom(host);

      const acks = await Promise.all([
        emit(a.socket, 'room:quickJoin'),
        emit(b.socket, 'room:quickJoin'),
      ]);
      expect(acks.filter((r) => r.ok)).toHaveLength(1);
      expectError(
        acks.find((r) => !r.ok)!,
        'ROOM_NOT_FOUND',
      );
      expect(started).toHaveLength(1);
    });

    it('경기 중 방장이 나가면 방이 삭제되고 참여자에게 room:closed가 간다', async () => {
      const host = await player();
      const guest = await player();
      const roomId = await createRoom(host);
      await emit(guest.socket, 'room:join', { roomId });

      const closed = once(guest.socket, 'room:closed');
      expect(await emit(host.socket, 'room:leave')).toEqual({ ok: true });
      expect(RoomClosedSchema.parse(await closed)).toEqual({ reason: 'host_left' });
      expect((await roomRows()).rows).toHaveLength(0);
    });

    it('대기 중 방장이 나가면 방이 삭제된다', async () => {
      const host = await player();
      await createRoom(host);
      expect(await emit(host.socket, 'room:leave')).toEqual({ ok: true });
      expect((await roomRows()).rows).toHaveLength(0);
    });

    it('참여자가 나가면 방은 유지되고 guest_id만 비워지며 방장은 다시 대기 상태가 된다', async () => {
      const host = await player();
      const guest = await player();
      const roomId = await createRoom(host);
      await emit(guest.socket, 'room:join', { roomId });
      expect((await roomRows()).rows[0]?.status).toBe('playing');

      const seen = once<RoomState>(host.socket, 'room:state');
      expect(await emit(guest.socket, 'room:leave')).toEqual({ ok: true });
      // 같은 갱신에서 status도 waiting으로 돌아가 상대 없는 playing 상태가 남지 않는다.
      expect(RoomStateSchema.parse(await seen)).toMatchObject({ guest: null, status: 'waiting' });
      expect((await roomRows()).rows).toEqual([{ id: roomId, guest_id: null, status: 'waiting' }]);
    });

    it('상대가 나간 뒤 다른 사용자가 입장하면 다시 곧바로 시작한다', async () => {
      const host = await player();
      const guest = await player();
      const next = await player();
      const roomId = await createRoom(host);
      await emit(guest.socket, 'room:join', { roomId });
      await emit(guest.socket, 'room:leave');

      const hostSees = once<RoomState>(host.socket, 'room:state');
      expect(await emit(next.socket, 'room:join', { roomId })).toEqual({ ok: true, roomId });
      expect(RoomStateSchema.parse(await hostSees)).toMatchObject({ status: 'playing' });
      expect(started).toHaveLength(2);
      expect(started[1]?.guest?.nickname).toBe(next.name);
      expect((await roomRows()).rows[0]).toMatchObject({ status: 'playing' });
    });

    it('방에 없어도 room:leave는 성공한다', async () => {
      const p = await player();
      expect(await emit(p.socket, 'room:leave')).toEqual({ ok: true });
    });

    it('더 이상 room:start 명령은 없다(ack가 오지 않는다)', async () => {
      const host = await player();
      const guest = await player();
      const roomId = await createRoom(host);
      await emit(guest.socket, 'room:join', { roomId });
      const outcome = await Promise.race([
        emit(host.socket, 'room:start'),
        sleep(500).then(() => 'no-ack' as const),
      ]);
      expect(outcome).toBe('no-ack');
    });

    it('연결이 끊기면 방에서 나간 것으로 처리한다(참여자면 자리 비움, 방장이면 방 삭제)', async () => {
      const host = await player();
      const guest = await player();
      const roomId = await createRoom(host);
      await emit(guest.socket, 'room:join', { roomId });

      const seen = once<RoomState>(host.socket, 'room:state');
      guest.socket.disconnect();
      expect((await seen).guest).toBeNull();

      host.socket.disconnect();
      await sleep(500);
      expect((await roomRows()).rows).toHaveLength(0);
    });

    it('서버 시작 때 rooms가 전부 삭제된다', async () => {
      const a = await player();
      const b = await player();
      await createRoom(a);
      await createRoom(b, privateRoom('MNPQRS'));
      expect((await roomRows()).rows).toHaveLength(2);

      await clearRooms(createDb(tempDb.pool));
      expect((await roomRows()).rows).toHaveLength(0);
    });
  });
});
