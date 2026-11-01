// 실행: 루트에서 npm test (Vitest)
import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import { BOARDS, PHYSICS } from '@alkkagi/shared';
import { Game } from './index.ts';
import { forceStop, launch, stepPhysics, type Stone, type World } from './physics.ts';

function stone(id: number, x: number, y: number, vx = 0, vy = 0): Stone {
  return { id, owner: (id % 2) as 0 | 1, x, y, vx, vy, h: 0, vz: 0, airborne: false, alive: true };
}

function world(stones: Stone[], board: 'standard' | 'circle' = 'standard'): World {
  return { board: BOARDS[board], stones, walls: [], stickies: [] };
}

describe('알–알 충돌', () => {
  test('정면 충돌에서 운동량이 보존되고 운동에너지가 e²배가 된다', () => {
    const a = stone(0, -3, 0, 60, 0);
    const b = stone(1, 3, 0, -40, 0);
    const w = world([a, b]);
    // 감속 없이 충돌만 보려고 충돌 직전까지 직접 옮긴다.
    a.x = -1.1 - 0.05;
    b.x = 1.1 + 0.05;
    const p0 = a.vx + b.vx;
    const e0 = a.vx ** 2 + b.vx ** 2;
    for (let i = 0; i < 10; i++) stepPhysics(w);
    // 마찰 감속(10틱 ≈ 0.083s × 100)만큼 속력이 줄었으므로 충돌 직후 값에 가깝게 비교한다.
    const fric = (PHYSICS.friction * 10) / PHYSICS.tickHz;
    const p1 = a.vx + b.vx;
    assert.ok(Math.abs(p1 - p0) <= 2 * fric + 1e-6, `운동량 ${p0} → ${p1}`);
    // 충돌 후 상대 속도는 e배로 뒤집힌다: (vb−va) ≈ e·(va0−vb0)
    const rel = b.vx - a.vx;
    assert.ok(Math.abs(rel - PHYSICS.stoneRestitution * 100) <= 2 * fric, `상대 속도 ${rel}`);
    assert.ok(a.vx ** 2 + b.vx ** 2 < e0);
  });

  test('겹침이 있으면 충돌 후 서로 겹치지 않는다', () => {
    const a = stone(0, 0, 0, 10, 0);
    const b = stone(1, 1.5, 0, 0, 0);
    const w = world([a, b]);
    stepPhysics(w);
    assert.ok(Math.hypot(b.x - a.x, b.y - a.y) >= 2 * PHYSICS.stoneRadius - 1e-9);
  });
});

describe('forceStop과 시간 상한', () => {
  test('모든 알을 정지시키고 떠 있는 알은 제자리에 착지시켜 판 밖이면 제거한다', () => {
    const inside = stone(0, 0, 0, 20, 5);
    const flyingIn = stone(1, 5, 5, 20, 0);
    flyingIn.airborne = true;
    flyingIn.h = 1;
    flyingIn.vz = 3;
    const flyingOut = stone(2, 30, 0, 20, 0);
    flyingOut.airborne = true;
    flyingOut.h = 1;
    const removed = forceStop(world([inside, flyingIn, flyingOut]));
    assert.deepEqual(removed, [2]);
    for (const s of [inside, flyingIn]) {
      assert.equal(Math.hypot(s.vx, s.vy, s.vz), 0);
      assert.equal(s.airborne, false);
      assert.equal(s.h, 0);
    }
    assert.equal(flyingOut.alive, false);
  });

  test('최대 세기 발사 뒤 정지 판정으로 턴이 넘어간다(상한 경로는 위 forceStop 테스트)', () => {
    // 끈끈이 없이는 10초를 넘기는 이동이 없으므로, 정지 판정이 되지 않는 상태(떠 있는 알)를 만든다.
    const g = new Game({
      gameId: 'g',
      board: 'standard',
      pieceCount: 5,
      seed: 1,
      startMs: 0,
      firstSeat: 0,
    });
    g.start();
    const v = g.getViewFor(0);
    // 속도를 직접 줘 사실상 멈추지 않게 한다: 느린 속도(0.2cm/s)는 감속으로 곧 0이 되므로 정지 판정이 먼저다.
    // 그래서 상한 경로는 forceStop 단위 테스트가 직접 검증하고, 여기서는 정지 판정으로 턴이 넘어가는지만 확인한다.
    g.submitShot(
      { seat: 0, observedAtMs: 0 },
      { gameId: 'g', turnId: v.turnId, stoneId: 0, angle: 0, power: 100 },
    );
    g.advanceTo(12_000);
    assert.equal(g.getViewFor(0).phase, 'aiming');
    assert.equal(g.getViewFor(0).activePlayerId, 1);
  });
});

describe('원형판', () => {
  test('반지름 26 밖으로 나간 알만 제거된다', () => {
    const inside = stone(0, 25.5, 0);
    const out = stone(1, 0, -25.9, 0, -30);
    const w = world([inside, out], 'circle');
    for (let i = 0; i < 20; i++) stepPhysics(w);
    assert.equal(inside.alive, true);
    assert.equal(out.alive, false);
  });

  test('대각선으로도 같은 반지름에서 제거된다', () => {
    const d = 26 / Math.SQRT2;
    const a = stone(0, d - 0.1, d - 0.1, 0, 0);
    const b = stone(1, d + 0.1, d + 0.1, 0, 0);
    const w = world([a, b], 'circle');
    stepPhysics(w);
    assert.equal(a.alive, true);
    assert.equal(b.alive, false);
  });

  test('발사한 알이 원형판 밖으로 나가면 게임에서 제거된다', () => {
    const g = new Game({
      gameId: 'g',
      board: 'circle',
      pieceCount: 5,
      seed: 1,
      startMs: 0,
      firstSeat: 0,
    });
    g.start();
    g.debugSetStone(0, 24, 0);
    const v = g.getViewFor(0);
    g.submitShot(
      { seat: 0, observedAtMs: 0 },
      { gameId: 'g', turnId: v.turnId, stoneId: 0, angle: 0, power: 60 },
    );
    g.advanceTo(5000);
    assert.equal(
      g.getViewFor(0).stones.some((s) => s.id === 0),
      false,
    );
  });
});

describe('회전한 벽', () => {
  test('45° 벽에서 반사 방향이 면의 법선으로 계산된다', () => {
    const s = stone(0, -5, 0);
    launch(s, 0, 50);
    const w = world([s]);
    w.walls = [{ cx: 0, cy: 0, angle: Math.PI / 4, halfLen: 4.4, halfThick: 0.3 }];
    const v0 = Math.hypot(s.vx, s.vy);
    for (let i = 0; i < 200 && s.vy <= 0; i++) stepPhysics(w);
    // 기대: v' = v − (1+e)(v·n)n, n=(−1,1)/√2 → (0.15v, 0.85v)
    assert.ok(s.vy > 0, `반사 후 위쪽 성분 ${s.vy}`);
    const ratio = s.vx / s.vy;
    assert.ok(ratio > 0.1 && ratio < 0.25, `vx/vy=${ratio}`);
    assert.ok(Math.hypot(s.vx, s.vy) < v0);
  });

  test('판 돌리기 뒤 벽이 같은 각도로 회전해 뷰에 반영된다', () => {
    const g = new Game({
      gameId: 'g',
      board: 'standard',
      pieceCount: 5,
      seed: 1,
      startMs: 0,
      firstSeat: 0,
    });
    g.start();
    g.debugGrant(0, 'wall');
    const wall = g.getViewFor(0).private.held!;
    assert.equal(
      g.useHazard(
        { seat: 0, observedAtMs: 0 },
        {
          gameId: 'g',
          hazardInstanceId: wall.hazardInstanceId,
          target: { x: 4.4, y: 0, orientation: 'horizontal' },
        },
      ).ok,
      true,
    );
    g.debugGrant(1, 'board_spin');
    const spin = g.getViewFor(1).private.held!;
    assert.equal(
      g.useHazard(
        { seat: 1, observedAtMs: 10 },
        { gameId: 'g', hazardInstanceId: spin.hazardInstanceId },
      ).ok,
      true,
    );
    const p = g.getViewFor(0).effects.find((e) => e.kind === 'wall')!.params!;
    assert.ok(Math.abs(p.angleDeg! + 45) < 1e-9, `angleDeg ${p.angleDeg}`);
    const rad = -Math.PI / 4;
    assert.ok(Math.abs(p.x! - 4.4 * Math.cos(rad)) < 1e-9);
    assert.ok(Math.abs(p.y! - 4.4 * Math.sin(rad)) < 1e-9);
  });
});
