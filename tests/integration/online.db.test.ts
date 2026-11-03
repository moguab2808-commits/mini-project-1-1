// 브라우저 전송 계층과 서버를 함께 검증한다. 제품 패키지 사이의 import가 아닌 통합 테스트다.
import type { AddressInfo } from 'node:net';
import { io, type Socket } from 'socket.io-client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { RoomClient } from '../../packages/client/src/online/room-client.ts';
import { createAppServer, type AppServer } from '../../packages/server/src/app.ts';
import {
  createTempDatabase,
  type TempDatabase,
} from '../../packages/server/src/db/temp-database.ts';

const baseUrl = process.env.DATABASE_URL;
const input = {
  title: '연동방',
  isPublic: true,
  board: 'standard' as const,
  pieceCount: 5 as const,
};
const PASSWORD = 'integration-test-password';

describe.skipIf(!baseUrl)('RemoteGameSession + 실제 서버 연동 (IMPL-010)', () => {
  let db: TempDatabase;
  let server: AppServer;
  let url: string;
  let seq = 0;
  let failStart = false;
  const clients: RoomClient[] = [];
  const sockets: Socket[] = [];

  async function player(cookie?: string) {
    if (!cookie) {
      const nickname = `연동${++seq}`;
      const ip = `10.3.0.${seq}`;
      await request(server.httpServer)
        .post('/api/auth/signup')
        .set('X-Forwarded-For', ip)
        .send({ nickname, password: PASSWORD })
        .expect(201);
      const login = await request(server.httpServer)
        .post('/api/auth/login')
        .set('X-Forwarded-For', ip)
        .send({ nickname, password: PASSWORD })
        .expect(200);
      cookie = (login.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    }
    const socket = io(url, {
      autoConnect: false,
      reconnection: false,
      forceNew: true,
      extraHeaders: { cookie },
    });
    const loginRequired = vi.fn();
    const closed = vi.fn();
    const client = new RoomClient(socket, { onLoginRequired: loginRequired, onRoomClosed: closed });
    clients.push(client);
    sockets.push(socket);
    const connected = new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
    });
    client.connect();
    await connected;
    return { client, socket, cookie, loginRequired, closed };
  }
  async function waitFor(check: () => boolean) {
    await vi.waitFor(() => expect(check()).toBe(true), { timeout: 5000, interval: 10 });
  }
  async function match() {
    const host = await player();
    const guest = await player();
    const created = await host.client.create(input);
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('방 생성 실패');
    expect(await guest.client.join({ roomId: created.roomId })).toEqual({
      ok: true,
      roomId: created.roomId,
    });
    await waitFor(() => host.client.getState().match!.store.getState().start !== null);
    return { host, guest, roomId: created.roomId };
  }

  beforeAll(async () => {
    db = await createTempDatabase(baseUrl!);
    server = createAppServer({
      pool: db.pool,
      sessionSecret: 'integration-test-secret-01234567890123456789',
      isProduction: false,
      gameLogSink: () => {},
      roomHooks: {
        onStarted: () => {
          if (failStart) throw new Error('시작 실패 주입');
        },
      },
    });
    await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${(server.httpServer.address() as AddressInfo).port}`;
  });
  afterEach(async () => {
    for (const client of clients.splice(0)) client.dispose();
    for (const socket of sockets.splice(0)) socket.disconnect();
    failStart = false;
    await vi.waitFor(
      async () => {
        const { rows } = await db.pool.query('SELECT id FROM rooms');
        expect(rows).toHaveLength(0);
      },
      { timeout: 5000, interval: 20 },
    );
  });
  afterAll(async () => {
    await server?.close();
    await db?.drop();
  });

  it('입장 ack 이전 시작·지급 수신 → 발사·몸짓 → 종료 → 같은 세션 재도전 → 나가기', async () => {
    const { host, guest } = await match();
    const h = host.client.getState().match!;
    const g = guest.client.getState().match!;
    const start = h.store.getState().start!;
    expect(g.store.getState().start!.gameId).toBe(start.gameId);
    expect(h.store.getState().grantCard).not.toBeNull();
    expect(g.store.getState().grantCard).not.toBeNull();
    const active = start.view.activePlayerId === 0 ? h : g;
    const view = active.store.getState().view!;
    const stone = view.stones.find((s) => s.ownerId === active.session.playerId)!;
    const shot = await active.session.submitShot({
      gameId: start.gameId,
      turnId: view.turnId,
      stoneId: stone.id,
      angle: 0,
      power: 10,
    });
    expect(shot).toEqual({ ok: true });
    await waitFor(() => h.store.getState().view!.revision > start.view.revision);
    h.session.sendAim({ gameId: start.gameId, mode: 'idle', lookYaw: 0.3 });
    // aim은 volatile이므로 유실될 수 있다. 최신 입력을 다시 보내 수렴을 확인한다.
    await vi.waitFor(() => {
      h.session.sendAim({ gameId: start.gameId, mode: 'idle', lookYaw: 0.3 });
      expect(g.store.getState().opponentAim?.lookYaw).toBe(0.3);
    });
    expect(await h.session.forfeit({ gameId: start.gameId })).toEqual({ ok: true });
    await waitFor(() => h.store.getState().result !== null && g.store.getState().result !== null);
    expect(h.store.getState().result!.rematchDeadlineMs).not.toBeNull();
    expect(
      await Promise.all([
        h.session.requestRematch(start.gameId),
        g.session.requestRematch(start.gameId),
      ]),
    ).toEqual([{ ok: true }, { ok: true }]);
    await waitFor(() => h.store.getState().start!.gameId !== start.gameId);
    expect(host.client.getState().match).toBe(h);
    expect(guest.client.getState().match).toBe(g);
    expect(h.store.getState().result).toBeNull();
    expect(await guest.client.leave()).toEqual({ ok: true });
    await waitFor(() => host.client.getState().room!.status === 'waiting');
    expect(h.store.getState().result).toMatchObject({ winnerId: 0, rematchDeadlineMs: null });
    expect(host.client.getState().match).toBe(h);
    const next = await player();
    expect(await next.client.join({ roomId: host.client.getState().room!.roomId })).toMatchObject({
      ok: true,
    });
    await waitFor(() => h.store.getState().result === null);
    expect(host.client.getState().match).toBe(h);
  });

  it('두 좌석이 동시에 나가도 정리가 끝나고 전적은 한 번만 저장된다', async () => {
    const { host, guest } = await match();
    const room = host.client.getState().room!;
    expect(await Promise.all([host.client.leave(), guest.client.leave()])).toEqual([
      { ok: true },
      { ok: true },
    ]);
    const { rows } = await db.pool.query<{ total_games: number }>(
      'SELECT total_games FROM users WHERE nickname IN ($1, $2)',
      [room.host.nickname, room.guest!.nickname],
    );
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.total_games === 1)).toBe(true);
  });

  it('중복 접속은 옛 클라이언트에 로그인 전환을 한 번 요청하고 상대에게 방 폐쇄를 알린다', async () => {
    const { host, guest } = await match();
    await player(host.cookie);
    await waitFor(
      () => host.loginRequired.mock.calls.length === 1 && guest.closed.mock.calls.length === 1,
    );
    expect(host.loginRequired).toHaveBeenCalledWith('new_connection');
    expect(guest.closed).toHaveBeenCalledWith(expect.objectContaining({ reason: 'host_left' }));
    expect(host.client.getState().match).toBeNull();
    expect(host.socket.active).toBe(false);
  });

  it('서버 연결 종료 때 재접속 없이 로그인으로 전환한다', async () => {
    const { host, guest } = await match();
    server.io.disconnectSockets(true);
    await waitFor(
      () =>
        host.loginRequired.mock.calls.length === 1 && guest.loginRequired.mock.calls.length === 1,
    );
    expect(host.socket.active).toBe(false);
    expect(guest.socket.active).toBe(false);
  });

  it('시작 실패는 먼저 받은 playing 세션을 정리하고 방장은 대기로 돌아간다', async () => {
    const host = await player();
    const guest = await player();
    const created = await host.client.create(input);
    if (!created.ok) throw new Error('방 생성 실패');
    failStart = true;
    expect(await guest.client.join({ roomId: created.roomId })).toMatchObject({
      ok: false,
      error: { code: 'INTERNAL_ERROR' },
    });
    expect(guest.client.getState()).toEqual({ room: null, match: null });
    await waitFor(() => host.client.getState().room!.status === 'waiting');
    expect(host.client.getState().match!.store.getState().start).toBeNull();
  });
});
