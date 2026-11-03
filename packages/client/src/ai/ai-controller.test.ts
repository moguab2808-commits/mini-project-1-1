import { DEFAULT_APPEARANCE, type Appearance } from '@alkkagi/shared';
import { describe, expect, it } from 'vitest';
import { isPlacementValid, previewShot, Prng, reachOf } from '@alkkagi/game-core';
import { RoomRuntime, type RuntimeClock } from '@alkkagi/game-runtime';
import {
  BOARDS,
  type CommandResult,
  type GameStart,
  type GameView,
  type Seat,
} from '@alkkagi/shared';
import {
  AiController,
  placementTarget,
  planShot,
  planShotSteps,
  randomPlacement,
} from './ai-controller.ts';
import { INSTALL_KINDS, placementWorldFromView } from '@alkkagi/game-core';

function makeView(stones: GameView['stones'], extra: Partial<GameView> = {}): GameView {
  return {
    gameId: 'g',
    serverTick: 0,
    serverNowMs: 0,
    revision: 1,
    phase: 'aiming',
    turnId: 1,
    round: 1,
    activePlayerId: 1,
    deadlineMs: 30000,
    boardRotationDeg: 0,
    stones,
    effects: [],
    result: null,
    stoneCounts: [
      stones.filter((s) => s.ownerId === 0).length,
      stones.filter((s) => s.ownerId === 1).length,
    ],
    private: {
      held: null,
      fatigueGauge: 0,
      overheated: false,
      cooldownEndsAtMs: null,
      usable: true,
      timeoutStreak: 0,
    },
    ...extra,
  };
}

const board = BOARDS.standard;

describe('planShot', () => {
  it('손 닿는 내 알로 가장자리 상대 알을 떨어뜨리는 발사를 고른다', () => {
    // 좌석 1은 +y 쪽. 상대(좌석 0) 알이 -y 가장자리 근처에 있다
    const view = makeView([
      { id: 1, ownerId: 1, x: 0, y: 2, h: 0 },
      { id: 2, ownerId: 0, x: 0, y: -19, h: 0 },
      { id: 3, ownerId: 0, x: 15, y: 15, h: 0 },
    ]);
    const plan = planShot(view, board, 1, false)!;
    expect(plan.rotateDeg).toBe(0);
    expect(plan.stoneId).toBe(1);
    // 고른 발사를 오차 없이 치면 가장자리 상대 알이 떨어지고 내 알은 남는다
    const r = previewShot({ board, stones: view.stones, ...plan });
    expect(r.removed).toContain(2);
    expect(r.removed).not.toContain(1);
    expect(plan.power).toBeGreaterThan(0);
    expect(plan.power).toBeLessThanOrEqual(100);
  });

  it('손 닿는 알이 없으면 돌리지 않을 때 null, 돌릴 수 있으면 판 돌리기를 계획한다', () => {
    // 좌석 1 기준점은 (0, 30). (0, -20)은 50cm 떨어져 닿지 않는다
    const view = makeView([
      { id: 1, ownerId: 1, x: 0, y: -20, h: 0 },
      { id: 2, ownerId: 0, x: 5, y: -5, h: 0 },
    ]);
    expect(reachOf(1, 0, -20).reachable).toBe(false);
    expect(planShot(view, board, 1, false)).toBeNull();
    const plan = planShot(view, board, 1, true)!;
    expect(plan.rotateDeg).not.toBe(0);
  });
});

describe('placementTarget', () => {
  it('벽은 격자 위의 놓을 수 있는 자리, 끈끈이는 알과 겹치지 않는 자리를 고른다', () => {
    const view = makeView([
      { id: 1, ownerId: 1, x: 0, y: 10, h: 0 },
      { id: 2, ownerId: 0, x: 0, y: -10, h: 0 },
    ]);
    const world = { board, stones: view.stones, walls: [], stickies: [] };
    const wall = placementTarget(view, board, 1, 'wall', new Prng(1))!;
    expect(wall.orientation).toBe('horizontal');
    expect(isPlacementValid('wall', wall.x, wall.y, wall.orientation!, world)).toBe(true);
    const sticky = placementTarget(view, board, 1, 'sticky', new Prng(1))!;
    expect(isPlacementValid('sticky', sticky.x, sticky.y, 'horizontal', world)).toBe(true);
  });
});

/** 수동 시계 */
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
    const end = this.nowMs + ms;
    for (;;) {
      await flush();
      this.timers.sort((a, b) => a.at - b.at);
      const next = this.timers[0];
      if (!next || next.at > end) break;
      this.timers.shift();
      this.nowMs = Math.max(this.nowMs, next.at);
      next.cb();
    }
    this.nowMs = end;
    await flush();
  }
}

async function flush(): Promise<void> {
  for (let i = 0; i < 3; i++) await Promise.resolve();
}

describe('AiController + RoomRuntime', () => {
  function setup() {
    const clock = new FakeClock();
    const views: [GameView[], GameView[]] = [[], []];
    const starts: GameStart[] = [];
    let controller: AiController | null = null;
    const results: Array<{ kind: string; result: CommandResult }> = [];
    const runtime = new RoomRuntime({
      clock,
      transport: {
        send: (seat: Seat, type, payload) => {
          if (type === 'game:state') views[seat].push(payload as GameView);
          if (type === 'game:start') {
            if (seat === 0) starts.push(payload as GameStart);
            views[seat].push((payload as GameStart).view);
          }
          if (seat === 1) queueMicrotask(() => controller?.receive(type, payload as never));
        },
      },
    });
    const record =
      (kind: string) =>
      (p: Promise<CommandResult>): Promise<CommandResult> =>
        p.then((result) => {
          results.push({ kind, result });
          return result;
        });
    controller = new AiController({
      seat: 1,
      clock,
      seed: 7,
      actions: {
        sendEmote: async () => ({ ok: true }),
        submitShot: (cmd) => record('shot')(runtime.submitShot(1, cmd)),
        useHazard: (cmd) => record('hazard')(runtime.useHazard(1, cmd)),
        rotateBoard: (cmd) => record('rotate')(runtime.rotateBoard(1, cmd)),
        aimHazard: (cmd) => {
          void runtime.aimHazard(1, cmd);
        },
        sendAim: (u) => {
          runtime.relayAim(1, u);
        },
      },
    });
    return { clock, runtime, controller, views, starts, results };
  }

  const startConfig = (firstSeat: Seat) => ({
    gameId: 'g1',
    board: 'standard' as const,
    pieceCount: 5,
    seed: 42,
    firstSeat,
    players: [
      { nickname: 'me', appearance: DEFAULT_APPEARANCE },
      { nickname: 'AI', appearance: DEFAULT_APPEARANCE },
    ] as [
      { nickname: string; appearance: Appearance },
      { nickname: string; appearance: Appearance },
    ],
  });

  it('AI 턴이면 조준 시간(1.5~3초) 뒤 사람과 같은 명령으로 발사하고 수락된다', async () => {
    const { clock, runtime, results } = setup();
    runtime.startGame(startConfig(1));
    await clock.advance(1400);
    expect(results.filter((r) => r.kind === 'shot')).toHaveLength(0);
    await clock.advance(1700);
    const shots = results.filter((r) => r.kind === 'shot');
    expect(shots.length).toBeGreaterThanOrEqual(1);
    expect(shots[0]!.result).toEqual({ ok: true });
    runtime.dispose();
  });

  it('잘못된 뷰로 낸 명령은 권한 측 검증에서 거부되고 상태가 바뀌지 않는다', async () => {
    const { clock, runtime, controller, views, starts, results } = setup();
    runtime.startGame(startConfig(0)); // 사람 선공
    await clock.advance(10);
    const real = starts[0]!;
    // 자기 턴이라고 잘못 적힌 뷰를 넣는다(지난 턴·오래된 뷰를 받은 경우와 같다)
    controller.receive('game:start', {
      ...real,
      seat: 1,
      view: { ...real.view, activePlayerId: 1, private: { ...real.view.private } },
    });
    const before = views[0].at(-1)!;
    await clock.advance(3200);
    const shots = results.filter((r) => r.kind === 'shot');
    expect(shots).toHaveLength(1);
    expect(shots[0]!.result).toMatchObject({ ok: false, error: { code: 'NOT_YOUR_TURN' } });
    const after = views[0].at(-1)!;
    expect(after.stones).toEqual(before.stones);
    expect(after.turnId).toBe(before.turnId);
    expect(after.activePlayerId).toBe(0);
    runtime.dispose();
  });
});

describe('AiController 방해요소', () => {
  function rig(kind: 'stun' | 'flashlight' | 'wall' | 'wind') {
    const clock = new FakeClock();
    const calls: Array<{ type: string; cmd: unknown }> = [];
    const ok = (type: string) => (cmd: unknown) => {
      calls.push({ type, cmd });
      return Promise.resolve<CommandResult>({ ok: true });
    };
    const controller = new AiController({
      seat: 1,
      clock,
      seed: 5,
      actions: {
        sendEmote: async () => ({ ok: true }),
        submitShot: ok('shot'),
        useHazard: ok('hazard'),
        rotateBoard: ok('rotate'),
        aimHazard: (cmd) => calls.push({ type: 'aim', cmd }),
        sendAim: () => undefined,
      },
    });
    const view = makeView(
      [
        { id: 1, ownerId: 1, x: 0, y: 10, h: 0 },
        { id: 2, ownerId: 0, x: 0, y: -10, h: 0 },
      ],
      {
        activePlayerId: 0, // 사람 턴
        private: {
          held: { hazardInstanceId: 'h1', kind, round: 1 },
          fatigueGauge: 0,
          overheated: false,
          cooldownEndsAtMs: null,
          usable: true,
          timeoutStreak: 0,
        },
      },
    );
    const start = {
      gameId: 'g',
      seat: 1,
      players: [
        { seat: 0, nickname: 'me', appearance: DEFAULT_APPEARANCE },
        { seat: 1, nickname: 'AI', appearance: DEFAULT_APPEARANCE },
      ],
      board: 'standard',
      pieceCount: 5,
      finalRound: 10,
      turnSeconds: 30,
      view,
    } as GameStart;
    // 뷰의 시각이 시계와 같게 맞춘다
    start.view = { ...view, serverNowMs: clock.nowMs, deadlineMs: clock.nowMs + 30000 };
    controller.receive('game:start', start);
    return { clock, calls, controller };
  }

  it('사람 턴 중 무작위 시각(1~8초)에 기절을 쓴다. 내 턴에는 쓰지 않는다', async () => {
    const { clock, calls } = rig('stun');
    await clock.advance(999);
    expect(calls).toHaveLength(0);
    await clock.advance(7100);
    const uses = calls.filter((c) => c.type === 'hazard');
    expect(uses).toEqual([{ type: 'hazard', cmd: { gameId: 'g', hazardInstanceId: 'h1' } }]);
  });

  it('후레쉬는 상대 얼굴 쪽으로 발동해 조준을 유지하다가 놓는다', async () => {
    const { clock, calls } = rig('flashlight');
    await clock.advance(8100 + 4000);
    const use = calls.find((c) => c.type === 'hazard')!.cmd as { target: { y: number; h: number } };
    expect(use.target.y).toBeCloseTo(-30, 0); // 좌석 0 얼굴은 −y 쪽
    const aims = calls.filter((c) => c.type === 'aim').map((c) => c.cmd as { active?: boolean });
    expect(aims.length).toBeGreaterThan(5);
    expect(aims.at(-1)!.active).toBe(false);
    expect(aims.slice(0, -1).every((a) => a.active === true)).toBe(true);
  });

  it('벽은 놓을 수 있는 격자 위치로 쓴다', async () => {
    const { clock, calls } = rig('wall');
    await clock.advance(8100);
    const use = calls.find((c) => c.type === 'hazard')!.cmd as {
      target: { x: number; y: number; orientation: string };
    };
    expect(use.target.orientation).toBeDefined();
    expect(
      isPlacementValid('wall', use.target.x, use.target.y, use.target.orientation as 'horizontal', {
        board,
        stones: [
          { x: 0, y: 10 },
          { x: 0, y: -10 },
        ],
        walls: [],
        stickies: [],
      }),
    ).toBe(true);
  });

  it('바람 같은 랜덤형은 직접 쓰지 않는다', async () => {
    const { clock, calls } = rig('wind');
    await clock.advance(30000);
    expect(calls.filter((c) => c.type === 'hazard')).toHaveLength(0);
  });
});

describe('AiController 계획 시간 나누기', () => {
  /** 최악 케이스: 손 닿는 내 알 9개 vs 판 중앙에 몰린 상대 알 9개(0°에 마땅한 발사가 없어 판 돌리기 후보까지 본다) */
  function worstCaseStones(): GameView['stones'] {
    const stones: GameView['stones'] = [];
    for (let i = 0; i < 9; i++) {
      stones.push({
        id: i + 1,
        ownerId: 1,
        x: -12 + 3 * i,
        y: 12 + (i % 2) * 3,
        h: 0,
      });
    }
    for (let i = 0; i < 9; i++) {
      stones.push({
        id: 20 + i,
        ownerId: 0,
        x: -4 + (i % 3) * 4,
        y: -4 + Math.floor(i / 3) * 4,
        h: 0,
      });
    }
    return stones;
  }

  it('planShotSteps는 미리보기마다 멈추고 끝까지 돌리면 planShot과 같은 계획이다', () => {
    const view = makeView(worstCaseStones());
    const steps = planShotSteps(view, board, 1, true);
    let yields = 0;
    let r = steps.next();
    while (!r.done) {
      yields += 1;
      r = steps.next();
    }
    expect(r.value).toEqual(planShot(view, board, 1, true));
    // 이론상 최대는 0° + 판 돌리기 5가지 × (9 × 9 × 5 후보 + 상위 12개 × 오차 표본 6) = 2,862회다.
    // 이 배치는 판을 돌리면 일부 알이 손에 닿지 않아 2,205회다(판 돌리기 후보까지 본다는 확인)
    expect(yields).toBeGreaterThan(2000);
  });

  it('최악 케이스 계획 중에도 같은 스레드의 120Hz 타이머가 수십 ms 넘게 밀리지 않는다', async () => {
    // 실제 시각과 실제 타이머를 쓰는 시계(Worker의 시계와 같은 방식)
    const clock: RuntimeClock = {
      now: () => performance.now(),
      setTimer: (cb, delayMs) => {
        const t = setTimeout(cb, delayMs);
        return () => clearTimeout(t);
      },
    };
    let fired: () => void = () => undefined;
    const shotOrRotate = new Promise<void>((resolve) => {
      fired = resolve;
    });
    const act = () => {
      fired();
      return Promise.resolve<CommandResult>({
        ok: false,
        error: { code: 'GAME_NOT_ACTIVE', message: '' },
      });
    };
    const controller = new AiController({
      seat: 1,
      clock,
      seed: 1,
      tuning: { aimDelayMinMs: 0, aimDelayMaxMs: 0 },
      actions: {
        sendEmote: async () => ({ ok: true }),
        submitShot: act,
        useHazard: act,
        rotateBoard: act,
        aimHazard: () => undefined,
        sendAim: () => undefined,
      },
    });
    const now = performance.now();
    const view = makeView(worstCaseStones(), {
      serverNowMs: now,
      deadlineMs: now + 30000,
    });
    const gaps: number[] = [];
    let last = performance.now();
    const tick = setInterval(() => {
      const t = performance.now();
      gaps.push(t - last);
      last = t;
    }, 1000 / 120);
    controller.receive('game:start', {
      gameId: 'g',
      seat: 1,
      players: [
        { seat: 0, nickname: 'me', appearance: DEFAULT_APPEARANCE },
        { seat: 1, nickname: 'AI', appearance: DEFAULT_APPEARANCE },
      ],
      board: 'standard',
      pieceCount: 9,
      finalRound: 10,
      turnSeconds: 30,
      view,
    } as GameStart);
    await shotOrRotate;
    clearInterval(tick);
    controller.dispose();
    expect(gaps.length).toBeGreaterThan(10); // 계획 중에 타이머가 여러 번 돌았다
    // 나누지 않으면 1초 가까이 밀린다. 조각은 4ms이므로 여유를 크게 둔 상한
    expect(Math.max(...gaps)).toBeLessThan(60);
  }, 30000);
});

describe('추가 위치형 무작위 배치 (DEC-055)', () => {
  it('7종 모두 배치 가능한 자리를 고르고, 같은 시드면 같은 자리다', () => {
    const view = makeView([
      { id: 0, ownerId: 0, x: 0, y: -11.5, h: 0 },
      { id: 1, ownerId: 1, x: 0, y: 11.5, h: 0 },
    ]);
    for (const kind of INSTALL_KINDS) {
      if (kind === 'wall' || kind === 'sticky') continue;
      const t = randomPlacement(view, board, kind, new Prng(7));
      expect(t, kind).not.toBeNull();
      const world = placementWorldFromView(board, view, view.serverNowMs);
      expect(isPlacementValid(kind, t!.x, t!.y, t!.orientation ?? 'horizontal', world), kind).toBe(
        true,
      );
      expect(randomPlacement(view, board, kind, new Prng(7))).toEqual(t);
    }
  });
});

describe('AI 감정표현', () => {
  it('상황에 따라 가끔 사용하고 3초 쿨타임과 종료·dispose를 지킨다', async () => {
    const calls: { at: number; emote: string }[] = [];
    for (let seed = 0; seed < 24; seed++) {
      const clock = new FakeClock();
      const local: { at: number; emote: string }[] = [];
      const controller = new AiController({
        seat: 1,
        clock,
        seed,
        actions: {
          sendEmote: async (cmd) => {
            local.push({ at: clock.now(), emote: cmd.emote });
            return { ok: true };
          },
          submitShot: async () => ({ ok: true }),
          useHazard: async () => ({ ok: true }),
          rotateBoard: async () => ({ ok: true }),
          aimHazard: () => undefined,
          sendAim: () => undefined,
        },
      });
      const v = makeView(
        [
          { id: 1, ownerId: 1, x: 0, y: 10, h: 0 },
          { id: 2, ownerId: 0, x: 0, y: -10, h: 0 },
        ],
        { activePlayerId: 0 },
      );
      const start: GameStart = {
        gameId: 'g',
        seat: 1,
        players: [
          { seat: 0, nickname: 'me', appearance: DEFAULT_APPEARANCE },
          { seat: 1, nickname: 'AI', appearance: DEFAULT_APPEARANCE },
        ],
        board: 'standard',
        theme: 'bar',
        pieceCount: 5,
        finalRound: 10,
        turnSeconds: 30,
        view: v,
      };
      controller.receive('game:start', start);
      // 같은 시각에 턴·알 개수가 여러 번 바뀌어도 연속 표현하지 않는다.
      for (let turn = 2; turn < 10; turn++)
        controller.receive('game:state', { ...v, turnId: turn });
      expect(local.length).toBeLessThanOrEqual(1);
      await clock.advance(3000);
      controller.receive('game:state', { ...v, turnId: 10, phase: 'moving', stoneCounts: [1, 0] });
      await clock.advance(3000);
      controller.receive('game:state', { ...v, turnId: 11, phase: 'moving', stoneCounts: [0, 0] });
      for (let i = 1; i < local.length; i++)
        expect(local[i]!.at - local[i - 1]!.at).toBeGreaterThanOrEqual(3000);
      controller.dispose();
      const count = local.length;
      controller.receive('game:state', { ...v, turnId: 12 });
      await clock.advance(10000);
      expect(local).toHaveLength(count);
      calls.push(...local);
    }
    expect(calls.some((e) => e.emote === 'gg')).toBe(true);
    expect(calls.some((e) => e.emote === 'surprise')).toBe(true);
    expect(calls.some((e) => e.emote === 'laugh')).toBe(true);
  });
});
