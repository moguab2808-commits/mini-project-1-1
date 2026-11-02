// 방해요소 입력 → 권한 측(game-runtime+game-core) → 양쪽 이벤트 흐름 통합 검증.
// LocalAuthority와 LocalGameSession을 MessageChannel로 연결하고 FakeClock으로 시간을 돌린다.
import { MessageChannel } from 'node:worker_threads';
import { afterEach, describe, expect, it } from 'vitest';
import type { CommandResult, HazardGranted, HazardTriggered } from '@alkkagi/shared';
import type { RuntimeClock } from '@alkkagi/game-runtime';
import { LocalAuthority, type PortLike } from '../local/local-authority.ts';
import { LocalGameSession, type SessionPort } from '../local/local-game-session.ts';
import { AimController } from './aim/aim-controller.ts';
import { GameStore } from './game-store.ts';

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
    await flush();
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

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
}

/** 좌석 0이 후레쉬, 좌석 1이 벽을 받는 시드(game-core `Game`으로 찾은 값) */
const SEED = 235;

const channels: MessageChannel[] = [];
const sessions: LocalGameSession[] = [];

afterEach(() => {
  for (const s of sessions) s.dispose();
  for (const c of channels) {
    c.port1.close();
    c.port2.close();
  }
  sessions.length = 0;
  channels.length = 0;
});

async function startGame() {
  const clock = new FakeClock();
  const authority = new LocalAuthority({
    clock,
    random: () => SEED / 0x1_0000_0000,
    heartbeatTimeoutMs: 0,
  });
  const seats = ([0, 1] as const).map((seat) => {
    const ch = new MessageChannel();
    channels.push(ch);
    authority.attach(ch.port1 as unknown as PortLike);
    const session = new LocalGameSession(ch.port2 as unknown as SessionPort, {
      seat,
      heartbeatMs: 0,
    });
    sessions.push(session);
    const received: { type: string; payload: unknown }[] = [];
    for (const type of [
      'game:start',
      'game:state',
      'hazard:granted',
      'hazard:triggered',
    ] as const) {
      session.on(type, (payload) => received.push({ type, payload }));
    }
    const store = new GameStore(session, () => clock.now());
    // 방해요소 명령 횟수(입력 로직이 사용 불가 상태에서 보내지 않는지 확인)
    const sent: unknown[] = [];
    const controller = new AimController({
      actions: {
        submitShot: (cmd) => session.submitShot(cmd),
        useHazard: (cmd) => {
          sent.push(cmd);
          return session.useHazard(cmd);
        },
        // 판 돌리기·조준 중계는 이 흐름 검증 범위 밖이다
        rotateBoard: () => Promise.resolve({ ok: true }),
        aimHazard: () => undefined,
        sendAim: () => undefined,
      },
      mySeat: seat,
      now: () => store.serverNow(),
    });
    // GameScreen과 같은 순서로 연결한다
    let lastStart = store.getState().start;
    let lastView = store.getState().view;
    store.subscribe(() => {
      const s = store.getState();
      if (s.start && s.start !== lastStart) controller.setStart(s.start);
      if (s.view && s.view !== lastView) controller.setView(s.view);
      lastStart = s.start;
      lastView = s.view;
    });
    return { seat, session, store, controller, received, sent };
  });
  await Promise.all(seats.map((s) => s.session.connect()));
  await flush();
  const [s0, s1] = seats as [(typeof seats)[number], (typeof seats)[number]];
  return { clock, s0, s1 };
}

const events = <T>(r: { type: string; payload: unknown }[], type: string) =>
  r.filter((e) => e.type === type).map((e) => e.payload as T);

type Seat = Awaited<ReturnType<typeof startGame>>['s0'];

const gameId = (s: Seat) => s.store.getState().start!.gameId;
const held = (s: Seat) => s.store.getState().view!.private.held!;

describe('방해요소 사용 흐름', () => {
  it('정상: E 키로 후레쉬를 들고 클릭해 쓰면 양쪽이 hazard:triggered를 받고 효과는 상대 뷰에만 가림으로 들어간다', async () => {
    const { clock, s0, s1 } = await startGame();
    expect(held(s0).kind).toBe('flashlight');
    expect(held(s1).kind).toBe('wall');

    s0.controller.onKey('e'); // 손에 들기(아직 보내지 않음)
    await clock.advance(20);
    expect(s0.sent).toHaveLength(0);
    // 상대 얼굴을 겨누고 왼쪽 클릭으로 발동
    s0.controller.onPointer({
      type: 'down',
      point: null,
      aimPoint: { x: 0, y: 30, h: 24 },
      stoneId: null,
      button: 0,
    });
    await clock.advance(100);

    for (const s of [s0, s1]) {
      const trig = events<HazardTriggered>(s.received, 'hazard:triggered').filter(
        (e) => e.phase === 'start',
      );
      expect(trig).toHaveLength(1);
      expect(trig[0]).toMatchObject({ kind: 'flashlight', sourceSeat: 0, targetSeat: 1 });
      // 화면에는 양쪽 모두 발동 안내가 쌓인다
      expect(s.store.getState().announcements.map((a) => a.kind)).toContain('flashlight');
    }
    // 효과 적용: 사용자는 게이지가 오르고, 대상만 시야 가림을 갖는다
    expect(s0.store.getState().view!.private.fatigueGauge).toBeGreaterThan(30);
    expect(s0.store.getState().view!.private.blind).toBeUndefined();
    expect(s1.store.getState().view!.private.blind).toMatchObject({ kind: 'flashlight' });
    expect(s0.store.getState().view!.effects.some((e) => e.kind === 'flashlight')).toBe(true);
  });

  it('비공개: hazard:granted는 본인만 받고 상대 뷰에는 내 보유 정보가 없다', async () => {
    const { clock, s0, s1 } = await startGame();
    await clock.advance(100);
    const g0 = events<HazardGranted>(s0.received, 'hazard:granted');
    const g1 = events<HazardGranted>(s1.received, 'hazard:granted');
    expect(g0.map((g) => g.kind)).toEqual(['flashlight']);
    expect(g1.map((g) => g.kind)).toEqual(['wall']);

    const mine = held(s0);
    const theirsJson = JSON.stringify(s1.received);
    expect(theirsJson).not.toContain(mine.hazardInstanceId);
    for (const v of [
      s1.store.getState().view!,
      ...events<{ view?: unknown }>(s1.received, 'game:state'),
    ]) {
      expect(JSON.stringify(v)).not.toContain(mine.hazardInstanceId);
    }
    expect(s1.store.getState().view!.private.held?.kind).toBe('wall');
    // 상대가 쓴 뒤에도 효과의 이름만 공개되고 보유 인스턴스는 드러나지 않는다
    s0.controller.onKey('e');
    s0.controller.onPointer({
      type: 'down',
      point: null,
      aimPoint: { x: 0, y: 30, h: 24 },
      stoneId: null,
      button: 0,
    });
    await clock.advance(100);
    expect(JSON.stringify(s1.received)).not.toContain(mine.hazardInstanceId);
  });

  it('오류: 과열 거부는 게이지를 올리지 않고 입력 로직은 과열 중 아무것도 보내지 않는다', async () => {
    const { clock, s0, s1 } = await startGame();
    const use = () =>
      s0.session.useHazard({ gameId: gameId(s0), hazardInstanceId: held(s0).hazardInstanceId });
    for (let i = 0; i < 3; i++) {
      const p = use(); // 40+40+40 → 100, 과열
      await clock.advance(20);
      expect(await p).toEqual({ ok: true });
    }
    await clock.advance(100);
    const hot = s0.store.getState().view!;
    expect(hot.private.overheated).toBe(true);
    const triggeredBefore = events<HazardTriggered>(s1.received, 'hazard:triggered').length;

    // 권한 측이 직접 거부한다
    const cmd = use();
    await clock.advance(20);
    const result: CommandResult = await cmd;
    expect(result).toMatchObject({ ok: false, error: { code: 'HAZARD_OVERHEATED' } });
    await clock.advance(1000);
    const after = s0.store.getState().view!;
    expect(after.private.overheated).toBe(true);
    // 게이지는 시간만 따라 줄고 거부로 오르지 않는다
    expect(after.private.fatigueGauge!).toBeLessThanOrEqual(hot.private.fatigueGauge!);
    expect(events<HazardTriggered>(s1.received, 'hazard:triggered').length).toBe(triggeredBefore);

    // 입력 로직은 과열 칸을 흐리게 보고 E를 보내지 않는다
    s0.sent.length = 0;
    s0.controller.onKey('e');
    await clock.advance(20);
    expect(s0.sent).toHaveLength(0);
  });

  it('오류: 잘못된 위치는 거부되고 쿨타임이 생기지 않으며, 유효한 배치 뒤에는 쿨타임 거부가 상태를 바꾸지 않는다', async () => {
    const { clock, s0, s1 } = await startGame();
    const target = (x: number, y: number) =>
      s1.session.useHazard({
        gameId: gameId(s1),
        hazardInstanceId: held(s1).hazardInstanceId,
        target: { x, y, orientation: 'horizontal' },
      });

    // 격자 밖, 알과 겹침, 판 밖
    for (const [x, y] of [
      [1, 0],
      [0, -11],
      [22, 0],
    ] as const) {
      const p = target(x, y);
      await clock.advance(20);
      expect(await p).toMatchObject({ ok: false, error: { code: 'HAZARD_INVALID_TARGET' } });
    }
    await clock.advance(100);
    expect(s1.store.getState().view!.private.cooldownEndsAtMs).toBeNull();
    expect(events<HazardTriggered>(s0.received, 'hazard:triggered')).toHaveLength(0);

    // 미리보기는 같은 기하 조건으로 빨강/초록을 판정한다
    s1.controller.onKey('e');
    const preview = (x: number, y: number) => {
      s1.controller.onPointer({
        type: 'move',
        point: { x, y },
        aimPoint: null,
        stoneId: null,
        button: 0,
      });
      return s1.controller.getSnapshot().placement!;
    };
    expect(preview(0, -11.5).valid).toBe(false);
    expect(preview(22, 0).valid).toBe(false);
    expect(preview(0, 0).valid).toBe(true);

    // 유효한 위치를 클릭해 확정
    s1.controller.onPointer({
      type: 'down',
      point: { x: 0, y: 0 },
      aimPoint: null,
      stoneId: null,
      button: 0,
    });
    await clock.advance(100);
    expect(s1.controller.getSnapshot().placement).toBeNull();
    for (const s of [s0, s1]) {
      const wall = s.store.getState().view!.effects.find((e) => e.kind === 'wall');
      expect(wall?.params).toMatchObject({ x: 0, y: 0, orientation: 'horizontal' });
    }
    const cooldown = s1.store.getState().view!.private.cooldownEndsAtMs;
    expect(cooldown).toBeGreaterThan(clock.now());

    // 쿨타임 중에는 입력 로직이 보내지 않고, 직접 보내도 권한 측이 거부하며 쿨타임은 그대로다
    s1.sent.length = 0;
    s1.controller.onKey('e');
    expect(s1.sent).toHaveLength(0);
    const again = target(2.2 * 3, 2.2 * 3);
    await clock.advance(20);
    expect(await again).toMatchObject({ ok: false, error: { code: 'HAZARD_COOLDOWN' } });
    await clock.advance(1000);
    expect(s1.store.getState().view!.private.cooldownEndsAtMs).toBe(cooldown);
  });
});
