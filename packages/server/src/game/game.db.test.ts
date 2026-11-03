import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { RuntimeClock } from '@alkkagi/game-runtime';
import type {
  CommandResult,
  GameOver,
  GameStart,
  HazardGranted,
  HazardTriggered,
  RematchState,
  RoomClosed,
  RoomState,
  TurnChange,
} from '@alkkagi/shared';
import { createAppServer, type AppServer } from '../app.ts';
import { createDb } from '../db/pool.ts';
import { createTempDatabase, type TempDatabase } from '../db/temp-database.ts';
import type { GameLogLine } from './game-log.ts';
import type { FinishedGame } from './game-service.ts';
import { recordResult } from './stats.ts';

// 실제 PostgreSQL(임시 DB)이 필요하다. `npm run test:db`로만 실행한다.
const baseUrl = process.env.DATABASE_URL;

const PASSWORD = 'correct-horse';

/** 경기 시계. 소켓·DB는 실제 시간으로 돌고, 경기 틱·재도전 타이머만 테스트가 넘긴다. */
class FakeClock implements RuntimeClock {
  t = Date.now();
  private timers: { at: number; cb: () => void; id: number }[] = [];
  private seq = 0;
  now(): number {
    return this.t;
  }
  setTimer(cb: () => void, delayMs: number): () => void {
    const id = this.seq++;
    this.timers.push({ at: this.t + delayMs, cb, id });
    return () => {
      this.timers = this.timers.filter((x) => x.id !== id);
    };
  }
  advance(ms: number): void {
    const target = this.t + ms;
    for (;;) {
      this.timers.sort((a, b) => a.at - b.at || a.id - b.id);
      const next = this.timers[0];
      if (!next || next.at > target) break;
      this.timers.shift();
      this.t = Math.max(this.t, next.at);
      next.cb();
    }
    this.t = target;
  }
}

type Ev = { event: string; payload: unknown };
type Player = {
  name: string;
  cookie: string;
  socket: ClientSocket;
  events: Ev[];
};
type Ack = { ok: boolean; roomId?: number; error?: { code: string } };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const publicRoom = { title: '공개방', isPublic: true, pieceCount: 5, board: 'standard' };

/** 인자 없이 쓸 수 있는 방해요소(위치·방향이 필요한 벽·끈끈이와 랜덤형은 뺀다) */
const SIMPLE_HAZARDS = ['board_spin', 'flashlight', 'water_gun', 'desk_shake', 'stun'];

describe.skipIf(!baseUrl)('온라인 대전 서버 (IMPL-009)', () => {
  let tempDb: TempDatabase;
  let server: AppServer;
  let port: number;
  let ipSeq = 0;
  let userSeq = 0;
  let sockets: ClientSocket[] = [];
  const clock = new FakeClock();
  // 경기 틱이 실제 시간처럼 흐르게 한다. 시계를 크게 넘기는 시험은 `clock.advance`를 더 부른다.
  let pump: ReturnType<typeof setInterval> | undefined;
  const logs: string[] = [];
  // `onGameFinished`(IMPL-011이 끼울 자리) 호출 기록. 방 정리(DB) 앞에서 불렸는지도 본다.
  const finished: (FinishedGame & { roomExists: boolean })[] = [];
  // 경기 서버 훅보다 먼저 불리는 테스트 훅. 시작 지연·실패를 만든다.
  const hook = {
    failStart: false,
    gate: null as Promise<void> | null,
    reached: false,
  };

  const nextIp = () => `10.2.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}`;
  const api = () => request(server.httpServer);

  async function login(nickname: string, signup: boolean): Promise<string> {
    const ip = nextIp();
    if (signup) {
      await api()
        .post('/api/auth/signup')
        .set('X-Forwarded-For', ip)
        .send({ nickname, password: PASSWORD })
        .expect(201);
    }
    const res = await api()
      .post('/api/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ nickname, password: PASSWORD })
      .expect(200);
    return (res.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
  }

  function openSocket(cookie: string): Promise<{ socket: ClientSocket; events: Ev[] }> {
    return new Promise((resolve, reject) => {
      const socket = connect(`http://127.0.0.1:${port}`, {
        extraHeaders: { cookie },
        reconnection: false,
        forceNew: true,
      });
      const events: Ev[] = [];
      socket.onAny((event: string, payload: unknown) => {
        events.push({ event, payload });
      });
      sockets.push(socket);
      socket.on('connect', () => resolve({ socket, events }));
      socket.on('connect_error', reject);
    });
  }

  async function player(): Promise<Player> {
    const name = `온라인${++userSeq}`;
    const cookie = await login(name, true);
    return { name, cookie, ...(await openSocket(cookie)) };
  }

  const emit = (socket: ClientSocket, event: string, payload?: unknown) =>
    new Promise<Ack>((resolve) => {
      socket.emit(event, payload, resolve);
    });

  /** 경기 명령은 틱에서 처리된다. 펌프가 틱을 돌리므로 ack를 기다리기만 하면 된다. */
  const command = (p: Player, event: string, payload: unknown) =>
    new Promise<CommandResult>((resolve) => {
      p.socket.emit(event, payload, resolve);
    });

  const eventsOf = <T>(p: Player, name: string): T[] =>
    p.events.filter((e) => e.event === name).map((e) => e.payload as T);

  async function waitFor<T>(p: Player, name: string, pred: (payload: T) => boolean = () => true) {
    for (let i = 0; i < 500; i++) {
      const found = eventsOf<T>(p, name).find(pred);
      if (found !== undefined) return found;
      await sleep(10);
    }
    throw new Error(`${p.name}: ${name} 이벤트를 받지 못했다`);
  }

  async function waitUntil(cond: () => boolean | Promise<boolean>, what: string) {
    for (let i = 0; i < 500; i++) {
      if (await cond()) return;
      await sleep(10);
    }
    throw new Error(`시간 초과: ${what}`);
  }

  /** 사용자의 전체 경기수·승·패. 무승부는 `total_games - wins - losses`다. */
  const record = async (name: string) => {
    const { rows } = await tempDb.pool.query<{
      id: number;
      total_games: number;
      wins: number;
      losses: number;
    }>('SELECT id, total_games, wins, losses FROM users WHERE nickname = $1', [name]);
    return rows[0]!;
  };

  // 앞 테스트의 연결 종료 처리가 늦게 끝날 수 있어 방 번호로 거른다.
  const finishedOf = (roomId: number) => finished.filter((f) => f.roomId === roomId);
  const waitFinished = (roomId: number, count: number) =>
    waitUntil(() => finishedOf(roomId).length >= count, `경기 종료 콜백 ${String(count)}회`);

  const roomRows = () =>
    tempDb.pool.query<{ id: number; guest_id: number | null; status: string }>(
      'SELECT id, guest_id, status FROM rooms ORDER BY id',
    );

  const gameLogs = (roomId: number): GameLogLine[] =>
    logs.map((l) => JSON.parse(l) as GameLogLine).filter((l) => l.roomId === roomId);

  /** 방을 만들고 상대가 입장해 경기가 시작될 때까지 진행한다. */
  async function startMatch() {
    const host = await player();
    const guest = await player();
    const created = await emit(host.socket, 'room:create', publicRoom);
    const roomId = created.roomId!;
    const joined = await emit(guest.socket, 'room:join', { roomId });
    expect(joined.ok).toBe(true);
    const hostStart = await waitFor<GameStart>(host, 'game:start');
    const guestStart = await waitFor<GameStart>(guest, 'game:start');
    return { host, guest, roomId, hostStart, guestStart, gameId: hostStart.gameId };
  }

  /** 새 경기마다 받는 방해요소가 달라 인자 없이 쓸 수 있는 보유자가 나올 때까지 방을 새로 연다. */
  async function matchWithSimpleHazard() {
    for (let i = 0; i < 12; i++) {
      const match = await startMatch();
      const holders = [
        { p: match.host, start: match.hostStart },
        { p: match.guest, start: match.guestStart },
      ];
      const holder = holders.find((h) => SIMPLE_HAZARDS.includes(h.start.view.private.held!.kind));
      if (holder) return { ...match, holder };
      await emit(match.host.socket, 'room:leave');
      await emit(match.guest.socket, 'room:leave');
    }
    throw new Error('인자 없이 쓸 수 있는 방해요소를 받은 경기가 나오지 않았다');
  }

  beforeAll(async () => {
    tempDb = await createTempDatabase(baseUrl!);
    server = createAppServer({
      pool: tempDb.pool,
      sessionSecret: 'test-secret-test-secret-test-secret-0123',
      isProduction: false,
      clock,
      rematchWindowMs: 15_000,
      gameLogSink: (line) => void logs.push(line),
      onGameFinished: async (info) => {
        const { rows } = await tempDb.pool.query('SELECT id FROM rooms WHERE id = $1', [
          info.roomId,
        ]);
        finished.push({ ...info, roomExists: rows.length === 1 });
      },
      roomHooks: {
        onStarted: async () => {
          hook.reached = true;
          if (hook.failStart) throw new Error('경기를 열지 못했다');
          if (hook.gate) await hook.gate;
        },
      },
    });
    await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
    port = (server.httpServer.address() as AddressInfo).port;
    pump = setInterval(() => {
      clock.advance(10);
    }, 10);
  }, 60_000);

  afterEach(async () => {
    for (const socket of sockets) socket.disconnect();
    sockets = [];
    hook.failStart = false;
    hook.gate = null;
    hook.reached = false;
    await sleep(300); // 끊김 처리(기권·종료 콜백)가 끝난 뒤 남은 방과 기록을 비운다
    await tempDb.pool.query('DELETE FROM rooms');
    finished.length = 0;
  });

  afterAll(async () => {
    clearInterval(pump);
    await server?.close();
    await tempDb?.drop();
  }, 60_000);

  describe('정상', () => {
    it('시작하면 방해요소는 받은 사람에게만 가고 이벤트 순서가 순서 규칙과 같다', async () => {
      const { host, guest, hostStart, guestStart } = await startMatch();
      expect(hostStart.seat).toBe(0);
      expect(guestStart.seat).toBe(1);
      await waitFor(host, 'turn:change');
      await waitFor(guest, 'turn:change');

      for (const [p, start] of [
        [host, hostStart],
        [guest, guestStart],
      ] as const) {
        const granted = eventsOf<HazardGranted>(p, 'hazard:granted');
        expect(granted).toHaveLength(1);
        expect(granted[0]!.kind).toBe(start.view.private.held!.kind);
        const order = p.events.map((e) => e.event);
        const first = (name: string) => order.indexOf(name);
        expect(first('game:start')).toBeLessThan(first('hazard:granted'));
        expect(first('hazard:granted')).toBeLessThan(first('turn:change'));
        expect(eventsOf<TurnChange>(p, 'turn:change')[0]!.reason).toBe('start');
      }
      // 상대의 보유 방해요소는 어느 쪽의 어떤 이벤트에도 담기지 않는다.
      expect(JSON.stringify(host.events)).not.toContain(
        guestStart.view.private.held!.hazardInstanceId,
      );
      expect(JSON.stringify(guest.events)).not.toContain(
        hostStart.view.private.held!.hazardInstanceId,
      );
    });

    it('hazard:use는 조건을 충족하면 양쪽에 hazard:triggered가 간다', async () => {
      const { host, guest, gameId, holder } = await matchWithSimpleHazard();
      const held = holder.start.view.private.held!;
      const result = await command(holder.p, 'hazard:use', {
        gameId,
        hazardInstanceId: held.hazardInstanceId,
      });
      expect(result).toEqual({ ok: true });
      for (const p of [host, guest]) {
        const triggered = await waitFor<HazardTriggered>(
          p,
          'hazard:triggered',
          // 랜덤형(바람·막대 가속)은 서버가 자동 발동하므로 사용한 종류로 좁힌다.
          (e) => e.phase === 'start' && e.kind === held.kind,
        );
        expect(triggered).toMatchObject({ gameId, kind: held.kind, sourceSeat: holder.start.seat });
      }
    });

    it('30초 동안 발사하지 않으면 turn:change(timeout)가 가고 연속 시간초과면 game:over(timeout_forfeit)가 간다', async () => {
      const { host, guest, roomId } = await startMatch();
      let over: GameOver | undefined;
      for (let i = 0; i < 12 && !over; i++) {
        clock.advance(31_000);
        await sleep(40);
        over = eventsOf<GameOver>(host, 'game:over')[0];
      }
      expect(over).toMatchObject({ reason: 'timeout_forfeit' });
      const reasons = eventsOf<TurnChange>(guest, 'turn:change').map((e) => e.reason);
      expect(reasons[0]).toBe('start');
      expect(reasons.filter((r) => r === 'timeout').length).toBeGreaterThanOrEqual(3);
      // 종료 콜백이 한 번만 불렸다.
      await waitFinished(roomId, 1);
      expect(finishedOf(roomId)).toHaveLength(1);
      expect(finishedOf(roomId)[0]!.result.reason).toBe('timeout_forfeit');
      // 두 사용자의 전적이 한 번만 반영됐다: 한 명은 승, 한 명은 패.
      const [h, g] = [await record(host.name), await record(guest.name)];
      expect([h.total_games, g.total_games]).toEqual([1, 1]);
      expect(h.wins + g.wins).toBe(1);
      expect(h.losses + g.losses).toBe(1);
      expect(
        gameLogs(roomId).some((l) => l.event === 'game_over' && l.reason === 'timeout_forfeit'),
      ).toBe(true);
    });
  });

  describe('오류', () => {
    it('경기 중이 아닌 사용자의 명령은 GAME_NOT_ACTIVE다', async () => {
      const lobby = await player();
      for (const event of ['shot:submit', 'hazard:use', 'board:rotate', 'game:forfeit']) {
        const r = await emit(lobby.socket, event, { gameId: 'none' });
        expect(r).toMatchObject({ ok: false, error: { code: 'GAME_NOT_ACTIVE' } });
      }
      const rematch = await emit(lobby.socket, 'rematch:request', { gameId: 'none' });
      expect(rematch).toMatchObject({ ok: false, error: { code: 'REMATCH_NOT_AVAILABLE' } });
    });

    it('낡은 명령은 STALE_TURN·STALE_HAZARD이고 입력의 사용자·좌석은 쓰지 않는다', async () => {
      const { host, guest, gameId, hostStart, guestStart } = await startMatch();
      const turn = await waitFor<TurnChange>(host, 'turn:change');
      const activeStart = turn.activePlayerId === 0 ? hostStart : guestStart;
      const idleStart = turn.activePlayerId === 0 ? guestStart : hostStart;
      const active = turn.activePlayerId === 0 ? host : guest;
      const idle = turn.activePlayerId === 0 ? guest : host;
      const ownStone = (s: GameStart) => s.view.stones.find((x) => x.ownerId === s.seat)!.id;

      const stale = await command(active, 'shot:submit', {
        gameId,
        turnId: turn.turnId + 99,
        stoneId: ownStone(activeStart),
        angle: 0.5,
        power: 10,
      });
      expect(stale).toMatchObject({ ok: false, error: { code: 'STALE_TURN' } });

      const staleHazard = await command(active, 'hazard:use', {
        gameId,
        hazardInstanceId: 'not-held',
      });
      expect(staleHazard).toMatchObject({ ok: false, error: { code: 'STALE_HAZARD' } });

      // 차례가 아닌 사람이 입력에 상대의 좌석·사용자 번호를 적어도 세션의 좌석으로만 처리된다.
      const forged = await command(idle, 'shot:submit', {
        gameId,
        turnId: turn.turnId,
        stoneId: ownStone(idleStart),
        angle: 0.5,
        power: 10,
        seat: turn.activePlayerId,
        userId: 1,
      });
      expect(forged).toMatchObject({ ok: false, error: { code: 'NOT_YOUR_TURN' } });

      const invalid = await command(active, 'shot:submit', { gameId, turnId: 'x' });
      expect(invalid).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
    });

    it('경기를 열지 못하면 입장을 되돌리고 입장자는 INTERNAL_ERROR를 받는다', async () => {
      const host = await player();
      const guest = await player();
      const { roomId } = await emit(host.socket, 'room:create', publicRoom);
      hook.failStart = true;
      const failed = await emit(guest.socket, 'room:join', { roomId });
      expect(failed).toMatchObject({ ok: false, error: { code: 'INTERNAL_ERROR' } });
      const rows = (await roomRows()).rows;
      expect(rows).toEqual([{ id: roomId, guest_id: null, status: 'waiting' }]);
      await waitUntil(
        () =>
          eventsOf<RoomState>(host, 'room:state').some(
            (s) =>
              s.status === 'waiting' &&
              s.guest === null &&
              eventsOf(host, 'room:state').length >= 3,
          ),
        '방장이 대기 상태를 다시 받는다',
      );

      // 되돌린 뒤에는 다시 입장해 경기를 열 수 있다.
      hook.failStart = false;
      expect(await emit(guest.socket, 'room:join', { roomId })).toMatchObject({ ok: true });
      await waitFor(guest, 'game:start');
    });
  });

  describe('예외: 이탈', () => {
    it('경기 중 room:leave는 나간 사람의 기권패이고 로그의 ingressSeq로 순서를 볼 수 있다', async () => {
      const { host, guest, roomId } = await startMatch();
      expect(await emit(guest.socket, 'room:leave')).toEqual({ ok: true });
      const over = await waitFor<GameOver>(host, 'game:over');
      expect(over).toMatchObject({ winnerId: 0, reason: 'forfeit' });
      // 종료 처리는 방 정리 앞에서 불린다(DATABASE 방 생명주기).
      await waitFinished(roomId, 1);
      expect(finishedOf(roomId)[0]).toMatchObject({ roomExists: true, result: { winnerId: 0 } });
      expect(await record(host.name)).toMatchObject({ total_games: 1, wins: 1, losses: 0 });
      expect(await record(guest.name)).toMatchObject({ total_games: 1, wins: 0, losses: 1 });
      // 참여자가 나가면 방은 유지돼 방장이 다시 대기한다.
      expect((await roomRows()).rows).toEqual([{ id: roomId, guest_id: null, status: 'waiting' }]);

      const lines = gameLogs(roomId);
      const start = lines.find((l) => l.event === 'start_commit')!;
      const leave = lines.find((l) => l.event === 'leave')!;
      const forfeit = lines.find((l) => l.event === 'forfeit')!;
      expect(leave).toMatchObject({ reason: 'leave_button', gameId: start.gameId });
      expect(leave.ingressSeq!).toBeGreaterThan(start.ingressSeq!);
      expect(forfeit.reason).toBe('leave');
      expect(lines.some((l) => l.event === 'game_over' && l.reason === 'forfeit')).toBe(true);
    });

    it('방장의 연결이 끊기면 방장의 기권패이고 참여자는 room:closed(host_left)를 받는다', async () => {
      const { host, guest, roomId } = await startMatch();
      host.socket.disconnect();
      const over = await waitFor<GameOver>(guest, 'game:over');
      expect(over).toMatchObject({ winnerId: 1, reason: 'forfeit' });
      expect(await waitFor<RoomClosed>(guest, 'room:closed')).toMatchObject({
        roomId,
        reason: 'host_left',
      });
      await waitFinished(roomId, 1);
      expect(finishedOf(roomId)[0]).toMatchObject({ roomExists: true, result: { winnerId: 1 } });
      expect(await record(host.name)).toMatchObject({ total_games: 1, wins: 0, losses: 1 });
      expect(await record(guest.name)).toMatchObject({ total_games: 1, wins: 1, losses: 0 });
      expect((await roomRows()).rows).toHaveLength(0);
      expect(gameLogs(roomId).find((l) => l.event === 'leave')).toMatchObject({
        reason: 'disconnect',
      });
    });

    it('같은 계정의 새 접속(session:replaced)은 기존 접속의 기권패다', async () => {
      const { host, guest, roomId } = await startMatch();
      const cookie = await login(guest.name, false);
      await openSocket(cookie);
      await waitFor(guest, 'session:replaced');
      const over = await waitFor<GameOver>(host, 'game:over');
      expect(over).toMatchObject({ winnerId: 0, reason: 'forfeit' });
      await waitFinished(roomId, 1);
      expect(gameLogs(roomId).find((l) => l.event === 'leave')).toMatchObject({
        reason: 'session_replaced',
      });
    });

    it('동시 이탈은 먼저 관찰된 쪽만 기권패이고 종료 처리는 한 번만 일어난다', async () => {
      const { host, guest, roomId } = await startMatch();
      const hostLeaving = emit(host.socket, 'room:leave');
      guest.socket.disconnect();
      await hostLeaving;
      await waitFinished(roomId, 1);
      await sleep(200);
      expect(finishedOf(roomId)).toHaveLength(1);
      const [h, g] = [await record(host.name), await record(guest.name)];
      expect([h.total_games, g.total_games]).toEqual([1, 1]);
      expect(h.wins + g.wins).toBe(1);
      expect(h.losses + g.losses).toBe(1);
      const { result, userIds } = finishedOf(roomId)[0]!;
      const lines = gameLogs(roomId);
      const leaves = lines.filter((l) => l.event === 'leave');
      expect(leaves.length).toBeGreaterThanOrEqual(1);
      // 기권패로 확정된 쪽은 가장 먼저 관찰된 `leave`의 사용자다.
      const first = [...leaves].sort((a, b) => a.ingressSeq! - b.ingressSeq!)[0]!;
      const loserId = userIds[result.winnerId === 0 ? 1 : 0];
      expect(first.userId).toBe(loserId);
      expect(lines.filter((l) => l.event === 'forfeit')).toHaveLength(1);
    });

    it('시작 전(대기실)에 나가면 기권패 없이 gameId가 null인 leave 로그만 남는다', async () => {
      const host = await player();
      const { roomId } = await emit(host.socket, 'room:create', publicRoom);
      await emit(host.socket, 'room:leave');
      const lines = gameLogs(roomId!);
      expect(lines.find((l) => l.event === 'leave')).toMatchObject({
        gameId: null,
        reason: 'leave_button',
      });
      expect(lines.some((l) => l.event === 'start_commit')).toBe(false);
      expect(lines.some((l) => l.event === 'forfeit')).toBe(false);
      expect(finishedOf(roomId!)).toHaveLength(0);
      expect(await record(host.name)).toMatchObject({ total_games: 0, wins: 0, losses: 0 });
    });

    it('입장 직후 방장이 나가도 시작 처리를 건너뛰지 않고 그 이탈이 기권패로 기록된다', async () => {
      const host = await player();
      const guest = await player();
      const { roomId } = await emit(host.socket, 'room:create', publicRoom);
      let release!: () => void;
      hook.gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      // 입장 UPDATE(시작 커밋)는 끝났지만 경기 생성은 `gate`에서 멈춘다.
      const joining = emit(guest.socket, 'room:join', { roomId });
      await waitUntil(() => hook.reached, '입장 UPDATE 이후 훅 도달');
      expect((await roomRows()).rows[0]?.status).toBe('playing');
      const leaving = emit(host.socket, 'room:leave');
      await sleep(150); // 이탈이 경기 생성을 기다리는 상태로 들어갈 시간
      release();
      expect(await joining).toMatchObject({ ok: true });
      expect(await leaving).toEqual({ ok: true });

      await waitFinished(roomId!, 1);
      expect(finishedOf(roomId!)[0]).toMatchObject({ roomExists: true, result: { winnerId: 1 } });
      expect(await record(host.name)).toMatchObject({ total_games: 1, wins: 0, losses: 1 });
      expect(await record(guest.name)).toMatchObject({ total_games: 1, wins: 1, losses: 0 });
      const lines = gameLogs(roomId!);
      const start = lines.find((l) => l.event === 'start_commit')!;
      const leave = lines.find((l) => l.event === 'leave')!;
      expect(leave.ingressSeq!).toBeGreaterThan(start.ingressSeq!);
      expect(lines.find((l) => l.event === 'forfeit')).toMatchObject({ reason: 'leave' });
      expect((await roomRows()).rows).toHaveLength(0);
    });

    it('로그에는 허용된 키만 있고 세션·쿠키·상대 보유 방해요소가 없다', async () => {
      const { host, guest, roomId, hostStart, guestStart } = await startMatch();
      await emit(guest.socket, 'room:leave');
      await waitFor(host, 'game:over');
      const mine = gameLogs(roomId);
      expect(mine.length).toBeGreaterThan(0);
      const allowed = new Set([
        'ts',
        'mono',
        'roomId',
        'gameId',
        'turnId',
        'userId',
        'ingressSeq',
        'serverTick',
        'event',
        'result',
        'reason',
      ]);
      for (const line of mine) {
        for (const key of Object.keys(line)) expect(allowed.has(key)).toBe(true);
      }
      const text = JSON.stringify(mine);
      for (const secret of [
        host.cookie.split('=')[1]!,
        guest.cookie.split('=')[1]!,
        'connect.sid',
        PASSWORD,
        hostStart.view.private.held!.hazardInstanceId,
        guestStart.view.private.held!.hazardInstanceId,
      ]) {
        expect(text).not.toContain(secret);
      }
    });
  });

  describe('전적', () => {
    it('경기가 끝나면 전체·승·패가 저장되고 프로필(/api/me)과 방 목록의 방장에 무승부까지 보인다', async () => {
      const { host, guest, gameId, roomId } = await startMatch();
      expect(await command(guest, 'game:forfeit', { gameId })).toEqual({ ok: true });
      await waitFinished(roomId, 1);

      const mine = await api().get('/api/me').set('Cookie', host.cookie).expect(200);
      expect(mine.body.user.record).toEqual({ totalGames: 1, wins: 1, losses: 0, draws: 0 });
      const loser = await api().get('/api/me').set('Cookie', guest.cookie).expect(200);
      expect(loser.body.user.record).toEqual({ totalGames: 1, wins: 0, losses: 1, draws: 0 });

      // 기권은 방을 나가는 것이 아니라 방이 남고(결과 화면), 목록의 방장 정보에 갱신된 전적이 실린다.
      const list = await api().get('/api/rooms').set('Cookie', guest.cookie).expect(200);
      expect(list.body.rooms[0].host).toMatchObject({
        nickname: host.name,
        record: { totalGames: 1, wins: 1, losses: 0, draws: 0 },
      });
      // 응답에 사용자 번호가 없다.
      expect(JSON.stringify(list.body)).not.toContain('"id"');
    });

    it('무승부는 두 사람의 total_games만 올리고 무승부 수는 total_games - wins - losses다', async () => {
      const a = await player();
      const b = await player();
      await recordResult(
        createDb(tempDb.pool),
        [(await record(a.name)).id, (await record(b.name)).id],
        null,
      );
      for (const p of [a, b]) {
        expect(await record(p.name)).toMatchObject({ total_games: 1, wins: 0, losses: 0 });
        const me = await api().get('/api/me').set('Cookie', p.cookie).expect(200);
        expect(me.body.user.record).toEqual({ totalGames: 1, wins: 0, losses: 0, draws: 1 });
      }
    });

    it('전적 저장이 실패하면 오류만 남기고 반영을 포기하며 방 정리는 계속된다', async () => {
      const { host, guest, roomId } = await startMatch();
      // 저장 트랜잭션이 실패하도록 방장의 경기 수가 한도에 닿게 만든다.
      await tempDb.pool.query('UPDATE users SET total_games = 999 WHERE nickname = $1', [
        host.name,
      ]);
      await tempDb.pool.query(
        'ALTER TABLE users ADD CONSTRAINT users_test_block CHECK (total_games < 1000)',
      );
      const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      try {
        expect(await emit(guest.socket, 'room:leave')).toEqual({ ok: true });
        expect(await waitFor<GameOver>(host, 'game:over')).toMatchObject({ reason: 'forfeit' });
        // 방 정리는 전적 저장이 실패해도 진행된다.
        await waitUntil(async () => (await roomRows()).rows[0]?.status === 'waiting', '방 정리');
        expect((await roomRows()).rows).toEqual([
          { id: roomId, guest_id: null, status: 'waiting' },
        ]);
        // 두 사람 모두 바뀌지 않았다(트랜잭션 전체 롤백). 재시도로 두 번 반영되지도 않는다.
        expect(await record(host.name)).toMatchObject({ total_games: 999, wins: 0, losses: 0 });
        expect(await record(guest.name)).toMatchObject({ total_games: 0, wins: 0, losses: 0 });
        expect(errors).toHaveBeenCalled();
      } finally {
        errors.mockRestore();
        await tempDb.pool.query('ALTER TABLE users DROP CONSTRAINT users_test_block');
      }
    });

    it('재도전으로 이어진 경기는 경기마다 한 번씩 반영된다', async () => {
      const { host, guest, gameId, roomId } = await startMatch();
      await command(guest, 'game:forfeit', { gameId });
      await waitFinished(roomId, 1);
      await command(host, 'rematch:request', { gameId });
      await command(guest, 'rematch:request', { gameId });
      const next = await waitFor<GameStart>(host, 'game:start', (e) => e.gameId !== gameId);
      await command(host, 'game:forfeit', { gameId: next.gameId });
      await waitFinished(roomId, 2);
      expect(await record(host.name)).toMatchObject({ total_games: 2, wins: 1, losses: 1 });
      expect(await record(guest.name)).toMatchObject({ total_games: 2, wins: 1, losses: 1 });
    });
  });

  describe('예외: 재도전 15초', () => {
    /** 경기를 기권으로 끝내 결과 화면(재도전 대기)으로 간다. */
    async function finishedMatch() {
      const match = await startMatch();
      expect(await command(match.guest, 'game:forfeit', { gameId: match.gameId })).toEqual({
        ok: true,
      });
      const over = await waitFor<GameOver>(match.host, 'game:over');
      await waitFor<GameOver>(match.guest, 'game:over');
      expect(over.rematchDeadlineMs).not.toBeNull();
      return { ...match, over };
    }

    it('경기 중이거나 끝난 경기가 아니면 REMATCH_NOT_AVAILABLE이다', async () => {
      const { host, gameId } = await startMatch();
      expect(await emit(host.socket, 'rematch:request', { gameId })).toMatchObject({
        ok: false,
        error: { code: 'REMATCH_NOT_AVAILABLE' },
      });
    });

    it('두 사람이 15초 안에 누르면 새 gameId의 경기가 시작된다', async () => {
      const { host, guest, gameId } = await finishedMatch();
      expect(await emit(host.socket, 'rematch:request', { gameId })).toEqual({ ok: true });
      const pending = await waitFor<RematchState>(guest, 'rematch:state');
      expect(pending).toMatchObject({
        myRequested: false,
        opponentRequested: true,
        outcome: 'pending',
      });
      expect(await emit(guest.socket, 'rematch:request', { gameId })).toEqual({ ok: true });
      for (const p of [host, guest]) {
        const accepted = await waitFor<RematchState>(
          p,
          'rematch:state',
          (s) => s.outcome === 'accepted',
        );
        expect(accepted).toMatchObject({ myRequested: true, opponentRequested: true });
        const next = await waitFor<GameStart>(p, 'game:start', (s) => s.gameId !== gameId);
        expect(next.gameId).not.toBe(gameId);
      }
      // 만료 시각이 지나도 성립한 재도전은 방을 건드리지 않는다.
      clock.advance(16_000);
      await sleep(100);
      expect((await roomRows()).rows[0]).toMatchObject({ status: 'playing' });
    });

    it('아무도 누르지 않으면 방이 닫히고 두 사람 모두 rematch_timeout을 받는다', async () => {
      const { host, guest, roomId } = await finishedMatch();
      clock.advance(15_100);
      for (const p of [host, guest]) {
        expect(await waitFor<RoomClosed>(p, 'room:closed')).toEqual({
          roomId,
          reason: 'rematch_timeout',
        });
        expect(
          (await waitFor<RematchState>(p, 'rematch:state', (s) => s.outcome === 'expired')).outcome,
        ).toBe('expired');
      }
      expect((await roomRows()).rows).toHaveLength(0);
      await waitFinished(roomId, 1);
      expect(await record(host.name)).toMatchObject({ total_games: 1 });
    });

    it('방장만 누르면 상대만 나가고 방장은 대기 상태가 된다', async () => {
      const { host, guest, gameId, roomId } = await finishedMatch();
      expect(await emit(host.socket, 'rematch:request', { gameId })).toEqual({ ok: true });
      clock.advance(15_100);
      expect(await waitFor<RoomClosed>(guest, 'room:closed')).toEqual({
        roomId,
        reason: 'rematch_timeout',
      });
      await waitUntil(
        () =>
          eventsOf<RoomState>(host, 'room:state').some(
            (s) => s.status === 'waiting' && s.guest === null,
          ),
        '방장이 대기 상태를 받는다',
      );
      expect(eventsOf(host, 'room:closed')).toHaveLength(0);
      expect((await roomRows()).rows).toEqual([{ id: roomId, guest_id: null, status: 'waiting' }]);
    });

    it('상대만 눌러도 방장이 누르지 않았으면 방이 닫힌다(상대에게 host_left)', async () => {
      const { host, guest, gameId, roomId } = await finishedMatch();
      expect(await emit(guest.socket, 'rematch:request', { gameId })).toEqual({ ok: true });
      clock.advance(15_100);
      expect(await waitFor<RoomClosed>(host, 'room:closed')).toEqual({
        roomId,
        reason: 'rematch_timeout',
      });
      expect(await waitFor<RoomClosed>(guest, 'room:closed')).toEqual({
        roomId,
        reason: 'host_left',
      });
      expect((await roomRows()).rows).toHaveLength(0);
    });

    it('15초가 지난 뒤의 재도전 요청은 거부된다', async () => {
      const { host, gameId, guest } = await finishedMatch();
      expect(await emit(host.socket, 'rematch:request', { gameId })).toEqual({ ok: true });
      clock.advance(15_100);
      await waitFor(guest, 'room:closed');
      expect(await emit(host.socket, 'rematch:request', { gameId })).toMatchObject({
        ok: false,
        error: { code: 'REMATCH_NOT_AVAILABLE' },
      });
    });
  });
});
