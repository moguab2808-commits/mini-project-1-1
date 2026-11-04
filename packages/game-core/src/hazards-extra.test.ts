// 추가 방해요소 10종과 턴 교체(DEC-055·057·058, IMPL-016). 실행: 루트에서 npm test
import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { HAZARD_TUNING, type HazardKind, type HazardUse, type Seat } from '@alkkagi/shared';
import { movingWallAt, isWallPlaceable } from './placement.ts';
import { rotate, makeWall, circleVsObb } from './geometry.ts';
import { BOARDS } from '@alkkagi/shared';
import { TestGame as Game } from './testing.ts';

const T0 = 1_000_000;
const env = (seat: Seat, t: number) => ({ seat, observedAtMs: t });

function mk(seed = 42): Game {
  const g = new Game({
    gameId: 'g1',
    board: 'standard',
    pieceCount: 5,
    seed,
    startMs: T0,
    firstSeat: 0,
  });
  g.start();
  g.drainEvents();
  return g;
}

type Target = HazardUse['target'];

function use(g: Game, seat: Seat, t: number, kind: HazardKind, target?: Target) {
  g.debugGrant(seat, kind);
  return again(g, seat, t, target);
}

function again(g: Game, seat: Seat, t: number, target?: Target) {
  const held = g.getViewFor(seat).private.held!;
  return g.useHazard(env(seat, t), {
    gameId: 'g1',
    hazardInstanceId: held.hazardInstanceId,
    ...(target ? { target } : {}),
  });
}

/** 지금 턴 주인이 쏜다 */
function shoot(g: Game, t: number, stoneId: number, angle: number, power: number) {
  const v = g.getViewFor(0);
  return g.submitShot(env(v.activePlayerId, t), {
    gameId: 'g1',
    turnId: v.turnId,
    stoneId,
    angle,
    power,
  });
}

/** 발사한 뒤 정지할 때까지 진행하며, 정지 직전(교체 전) 상태를 돌려준다 */
function runShot(g: Game, t: number, stoneId: number, angle: number, power: number) {
  assert.equal(shoot(g, t, stoneId, angle, power).ok, true);
  let last = g.debugState();
  for (let i = 0; i < 2000 && g.getViewFor(0).phase === 'moving'; i++) {
    last = g.debugState();
    t += 1000 / 120;
    g.advanceTo(t);
  }
  return { t, before: last, after: g.debugState() };
}

const stoneOf = (st: ReturnType<Game['debugState']>, id: number) =>
  st.stones.find((s) => s.id === id)!;

/** 0번 좌석 알 2(0, −11.5)만 남기고 나머지는 멀리 둔다. 상대 알 하나는 남겨 경기가 끝나지 않게 한다 */
function clearLane(g: Game): void {
  for (const id of [0, 1, 3, 4]) g.debugSetStone(id, -20 + id * 2, -20);
  for (const id of [5, 6, 7, 8, 9]) g.debugSetStone(id, -20 + (id - 5) * 3, 20);
}

const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? 'OK' : r.error!.code);

describe('턴 교체와 사용 제한', () => {
  test('라운드가 바뀌면 설치물·효과가 두 좌석 모두 사라진다(DEC-067)', () => {
    const g = mk();
    assert.equal(code(use(g, 0, T0, 'magnet', { x: -12, y: 12 })), 'OK');
    assert.equal(code(use(g, 1, T0 + 1, 'ice_floor', { x: 8, y: -8 })), 'OK');
    assert.equal(g.getViewFor(0).effects.length, 2);
    clearLane(g);
    const first = runShot(g, T0 + 10, 2, Math.PI / 2, 1);
    assert.equal(g.getViewFor(0).effects.length, 2, '라운드 첫 턴이 끝날 때는 이어진다');
    runShot(g, first.t, 5, -Math.PI / 2, 1);
    assert.equal(g.getViewFor(0).effects.length, 0);
    assert.equal(g.getViewFor(1).effects.length, 0);
  });

  test('턴당 1회형은 두 번째 사용이 HAZARD_NOT_USABLE이고 상태·난수를 바꾸지 않는다', () => {
    const g = mk();
    assert.equal(code(use(g, 0, T0, 'ice_floor', { x: 0, y: 0 })), 'OK');
    const v = g.getViewFor(0);
    assert.equal(v.private.usable, false);
    assert.equal(v.private.fatigueGauge, null);
    assert.equal(v.private.cooldownEndsAtMs, null);
    const before = { view: JSON.stringify(g.getViewFor(0)), prng: g.debugPrngStates() };
    assert.equal(code(again(g, 0, T0, { x: 0, y: 0 })), 'HAZARD_NOT_USABLE');
    assert.deepEqual({ view: JSON.stringify(g.getViewFor(0)), prng: g.debugPrngStates() }, before);
  });

  test('쿨타임형 추가 종류는 20초 쿨타임이다', () => {
    const g = mk();
    assert.equal(code(use(g, 0, T0, 'pit', { x: 0, y: 0 })), 'OK');
    assert.equal(g.getViewFor(0).private.cooldownEndsAtMs, T0 + 20000);
    assert.equal(code(again(g, 0, T0 + 9000, { x: 10, y: 0 })), 'HAZARD_COOLDOWN');
  });

  test('target 형식이 종류와 맞지 않으면 INVALID_INPUT이다', () => {
    const g = mk();
    assert.equal(
      code(use(g, 0, T0, 'magnet', { x: 0, y: 0, orientation: 'vertical' })),
      'INVALID_INPUT',
    );
    assert.equal(code(use(g, 0, T0, 'magnet')), 'INVALID_INPUT');
    assert.equal(code(use(g, 0, T0, 'ice_floor')), 'INVALID_INPUT');
    assert.equal(
      code(use(g, 0, T0, 'ice_floor', { x: 0, y: 0, orientation: 'vertical' })),
      'INVALID_INPUT',
    );
    assert.equal(code(use(g, 0, T0, 'gravity_zone', { x: 0, y: 0 })), 'INVALID_INPUT');
    assert.equal(code(use(g, 0, T0, 'moving_wall', { x: 0, y: 0 })), 'INVALID_INPUT');
    assert.equal(code(use(g, 0, T0, 'decoy', { x: 0, y: 0 })), 'INVALID_INPUT');
  });
});

describe('배치 거부 (DEC-057)', () => {
  test('다른 설치물과 겹치면 거부되고 상태·난수를 바꾸지 않는다', () => {
    const g = mk();
    assert.equal(code(use(g, 0, T0, 'wall', { x: 0, y: 0, orientation: 'horizontal' })), 'OK');
    g.debugGrant(1, 'magnet');
    const before = { v: JSON.stringify(g.getViewFor(1)), p: g.debugPrngStates() };
    assert.equal(code(again(g, 1, T0, { x: 3, y: 2 })), 'HAZARD_INVALID_TARGET');
    assert.deepEqual({ v: JSON.stringify(g.getViewFor(1)), p: g.debugPrngStates() }, before);
    assert.equal(code(again(g, 1, T0, { x: 0, y: 12 })), 'OK', '겹치지 않는 자리는 된다');
  });

  test('폭탄·구멍은 알과 겹치면 거부, 영역형·이동 장애물 경로는 알과 겹쳐도 된다', () => {
    const g = mk();
    // 알 2는 (0, −11.5)
    assert.equal(code(use(g, 0, T0, 'mine', { x: 0, y: -11 })), 'HAZARD_INVALID_TARGET');
    assert.equal(code(use(g, 0, T0, 'pit', { x: 1, y: -11 })), 'HAZARD_INVALID_TARGET');
    assert.equal(code(use(g, 0, T0, 'reverse_zone', { x: 0, y: -11 })), 'OK');
    assert.equal(
      code(use(g, 1, T0, 'moving_wall', { x: 0, y: 11, orientation: 'horizontal' })),
      'OK',
    );
  });

  test('판 밖으로 나가는 자리는 거부된다', () => {
    const g = mk();
    assert.equal(code(use(g, 0, T0, 'magnet', { x: 16, y: 0 })), 'HAZARD_INVALID_TARGET');
    assert.equal(
      code(use(g, 0, T0, 'moving_wall', { x: 0, y: 15.4, orientation: 'vertical' })),
      'HAZARD_INVALID_TARGET',
    );
  });
});

describe('힘을 주는 설치물', () => {
  function straightShot(setup?: (g: Game) => void, power = 20) {
    const g = mk();
    clearLane(g);
    setup?.(g);
    return runShot(g, T0 + 10, 2, Math.PI / 2, power).before;
  }

  test('자석: 지나가는 알이 자석 쪽으로 휜다', () => {
    const plain = stoneOf(straightShot(), 2);
    const bent = stoneOf(
      straightShot((g) => use(g, 1, T0, 'magnet', { x: 6, y: -2 })),
      2,
    );
    assert.ok(Math.abs(plain.x) < 1e-9);
    assert.ok(bent.x > 0.5, `자석 쪽(+x)으로 휜다: ${bent.x}`);
  });

  test('중력 구역: 방향을 45° 단위로 반올림하고 그 방향으로 민다', () => {
    let dir = NaN;
    const st = straightShot((g) => {
      assert.equal(code(use(g, 1, T0, 'gravity_zone', { x: 0, y: 0, directionRad: 0.3 })), 'OK');
      dir = g.getViewFor(0).effects[0]!.params!.directionRad!;
    });
    assert.equal(dir, 0);
    assert.ok(stoneOf(st, 2).x > 0.5);
  });

  test('미끄럼 장판: 원 안을 지나는 알은 같은 세기로 더 멀리 간다(DEC-071)', () => {
    const plain = stoneOf(straightShot(undefined, 10), 2);
    let params: unknown;
    const ice = stoneOf(
      straightShot((g) => {
        assert.equal(code(use(g, 1, T0, 'ice_floor', { x: 0, y: -2 })), 'OK');
        params = g.getViewFor(0).effects[0]!.params;
      }, 10),
      2,
    );
    assert.deepEqual(params, { x: 0, y: -2 });
    const d0 = plain.y + 11.5;
    const d1 = ice.y + 11.5;
    // 끝까지 원 안(반지름 13.2, y −15.2~11.2)에서 미끄러진다
    assert.ok(ice.y < -2 + HAZARD_TUNING.iceFloorDiameter / 2, `${ice.y}`);
    assert.ok(Math.abs(d1 / d0 - 1 / HAZARD_TUNING.iceFrictionMultiplier) < 0.15, `${d0} → ${d1}`);
  });

  test('미끄럼 장판: 원 밖을 지나는 알은 그대로다', () => {
    const plain = stoneOf(straightShot(undefined, 10), 2);
    const away = stoneOf(
      straightShot((g) => assert.equal(code(use(g, 1, T0, 'ice_floor', { x: 9, y: 9 })), 'OK'), 10),
      2,
    );
    assert.equal(away.y, plain.y);
  });

  test('미끄럼 장판: 판 밖은 HAZARD_INVALID_TARGET이고, 다른 설치물과는 겹쳐도 된다(DEC-075)', () => {
    const g = mk();
    assert.equal(code(use(g, 0, T0, 'sticky', { x: -5, y: -5 })), 'OK');
    g.debugGrant(1, 'ice_floor');
    const before = { view: JSON.stringify(g.getViewFor(1)), prng: g.debugPrngStates() };
    // 판 밖(반 변 23 − 반지름 13.2 = 9.8 초과)
    assert.equal(code(again(g, 1, T0, { x: 10, y: 0 })), 'HAZARD_INVALID_TARGET');
    assert.deepEqual({ view: JSON.stringify(g.getViewFor(1)), prng: g.debugPrngStates() }, before);
    // 끈끈이 위에 겹쳐 놓을 수 있고, 그 뒤에도 미끄럼 장판 위에 다른 설치물을 놓을 수 있다
    assert.equal(code(again(g, 1, T0, { x: 0, y: 0 })), 'OK');
    assert.equal(code(use(g, 0, T0, 'magnet', { x: 12, y: 12 })), 'OK');
  });

  test('방향 반전: 구역에 들어온 알이 돌아간다(한 번만)', () => {
    const st = straightShot((g) => use(g, 1, T0, 'reverse_zone', { x: 0, y: -2 }));
    assert.ok(stoneOf(st, 2).y < -11.5, `되돌아갔다: ${stoneOf(st, 2).y}`);
  });

  test('폭탄: 움직이는 알이 닿으면 터져 주변 알을 밀고 exploded로 끝난다', () => {
    const g = mk();
    clearLane(g);
    g.debugSetStone(5, 3, -4);
    assert.equal(code(use(g, 1, T0, 'mine', { x: 0, y: -4 })), 'OK');
    g.drainEvents();
    const events: unknown[] = [];
    assert.equal(shoot(g, T0 + 10, 2, Math.PI / 2, 20).ok, true);
    let t = T0 + 10;
    let pushed = false;
    for (let i = 0; i < 2000 && g.getViewFor(0).phase === 'moving'; i++) {
      t += 1000 / 120;
      g.advanceTo(t);
      events.push(...g.drainEvents());
      if (stoneOf(g.debugState(), 5).x > 3.5) pushed = true;
    }
    assert.ok(pushed, '폭발 반경 안의 멈춘 알도 밀린다');
    const end = events.find(
      (e) =>
        (e as { type: string; payload: { kind: string; phase: string } }).type ===
          'hazard:triggered' &&
        (e as { payload: { kind: string } }).payload.kind === 'mine' &&
        (e as { payload: { phase: string } }).payload.phase === 'end',
    ) as { payload: { params: { exploded: boolean } } } | undefined;
    assert.equal(end?.payload.params.exploded, true);
  });

  test('구멍: 지면 알이 구멍을 지나면 떨어지고 진짜 남은 알 수가 준다', () => {
    const g = mk();
    clearLane(g);
    assert.equal(code(use(g, 1, T0, 'pit', { x: 0, y: -4 })), 'OK');
    const { after } = runShot(g, T0 + 10, 2, Math.PI / 2, 20);
    assert.equal(stoneOf(after, 2).alive, false);
    assert.deepEqual(g.getViewFor(1).stoneCounts, [4, 5]);
  });

  test('이동 장애물: 일정 속도로 ±진폭을 왕복하고 움직이는 알을 튕긴다', () => {
    const P = HAZARD_TUNING.movingWallPeriodMs;
    const A = HAZARD_TUNING.movingWallAmplitude;
    const at = (ms: number) => movingWallAt(0, 0, 0, 0, ms).wall.cy;
    assert.ok(Math.abs(at(0)) < 1e-9);
    assert.ok(Math.abs(at(P / 4) - A) < 1e-9);
    assert.ok(Math.abs(at(P / 2)) < 1e-9);
    assert.ok(Math.abs(at((3 * P) / 4) + A) < 1e-9);
    const plain = stoneOf(straightShot(undefined, 30), 2);
    const hit = stoneOf(
      straightShot(
        (g) => use(g, 1, T0, 'moving_wall', { x: 0, y: 0, orientation: 'vertical' }),
        30,
      ),
      2,
    );
    assert.ok(plain.y > 5);
    assert.ok(hit.y < plain.y - 5, `벽에 튕겼다: ${hit.y}`);
  });

  test('이동 장애물은 멈춘 알을 밀지 않는다', () => {
    const g = mk();
    clearLane(g);
    g.debugSetStone(5, 0, 0);
    assert.equal(code(use(g, 1, T0, 'moving_wall', { x: 0, y: 0, orientation: 'vertical' })), 'OK');
    const { before } = runShot(g, T0 + 10, 0, 0, 1);
    const s5 = stoneOf(before, 5);
    assert.deepEqual([s5.x, s5.y], [0, 0]);
  });
});

describe('속임수형 뷰 경계 (DEC-058)', () => {
  test('가짜벽: 양쪽 모두 같은 wall 3개를 받고 진짜 여부는 어디에도 없으며 1개만 충돌한다', () => {
    const g = mk();
    assert.equal(code(use(g, 0, T0, 'fake_wall', { x: 0, y: 0, orientation: 'horizontal' })), 'OK');
    const ev = g.drainEvents().filter((e) => e.type === 'hazard:triggered');
    assert.equal(ev.length, 3);
    assert.ok(
      ev.every(
        (e) => e.type === 'hazard:triggered' && e.payload.kind === 'wall' && !('toSeat' in e),
      ),
    );
    const a = g.getViewFor(0).effects;
    const b = g.getViewFor(1).effects;
    assert.equal(a.length, 3);
    assert.deepEqual(a, b);
    assert.ok(a.every((e) => e.kind === 'wall'));
    const json = JSON.stringify([a, b, ev]);
    for (const word of ['real', 'fake', 'fake_wall']) assert.equal(json.includes(word), false);
    assert.equal(g.debugState().walls.length, 1, '진짜 1개만 물리 벽');
  });

  test('가짜벽의 진짜는 클릭한 위치이며 세 벽은 동시에 생기고 순서로 진짜를 누설하지 않는다', () => {
    const g = mk(77);
    assert.equal(code(use(g, 0, T0, 'fake_wall', { x: 0, y: 0, orientation: 'horizontal' })), 'OK');
    assert.deepEqual(g.debugState().walls, [makeWall(0, 0, 'horizontal')]);
    const effects = g.debugState().effects.filter((e) => e.kind === 'wall');
    assert.equal(effects.length, 3);
    assert.equal(effects.filter((e) => !e.fake).length, 1);
    assert.equal(new Set(effects.map((e) => e.startsAtMs)).size, 1);
    assert.equal(new Set(effects.map((e) => e.expiresAtMs)).size, 1);
    const walls = effects.map((e) => e.wall!);
    const stones = g.debugState().stones.filter((stone) => stone.alive);
    walls.forEach((wall, i) =>
      assert.equal(
        isWallPlaceable(wall, {
          board: BOARDS.standard,
          stones,
          walls: walls.filter((_, j) => j !== i),
          stickies: [],
        }),
        true,
      ),
    );
    const publicWalls = g
      .getViewFor(1)
      .effects.filter((e) => e.kind === 'wall')
      .map((e) => [e.params!.x!, e.params!.y!]);
    assert.deepEqual(
      publicWalls,
      [...publicWalls].sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!),
    );
    assert.notDeepEqual(
      walls.slice(1).map((w) => [w.cx, w.cy]),
      [
        [0, -6.6],
        [0, 6.6],
      ],
    );
  });

  test('진짜 벽이 잘못된 위치면 부분 설치·쿨타임·상태·난수 소비 없이 실패한다', () => {
    const g = mk();
    g.debugGrant(0, 'fake_wall');
    g.drainEvents();
    const state = JSON.stringify([
      g.getViewFor(0),
      g.getViewFor(1),
      g.debugState(),
      g.debugPrngStates(),
    ]);
    for (const target of [
      { x: 22, y: 0, orientation: 'horizontal' as const },
      { x: 0, y: -11, orientation: 'horizontal' as const },
    ]) {
      assert.equal(code(again(g, 0, T0, target)), 'HAZARD_INVALID_TARGET');
      assert.equal(
        JSON.stringify([g.getViewFor(0), g.getViewFor(1), g.debugState(), g.debugPrngStates()]),
        state,
      );
      assert.deepEqual(g.drainEvents(), []);
    }
  });

  test('분신과 옮긴 진짜 알은 벽·구멍과 겹치지 않게 배치된다', () => {
    let placed = 0;
    for (let seed = 0; seed < 12; seed++) {
      const g = mk(seed);
      clearLane(g);
      assert.equal(code(use(g, 1, T0, 'pit', { x: 8, y: -11 })), 'OK');
      assert.equal(code(use(g, 1, T0, 'wall', { x: 0, y: -4.4, orientation: 'horizontal' })), 'OK');
      const result = use(g, 0, T0, 'decoy', { stoneId: 2 });
      if (!result.ok) continue;
      placed++;
      const view = g.getViewFor(0);
      const real = view.stones.find((s) => s.id === 2)!;
      const spots = [real, ...view.decoys!];
      assert.equal(spots.length, 3);
      for (const spot of spots) {
        assert.equal(circleVsObb(spot.x, spot.y, 1.1, makeWall(0, -4.4, 'horizontal')), null);
        assert.ok(Math.hypot(spot.x - 8, spot.y + 11) >= HAZARD_TUNING.pitDiameter / 2 + 1.1);
      }
    }
    assert.ok(placed > 0);
  });

  test('분신·실제 알·가짜벽 세 곳은 판 돌리기 때 같은 각도로 회전한다', () => {
    const g = mk(99);
    clearLane(g);
    assert.equal(code(use(g, 0, T0, 'decoy', { stoneId: 2 })), 'OK');
    assert.equal(
      code(use(g, 1, T0, 'fake_wall', { x: 0, y: 4.4, orientation: 'horizontal' })),
      'OK',
    );
    const before = g.getViewFor(0);
    assert.equal(
      g.rotateBoard(env(0, T0), { gameId: 'g1', turnId: before.turnId, deltaDeg: 45 }).ok,
      true,
    );
    const after = g.getViewFor(0);
    const realBefore = before.stones.find((s) => s.id === 2)!;
    const realAfter = after.stones.find((s) => s.id === 2)!;
    const [realX, realY] = rotate(realBefore.x, realBefore.y, Math.PI / 4);
    assert.ok(Math.abs(realAfter.x - realX) < 1e-9 && Math.abs(realAfter.y - realY) < 1e-9);
    for (const original of before.decoys!) {
      const moved = after.decoys!.find((d) => d.decoyId === original.decoyId)!;
      const [x, y] = rotate(original.x, original.y, Math.PI / 4);
      assert.ok(Math.abs(moved.x - x) < 1e-9 && Math.abs(moved.y - y) < 1e-9);
    }
    before.effects
      .filter((e) => e.kind === 'wall')
      .forEach((e, i) => {
        const moved = after.effects.filter((next) => next.kind === 'wall')[i]!;
        const [x, y] = rotate(e.params!.x!, e.params!.y!, Math.PI / 4);
        assert.ok(Math.abs(moved.params!.x! - x) < 1e-9 && Math.abs(moved.params!.y! - y) < 1e-9);
        assert.equal(moved.params!.angleDeg, e.params!.angleDeg! + 45);
      });
  });

  test('분신술: 시전자는 decoys로, 상대는 일반 알로 받고 상대에게는 안내가 없다', () => {
    const g = mk();
    clearLane(g);
    assert.equal(code(use(g, 0, T0, 'decoy', { stoneId: 2 })), 'OK');
    const ev = g.drainEvents().filter((e) => e.type === 'hazard:triggered');
    assert.equal(ev.length, 1);
    assert.equal(ev[0]!.type === 'hazard:triggered' && ev[0]!.toSeat, 0, '시전자에게만');
    const mine = g.getViewFor(0);
    const theirs = g.getViewFor(1);
    assert.equal(mine.stones.length, 10);
    assert.equal(mine.decoys?.length, 2);
    assert.equal(theirs.stones.length, 12);
    assert.equal(theirs.decoys, undefined);
    assert.deepEqual(theirs.stoneCounts, [5, 5]);
    assert.equal(
      theirs.effects.some((e) => e.kind === 'decoy'),
      false,
    );
    const real = mine.stones.find((s) => s.id === 2)!;
    const d = Math.hypot(real.x, real.y + 11.5);
    assert.ok(
      d >= HAZARD_TUNING.decoyMinDistance - 1e-9 && d <= HAZARD_TUNING.decoyMaxDistance + 1e-9,
    );
    // 허상 id로 발사할 수 없다
    const fakeId = mine.decoys![0]!.decoyId;
    assert.equal(code(shoot(g, T0 + 1, fakeId, 0, 10)), 'INVALID_STONE');
    // 어느 알이든 허상에 닿으면 그 허상만 사라진다
    const target = mine.decoys![0]!;
    g.debugSetStone(5, target.x, target.y);
    const first = runShot(g, T0 + 2, 0, 0, 1);
    runShot(g, first.t, 6, -Math.PI / 2, 1);
    // 라운드 교체로 분신술이 끝났으므로 교체 전 마지막 판단은 이벤트 대신 상태로 본다
    assert.equal(g.getViewFor(1).stones.length, 10, '교체 뒤 허상이 모두 사라진다');
  });

  test('분신술 허상은 닿으면 사라지고 나머지는 남는다', () => {
    const g = mk();
    clearLane(g);
    use(g, 0, T0, 'decoy', { stoneId: 2 });
    const [d0, d1] = g.getViewFor(0).decoys!;
    g.debugSetStone(5, d0!.x, d0!.y);
    // 다른 알을 약하게 쳐서 한 틱 이상 움직이는 동안의 정리를 본다
    assert.equal(shoot(g, T0 + 1, 0, 0, 1).ok, true);
    g.advanceTo(T0 + 30);
    const left = g.getViewFor(0).decoys ?? [];
    assert.deepEqual(
      left.map((d) => d.decoyId),
      [d1!.decoyId],
    );
  });

  test('분신술 거부: 상대 알·없는 알은 HAZARD_INVALID_TARGET이고 난수를 바꾸지 않는다', () => {
    const g = mk();
    g.debugGrant(0, 'decoy');
    const p = g.debugPrngStates();
    assert.equal(code(again(g, 0, T0, { stoneId: 5 })), 'HAZARD_INVALID_TARGET');
    assert.equal(code(again(g, 0, T0, { stoneId: 99 })), 'HAZARD_INVALID_TARGET');
    assert.deepEqual(g.debugPrngStates(), p);
    assert.equal(g.getViewFor(0).private.usable, true, '거부는 턴당 1회를 소모하지 않는다');
  });

  test('알 무게 변화: 상대 뷰·이벤트에 없고, 맞은 내 알이 덜 밀린다', () => {
    const push = (heavy: boolean) => {
      const g = mk();
      clearLane(g);
      g.debugSetStone(5, 0, -5);
      if (heavy) {
        assert.equal(code(use(g, 1, T0, 'heavy_stones')), 'OK');
        const ev = g.drainEvents().filter((e) => e.type === 'hazard:triggered');
        assert.equal(ev.length === 1 && ev[0]!.type === 'hazard:triggered' && ev[0]!.toSeat, 1);
        const opp = g.getViewFor(0);
        assert.equal(JSON.stringify(opp).includes('heavy'), false);
        assert.equal(
          g.getViewFor(1).effects.some((e) => e.kind === 'heavy_stones'),
          true,
        );
      }
      return stoneOf(runShot(g, T0 + 10, 2, Math.PI / 2, 30).before, 5).y + 5;
    };
    const light = push(false);
    const heavy = push(true);
    assert.ok(heavy < light * 0.7, `${light} → ${heavy}`);
  });

  test('같은 시드·같은 명령이면 결과가 같다', () => {
    const run = () => {
      const g = mk(99);
      clearLane(g);
      use(g, 0, T0, 'decoy', { stoneId: 2 });
      use(g, 1, T0, 'fake_wall', { x: 0, y: 4.4, orientation: 'horizontal' });
      use(g, 1, T0 + 1, 'magnet', { x: -8, y: 12 });
      const v = g.getViewFor(0);
      runShot(g, T0 + 10, v.stones.find((s) => s.id === 2)!.id, Math.PI / 2, 40);
      return JSON.stringify([g.getViewFor(0), g.getViewFor(1), g.debugState().stones]);
    };
    assert.equal(run(), run());
  });
});
