import { MessageChannel } from 'node:worker_threads';
import { afterEach, describe, expect, it } from 'vitest';
import type { AimState, GameOver, GameStart, GameView, RematchState } from '@alkkagi/shared';
import type { RuntimeClock } from '@alkkagi/game-runtime';
import { GameStore } from '../game/game-store.ts';
import { LocalAuthority, type PortLike } from './local-authority.ts';
import {
  LocalGameSession,
  LocalSessionRejectedError,
  type SessionPort,
} from './local-game-session.ts';

/** 수동 시계: `advance`로만 흐르고 타이머를 시각 순서대로 실행한다. */
class FakeClock implements RuntimeClock {
  nowMs = 1_000_000;
  private timers: { at: number; cb: () => void; id: number }[] = [];
  private nextId = 1;
  now(): number {
    return this.nowMs;
  }
  setTimer(cb: () => void, delayMs: number): () => void {
    const id = this.nextId++;
    this.timers.push({ at: this.nowMs + delayMs, cb, id });
    return () => {
      this.timers = this.timers.filter((t) => t.id !== id);
    };
  }
  async advance(ms: number): Promise<void> {
    await flush(); // 전송 중인 메시지가 먼저 도착하게 한다
    const end = this.nowMs + ms;
    for (;;) {
      this.timers.sort((a, b) => a.at - b.at);
      const next = this.timers[0];
      if (!next || next.at > end) break;
      this.timers.shift();
      this.nowMs = Math.max(this.nowMs, next.at);
      next.cb();
      await flush();
    }
    this.nowMs = end;
    await flush();
  }
}

/** MessageChannel 메시지가 도착하도록 이벤트 루프를 몇 번 돌린다. */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
}

const channels: MessageChannel[] = [];
const sessions: LocalGameSession[] = [];

function setup(options: ConstructorParameters<typeof LocalAuthority>[0]) {
  const authority = new LocalAuthority(options);
  const connect = (seat: 0 | 1) => {
    const ch = new MessageChannel();
    channels.push(ch);
    authority.attach(ch.port1 as unknown as PortLike);
    const session = new LocalGameSession(ch.port2 as unknown as SessionPort, {
      seat,
      heartbeatMs: 0,
    });
    sessions.push(session);
    const log: { type: string; payload: unknown }[] = [];
    for (const type of [
      'game:start',
      'game:state',
      'hazard:granted',
      'hazard:triggered',
      'turn:change',
      'game:over',
      'rematch:state',
      'aim:state',
    ] as const) {
      session.on(type, (payload) => log.push({ type, payload }));
    }
    return { session, log };
  };
  return { authority, connect };
}

afterEach(() => {
  for (const s of sessions) s.dispose();
  for (const c of channels) {
    c.port1.close();
    c.port2.close();
  }
  sessions.length = 0;
  channels.length = 0;
});

const of = <T>(log: { type: string; payload: unknown }[], type: string) =>
  log.filter((e) => e.type === type).map((e) => e.payload as T);

describe('LocalAuthority + LocalGameSession', () => {
  it('두 좌석이 연결되면 경기가 시작되고 각자 자기 좌석의 game:start를 받는다', async () => {
    const clock = new FakeClock();
    const { connect } = setup({ clock, random: () => 0.5, heartbeatTimeoutMs: 0 });
    const a = connect(0);
    await a.session.connect();
    await flush();
    expect(of(a.log, 'game:start')).toHaveLength(0); // 한 창만으로는 시작하지 않는다
    const b = connect(1);
    await b.session.connect();
    await flush();
    const sa = of<GameStart>(a.log, 'game:start');
    const sb = of<GameStart>(b.log, 'game:start');
    expect(sa).toHaveLength(1);
    expect(sb).toHaveLength(1);
    expect(sa[0]?.seat).toBe(0);
    expect(sb[0]?.seat).toBe(1);
    expect(sa[0]?.gameId).toBe(sb[0]?.gameId);
    expect(sa[0]?.pieceCount).toBe(7);
  });

  it('같은 좌석의 두 번째 연결은 거부된다', async () => {
    const clock = new FakeClock();
    const { connect } = setup({ clock, heartbeatTimeoutMs: 0 });
    const first = connect(0);
    await first.session.connect();
    const second = connect(0);
    await expect(second.session.connect()).rejects.toBeInstanceOf(LocalSessionRejectedError);
    await expect(second.session.connect()).rejects.toMatchObject({ reason: 'SEAT_TAKEN' });
  });

  it('발사하면 양쪽이 game:state를 받고, 거부된 명령은 결과 코드로 돌아온다', async () => {
    const clock = new FakeClock();
    const { connect } = setup({ clock, random: () => 0.25, heartbeatTimeoutMs: 0 });
    const a = connect(0);
    const b = connect(1);
    await Promise.all([a.session.connect(), b.session.connect()]);
    await flush();
    const start = of<GameStart>(a.log, 'game:start')[0]!;
    const first = start.view.activePlayerId;
    const shooter = first === 0 ? a : b;
    const waiter = first === 0 ? b : a;
    const stone = start.view.stones.find((s) => s.ownerId === first)!;

    // 상대 턴에 발사 → 거부
    const wrongPending = waiter.session.submitShot({
      gameId: start.gameId,
      turnId: start.view.turnId,
      stoneId: stone.id,
      angle: 1,
      power: 50,
    });
    await clock.advance(10);
    const wrong = await wrongPending;
    expect(wrong).toMatchObject({ ok: false, error: { code: 'NOT_YOUR_TURN' } });

    const ok = shooter.session.submitShot({
      gameId: start.gameId,
      turnId: start.view.turnId,
      stoneId: stone.id,
      angle: 1,
      power: 50,
    });
    await clock.advance(10);
    expect(await ok).toEqual({ ok: true });
    await clock.advance(3000);
    const statesA = of<GameView>(a.log, 'game:state');
    const statesB = of<GameView>(b.log, 'game:state');
    expect(statesA.length).toBeGreaterThan(1);
    expect(statesB.length).toBeGreaterThan(1);
    expect(of(a.log, 'turn:change').length).toBeGreaterThan(0);
  });

  it('창을 닫으면(bye) 그 좌석이 기권패이고 같은 좌석으로 다시 들어올 수 없다', async () => {
    const clock = new FakeClock();
    const { connect } = setup({ clock, heartbeatTimeoutMs: 0 });
    const a = connect(0);
    const b = connect(1);
    await Promise.all([a.session.connect(), b.session.connect()]);
    await flush();
    a.session.dispose();
    await clock.advance(50);
    const over = of<GameOver>(b.log, 'game:over');
    expect(over).toHaveLength(1);
    expect(over[0]).toMatchObject({ winnerId: 1, reason: 'forfeit' });

    const again = connect(0);
    await expect(again.session.connect()).rejects.toMatchObject({ reason: 'SEAT_DEPARTED' });
  });

  it('하트비트가 끊긴 창은 닫힌 것으로 보고 기권패 처리한다', async () => {
    const clock = new FakeClock();
    const { connect } = setup({ clock, heartbeatTimeoutMs: 6000 });
    const a = connect(0);
    const b = connect(1);
    await Promise.all([a.session.connect(), b.session.connect()]);
    await flush();
    // b는 ping을 보내고 a는 보내지 않는다
    for (let i = 0; i < 4; i++) {
      await clock.advance(2000);
      (b.session as unknown as { port: SessionPort }).port.postMessage({ t: 'ping' });
      await flush();
    }
    await clock.advance(50);
    const over = of<GameOver>(b.log, 'game:over');
    expect(over).toHaveLength(1);
    expect(over[0]).toMatchObject({ winnerId: 1, reason: 'forfeit' });
  });

  it('기권 명령으로 끝난 뒤 양쪽이 재도전하면 새 gameId로 다시 시작한다', async () => {
    const clock = new FakeClock();
    const { connect } = setup({ clock, random: () => 0.3, heartbeatTimeoutMs: 0 });
    const a = connect(0);
    const b = connect(1);
    await Promise.all([a.session.connect(), b.session.connect()]);
    await flush();
    const start = of<GameStart>(a.log, 'game:start')[0]!;
    const ff = a.session.forfeit({ gameId: start.gameId });
    await clock.advance(20);
    expect(await ff).toEqual({ ok: true });
    const over = of<GameOver>(a.log, 'game:over')[0]!;
    expect(over.winnerId).toBe(1);
    expect(over.rematchDeadlineMs).not.toBeNull();

    expect(await a.session.requestRematch('wrong-id')).toMatchObject({
      ok: false,
      error: { code: 'REMATCH_NOT_AVAILABLE' },
    });
    expect(await a.session.requestRematch(over.gameId)).toEqual({ ok: true });
    await flush();
    const mid = of<RematchState>(b.log, 'rematch:state').at(-1)!;
    expect(mid).toMatchObject({ myRequested: false, opponentRequested: true, outcome: 'pending' });
    expect(await b.session.requestRematch(over.gameId)).toEqual({ ok: true });
    await clock.advance(20);
    expect(of<RematchState>(a.log, 'rematch:state').at(-1)?.outcome).toBe('accepted');
    const starts = of<GameStart>(a.log, 'game:start');
    expect(starts).toHaveLength(2);
    expect(starts[1]?.gameId).not.toBe(start.gameId);
    expect(of<GameStart>(b.log, 'game:start')[1]?.seat).toBe(1);
  });

  it('재도전은 15초가 지나면 만료되고 그 뒤 요청은 거부된다', async () => {
    const clock = new FakeClock();
    const { connect } = setup({ clock, random: () => 0.3, heartbeatTimeoutMs: 0 });
    const a = connect(0);
    const b = connect(1);
    await Promise.all([a.session.connect(), b.session.connect()]);
    await flush();
    const start = of<GameStart>(a.log, 'game:start')[0]!;
    void a.session.forfeit({ gameId: start.gameId });
    await clock.advance(20);
    const over = of<GameOver>(a.log, 'game:over')[0]!;
    await a.session.requestRematch(over.gameId);
    await clock.advance(16_000);
    expect(of<RematchState>(b.log, 'rematch:state').at(-1)?.outcome).toBe('expired');
    expect(await b.session.requestRematch(over.gameId)).toMatchObject({
      ok: false,
      error: { code: 'REMATCH_NOT_AVAILABLE' },
    });
  });

  it('두 창이 모두 닫히면 처음 상태로 돌아가 다음 접속이 새 경기를 연다', async () => {
    const clock = new FakeClock();
    const { connect } = setup({ clock, heartbeatTimeoutMs: 0 });
    const a = connect(0);
    const b = connect(1);
    await Promise.all([a.session.connect(), b.session.connect()]);
    await flush();
    a.session.dispose();
    b.session.dispose();
    await clock.advance(50);
    const a2 = connect(0);
    const b2 = connect(1);
    await Promise.all([a2.session.connect(), b2.session.connect()]);
    await flush();
    expect(of<GameStart>(a2.log, 'game:start')).toHaveLength(1);
  });

  describe('시안 연출: 판 돌리기·조준 중계 (DEC-036)', () => {
    async function started(random: number) {
      const clock = new FakeClock();
      const { connect } = setup({ clock, random: () => random, heartbeatTimeoutMs: 0 });
      const a = connect(0);
      const b = connect(1);
      await Promise.all([a.session.connect(), b.session.connect()]);
      await flush();
      const start = of<GameStart>(a.log, 'game:start')[0]!;
      const first = start.view.activePlayerId;
      return {
        clock,
        a,
        b,
        start,
        active: first === 0 ? a : b,
        waiting: first === 0 ? b : a,
      };
    }

    it('aim:update는 상대 창에만 seat를 붙여 aim:state로 중계되고 상대 store에 들어간다', async () => {
      const { a, b, start } = await started(0.5);
      const storeB = new GameStore(b.session);
      storeB.subscribe(() => undefined);
      // store는 game:start 뒤에 만들어 start가 없다. 이때는 gameId 대조 없이 받는다
      a.session.sendAim({ gameId: start.gameId, mode: 'charge', stoneId: 0, angle: 1, power: 40 });
      a.session.sendAim({ gameId: 'wrong', mode: 'idle' });
      await flush();
      expect(of<AimState>(a.log, 'aim:state')).toHaveLength(0);
      const got = of<AimState>(b.log, 'aim:state');
      expect(got).toEqual([
        { gameId: start.gameId, mode: 'charge', stoneId: 0, angle: 1, power: 40, seat: 0 },
      ]);
      expect(storeB.getState().opponentAim).toEqual(got[0]);
      storeB.dispose();
    });

    it('내 턴의 판 돌리기는 양쪽 boardRotationDeg를 바꾸고 상대 턴의 돌리기는 거부된다', async () => {
      const { clock, a, b, start, active, waiting } = await started(0.25);
      const cmd = { gameId: start.gameId, turnId: start.view.turnId, deltaDeg: 10 };
      const wrong = waiting.session.rotateBoard(cmd);
      await clock.advance(20);
      expect(await wrong).toMatchObject({ ok: false, error: { code: 'NOT_YOUR_TURN' } });
      const ok = active.session.rotateBoard(cmd);
      await clock.advance(20);
      expect(await ok).toEqual({ ok: true });
      expect(of<GameView>(a.log, 'game:state').at(-1)?.boardRotationDeg).toBe(10);
      expect(of<GameView>(b.log, 'game:state').at(-1)?.boardRotationDeg).toBe(10);
    });

    it('hazard:aim은 응답 없이 보내도 연결을 깨지 않는다', async () => {
      const { clock, active, start } = await started(0.25);
      active.session.aimHazard({
        gameId: start.gameId,
        hazardInstanceId: 'none',
        target: { x: 0, y: 30, h: 24 },
      });
      const cmd = { gameId: start.gameId, turnId: start.view.turnId, deltaDeg: -5 };
      const ok = active.session.rotateBoard(cmd);
      await clock.advance(20);
      expect(await ok).toEqual({ ok: true });
    });
  });
});
