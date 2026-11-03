import { MessageChannel } from 'node:worker_threads';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RuntimeClock } from '@alkkagi/game-runtime';
import {
  AppearanceSchema,
  BOARDS,
  DEFAULT_APPEARANCE,
  type GameOver,
  type GameStart,
  type GameView,
  type HazardGranted,
  type RematchState,
} from '@alkkagi/shared';
import type { PortLike } from '../local/local-authority.ts';
import type { SessionPort } from '../local/local-game-session.ts';
import { AiAuthority } from './ai-authority.ts';
import { AiController, planShot } from './ai-controller.ts';
import { AiGameSession } from './ai-game-session.ts';

const TESTER_LOOK = { ...DEFAULT_APPEARANCE, hair: 2, eyes: 3 };

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
  /** 타이머를 시각 순서대로 실행한다. 메시지 전달은 `flushEvery`번째 타이머마다 기다린다 */
  async advance(ms: number, flushEvery = 1): Promise<void> {
    await flush();
    const end = this.nowMs + ms;
    let n = 0;
    for (;;) {
      this.timers.sort((a, b) => a.at - b.at);
      const next = this.timers[0];
      if (!next || next.at > end) break;
      this.timers.shift();
      this.nowMs = Math.max(this.nowMs, next.at);
      next.cb();
      if (++n % flushEvery === 0) await flush();
    }
    this.nowMs = end;
    await flush();
  }
}

async function flush(): Promise<void> {
  for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r));
}

const channels: MessageChannel[] = [];
const sessions: AiGameSession[] = [];

afterEach(() => {
  for (const s of sessions) s.dispose();
  for (const c of channels) {
    c.port1.close();
    c.port2.close();
  }
  sessions.length = 0;
  channels.length = 0;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function setup(
  settings: { board: 'standard' | 'circle'; pieceCount: 5 | 7 | 9 },
  random: () => number = mulberry(3),
) {
  const clock = new FakeClock();
  const authority = new AiAuthority({ clock, random });
  const ch = new MessageChannel();
  channels.push(ch);
  authority.attach(ch.port1 as unknown as PortLike);
  const session = new AiGameSession(ch.port2 as unknown as SessionPort, {
    ...settings,
    profile: { nickname: '테스터', appearance: TESTER_LOOK },
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
    'emote:shown',
  ] as const) {
    session.on(type, (payload) => log.push({ type, payload }));
  }
  return { clock, session, log };
}

const of = <T>(log: { type: string; payload: unknown }[], type: string) =>
  log.filter((e) => e.type === type).map((e) => e.payload as T);

/** 결정적인 [0, 1) 난수 */
function mulberry(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 사람 대역: 자기 턴이 오면 1초 뒤 AI와 같은 계획 함수로 친다(오차 없음). 판을 돌려야 하면
 * 손 닿는 알을 판 중심 쪽으로 약하게 친다(시간초과 기권으로 끝나지 않게).
 */
function humanBot(
  session: AiGameSession,
  clock: FakeClock,
  log: { type: string; payload: unknown }[],
) {
  let lastTurn = '';
  let board = BOARDS.standard;
  session.on('game:start', (s) => {
    board = BOARDS[s.board];
  });
  const onView = (v: GameView) => {
    if (v.phase !== 'aiming' || v.activePlayerId !== 0 || v.result) return;
    const key = `${v.gameId}:${String(v.turnId)}`;
    if (key === lastTurn) return;
    lastTurn = key;
    clock.setTimer(() => {
      const latest = of<GameView>(log, 'game:state').at(-1) ?? v;
      const view = latest.turnId === v.turnId ? latest : v;
      const plan = planShot(view, board, 0, false);
      const mine = view.stones.find((s) => s.ownerId === 0 && Math.hypot(s.x, s.y + 30) <= 40);
      const shot =
        plan ??
        (mine ? { stoneId: mine.id, angle: Math.atan2(-mine.y, -mine.x), power: 20 } : null);
      if (!shot) return;
      void session.submitShot({
        gameId: view.gameId,
        turnId: view.turnId,
        stoneId: shot.stoneId,
        angle: shot.angle,
        power: shot.power,
      });
    }, 1000);
  };
  session.on('game:start', (s) => {
    onView(s.view);
  });
  session.on('game:state', onView);
}

describe('AiAuthority + AiGameSession', () => {
  it('사람 감정표현을 같은 런타임으로 보내고 쿨타임·잘못된 값을 거부한다', async () => {
    const { session, log } = setup({ board: 'standard', pieceCount: 5 });
    await session.connect();
    await flush();
    const start = of<GameStart>(log, 'game:start')[0]!;
    const cmd = { gameId: start.gameId, emote: 'surprise' as const };
    expect(await session.sendEmote(cmd)).toEqual({ ok: true });
    await flush();
    const own = of<{ seat: number; emote: string }>(log, 'emote:shown').filter((e) => e.seat === 0);
    expect(own).toHaveLength(1);
    expect(own[0]!.emote).toBe('surprise');
    const again = await session.sendEmote(cmd);
    expect(!again.ok && again.error.code).toBe('EMOTE_COOLDOWN');
    const invalid = await session.sendEmote({ ...cmd, emote: 'other' } as never);
    expect(!invalid.ok && invalid.error.code).toBe('INVALID_INPUT');
  });

  it.each([
    { board: 'circle', pieceCount: 5, seed: 3 },
    { board: 'standard', pieceCount: 7, seed: 11 },
    { board: 'standard', pieceCount: 9, seed: 29 },
  ] as const)(
    '판·알 개수를 정해 시작하면 서버 요청 없이 AI와 경기가 끝까지 진행된다 (%o)',
    async ({ board, pieceCount, seed }) => {
      const fetchSpy = vi.fn();
      const wsSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      vi.stubGlobal('WebSocket', wsSpy);
      vi.stubGlobal('XMLHttpRequest', wsSpy);

      const { clock, session, log } = setup({ board, pieceCount }, mulberry(seed));
      humanBot(session, clock, log);
      await session.connect();
      await flush();
      const start = of<GameStart>(log, 'game:start')[0]!;
      expect(session.mode).toBe('ai');
      expect(start.seat).toBe(0);
      expect(start.board).toBe(board);
      expect(start.pieceCount).toBe(pieceCount);
      expect(start.players[0]).toEqual({ seat: 0, nickname: '테스터', appearance: TESTER_LOOK });
      expect(AppearanceSchema.safeParse(start.players[1].appearance).success).toBe(true);
      expect(start.players[1]).toMatchObject({ nickname: 'AI' });

      // 10라운드(턴 30초 상한) 안에 끝난다
      for (let i = 0; i < 80 && of(log, 'game:over').length === 0; i++) {
        await clock.advance(10_000, 40);
      }
      const over = of<GameOver>(log, 'game:over');
      expect(over).toHaveLength(1);
      expect(['all_stones_out', 'final_round']).toContain(over[0]!.reason);
      // AI도 실제로 쳤다: AI 턴이 끝날 때 상대 알 수가 바뀌었거나 AI 턴이 시간초과 없이 넘어갔다
      const turns = of<{ activePlayerId: number; reason: string }>(log, 'turn:change');
      const aiTimeouts = turns.filter(
        (t, i) => i > 0 && turns[i - 1]!.activePlayerId === 1 && t.reason === 'timeout',
      );
      expect(aiTimeouts).toHaveLength(0);
      expect(
        turns.filter((t, i) => i > 0 && turns[i - 1]!.activePlayerId === 1).length,
      ).toBeGreaterThan(0);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(wsSpy).not.toHaveBeenCalled();
    },
    60_000,
  );

  it('AI 컨트롤러는 자기 좌석 이벤트만 받는다(사람의 방해요소·뷰를 보지 않는다)', async () => {
    const received: { type: string; payload: unknown }[] = [];
    const original = AiController.prototype.receive;
    vi.spyOn(AiController.prototype, 'receive').mockImplementation(function (
      this: AiController,
      type,
      payload,
    ) {
      received.push({ type, payload });
      original.call(this, type, payload);
    });
    const { clock, session, log } = setup({ board: 'standard', pieceCount: 7 });
    humanBot(session, clock, log);
    await session.connect();
    for (let i = 0; i < 12; i++) await clock.advance(10_000, 40);

    const aiStarts = received.filter((e) => e.type === 'game:start');
    expect(aiStarts.length).toBeGreaterThan(0);
    for (const e of aiStarts) expect((e.payload as GameStart).seat).toBe(1);
    // 사람에게 간 방해요소 지급은 AI가 받지 않는다
    const humanGrants = new Set(
      of<HazardGranted>(log, 'hazard:granted').map((g) => g.hazardInstanceId),
    );
    const aiGrants = received
      .filter((e) => e.type === 'hazard:granted')
      .map((e) => (e.payload as HazardGranted).hazardInstanceId);
    expect(humanGrants.size + aiGrants.length).toBeGreaterThan(0);
    for (const id of aiGrants) expect(humanGrants.has(id)).toBe(false);
    // AI가 받은 뷰의 비공개 칸은 AI 자기 것이다
    const humanHeld = new Set(
      of<GameView>(log, 'game:state')
        .map((v) => v.private.held?.hazardInstanceId)
        .filter(Boolean),
    );
    for (const e of received.filter((r) => r.type === 'game:state')) {
      const id = (e.payload as GameView).private.held?.hazardInstanceId;
      if (id) expect(humanHeld.has(id)).toBe(false);
    }
  }, 60_000);

  it('재도전하기를 누르면 같은 설정으로 바로 새 AI 대전이 시작된다', async () => {
    const { clock, session, log } = setup({ board: 'standard', pieceCount: 9 });
    await session.connect();
    await flush();
    const first = of<GameStart>(log, 'game:start')[0]!;
    const forfeit = session.forfeit({ gameId: first.gameId });
    await clock.advance(50);
    expect(await forfeit).toEqual({ ok: true });
    const over = of<GameOver>(log, 'game:over')[0]!;
    expect(over).toMatchObject({ winnerId: 1, reason: 'forfeit' });

    const req = session.requestRematch(over.gameId);
    await clock.advance(50);
    expect(await req).toEqual({ ok: true });
    expect(of<RematchState>(log, 'rematch:state').at(-1)).toMatchObject({ outcome: 'accepted' });
    const starts = of<GameStart>(log, 'game:start');
    expect(starts).toHaveLength(2);
    expect(starts[1]!.gameId).not.toBe(first.gameId);
    expect(starts[1]).toMatchObject({ board: 'standard', pieceCount: 9 });
    // AI 외형은 재도전에서 같다(DEC-059)
    expect(starts[1]!.players[1].appearance).toEqual(first.players[1].appearance);
  });

  it('재도전 시간이 지나면 무산되고, 지난 경기의 재도전 요청은 거부된다', async () => {
    const { clock, session, log } = setup({ board: 'standard', pieceCount: 5 });
    await session.connect();
    await flush();
    const first = of<GameStart>(log, 'game:start')[0]!;
    void session.forfeit({ gameId: first.gameId });
    await clock.advance(50);
    await clock.advance(15_100);
    expect(of<RematchState>(log, 'rematch:state').at(-1)).toMatchObject({ outcome: 'expired' });
    const late = session.requestRematch(first.gameId);
    await clock.advance(10);
    expect(await late).toMatchObject({ ok: false, error: { code: 'REMATCH_NOT_AVAILABLE' } });
  });

  it('좌석 0이 아닌 연결은 거부된다', async () => {
    const clock = new FakeClock();
    const authority = new AiAuthority({ clock });
    const ch = new MessageChannel();
    channels.push(ch);
    authority.attach(ch.port1 as unknown as PortLike);
    const replies: unknown[] = [];
    ch.port2.on('message', (m) => replies.push(m));
    ch.port2.postMessage({ t: 'hello', seat: 1 });
    await flush();
    expect(replies).toEqual([{ t: 'rejected', reason: 'INVALID_HELLO' }]);
  });
});
