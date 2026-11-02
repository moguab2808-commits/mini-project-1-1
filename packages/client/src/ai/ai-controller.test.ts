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
import { AiController, placementTarget, planShot } from './ai-controller.ts';

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
      { nickname: 'me', characterId: 'bear' as const },
      { nickname: 'AI', characterId: 'cat' as const },
    ] as [{ nickname: string; characterId: 'bear' }, { nickname: string; characterId: 'cat' }],
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
        { seat: 0, nickname: 'me', characterId: 'bear' },
        { seat: 1, nickname: 'AI', characterId: 'cat' },
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
