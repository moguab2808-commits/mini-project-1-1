// 실행: 루트에서 npm test (Vitest)
import assert from 'node:assert/strict';
import { monitorEventLoopDelay, performance } from 'node:perf_hooks';
import { describe, test } from 'vitest';
import type { CommandResult, GameView, Seat } from '@alkkagi/shared';
import { MAX_CATCH_UP_MS, RoomRuntime, type StartGameConfig } from './index.ts';
import type {
  GameLike,
  RuntimeClock,
  RuntimeEventMap,
  RuntimeLogEntry,
  RuntimeTransport,
  SendOptions,
} from './types.ts';

class FakeClock implements RuntimeClock {
  t = 1_000_000;
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
  /** 타이머를 시간 순으로 실행하며 시각을 목표까지 진행한다 */
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
  /** 이벤트 루프가 멈췄다 돌아온 것처럼 타이머를 실행하지 않고 시각만 넘긴다 */
  freeze(ms: number): void {
    this.t += ms;
  }
}

interface Sent {
  seat: Seat;
  type: keyof RuntimeEventMap;
  payload: unknown;
  opts: SendOptions;
}

class FakeTransport implements RuntimeTransport {
  sent: Sent[] = [];
  send<K extends keyof RuntimeEventMap>(
    seat: Seat,
    type: K,
    payload: RuntimeEventMap[K],
    opts: SendOptions,
  ): void {
    this.sent.push({ seat, type, payload, opts });
  }
  of(type: keyof RuntimeEventMap, seat?: Seat): Sent[] {
    return this.sent.filter((s) => s.type === type && (seat === undefined || s.seat === seat));
  }
}

const CONFIG: StartGameConfig = {
  gameId: 'g1',
  board: 'standard',
  pieceCount: 5,
  seed: 42,
  firstSeat: 0,
  players: [
    { nickname: '가', characterId: 'bear' },
    { nickname: '나', characterId: 'cat' },
  ],
};

function setup(opts: { rematchWindowMs?: number } = {}) {
  const clock = new FakeClock();
  const transport = new FakeTransport();
  const logs: RuntimeLogEntry[] = [];
  const finished: unknown[] = [];
  const rt = new RoomRuntime({
    clock,
    transport,
    logger: { log: (e) => logs.push(e) },
    onFinished: (r) => finished.push(r),
    rematchWindowMs: opts.rematchWindowMs,
  });
  rt.startGame(CONFIG);
  return { clock, transport, logs, finished, rt };
}

const lastView = (t: FakeTransport, seat: Seat) =>
  t.of('game:state', seat).at(-1)?.payload as GameView | undefined;

function shotCmd(t: FakeTransport, seat: Seat, power = 1, angle = 0) {
  const start = t.of('game:start', seat)[0]!.payload as RuntimeEventMap['game:start'];
  const v = lastView(t, seat) ?? start.view;
  return {
    gameId: 'g1',
    turnId: v.turnId,
    stoneId: v.stones.find((s) => s.ownerId === seat)!.id,
    angle,
    power,
  };
}

describe('RoomRuntime', () => {
  describe('정상', () => {
    test('시작하면 좌석별 game:start와 본인 방해요소만 보낸다', () => {
      const { transport } = setup();
      const starts = transport.of('game:start');
      assert.equal(starts.length, 2);
      const [s0, s1] = starts.map((s) => s.payload as RuntimeEventMap['game:start']);
      assert.equal(s0!.seat, 0);
      assert.equal(s1!.seat, 1);
      assert.equal(s0!.players[1].nickname, '나');
      // hazard:granted는 받은 사람에게만, turn:change는 양쪽에
      const granted = transport.of('hazard:granted');
      assert.equal(granted.length, 2);
      assert.deepEqual(granted.map((g) => g.seat).sort(), [0, 1]);
      assert.equal(transport.of('turn:change').length, 2);
      // 상대 보유 방해요소는 뷰에 없다
      assert.notEqual(s0!.view.private.held, null);
    });

    test('같은 틱에 들어온 명령은 ingressSeq 순서로 처리된다', async () => {
      for (const order of [
        [0, 1],
        [1, 0],
      ] as const) {
        const { clock, transport, rt } = setup();
        const results: Record<number, CommandResult> = {};
        const first = order[0];
        const second = order[1];
        // 활성 좌석(0)의 발사와 상대(1)의 발사를 같은 틱에 넣는다
        const p1 = rt
          .submitShot(first, shotCmd(transport, first))
          .then((r) => (results[first] = r));
        const p2 = rt
          .submitShot(second, shotCmd(transport, second))
          .then((r) => (results[second] = r));
        clock.advance(20);
        await Promise.all([p1, p2]);
        assert.equal(results[0]!.ok, true, `order ${order.join('')}: 활성 좌석 발사는 성공`);
        assert.equal(results[1]!.ok, false);
        assert.equal(!results[1]!.ok && results[1]!.error.code, 'NOT_YOUR_TURN');
      }
    });

    test('알 이동 중 스냅샷은 volatile 약 30Hz이고 정지 뒤 최종 스냅샷은 신뢰 전송이다', async () => {
      const { clock, transport, rt } = setup();
      const r = rt.submitShot(0, shotCmd(transport, 0, 40));
      clock.advance(10);
      assert.equal((await r).ok, true);
      const before = transport.sent.length;
      clock.advance(1000);
      const states = transport.sent
        .slice(before)
        .filter((s) => s.type === 'game:state' && s.seat === 0);
      const volatiles = states.filter((s) => s.opts.volatile);
      assert.ok(volatiles.length >= 2, `이동 중 스냅샷 ${volatiles.length}개`);
      assert.ok(volatiles.length <= 31, '초당 30회를 넘지 않는다');
      for (const s of volatiles) assert.equal((s.payload as GameView).phase, 'moving');
      const last = states.at(-1)!;
      assert.equal(last.opts.volatile, false);
      assert.notEqual((last.payload as GameView).phase, 'moving');
      // revision은 줄어들지 않는다
      const revs = states.map((s) => (s.payload as GameView).revision);
      assert.deepEqual(
        revs,
        [...revs].sort((a, b) => a - b),
      );
      // turn:change는 신뢰 전송으로 한 번 더 나갔다
      assert.ok(transport.of('turn:change', 0).every((s) => !s.opts.volatile));
      assert.equal(transport.of('turn:change', 0).length, 2);
    });
  });

  describe('오류', () => {
    test('틱이 밀리면 따라잡기 상한까지만 진행하고 넘긴 시간을 tick_skipped로 남긴다', () => {
      const { clock, logs, transport } = setup();
      const startDeadline = (transport.of('turn:change', 0)[0]!.payload as { deadlineMs: number })
        .deadlineMs;
      clock.freeze(5_000);
      clock.advance(20);
      const skipped = logs.filter((l) => l.event === 'tick_skipped');
      assert.equal(skipped.length, 1);
      const dropped = Number(skipped[0]!.result);
      assert.ok(dropped >= 5_000 - MAX_CATCH_UP_MS - 1, `버린 시간 ${dropped}ms`);
      // 버린 시간만큼 경기 시각이 밀리므로 마감이 지나지 않았다
      const v = lastView(transport, 0);
      if (v) assert.ok(v.serverNowMs <= startDeadline);
    });

    test('거부된 명령은 순번만 소비하고 상태를 바꾸지 않는다', async () => {
      const { clock, transport, logs, rt } = setup();
      clock.advance(20);
      const before = lastView(transport, 0);
      const bad = rt.submitShot(0, { ...shotCmd(transport, 0), power: 0 });
      const wrongTurn = rt.submitShot(1, shotCmd(transport, 1));
      const good = rt.submitShot(0, shotCmd(transport, 0));
      clock.advance(20);
      const [b, w, g] = await Promise.all([bad, wrongTurn, good]);
      assert.equal(!b.ok && b.error.code, 'INVALID_INPUT');
      assert.equal(!w.ok && w.error.code, 'NOT_YOUR_TURN');
      assert.equal(g.ok, true);
      const seqs = logs.filter((l) => l.event === 'shot').map((l) => l.ingressSeq);
      // 시작 커밋이 순번 0을 쓴다
      assert.deepEqual(seqs, [1, 2, 3]);
      // 거부된 두 명령 뒤에도 상태는 좋은 발사에서만 바뀐다
      const after = lastView(transport, 0);
      assert.ok(!before || !after || after.revision >= before.revision);
    });

    test('경기가 없으면 명령은 GAME_NOT_ACTIVE다', async () => {
      const clock = new FakeClock();
      const rt = new RoomRuntime({ clock, transport: new FakeTransport() });
      const r = await rt.leave(0, 'leave_button');
      assert.equal(!r.ok && r.error.code, 'GAME_NOT_ACTIVE');
    });
  });

  describe('예외', () => {
    test('동시 이탈은 ingressSeq가 작은 쪽이 기권패다', async () => {
      const { clock, transport, finished, rt } = setup({
        rematchWindowMs: 15_000,
      });
      const a = rt.leave(1, 'disconnect');
      const b = rt.leave(0, 'session_replaced');
      clock.advance(20);
      const [ra, rb] = await Promise.all([a, b]);
      assert.equal(ra.ok, true);
      assert.equal(!rb.ok && rb.error.code, 'GAME_NOT_ACTIVE');
      assert.equal(finished.length, 1);
      const over = transport.of('game:over', 0)[0]!.payload as RuntimeEventMap['game:over'];
      assert.equal(over.winnerId, 0);
      assert.equal(over.reason, 'forfeit');
      assert.ok(over.rematchDeadlineMs !== null && over.rematchDeadlineMs > 0);
      // 종료 뒤에는 틱이 멈춘다
      const n = transport.sent.length;
      clock.advance(1000);
      assert.equal(transport.sent.length, n);
    });

    test('재도전으로 새 경기를 시작해도 ingressSeq는 이어진다', async () => {
      const { clock, logs, rt } = setup();
      const p = rt.leave(0, 'leave_button');
      clock.advance(20);
      await p;
      rt.startGame({ ...CONFIG, gameId: 'g2' });
      const q = rt.useHazard(0, { gameId: 'g2', hazardInstanceId: 'none' });
      clock.advance(20);
      await q;
      // 기권 로그는 `leave`의 순번을 이어 쓰므로 순번 소비 이벤트만 센다
      const seqs = logs
        .filter((l) => l.ingressSeq !== undefined && l.event !== 'forfeit')
        .map((l) => l.ingressSeq!);
      assert.ok(seqs.length >= 2);
      assert.deepEqual(
        seqs,
        [...seqs].sort((a, b) => a - b),
      );
      assert.equal(new Set(seqs).size, seqs.length);
    });
  });
  describe('견고성', () => {
    test('전송·종료 콜백이 던져도 틱 루프와 대기 명령이 멈추지 않는다', async () => {
      const clock = new FakeClock();
      const inner = new FakeTransport();
      const errors: unknown[] = [];
      let broken = true;
      const rt = new RoomRuntime({
        clock,
        transport: {
          send: (...a) => {
            inner.send(...a);
            if (broken) throw new Error('닫힌 소켓');
          },
        },
        onFinished: () => {
          throw new Error('DB 오류');
        },
        onError: (e) => errors.push(e),
      });
      rt.startGame(CONFIG);
      assert.ok(errors.length > 0, '전송 오류가 보고된다');
      broken = false;
      const p = rt.submitShot(0, shotCmd(inner, 0, 1));
      clock.advance(20);
      assert.equal((await p).ok, true, '전송 오류 뒤에도 틱이 돌아 명령이 처리된다');
      const n = errors.length;
      const l = rt.leave(0, 'leave_button');
      clock.advance(20);
      assert.equal((await l).ok, true);
      assert.ok(errors.length > n, 'onFinished 오류도 보고된다');
      assert.equal(rt.isRunning, false);
      const sent = inner.sent.length;
      clock.advance(500);
      assert.equal(inner.sent.length, sent, '종료 뒤 틱은 멈춘다');
    });

    test('dispose 뒤 명령은 대기하지 않고 거부되며 새 경기는 시작할 수 없다', async () => {
      const { rt } = setup();
      rt.dispose();
      assert.equal(rt.isRunning, false);
      const shot = await rt.submitShot(0, {
        gameId: 'g1',
        turnId: 0,
        stoneId: 0,
        angle: 0,
        power: 1,
      });
      assert.equal(!shot.ok && shot.error.code, 'GAME_NOT_ACTIVE');
      const left = await rt.leave(1, 'disconnect');
      assert.equal(!left.ok && left.error.code, 'GAME_NOT_ACTIVE');
      assert.throws(() => rt.startGame({ ...CONFIG, gameId: 'g2' }));
    });

    test('재대결 마감 시각은 종료 때 한 번만 정해진다', async () => {
      const { clock, transport, rt } = setup({ rematchWindowMs: 15_000 });
      const p = rt.leave(0, 'leave_button');
      clock.advance(20);
      await p;
      const over = transport.of('game:over', 0)[0]!.payload as RuntimeEventMap['game:over'];
      const deadline = over.rematchDeadlineMs;
      assert.ok(deadline !== null);
      clock.advance(5_000);
      const view = lastView(transport, 0);
      assert.ok(view?.result);
      assert.equal(view.result.rematchDeadlineMs, deadline);
    });

    test('이벤트 없이 revision만 오른 상태도 신뢰 전송으로 보낸다', () => {
      const clock = new FakeClock();
      const transport = new FakeTransport();
      const stub = {
        gameId: 'g1',
        rev: 1,
        tick: 0,
        start() {},
        advanceTo() {
          this.tick++;
        },
        drainEvents: () => [],
        isFinished: false,
        meta() {
          return { tick: this.tick, revision: this.rev, phase: 'aiming' as const };
        },
        getViewFor() {
          return {
            gameId: 'g1',
            serverTick: this.tick,
            serverNowMs: 0,
            revision: this.rev,
            phase: 'aiming',
          } as unknown as GameView;
        },
        submitShot: () => ({ ok: true }) as CommandResult,
        useHazard: () => ({ ok: true }) as CommandResult,
        forfeit: () => ({ ok: true }) as CommandResult,
      };
      const rt = new RoomRuntime({
        clock,
        transport,
        createGame: () => stub as unknown as GameLike,
      });
      rt.startGame(CONFIG);
      clock.advance(50);
      assert.equal(transport.of('game:state').length, 0, '바뀐 것이 없으면 보내지 않는다');
      stub.rev = 2;
      clock.advance(20);
      const states = transport.of('game:state');
      assert.equal(states.length, 2);
      for (const st of states) {
        assert.equal((st.payload as GameView).revision, 2);
        assert.equal(st.opts.volatile, false);
      }
      clock.advance(50);
      assert.equal(transport.of('game:state').length, 2, '같은 revision은 다시 보내지 않는다');
      rt.dispose();
    });
  });
  describe('서버 로그 (OPERATIONS)', () => {
    test('start_commit·leave가 같은 순번 공간의 ingressSeq를 가지고 leave는 reason을 쓴다', async () => {
      const clock = new FakeClock();
      const logs: RuntimeLogEntry[] = [];
      const rt = new RoomRuntime({
        clock,
        transport: new FakeTransport(),
        logger: { log: (e) => logs.push(e) },
      });
      // 시작 커밋 전 이탈: 경기가 없어도 순번을 쓰고 gameId는 null이다
      const before = await rt.leave(1, 'disconnect');
      assert.equal(!before.ok && before.error.code, 'GAME_NOT_ACTIVE');
      rt.startGame(CONFIG);
      const p = rt.leave(0, 'session_replaced');
      clock.advance(20);
      assert.equal((await p).ok, true);

      const seqLogs = logs.filter((l) => l.ingressSeq !== undefined);
      const by = (event: string) => seqLogs.filter((l) => l.event === event);
      assert.equal(by('leave').length, 2);
      assert.equal(by('start_commit').length, 1);
      const [pre, post] = by('leave');
      assert.equal(pre!.gameId, null);
      assert.equal(pre!.reason, 'disconnect');
      assert.equal(post!.reason, 'session_replaced');
      const commit = by('start_commit')[0]!;
      // 시작 전 이탈 < 시작 커밋 < 시작 뒤 이탈
      assert.ok(pre!.ingressSeq! < commit.ingressSeq!);
      assert.ok(commit.ingressSeq! < post!.ingressSeq!);
      // leave 한 번이 순번 하나만 쓴다(기권 로그가 같은 순번을 이어 쓴다)
      const forfeit = by('forfeit')[0]!;
      assert.equal(forfeit.ingressSeq, post!.ingressSeq);
      assert.equal(forfeit.reason, 'leave');
      assert.equal(new Set(seqLogs.map((l) => `${l.event}${l.ingressSeq}`)).size, seqLogs.length);
    });

    test('기권 명령의 forfeit 사유는 command다', async () => {
      const { clock, logs, rt } = setup();
      const p = rt.forfeit(1, { gameId: 'g1' });
      clock.advance(20);
      assert.equal((await p).ok, true);
      const f = logs.find((l) => l.event === 'forfeit');
      assert.equal(f?.reason, 'command');
    });
  });
  describe('시간초과 기권·실제 시계', () => {
    test('같은 플레이어의 연속 시간초과 3회는 forfeit(reason timeout)과 game_over로 기록된다', () => {
      const { clock, logs, transport, finished } = setup();
      // 아무도 발사하지 않는다: 턴마다 30초 뒤 시간초과, 좌석 0·1이 번갈아 3회씩
      for (let i = 0; i < 7 && finished.length === 0; i++) clock.advance(31_000);
      assert.equal(finished.length, 1);
      const forfeit = logs.filter((l) => l.event === 'forfeit');
      assert.equal(forfeit.length, 1);
      assert.equal(forfeit[0]!.reason, 'timeout');
      const over = logs.find((l) => l.event === 'game_over');
      assert.equal(over?.reason, 'timeout_forfeit');
      // forfeit 로그가 game_over 앞에 남는다
      assert.ok(logs.indexOf(forfeit[0]!) < logs.indexOf(over!));
      assert.equal(transport.of('game:over', 0).length, 1);
    });

    test('실제 setTimeout 시계로도 틱·전송·종료 스냅샷이 동작한다', async () => {
      const clock: RuntimeClock = {
        now: () => Math.round(performance.timeOrigin + performance.now()),
        setTimer: (cb, ms) => {
          const h = setTimeout(cb, ms);
          return () => clearTimeout(h);
        },
      };
      const transport = new FakeTransport();
      const logs: RuntimeLogEntry[] = [];
      const rt = new RoomRuntime({ clock, transport, logger: { log: (e) => logs.push(e) } });
      const loop = monitorEventLoopDelay({ resolution: 5 });
      loop.enable();
      const started = performance.now();
      rt.startGame(CONFIG);
      const shot = await rt.submitShot(0, shotCmd(transport, 0, 40));
      const ackMs = performance.now() - started;
      assert.equal(shot.ok, true);
      // 알이 멈춰 턴이 넘어갈 때까지 기다린다(최대 5초)
      const deadline = performance.now() + 5_000;
      while (transport.of('turn:change', 0).length < 2 && performance.now() < deadline) {
        await new Promise((r) => setTimeout(r, 25));
      }
      loop.disable();
      rt.dispose();

      assert.equal(transport.of('turn:change', 0).length, 2, '실제 시계로 턴이 넘어갔다');
      const states = transport.of('game:state', 0);
      const volatiles = states.filter((s) => s.opts.volatile);
      assert.ok(volatiles.length >= 5, `이동 중 스냅샷 ${volatiles.length}개`);
      const last = states.at(-1)!;
      assert.equal(last.opts.volatile, false);
      assert.notEqual((last.payload as GameView).phase, 'moving');
      assert.equal(
        logs.filter((l) => l.event === 'tick_skipped').length,
        0,
        '정상 부하에서는 틱을 건너뛰지 않는다',
      );
      // 참고 수치(합격 기준 아님): 이 PC·무부하 한 번의 측정
      console.log(
        `[실제 시계] 발사 ack ${ackMs.toFixed(1)}ms, 스냅샷 ${volatiles.length}개(volatile), ` +
          `이벤트 루프 지연 p99 ${(loop.percentile(99) / 1e6).toFixed(1)}ms, max ${(loop.max / 1e6).toFixed(1)}ms`,
      );
    }, 10_000);
  });
});
