import { describe, expect, it } from 'vitest';
import type {
  AimUpdate,
  BoardRotate,
  CommandResult,
  GameStart,
  GameView,
  HazardAim,
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
  rotations: BoardRotate[];
  hazardAims: HazardAim[];
  poses: AimUpdate[];
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
    rotations: [],
    hazardAims: [],
    poses: [],
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
    rotateBoard: (cmd) => {
      env.rotations.push(cmd);
      return Promise.resolve(OK);
    },
    aimHazard: (cmd) => env.hazardAims.push(cmd),
    sendAim: (update) => env.poses.push(update),
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
  aimPoint: BoardPointerEvent['aimPoint'] = null,
): BoardPointerEvent => ({ type, point, aimPoint, stoneId, button });

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
  it('활성 시간 동안 조준 각도를 초당 120도씩 바람 방향으로 돌린다', () => {
    const env = setup(
      makeView({
        effects: [
          {
            kind: 'wind',
            targetSeat: 0,
            startsAtMs: 1000,
            expiresAtMs: 2000,
            params: { directionRad: (170 * Math.PI) / 180 },
          },
        ],
      }),
    );
    selectStone0(env); // 각도 0
    expect(env.controller.getSnapshot().aim?.angle).toBeCloseTo(0);
    run(env, 1000); // 1초 동안 약 120도(만료 시각 경계의 마지막 한 걸음은 제외)
    const deg = (env.controller.getSnapshot().aim!.angle * 180) / Math.PI;
    expect(deg).toBeGreaterThan(112);
    expect(deg).toBeLessThanOrEqual(120);
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
  const IMMEDIATE: HazardKind[] = ['board_spin', 'desk_shake', 'stun'];

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

    const shake = makeView({ held: 'desk_shake' });
    const hot = setup({
      ...shake,
      private: { ...shake.private, fatigueGauge: 100, overheated: true, usable: false },
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

const deg = (rad: number) => (rad * 180) / Math.PI;

describe('손이 닿는 거리', () => {
  /** 좌석 0 기준점 (0, −30). 알 5는 거리 42(닿지 않음), 알 6은 거리 33(strain 0.5) */
  const farView = (patch: Partial<GameView> = {}) =>
    makeView({
      deadlineMs: 60000,
      stones: [
        { id: 0, ownerId: 0, x: -10, y: -11.5, h: 0 },
        { id: 5, ownerId: 0, x: 0, y: 12, h: 0 },
        { id: 6, ownerId: 0, x: 0, y: 3, h: 0 },
        { id: 2, ownerId: 1, x: 10, y: 11.5, h: 0 },
      ],
      ...patch,
    });

  it('가까운 알은 reachable·strain 0이고 흔들림이 없다', () => {
    const env = setup(farView());
    selectStone0(env);
    const snap = env.controller.getSnapshot();
    expect(snap.aim).toMatchObject({ reachable: true, strain: 0 });
    expect(snap.shake).toBe(0);
    expect(snap.hint).toBeNull();
  });

  it('닿지 않는 알은 회색 조준(reachable false)과 안내를 보이고, 놓아도 발사하지 않는다', () => {
    const env = setup(farView());
    env.controller.onPointer(ptr('down', { x: 0, y: 12 }, 5));
    env.controller.onPointer(ptr('move', { x: 10, y: 12 }));
    const snap = env.controller.getSnapshot();
    expect(snap.aim).toMatchObject({ stoneId: 5, reachable: false, strain: 1 });
    expect(snap.hint).toBe('손이 안 닿아요 — 판을 돌려 보세요');
    env.controller.onPointer(ptr('down', { x: 10, y: 12 }));
    run(env, 500);
    env.controller.onPointer(ptr('up', { x: 10, y: 12 }));
    expect(env.shots).toHaveLength(0);
    expect(env.controller.getSnapshot().aim).toMatchObject({ stoneId: 5, charging: false });
  });

  it('먼 알(strain>0)은 조준 각도가 시간에 따라 최대 strain×4도 안에서 떨리고 화면이 흔들린다', () => {
    const env = setup(farView());
    env.controller.onPointer(ptr('down', { x: 0, y: 3 }, 6));
    env.controller.onPointer(ptr('move', { x: 10, y: 3 })); // 마우스 각도 0
    const angles: number[] = [];
    for (let i = 0; i < 20; i++) {
      run(env, 50);
      angles.push(deg(env.controller.getSnapshot().aim!.angle));
    }
    const snap = env.controller.getSnapshot();
    expect(snap.aim!.strain).toBeCloseTo(0.5);
    expect(snap.aim!.reachable).toBe(true);
    expect(Math.max(...angles.map(Math.abs))).toBeLessThanOrEqual(2 + 1e-9);
    expect(new Set(angles.map((a) => a.toFixed(4))).size).toBeGreaterThan(5);
    expect(snap.shake).toBeGreaterThan(0);
    // 발사 각도에도 떨림이 반영된다(표시 각도와 같다)
    env.controller.onPointer(ptr('down', { x: 10, y: 3 }));
    run(env, 500);
    const shown = env.controller.getSnapshot().aim!.angle;
    env.controller.onPointer(ptr('up', { x: 10, y: 3 }));
    expect(env.shots[0]!.angle).toBeCloseTo(shown, 10);
  });
});

describe('흔들림', () => {
  it('내게 걸린 바람·책상 흔들기 중 shake가 생기고, 값은 원인별 최댓값이다', () => {
    const wind = setup(
      makeView({
        effects: [
          {
            kind: 'wind',
            targetSeat: 0,
            startsAtMs: 1000,
            expiresAtMs: 2000,
            params: { directionRad: 0 },
          },
        ],
      }),
    );
    run(wind, 100);
    expect(wind.controller.getSnapshot().shake).toBeGreaterThan(0);
    run(wind, 1000);
    expect(wind.controller.getSnapshot().shake).toBe(0);

    const other = setup(
      makeView({
        effects: [
          {
            kind: 'wind',
            targetSeat: 1,
            startsAtMs: 1000,
            expiresAtMs: 2000,
            params: { directionRad: 0 },
          },
        ],
      }),
    );
    run(other, 100);
    expect(other.controller.getSnapshot().shake).toBe(0);

    // 책상 흔들기는 대상과 관계없이 양쪽 화면을 흔들고 조준 각도도 떨린다
    const desk = setup(
      makeView({
        effects: [
          {
            kind: 'desk_shake',
            targetSeat: 1,
            startsAtMs: 1000,
            expiresAtMs: 1500,
            params: {},
          },
          {
            kind: 'wind',
            targetSeat: 0,
            startsAtMs: 1000,
            expiresAtMs: 1500,
            params: { directionRad: 0 },
          },
        ],
      }),
    );
    selectStone0(desk);
    const angles: number[] = [];
    for (let i = 0; i < 6; i++) {
      run(desk, 50);
      angles.push(desk.controller.getSnapshot().aim!.angle);
    }
    expect(desk.controller.getSnapshot().shake).toBe(1);
    expect(new Set(angles.map((a) => a.toFixed(5))).size).toBeGreaterThan(3);
    run(desk, 500);
    expect(desk.controller.getSnapshot().shake).toBe(0);
    expect(desk.controller.getSnapshot().aim!.angle).toBeCloseTo(0, 10);
  });
});

describe('기본 판 돌리기', () => {
  it('누르는 동안 초당 90도를 약 20Hz로 나눠 보낸다(A·← 양수, D·→ 음수)', () => {
    const env = setup();
    env.controller.pressRotate('KeyA', 1);
    run(env, 1000);
    expect(env.controller.getSnapshot().pose).toEqual({ mode: 'rotate' });
    env.controller.releaseRotate('KeyA');
    const total = env.rotations.reduce((s, r) => s + r.deltaDeg, 0);
    expect(total).toBeCloseTo(90, 5);
    expect(env.rotations.length).toBeGreaterThanOrEqual(18);
    expect(env.rotations.length).toBeLessThanOrEqual(21);
    expect(env.rotations.every((r) => r.gameId === 'g1' && r.turnId === 1 && r.deltaDeg > 0)).toBe(
      true,
    );
    expect(env.controller.getSnapshot().pose).toEqual({ mode: 'idle' });

    env.rotations.length = 0;
    env.controller.pressRotate('btn-cw', -1);
    run(env, 500);
    env.controller.releaseRotate('btn-cw');
    expect(env.rotations.reduce((s, r) => s + r.deltaDeg, 0)).toBeCloseTo(-45, 5);
  });

  it('놓을 때 남은 회전량을 바로 보내고, 반대 방향을 함께 누르면 멈춘다', () => {
    const env = setup();
    env.controller.pressRotate('KeyA', 1);
    run(env, 50);
    env.t += 30;
    env.controller.releaseRotate('KeyA'); // 30ms 분량(2.7도)을 즉시 보낸다
    expect(env.rotations.reduce((s, r) => s + r.deltaDeg, 0)).toBeCloseTo(4.5 + 2.7, 5);

    env.rotations.length = 0;
    env.controller.pressRotate('KeyA', 1);
    env.controller.pressRotate('KeyD', -1);
    run(env, 500);
    expect(env.rotations).toHaveLength(0);
  });

  it('상대 턴·기절·충전 중·배치 모드·들기 모드에서는 돌리지 않는다', () => {
    const cases: Env[] = [];
    cases.push(setup(makeView({ activePlayerId: 1 })));
    cases.push(
      setup(
        makeView({
          effects: [{ kind: 'stun', targetSeat: 0, startsAtMs: 900, expiresAtMs: 9000 }],
        }),
      ),
    );
    cases.push(setup(makeView({ phase: 'moving' })));
    const charging = setup();
    selectStone0(charging);
    charging.controller.onPointer(ptr('down', { x: 0, y: -11.5 }));
    cases.push(charging);
    const placing = setup(makeView({ held: 'sticky' }));
    placing.controller.onKey('e');
    cases.push(placing);
    const holding = setup(makeView({ held: 'flashlight' }));
    holding.controller.onKey('e');
    cases.push(holding);

    for (const env of cases) {
      expect(env.controller.getSnapshot().canRotate).toBe(false);
      env.controller.pressRotate('KeyA', 1);
      run(env, 300);
      env.controller.releaseRotate('KeyA');
      expect(env.rotations).toHaveLength(0);
      expect(env.controller.getSnapshot().pose.mode).not.toBe('rotate');
    }
  });

  it('거부 응답은 조용히 무시한다', async () => {
    const env = setup();
    const rejected: BoardRotate[] = [];
    // 거부를 돌려주는 세션으로 바꿔 끼운다
    const actions = (env.controller as unknown as { actions: { rotateBoard: unknown } }).actions;
    actions.rotateBoard = (cmd: BoardRotate) => {
      rejected.push(cmd);
      return Promise.resolve(fail('BOARD_ROTATE_NOT_ALLOWED'));
    };
    env.controller.pressRotate('ArrowLeft', 1);
    run(env, 200);
    await flush();
    expect(rejected.length).toBeGreaterThan(0);
    expect(env.controller.getSnapshot().notice).toBeNull();
  });
});

describe('후레쉬·물총 들기', () => {
  const face = { x: 0, y: 30, h: 24 };

  it('E로 들고, 왼쪽 클릭으로 조준점에 발동한 뒤 효과가 활성인 동안 조준점을 약 20Hz로 보낸다', async () => {
    const env = setup(makeView({ held: 'flashlight', deadlineMs: 60000 }));
    env.controller.onPointer(ptr('move', { x: 0, y: 5 }, null, 0, { x: 1, y: 30, h: 20 }));
    env.controller.onKey('e');
    let snap = env.controller.getSnapshot();
    expect(snap.holding).toEqual({ kind: 'flashlight', fired: false });
    expect(snap.hint).toBe('클릭해서 발동, ESC 취소');
    expect(snap.pose).toEqual({
      mode: 'hold_hazard',
      kind: 'flashlight',
      target: { x: 1, y: 30, h: 20 },
    });
    expect(env.hazards).toHaveLength(0);

    env.controller.onPointer(ptr('down', { x: 0, y: 5 }, null, 0, face));
    expect(env.hazards).toEqual([{ gameId: 'g1', hazardInstanceId: 'h-flashlight', target: face }]);
    await flush();
    snap = env.controller.getSnapshot();
    expect(snap.holding).toEqual({ kind: 'flashlight', fired: true });
    expect(snap.hint).toBe('마우스로 상대 얼굴을 겨누세요');

    // 권한 측이 효과를 시작한다(상대가 대상)
    env.controller.setView(
      makeView({
        deadlineMs: 60000,
        effects: [
          {
            kind: 'flashlight',
            targetSeat: 1,
            startsAtMs: 1000,
            expiresAtMs: 5000,
            params: { aimX: 0, aimY: 30, aimH: 24, coverage: 0 },
          },
        ],
      }),
    );
    // 매 프레임(약 16ms) 조준점을 옮겨도 50ms 간격으로만 보낸다
    for (let i = 0; i < 60; i++) {
      env.t += 16;
      env.controller.onPointer(ptr('move', null, null, 0, { x: i * 0.1, y: 30, h: 24 }));
      env.controller.tick();
    }
    expect(env.hazardAims.length).toBeGreaterThanOrEqual(16);
    expect(env.hazardAims.length).toBeLessThanOrEqual(21);
    expect(env.hazardAims.at(-1)).toMatchObject({
      gameId: 'g1',
      hazardInstanceId: 'h-flashlight',
      target: { y: 30, h: 24 },
    });
    // 발동 중 왼쪽 클릭은 알 선택·충전으로 가지 않는다
    env.controller.onPointer(ptr('down', { x: -10, y: -11.5 }, 0));
    expect(env.controller.getSnapshot().aim).toBeNull();
    expect(env.hazards).toHaveLength(1);
    // ESC는 발동 뒤에는 취소하지 않는다
    env.controller.onKey('escape');
    expect(env.controller.getSnapshot().holding?.fired).toBe(true);

    // 효과가 끝나면 들기 상태를 접고 더 보내지 않는다
    env.t = 5100;
    env.controller.tick();
    expect(env.controller.getSnapshot().holding).toBeNull();
    const sent = env.hazardAims.length;
    env.t += 100;
    env.controller.onPointer(ptr('move', null, null, 0, { x: 5, y: 30, h: 24 }));
    env.controller.tick();
    expect(env.hazardAims).toHaveLength(sent);
  });

  it('조준점이 없으면 상대 얼굴 위치를 기본 조준점으로 쓴다', () => {
    const env = setup(makeView({ held: 'water_gun' }));
    env.controller.onSlotClick();
    env.controller.onPointer(ptr('down', { x: 0, y: 0 }));
    expect(env.hazards[0]!.target).toEqual(face);
  });

  it('발동 전 ESC·오른쪽 클릭은 취소하고 아무것도 보내지 않는다', () => {
    const env = setup(makeView({ held: 'water_gun' }));
    env.controller.onKey('e');
    env.controller.onKey('escape');
    expect(env.controller.getSnapshot().holding).toBeNull();
    env.controller.onKey('e');
    env.controller.onPointer(ptr('down', { x: 0, y: 0 }, null, 2));
    expect(env.controller.getSnapshot().holding).toBeNull();
    expect(env.hazards).toHaveLength(0);
    expect(env.hazardAims).toHaveLength(0);
  });

  it('들고 있는 동안 왼쪽 클릭은 알 선택·충전으로 가지 않고 발동만 한다', () => {
    const env = setup(makeView({ held: 'flashlight' }));
    selectStone0(env);
    env.controller.onKey('e');
    expect(env.controller.getSnapshot().aim).toBeNull();
    env.controller.onPointer(ptr('down', { x: -10, y: -11.5 }, 0, 0, face));
    run(env, 500);
    env.controller.onPointer(ptr('up', { x: -10, y: -11.5 }, 0));
    expect(env.shots).toHaveLength(0);
    expect(env.hazards).toHaveLength(1);
  });

  it('충전 중에는 들기 모드로 들어가지 않는다', () => {
    const env = setup(makeView({ held: 'flashlight' }));
    selectStone0(env);
    env.controller.onPointer(ptr('down', { x: 0, y: -11.5 }));
    env.controller.onKey('e');
    expect(env.controller.getSnapshot().holding).toBeNull();
    expect(env.controller.getSnapshot().aim?.charging).toBe(true);
  });

  it('발동 거부는 들기 상태를 접고 안내한다', async () => {
    const env = setup(makeView({ held: 'flashlight' }));
    env.hazardResult = fail('HAZARD_OVERHEATED');
    env.controller.onKey('e');
    env.controller.onPointer(ptr('down', { x: 0, y: 0 }, null, 0, face));
    await flush();
    expect(env.controller.getSnapshot().holding).toBeNull();
    expect(env.controller.getSnapshot().notice).not.toBeNull();
  });
});

describe('몸짓 중계', () => {
  it('몸짓이 바뀔 때 최대 20Hz로 aim:update를 보낸다', () => {
    const env = setup();
    env.controller.tick();
    expect(env.poses.at(-1)).toEqual({ gameId: 'g1', mode: 'idle' });
    env.t += 60;
    selectStone0(env); // 선택(각도 기본값) 직후 방향 변경은 50ms 뒤 tick에서 보낸다
    run(env, 50);
    expect(env.poses.at(-1)).toMatchObject({ gameId: 'g1', mode: 'aim', stoneId: 0 });
    expect(env.poses.at(-1)!.angle).toBeCloseTo(0);
    // 같은 몸짓은 다시 보내지 않는다
    const n = env.poses.length;
    run(env, 200);
    expect(env.poses).toHaveLength(n);
    // 충전 중에는 세기가 바뀌므로 계속 보내되 50ms 간격을 넘지 않는다
    env.controller.onPointer(ptr('down', { x: 0, y: -11.5 }));
    for (let i = 0; i < 60; i++) {
      env.t += 16;
      env.controller.tick();
    }
    const charge = env.poses.filter((p) => p.mode === 'charge');
    expect(charge.length).toBeGreaterThanOrEqual(16);
    expect(charge.length).toBeLessThanOrEqual(21);
    expect(charge.every((p) => p.power! >= 0 && p.power! <= 100)).toBe(true);
  });
});
