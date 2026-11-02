import { describe, expect, it } from 'vitest';
import type {
  CommandResult,
  GameStart,
  GameView,
  HazardKind,
  HazardUse,
  ShotSubmit,
} from '@alkkagi/shared';
import { AimController, type AimActions } from './aim-controller.ts';
import type { BoardPointerEvent } from '../scene/scene-contract.ts';

const OK: CommandResult = { ok: true };
const fail = (code: Extract<CommandResult, { ok: false }>['error']['code']): CommandResult => ({
  ok: false,
  error: { code, message: code },
});

interface Env {
  t: number;
  shots: ShotSubmit[];
  hazards: HazardUse[];
  shotResult: CommandResult;
  hazardResult: CommandResult;
  controller: AimController;
  view: GameView;
}

function makeView(patch: Partial<GameView> & { held?: HazardKind } = {}): GameView {
  const { held, ...rest } = patch;
  return {
    gameId: 'g1',
    serverTick: 0,
    serverNowMs: 1000,
    revision: 1,
    phase: 'aiming',
    turnId: 1,
    round: 1,
    activePlayerId: 0,
    deadlineMs: 31000,
    boardRotationDeg: 0,
    stones: [
      { id: 0, ownerId: 0, x: -10, y: -11.5, h: 0 },
      { id: 1, ownerId: 0, x: 0, y: -11.5, h: 0 },
      { id: 2, ownerId: 1, x: 0, y: 11.5, h: 0 },
    ],
    effects: [],
    result: null,
    private: {
      held: held ? { hazardInstanceId: `h-${held}`, kind: held, round: 1 } : null,
      fatigueGauge:
        held && ['board_spin', 'flashlight', 'water_gun', 'desk_shake'].includes(held) ? 0 : null,
      overheated: false,
      cooldownEndsAtMs: null,
      usable: held !== undefined && held !== 'bar_speed' && held !== 'wind',
      timeoutStreak: 0,
    },
    ...rest,
  };
}

function setup(view: GameView = makeView(), seat: 0 | 1 = 0): Env {
  const env = {
    t: 1000,
    shots: [],
    hazards: [],
    shotResult: OK,
    hazardResult: OK,
    view,
  } as unknown as Env;
  const actions: AimActions = {
    submitShot: (cmd) => {
      env.shots.push(cmd);
      return Promise.resolve(env.shotResult);
    },
    useHazard: (cmd) => {
      env.hazards.push(cmd);
      return Promise.resolve(env.hazardResult);
    },
  };
  env.controller = new AimController({ actions, mySeat: seat, now: () => env.t });
  env.controller.setStart({
    gameId: view.gameId,
    seat,
    players: [
      { seat: 0, nickname: 'a', characterId: 'bear' },
      { seat: 1, nickname: 'b', characterId: 'cat' },
    ],
    board: 'standard',
    pieceCount: 7,
    finalRound: 10,
    turnSeconds: 30,
    view,
  } satisfies GameStart);
  return env;
}

const ptr = (
  type: BoardPointerEvent['type'],
  point: { x: number; y: number } | null,
  stoneId: number | null = null,
  button = 0,
): BoardPointerEvent => ({ type, point, stoneId, button });

const flush = () => new Promise((r) => setImmediate(r));

/** 알 0을 선택하고 (+x 방향) 오른쪽을 가리킨 상태 */
function selectStone0(env: Env) {
  env.controller.onPointer(ptr('down', { x: -10, y: -11.5 }, 0));
  env.controller.onPointer(ptr('up', { x: -10, y: -11.5 }, 0));
  env.controller.onPointer(ptr('move', { x: 0, y: -11.5 }));
}

/** 시간을 ms만큼 100ms 단위로 흘린다 */
function run(env: Env, ms: number) {
  for (let i = 0; i < ms / 50; i++) {
    env.t += 50;
    env.controller.tick();
  }
}

describe('알 선택과 각도', () => {
  it('내 알 클릭은 선택, 다른 알 클릭은 선택 변경, 상대 알 클릭은 무시한다', () => {
    const env = setup();
    env.controller.onPointer(ptr('down', { x: -10, y: -11.5 }, 0));
    expect(env.controller.getSnapshot().aim?.stoneId).toBe(0);
    env.controller.onPointer(ptr('down', { x: 0, y: -11.5 }, 1));
    expect(env.controller.getSnapshot().aim?.stoneId).toBe(1);
    env.controller.onPointer(ptr('down', { x: 0, y: 11.5 }, 2)); // 상대 알 위에서 누름 = 충전 시작
    expect(env.controller.getSnapshot().aim?.stoneId).toBe(1);
  });

  it('알 중심에서 포인터를 향하는 각도를 (−π, π]로 정규화한다', () => {
    const env = setup();
    env.controller.onPointer(ptr('down', { x: -10, y: -11.5 }, 0));
    env.controller.onPointer(ptr('move', { x: 0, y: -11.5 }));
    expect(env.controller.getSnapshot().aim?.angle).toBeCloseTo(0);
    env.controller.onPointer(ptr('move', { x: -10, y: 5 }));
    expect(env.controller.getSnapshot().aim?.angle).toBeCloseTo(Math.PI / 2);
    env.controller.onPointer(ptr('move', { x: -20, y: -11.5 }));
    expect(env.controller.getSnapshot().aim?.angle).toBeCloseTo(Math.PI);
    // atan2(-0, -1) = -π 경계는 π로 돌려놓는다
    env.controller.onPointer(ptr('move', { x: -20, y: -11.5 - 0 }));
    const a = env.controller.getSnapshot().aim!.angle;
    expect(a).toBeGreaterThan(-Math.PI);
    expect(a).toBeLessThanOrEqual(Math.PI);
  });

  it('상대 턴·기절·마감 후에는 조준하지 않는다', () => {
    const other = setup(makeView({ activePlayerId: 1 }));
    other.controller.onPointer(ptr('down', { x: -10, y: -11.5 }, 0));
    expect(other.controller.getSnapshot().aim).toBeNull();

    const stunned = setup(
      makeView({
        effects: [{ kind: 'stun', targetSeat: 0, startsAtMs: 900, expiresAtMs: 4000 }],
      }),
    );
    stunned.controller.onPointer(ptr('down', { x: -10, y: -11.5 }, 0));
    expect(stunned.controller.getSnapshot().aim).toBeNull();

    const late = setup(makeView({ deadlineMs: 1000 }));
    late.controller.onPointer(ptr('down', { x: -10, y: -11.5 }, 0));
    expect(late.controller.getSnapshot().aim).toBeNull();
  });

  it('moving 단계에서는 조준하지 않는다', () => {
    const env = setup(makeView({ phase: 'moving' }));
    env.controller.onPointer(ptr('down', { x: -10, y: -11.5 }, 0));
    expect(env.controller.getSnapshot().aim).toBeNull();
  });
});

describe('세기 막대와 발사', () => {
  it('2초 주기 삼각파로 0→100→0 진행한다', () => {
    const env = setup();
    selectStone0(env);
    env.controller.onPointer(ptr('down', { x: 0, y: -11.5 }));
    expect(env.controller.getSnapshot().aim).toMatchObject({ charging: true, power: 0 });
    run(env, 500);
    expect(env.controller.getSnapshot().aim?.power).toBeCloseTo(50, 0);
    run(env, 500);
    expect(env.controller.getSnapshot().aim?.power).toBeCloseTo(100, 0);
    run(env, 500);
    expect(env.controller.getSnapshot().aim?.power).toBeCloseTo(50, 0);
    run(env, 500);
    expect(env.controller.getSnapshot().aim?.power).toBeCloseTo(0, 0);
  });

  it('bar_speed 효과 중에는 2배 빠르다', () => {
    const env = setup(
      makeView({
        effects: [
          {
            kind: 'bar_speed',
            targetSeat: 0,
            startsAtMs: 900,
            expiresAtMs: 5000,
            params: { multiplier: 2 },
          },
        ],
      }),
    );
    selectStone0(env);
    env.controller.onPointer(ptr('down', { x: 0, y: -11.5 }));
    run(env, 500);
    expect(env.controller.getSnapshot().aim?.power).toBeCloseTo(100, 0);
  });

  it('놓으면 그 순간의 세기·각도로 submitShot을 보낸다', async () => {
    const env = setup();
    selectStone0(env);
    env.controller.onPointer(ptr('down', { x: 0, y: -11.5 }));
    run(env, 500);
    // 누르는 동안 방향을 바꾼다: 위쪽(+y)
    env.controller.onPointer(ptr('move', { x: -10, y: 0 }));
    env.controller.onPointer(ptr('up', { x: -10, y: 0 }));
    expect(env.shots).toHaveLength(1);
    expect(env.shots[0]).toMatchObject({ gameId: 'g1', turnId: 1, stoneId: 0 });
    expect(env.shots[0]!.power).toBeCloseTo(50, 0);
    expect(env.shots[0]!.angle).toBeCloseTo(Math.PI / 2);
    await flush();
  });

  it('세기 0에서 놓으면 발사하지 않고 조준 상태로 돌아간다', () => {
    const env = setup();
    selectStone0(env);
    env.controller.onPointer(ptr('down', { x: 0, y: -11.5 }));
    env.controller.onPointer(ptr('up', { x: 0, y: -11.5 }));
    expect(env.shots).toHaveLength(0);
    expect(env.controller.getSnapshot().aim).toMatchObject({ stoneId: 0, charging: false });
  });

  it('누른 채 오른쪽 클릭이나 ESC를 누르면 취소한다', () => {
    const env = setup();
    selectStone0(env);
    env.controller.onPointer(ptr('down', { x: 0, y: -11.5 }));
    run(env, 500);
    env.controller.onPointer(ptr('down', { x: 0, y: -11.5 }, null, 2));
    env.controller.onPointer(ptr('up', { x: 0, y: -11.5 }));
    expect(env.shots).toHaveLength(0);
    expect(env.controller.getSnapshot().aim?.charging).toBe(false);

    env.controller.onPointer(ptr('down', { x: 0, y: -11.5 }));
    run(env, 500);
    env.controller.onKey('escape');
    env.controller.onPointer(ptr('up', { x: 0, y: -11.5 }));
    expect(env.shots).toHaveLength(0);
  });

  it('결과 도착 전후로 같은 턴에 중복 발사하지 않는다', async () => {
    const env = setup();
    selectStone0(env);
    env.controller.onPointer(ptr('down', { x: 0, y: -11.5 }));
    run(env, 500);
    env.controller.onPointer(ptr('up', { x: 0, y: -11.5 }));
    // 결과 도착 전
    env.controller.onPointer(ptr('down', { x: -10, y: -11.5 }, 0));
    env.controller.onPointer(ptr('down', { x: 0, y: -11.5 }));
    run(env, 500);
    env.controller.onPointer(ptr('up', { x: 0, y: -11.5 }));
    await flush();
    // 결과 도착 후(스냅샷이 아직 aiming)
    env.controller.onPointer(ptr('down', { x: -10, y: -11.5 }, 0));
    env.controller.onPointer(ptr('down', { x: 0, y: -11.5 }));
    run(env, 500);
    env.controller.onPointer(ptr('up', { x: 0, y: -11.5 }));
    expect(env.shots).toHaveLength(1);
  });

  it('STALE_TURN 거부는 조준을 초기화하고 짧은 안내를 남긴다', async () => {
    const env = setup();
    env.shotResult = fail('STALE_TURN');
    selectStone0(env);
    env.controller.onPointer(ptr('down', { x: 0, y: -11.5 }));
    run(env, 500);
    env.controller.onPointer(ptr('up', { x: 0, y: -11.5 }));
    await flush();
    const snap = env.controller.getSnapshot();
    expect(snap.aim).toBeNull();
    expect(snap.notice?.text).toBeTruthy();
    // 안내는 시간이 지나면 사라진다
    run(env, 2500);
    expect(env.controller.getSnapshot().notice).toBeNull();
  });

  it('턴이 바뀌거나 마감이 지나면 조준 상태를 초기화한다', () => {
    const env = setup();
    selectStone0(env);
    env.controller.onPointer(ptr('down', { x: 0, y: -11.5 }));
    env.controller.setView(makeView({ turnId: 2, activePlayerId: 1 }));
    expect(env.controller.getSnapshot().aim).toBeNull();

    const env2 = setup(makeView({ deadlineMs: 2000 }));
    selectStone0(env2);
    expect(env2.controller.getSnapshot().aim).not.toBeNull();
    run(env2, 1100);
    expect(env2.controller.getSnapshot().aim).toBeNull();

    const env3 = setup();
    selectStone0(env3);
    env3.controller.setView(
      makeView({ effects: [{ kind: 'stun', targetSeat: 0, startsAtMs: 900, expiresAtMs: 4000 }] }),
    );
    expect(env3.controller.getSnapshot().aim).toBeNull();
  });
});

describe('바람', () => {
  it('활성 시간 동안 조준 각도를 초당 60도씩 바람 방향으로 돌린다', () => {
    const env = setup(
      makeView({
        effects: [
          {
            kind: 'wind',
            targetSeat: 0,
            startsAtMs: 1000,
            expiresAtMs: 2000,
            params: { directionRad: Math.PI / 2 },
          },
        ],
      }),
    );
    selectStone0(env); // 각도 0
    expect(env.controller.getSnapshot().aim?.angle).toBeCloseTo(0);
    run(env, 1000); // 1초 동안 약 60도(만료 시각 경계의 마지막 한 걸음은 제외)
    const deg = (env.controller.getSnapshot().aim!.angle * 180) / Math.PI;
    expect(deg).toBeGreaterThan(56);
    expect(deg).toBeLessThanOrEqual(60);
    run(env, 1000); // 효과 만료 뒤에는 더 돌지 않는다
    expect((env.controller.getSnapshot().aim!.angle * 180) / Math.PI).toBeCloseTo(deg, 5);
  });

  it('바람 방향을 지나치지 않고, 마우스 입력과 함께 반영된다', () => {
    const env = setup(
      makeView({
        deadlineMs: 60000,
        effects: [
          {
            kind: 'wind',
            targetSeat: 0,
            startsAtMs: 1000,
            expiresAtMs: 9000,
            params: { directionRad: Math.PI / 6 },
          },
        ],
      }),
    );
    selectStone0(env);
    run(env, 2000);
    expect(env.controller.getSnapshot().aim?.angle).toBeCloseTo(Math.PI / 6, 3);
    env.controller.onPointer(ptr('move', { x: -10, y: 0 })); // 마우스를 위로 돌리면 입력이 더해진다
    expect(env.controller.getSnapshot().aim?.angle).toBeGreaterThan(Math.PI / 6);
  });

  it('상대에게 걸린 바람은 반영하지 않는다', () => {
    const env = setup(
      makeView({
        effects: [
          {
            kind: 'wind',
            targetSeat: 1,
            startsAtMs: 1000,
            expiresAtMs: 2000,
            params: { directionRad: Math.PI / 2 },
          },
        ],
      }),
    );
    selectStone0(env);
    run(env, 1000);
    expect(env.controller.getSnapshot().aim?.angle).toBeCloseTo(0);
  });
});

describe('방해요소 입력', () => {
  const IMMEDIATE: HazardKind[] = ['board_spin', 'flashlight', 'water_gun', 'desk_shake', 'stun'];

  it.each(IMMEDIATE)('즉시형 %s는 E 키로 바로 hazard:use를 보낸다', (kind) => {
    const env = setup(makeView({ held: kind }));
    env.controller.onKey('e');
    expect(env.hazards).toEqual([{ gameId: 'g1', hazardInstanceId: `h-${kind}` }]);
  });

  it('칸 클릭도 E 키와 같다', () => {
    const env = setup(makeView({ held: 'stun' }));
    env.controller.onSlotClick();
    expect(env.hazards).toHaveLength(1);
  });

  it('랜덤형은 무시한다', () => {
    for (const kind of ['bar_speed', 'wind'] as const) {
      const env = setup(makeView({ held: kind }));
      env.controller.onKey('e');
      expect(env.hazards).toHaveLength(0);
      expect(env.controller.getSnapshot().placement).toBeNull();
    }
  });

  it('쿨타임·과열 중에는 입력을 보내지 않는다', () => {
    const view = makeView({ held: 'stun' });
    const cooling = setup({
      ...view,
      private: { ...view.private, cooldownEndsAtMs: 20000, usable: false },
    });
    cooling.controller.onKey('e');
    expect(cooling.hazards).toHaveLength(0);

    const flash = makeView({ held: 'flashlight' });
    const hot = setup({
      ...flash,
      private: { ...flash.private, fatigueGauge: 100, overheated: true, usable: false },
    });
    hot.controller.onKey('e');
    expect(hot.hazards).toHaveLength(0);
    // 게이지가 0까지 줄면 과열이 풀린 것으로 보고 다시 보낸다(20초)
    hot.t += 21000;
    hot.controller.onKey('e');
    expect(hot.hazards).toHaveLength(1);
  });

  it('경기가 끝난 뒤에는 보내지 않는다', () => {
    const env = setup(makeView({ held: 'stun', phase: 'finished' }));
    env.controller.onKey('e');
    expect(env.hazards).toHaveLength(0);
  });

  it('충전 중 즉시형은 충전을 끊지 않고, 벽·끈끈이는 배치 모드로 들어가지 않는다', () => {
    const env = setup(makeView({ held: 'stun' }));
    selectStone0(env);
    env.controller.onPointer(ptr('down', { x: 0, y: -11.5 }));
    run(env, 500);
    env.controller.onKey('e');
    expect(env.hazards).toHaveLength(1);
    expect(env.controller.getSnapshot().aim?.charging).toBe(true);
    run(env, 500);
    expect(env.controller.getSnapshot().aim?.power).toBeCloseTo(100, 0);

    const wall = setup(makeView({ held: 'wall' }));
    selectStone0(wall);
    wall.controller.onPointer(ptr('down', { x: 0, y: -11.5 }));
    wall.controller.onKey('e');
    expect(wall.controller.getSnapshot().placement).toBeNull();
    expect(wall.hazards).toHaveLength(0);
  });

  describe('배치 모드', () => {
    it('벽: 격자에 스냅한 미리보기, R·휠로 방향 전환, 빈 곳 클릭으로 확정', async () => {
      const env = setup(makeView({ held: 'wall' }));
      env.controller.onPointer(ptr('move', { x: 4.9, y: 0.4 }));
      env.controller.onKey('e');
      const p = env.controller.getSnapshot().placement!;
      expect(p).toMatchObject({ kind: 'wall', orientation: 'horizontal', valid: true });
      expect(p.x).toBeCloseTo(4.4);
      expect(p.y).toBeCloseTo(0);
      env.controller.onKey('r');
      expect(env.controller.getSnapshot().placement?.orientation).toBe('vertical');
      env.controller.onWheel();
      expect(env.controller.getSnapshot().placement?.orientation).toBe('horizontal');
      env.controller.onKey('r');
      env.controller.onPointer(ptr('down', { x: 4.9, y: 0.4 }));
      expect(env.hazards).toHaveLength(1);
      expect(env.hazards[0]).toMatchObject({
        gameId: 'g1',
        hazardInstanceId: 'h-wall',
        target: { orientation: 'vertical' },
      });
      expect(env.hazards[0]!.target!.x).toBeCloseTo(4.4);
      await flush();
      expect(env.controller.getSnapshot().placement).toBeNull();
    });

    it('알과 겹치거나 판 밖이거나 기존 벽과 겹치면 빨간 후보이고 보내지 않는다', () => {
      const env = setup(
        makeView({
          held: 'wall',
          effects: [
            {
              kind: 'wall',
              targetSeat: 1,
              startsAtMs: 900,
              expiresAtMs: 5000,
              params: { x: 8.8, y: 4.4, orientation: 'horizontal', angleDeg: 0 },
            },
          ],
        }),
      );
      env.controller.onKey('e');
      const at = (x: number, y: number) => {
        env.controller.onPointer(ptr('move', { x, y }));
        return env.controller.getSnapshot().placement!;
      };
      expect(at(0, -11.5).valid).toBe(false); // 알 위
      expect(at(22, 0).valid).toBe(false); // 판 밖(가로 벽이 삐져나감)
      expect(at(8.8, 4.4).valid).toBe(false); // 기존 벽
      expect(at(0, 0).valid).toBe(true);
      at(0, -11.5);
      env.controller.onPointer(ptr('down', { x: 0, y: -11.5 }));
      expect(env.hazards).toHaveLength(0);
      expect(env.controller.getSnapshot().placement).not.toBeNull();
    });

    it('끈끈이는 격자 없이 따라가며 방향 없이 보낸다', () => {
      const env = setup(makeView({ held: 'sticky' }));
      env.controller.onPointer(ptr('move', { x: 3.3, y: 1.7 }));
      env.controller.onKey('e');
      const p = env.controller.getSnapshot().placement!;
      expect(p).toMatchObject({ kind: 'sticky', x: 3.3, y: 1.7, valid: true });
      env.controller.onKey('r');
      env.controller.onPointer(ptr('down', { x: 3.3, y: 1.7 }));
      expect(env.hazards[0]!.target).toEqual({ x: 3.3, y: 1.7 });
    });

    it('ESC·오른쪽 클릭은 취소하며 아무것도 보내지 않는다', () => {
      const env = setup(makeView({ held: 'sticky' }));
      env.controller.onKey('e');
      env.controller.onKey('escape');
      expect(env.controller.getSnapshot().placement).toBeNull();
      env.controller.onKey('e');
      env.controller.onPointer(ptr('down', { x: 0, y: 0 }, null, 2));
      expect(env.controller.getSnapshot().placement).toBeNull();
      expect(env.hazards).toHaveLength(0);
    });

    it('배치 모드 중 왼쪽 클릭은 알 선택·충전으로 전달되지 않는다', () => {
      const env = setup(makeView({ held: 'sticky' }));
      env.controller.onKey('e');
      env.controller.onPointer(ptr('down', { x: -10, y: -11.5 }, 0)); // 알 위의 빨간 후보
      expect(env.controller.getSnapshot().aim).toBeNull();
      env.controller.onKey('escape');
      expect(env.controller.getSnapshot().aim).toBeNull(); // 선택되지 않았다
    });

    it('위치 거부(HAZARD_INVALID_TARGET)는 배치 모드를 유지하고 안내한다', async () => {
      const env = setup(makeView({ held: 'sticky' }));
      env.hazardResult = fail('HAZARD_INVALID_TARGET');
      env.controller.onKey('e');
      env.controller.onPointer(ptr('move', { x: 0, y: 0 }));
      env.controller.onPointer(ptr('down', { x: 0, y: 0 }));
      await flush();
      expect(env.controller.getSnapshot().placement).not.toBeNull();
      expect(env.controller.getSnapshot().notice).not.toBeNull();
    });

    it('보유 방해요소가 바뀌면 배치 모드를 접는다', () => {
      const env = setup(makeView({ held: 'sticky' }));
      env.controller.onKey('e');
      env.controller.setView(makeView({ held: 'wall' }));
      expect(env.controller.getSnapshot().placement).toBeNull();
    });
  });
});
