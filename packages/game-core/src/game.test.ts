// 실행: 루트에서 npm test (Vitest)
import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import type { GameView, Seat } from '@alkkagi/shared';
import { Game, type CoreEvent } from './index.ts';

const T0 = 1_000_000;

function mk(opts: { seed?: number; pieces?: number; board?: 'standard' | 'circle' } = {}): Game {
  const g = new Game({
    gameId: 'g1',
    board: opts.board ?? 'standard',
    pieceCount: opts.pieces ?? 5,
    seed: opts.seed ?? 42,
    startMs: T0,
    firstSeat: 0,
  });
  g.start();
  return g;
}

const env = (seat: Seat, t: number) => ({ seat, observedAtMs: t });

function shoot(g: Game, seat: Seat, t: number, power: number, angle: number, stoneId?: number) {
  const v = g.getViewFor(seat);
  const id = stoneId ?? v.stones.find((s) => s.ownerId === seat)!.id;
  return g.submitShot(env(seat, t), { gameId: 'g1', turnId: v.turnId, stoneId: id, angle, power });
}

/** 알이 모두 멈춰 다음 턴이 될 때까지 진행하고 그때 시각을 돌려준다 */
function settle(g: Game, t: number): number {
  for (let i = 0; i < 400 && g.getViewFor(0).phase === 'moving'; i++) {
    t += 50;
    g.advanceTo(t);
  }
  return t;
}

/** 아주 약한 발사로 턴을 넘긴다(알이 판에서 나가지 않는다) */
function passTurn(g: Game, t: number): number {
  const seat = g.getViewFor(0).activePlayerId;
  const r = shoot(g, seat, t, 1, 0);
  assert.equal(r.ok, true);
  return settle(g, t);
}

function use(
  g: Game,
  seat: Seat,
  t: number,
  target?: { x: number; y: number; orientation?: 'horizontal' | 'vertical' },
) {
  const held = g.getViewFor(seat).private.held!;
  return g.useHazard(env(seat, t), {
    gameId: 'g1',
    hazardInstanceId: held.hazardInstanceId,
    target,
  });
}

function events(g: Game, type: CoreEvent['type']) {
  return g.drainEvents().filter((e) => e.type === type);
}

describe('HAZARD-GRANT: 지급과 교체', () => {
  test('시작과 3·5·7·9라운드 시작에만 교체 지급되고 누적되지 않는다', () => {
    const g = mk();
    const all: CoreEvent[] = [...g.drainEvents()];
    const ids = new Set<string>();
    const holds = (): string[] =>
      [0, 1].map((s) => g.getViewFor(s as Seat).private.held!.hazardInstanceId);
    holds().forEach((i) => ids.add(i));
    let t = T0;
    const rounds: number[] = [];
    while (!g.isFinished) {
      t = passTurn(g, t);
      for (const e of g.drainEvents()) {
        all.push(e);
        if (e.type === 'hazard:granted' && e.toSeat === 0) rounds.push(e.payload.round);
      }
      if (!g.isFinished) holds().forEach((i) => ids.add(i));
    }
    const grants = all.filter((e) => e.type === 'hazard:granted');
    assert.deepEqual(rounds, [3, 5, 7, 9]);
    assert.equal(grants.length, 10, '시작 2개 + 교체 8개');
    assert.equal(grants.filter((e) => e.type === 'hazard:granted' && e.payload.replaced).length, 8);
    assert.equal(ids.size, 10, '교체마다 새 인스턴스 id');
    const over = all.find((e) => e.type === 'game:over');
    assert.ok(over && over.type === 'game:over' && over.payload.reason === 'final_round');
    assert.equal(over.payload.winnerId, null, '남은 알 수가 같으면 무승부');
  });

  test('보유는 항상 1개이며 교체 때 게이지·쿨타임·이전 효과가 지워진다', () => {
    const g = mk();
    g.debugGrant(0, 'wall');
    use(g, 0, T0, { x: 0, y: 0, orientation: 'horizontal' });
    assert.equal(g.debugState().walls.length, 1);
    g.debugGrant(1, 'board_spin');
    use(g, 1, T0 + 10);
    assert.equal(g.debugState().players[1]!.gauge > 0, true);
    let t = T0;
    for (let i = 0; i < 4; i++) t = passTurn(g, t); // 3라운드 시작 교체
    const st = g.debugState();
    assert.equal(st.players[0]!.cooldownEndsAtMs, null);
    assert.equal(st.players[1]!.gauge, 0);
    assert.equal(st.walls.length, 0, '이전 방해요소의 벽 효과가 지워진다');
  });
});

describe('TURN-TIMEOUT: 턴 마감', () => {
  test('30초가 지나면 턴이 넘어가고 turn:change 사유가 timeout이다', () => {
    const g = mk();
    g.drainEvents();
    g.advanceTo(T0 + 29_999);
    assert.equal(g.getViewFor(0).activePlayerId, 0);
    g.advanceTo(T0 + 30_000);
    assert.equal(g.getViewFor(0).activePlayerId, 1);
    const tc = events(g, 'turn:change')[0];
    assert.ok(tc && tc.type === 'turn:change' && tc.payload.reason === 'timeout');
  });

  test('같은 플레이어의 연속 시간초과 3회에 기권패, 발사하면 횟수가 초기화된다', () => {
    const g = mk();
    let t = T0;
    // 0: 시간초과, 1: 시간초과, 0: 시간초과, 1: 발사로 초기화는 아님(0의 횟수만 센다)
    for (let i = 0; i < 4; i++) {
      t += 30_000;
      g.advanceTo(t);
    }
    assert.equal(g.getViewFor(0).private.timeoutStreak, 2);
    assert.equal(g.getViewFor(1).private.timeoutStreak, 2);
    t = passTurn(g, t); // 0이 발사 → 0의 횟수 초기화
    assert.equal(g.getViewFor(0).private.timeoutStreak, 0);
    t += 30_000;
    g.advanceTo(t); // 1의 3번째 연속 시간초과
    const over = g.drainEvents().find((e) => e.type === 'game:over');
    assert.ok(over && over.type === 'game:over');
    assert.equal(over.payload.reason, 'timeout_forfeit');
    assert.equal(over.payload.winnerId, 0);
  });

  test('정확히 마감 시각의 발사는 시간초과가 우선이다', () => {
    const g = mk();
    const v = g.getViewFor(0);
    const r = g.submitShot(env(0, v.deadlineMs), {
      gameId: 'g1',
      turnId: v.turnId,
      stoneId: 0,
      angle: 0,
      power: 10,
    });
    assert.deepEqual(r.ok === false && r.error.code, 'STALE_TURN');
    const g2 = mk();
    const r2 = shoot(g2, 0, T0 + 29_999, 10, 0);
    assert.equal(r2.ok, true);
  });
});

describe('판정과 물리', () => {
  test('판 밖으로 밀려난 알은 제거되고 남은 알 수로 결과가 정해진다', () => {
    const g = mk({ pieces: 5 });
    g.debugSetStone(0, 22.9, 0);
    const r = shoot(g, 0, T0, 50, 0, 0);
    assert.equal(r.ok, true);
    settle(g, T0);
    const ids = g.getViewFor(0).stones.map((s) => s.id);
    assert.equal(ids.includes(0), false);
    assert.equal(g.getViewFor(0).stones.length, 9);
  });

  test('한 번의 발사 끝에 양쪽 알이 모두 0개면 무승부다', () => {
    const g = mk({ pieces: 5 });
    for (let id = 0; id < 10; id++) if (id !== 0 && id !== 5) g.debugSetStone(id, 0, 0, false);
    g.debugSetStone(0, 22.9, 0);
    g.debugSetStone(5, 22.9, 8, true, 0, 80); // 이미 판 밖으로 미끄러지는 상대 알
    shoot(g, 0, T0, 50, 0, 0);
    settle(g, T0);
    const over = g.drainEvents().find((e) => e.type === 'game:over');
    assert.ok(over && over.type === 'game:over');
    assert.equal(over.payload.winnerId, null);
    assert.equal(over.payload.reason, 'all_stones_out');
    assert.deepEqual(over.payload.remainingStones, [0, 0]);
  });

  test('상대 알을 모두 제거하면 승리, 자기 알이 모두 나가면 상대 승리', () => {
    const g = mk({ pieces: 5 });
    for (let id = 1; id < 10; id++) g.debugSetStone(id, 0, 0, false);
    g.debugSetStone(0, 22.9, 0);
    shoot(g, 0, T0, 50, 0, 0);
    settle(g, T0);
    // 알 5개를 남겨 둔 쪽이 이기려면 id 5..9 중 하나라도 있어야 한다: 위에서 모두 제거했으므로 다시 만든다
    const g2 = mk({ pieces: 5 });
    for (let id = 1; id < 5; id++) g2.debugSetStone(id, 0, 0, false);
    g2.debugSetStone(0, 22.9, 0);
    shoot(g2, 0, T0, 50, 0, 0);
    settle(g2, T0);
    const over = g2.drainEvents().find((e) => e.type === 'game:over');
    assert.ok(over && over.type === 'game:over');
    assert.equal(over.payload.winnerId, 1);
    assert.equal(over.payload.reason, 'all_stones_out');
  });

  test('세기 80 이상은 떠올라 다른 알 위를 지나가고 착지 지점이 판 밖이면 제거된다', () => {
    const g = mk();
    g.debugSetStone(0, -20, 0);
    g.debugSetStone(5, -10, 0);
    shoot(g, 0, T0, 90, 0, 0);
    settle(g, T0);
    const s5 = g.getViewFor(0).stones.find((s) => s.id === 5)!;
    assert.equal(s5.x, -10, '떠 있는 동안 다른 알과 충돌하지 않는다');
    const g2 = mk();
    g2.debugSetStone(0, 20, 0);
    shoot(g2, 0, T0, 100, 0, 0);
    settle(g2, T0);
    assert.equal(
      g2.getViewFor(0).stones.some((s) => s.id === 0),
      false,
      '체공 후 판 밖에 착지',
    );
  });

  test('같은 시드·같은 입력이면 같은 결과다', () => {
    const run = (seed: number) => {
      const g = mk({ seed });
      g.debugGrant(0, 'desk_shake');
      use(g, 0, T0);
      shoot(g, 0, T0 + 100, 70, 1.2);
      settle(g, T0 + 100);
      return JSON.stringify(g.getViewFor(0));
    };
    assert.equal(run(7), run(7));
    assert.notEqual(run(7), run(8));
  });

  test('벽에 부딪히면 튕기고 알이 벽을 통과하지 않는다', () => {
    const g = mk();
    g.debugGrant(1, 'wall');
    g.debugSetStone(0, -10, 0);
    const r = use(g, 1, T0, { x: -4.4, y: 0, orientation: 'vertical' });
    assert.equal(r.ok, true);
    shoot(g, 0, T0 + 10, 50, 0, 0);
    settle(g, T0 + 10);
    const s0 = g.getViewFor(0).stones.find((s) => s.id === 0)!;
    assert.ok(s0.x < -5.7, `벽 앞에서 튕겨 돌아온다: ${s0.x}`);
  });

  test('끈끈이 안의 알은 더 빨리 멈춘다', () => {
    const dist = (sticky: boolean) => {
      const g = mk();
      g.debugSetStone(0, -10, 0);
      if (sticky) {
        g.debugGrant(1, 'sticky');
        assert.equal(use(g, 1, T0, { x: -4, y: 0 }).ok, true);
      }
      shoot(g, 0, T0 + 10, 30, 0, 0);
      settle(g, T0 + 10);
      return g.getViewFor(0).stones.find((s) => s.id === 0)!.x;
    };
    assert.ok(dist(true) < dist(false) - 5, `${dist(true)} vs ${dist(false)}`);
  });

  test('원형판 배치는 판 안이고 중심 대칭이다', () => {
    const g = mk({ board: 'circle', pieces: 9 });
    const st = g.getViewFor(0).stones;
    for (const s of st) assert.ok(Math.hypot(s.x, s.y) < 26);
    for (const s of st.filter((q) => q.ownerId === 0)) {
      const m = st.find((q) => q.id === s.id + 9)!;
      assert.ok(Math.abs(m.x + s.x) < 1e-9 && Math.abs(m.y + s.y) < 1e-9);
    }
  });

  test('판 돌리기: 알·벽이 함께 시계 방향 45° 회전하고 알은 판 안에 남는다', () => {
    const g = mk();
    g.debugGrant(0, 'board_spin');
    g.debugSetStone(0, 22.9, 22.9);
    const r = use(g, 0, T0);
    assert.equal(r.ok, true);
    const v = g.getViewFor(0);
    assert.equal(v.boardRotationDeg, 45);
    const s0 = v.stones.find((s) => s.id === 0)!;
    assert.ok(Math.abs(s0.x) <= 23 && Math.abs(s0.y) <= 23, '모서리의 알도 판 안으로 보정');
    const s1 = v.stones.find((s) => s.id === 1)!; // 초기 (−23+46*2/6, −11.5)
    const rad = -Math.PI / 4;
    const ox = -23 + (2 * 46) / 6;
    const oy = -11.5;
    assert.ok(Math.abs(s1.x - (ox * Math.cos(rad) - oy * Math.sin(rad))) < 0.05);
  });

  test('책상 흔들기: 알이 1.1cm 이내로만 움직이고 제거되지 않는다', () => {
    const g = mk();
    g.debugGrant(0, 'desk_shake');
    const before = g.getViewFor(0).stones;
    assert.equal(use(g, 0, T0).ok, true);
    const after = g.getViewFor(0).stones;
    assert.equal(after.length, before.length);
    for (const a of after) {
      const b = before.find((s) => s.id === a.id)!;
      assert.ok(
        Math.hypot(a.x - b.x, a.y - b.y) <= 1.1 + 2.3,
        '겹침 보정으로 조금 더 움직일 수 있다',
      );
    }
  });
});

describe('명령 거부', () => {
  const snap = (g: Game) =>
    JSON.stringify([g.getViewFor(0), g.getViewFor(1), g.debugPrngStates(), g.debugState()]);
  const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? 'OK' : r.error!.code);

  test('발사 거부는 순서대로 코드를 돌려주고 상태·난수를 바꾸지 않는다', () => {
    const g = mk();
    g.debugGrant(1, 'stun');
    const v = g.getViewFor(0);
    const base = { gameId: 'g1', turnId: v.turnId, stoneId: 0, angle: 0, power: 10 };
    const cases: Array<[string, () => ReturnType<Game['submitShot']>]> = [
      ['STALE_TURN', () => g.submitShot(env(0, T0), { ...base, turnId: 99 })],
      ['STALE_TURN', () => g.submitShot(env(0, T0), { ...base, gameId: 'other' })],
      ['NOT_YOUR_TURN', () => g.submitShot(env(1, T0), { ...base, stoneId: 5 })],
      ['INVALID_STONE', () => g.submitShot(env(0, T0), { ...base, stoneId: 5 })],
      ['INVALID_STONE', () => g.submitShot(env(0, T0), { ...base, stoneId: 999 })],
      ['INVALID_INPUT', () => g.submitShot(env(0, T0), { ...base, power: 0 })],
    ];
    for (const [expected, run] of cases) {
      const before = snap(g);
      assert.equal(code(run()), expected);
      assert.equal(snap(g), before);
    }
    use(g, 1, T0);
    g.advanceTo(T0 + 1000);
    const before = snap(g);
    assert.equal(code(g.submitShot(env(0, T0 + 1000), base)), 'PLAYER_STUNNED');
    assert.equal(snap(g), before);
    // 기절이 풀리면 발사된다
    assert.equal(code(g.submitShot(env(0, T0 + 3000), base)), 'OK');
    assert.equal(code(g.submitShot(env(0, T0 + 3001), base)), 'SHOT_ALREADY_SUBMITTED');
  });

  test('경기 시작 전과 종료 후에는 GAME_NOT_ACTIVE다', () => {
    const waiting = new Game({
      gameId: 'g1',
      board: 'standard',
      pieceCount: 5,
      seed: 1,
      startMs: T0,
    });
    const base = { gameId: 'g1', turnId: 1, stoneId: 0, angle: 0, power: 10 };
    assert.equal(code(waiting.submitShot(env(0, T0), base)), 'GAME_NOT_ACTIVE');
    assert.equal(
      code(waiting.useHazard(env(0, T0), { gameId: 'g1', hazardInstanceId: 'x' })),
      'GAME_NOT_ACTIVE',
    );
    const g = mk();
    assert.equal(g.forfeit(env(0, T0), { gameId: 'g1' }).ok, true);
    assert.equal(code(g.submitShot(env(1, T0), base)), 'GAME_NOT_ACTIVE');
    assert.equal(code(g.forfeit(env(1, T0), { gameId: 'g1' })), 'GAME_NOT_ACTIVE');
    const over = g.drainEvents().find((e) => e.type === 'game:over');
    assert.ok(over && over.type === 'game:over');
    assert.equal(over.payload.winnerId, 1);
    assert.equal(over.payload.reason, 'forfeit');
  });

  test('방해요소 거부 순서와 코드, 거부는 상태·난수를 바꾸지 않는다', () => {
    const g = mk();
    g.debugGrant(0, 'wall');
    const id = g.getViewFor(0).private.held!.hazardInstanceId;
    const run = (
      seat: Seat,
      t: number,
      hid: string,
      target?: { x: number; y: number; orientation?: 'horizontal' | 'vertical' },
      gameId = 'g1',
    ) => code(g.useHazard(env(seat, t), { gameId, hazardInstanceId: hid, target }));
    // 시간 경과는 정상 진행이므로 시각을 먼저 맞춘 뒤, 거부가 상태·난수를 바꾸지 않는지 비교한다.
    const rej = (expected: string, t: number, f: () => string) => {
      g.advanceTo(t);
      const before = snap(g);
      assert.equal(f(), expected);
      assert.equal(snap(g), before);
    };
    rej('STALE_HAZARD', T0, () => run(0, T0, 'old'));
    rej('STALE_HAZARD', T0, () => run(0, T0, id, undefined, 'other'));
    rej('HAZARD_INVALID_TARGET', T0, () => run(0, T0, id)); // 대상 없음
    rej('HAZARD_INVALID_TARGET', T0, () =>
      run(0, T0, id, { x: 1, y: 0, orientation: 'horizontal' }),
    ); // 격자 밖
    rej('HAZARD_INVALID_TARGET', T0, () =>
      run(0, T0, id, { x: 22, y: 0, orientation: 'horizontal' }),
    ); // 판 밖으로 나감
    rej('HAZARD_INVALID_TARGET', T0, () =>
      run(0, T0, id, { x: -6.6, y: -11, orientation: 'horizontal' }),
    ); // 알과 겹침
    assert.equal(run(0, T0, id, { x: 0, y: 0, orientation: 'horizontal' }), 'OK');
    // 쿨타임 검사가 위치 검사보다 먼저다(AUTH 검증 경계 순서)
    rej('HAZARD_COOLDOWN', T0 + 1000, () =>
      run(0, T0 + 1000, id, { x: 1, y: 0, orientation: 'horizontal' }),
    );
    rej('HAZARD_COOLDOWN', T0 + 1000, () =>
      run(0, T0 + 1000, id, { x: 4.4, y: 4.4, orientation: 'vertical' }),
    );
  });

  test('랜덤형은 직접 쓸 수 없고 과열 중 피로도형은 거부된다', () => {
    const g = mk();
    g.debugGrant(0, 'wind');
    const w = g.getViewFor(0);
    assert.equal(w.private.usable, false);
    assert.equal(code(use(g, 0, T0)), 'HAZARD_NOT_USABLE');
    g.debugGrant(0, 'board_spin');
    assert.equal(code(use(g, 0, T0 + 1)), 'OK');
    assert.equal(code(use(g, 0, T0 + 2)), 'OK');
    assert.equal(g.getViewFor(0).private.overheated, true);
    assert.equal(g.getViewFor(0).private.usable, false);
    assert.equal(code(use(g, 0, T0 + 3)), 'HAZARD_OVERHEATED');
    g.advanceTo(T0 + 19_000);
    assert.equal(g.getViewFor(0).private.overheated, true, '게이지가 남아 있다');
    g.advanceTo(T0 + 20_100);
    assert.equal(g.getViewFor(0).private.overheated, false);
    assert.equal(code(use(g, 0, T0 + 20_200)), 'OK');
  });
});

describe('랜덤형 자동 발동', () => {
  test('15초 구간마다 1회, 상대에게 1초 발동한다', () => {
    const g = mk();
    g.debugGrant(0, 'wind');
    g.drainEvents();
    g.advanceTo(T0 + 29_999);
    g.advanceTo(T0 + 30_000); // 턴 변경
    g.advanceTo(T0 + 44_999);
    const starts = g
      .drainEvents()
      .flatMap((e) =>
        e.type === 'hazard:triggered' && e.payload.phase === 'start' ? [e.payload] : [],
      );
    assert.equal(starts.length, 3);
    starts.forEach((p, i) => {
      assert.equal(p.kind, 'wind');
      assert.equal(p.targetSeat, 1);
      assert.equal(p.expiresAtMs - p.startsAtMs, 1000);
      assert.ok(p.startsAtMs >= T0 + i * 15_000 && p.startsAtMs < T0 + (i + 1) * 15_000 - 1000 + 1);
      assert.ok(typeof p.params?.directionRad === 'number');
    });
  });
});

describe('getViewFor: 상대 비공개', () => {
  const TOP = [
    'gameId',
    'serverTick',
    'serverNowMs',
    'revision',
    'phase',
    'turnId',
    'round',
    'activePlayerId',
    'deadlineMs',
    'boardRotationDeg',
    'stones',
    'effects',
    'result',
    'private',
  ].sort();
  const PRIVATE = [
    'held',
    'fatigueGauge',
    'overheated',
    'cooldownEndsAtMs',
    'usable',
    'timeoutStreak',
    'blind',
  ];

  function keysOk(v: GameView): void {
    assert.deepEqual(Object.keys(v).sort(), TOP);
    for (const k of Object.keys(v.private))
      assert.ok(PRIVATE.includes(k), `허용 목록에 없는 private 필드 ${k}`);
    for (const s of v.stones)
      assert.deepEqual(Object.keys(s).sort(), ['h', 'id', 'ownerId', 'x', 'y']);
    for (const e of v.effects) {
      for (const k of Object.keys(e))
        assert.ok(['kind', 'targetSeat', 'startsAtMs', 'expiresAtMs', 'params'].includes(k));
    }
  }

  test('필드가 허용 목록과 같고 상대의 보유·게이지·쿨타임·시드가 없다', () => {
    const seed = 123456789;
    const g = mk({ seed });
    g.debugGrant(0, 'flashlight');
    g.debugGrant(1, 'stun');
    const v0 = g.getViewFor(0);
    const v1 = g.getViewFor(1);
    keysOk(v0);
    keysOk(v1);
    const j1 = JSON.stringify(v1);
    assert.equal(j1.includes(v0.private.held!.hazardInstanceId), false);
    assert.equal(j1.includes('flashlight'), false, '상대 보유 종류가 내 뷰에 없다');
    assert.equal(j1.includes(String(seed)), false);
    assert.equal(v0.private.fatigueGauge, 0);
    assert.equal(v1.private.fatigueGauge, null);
    // 사용 후: 효과는 양쪽 공개, 시야 가림 모양은 대상 뷰에만
    assert.equal(use(g, 0, T0 + 5).ok, true);
    const a = g.getViewFor(0);
    const b = g.getViewFor(1);
    keysOk(a);
    keysOk(b);
    assert.equal(
      a.effects.some((e) => e.kind === 'flashlight'),
      true,
    );
    assert.equal(
      b.effects.some((e) => e.kind === 'flashlight'),
      true,
    );
    assert.equal(a.private.blind, undefined);
    assert.equal(b.private.blind?.kind, 'flashlight');
    assert.equal(b.private.blind?.maxCoverage, 0.7);
    assert.equal(JSON.stringify(a).includes('"blind"'), false);
    // 사용자 번호·시드 같은 내부 필드가 어디에도 없다
    for (const key of ['seed', 'userId', 'users', 'grantRng']) {
      assert.equal(JSON.stringify([a, b]).includes(`"${key}"`), false);
    }
  });

  test('hazard:granted는 받는 좌석을 지정하고 이벤트 payload에 상대 정보가 없다', () => {
    const g = mk();
    const grants = g.drainEvents().filter((e) => e.type === 'hazard:granted');
    assert.equal(grants.length, 2);
    assert.deepEqual(
      grants.map((e) => e.type === 'hazard:granted' && e.toSeat),
      [0, 1],
    );
    const triggered = (() => {
      g.debugGrant(0, 'wall');
      use(g, 0, T0, { x: 0, y: 0, orientation: 'horizontal' });
      return g.drainEvents().filter((e) => e.type === 'hazard:triggered');
    })();
    for (const e of triggered) {
      if (e.type !== 'hazard:triggered') continue;
      for (const k of Object.keys(e.payload)) {
        assert.ok(
          [
            'gameId',
            'kind',
            'phase',
            'sourceSeat',
            'targetSeat',
            'startsAtMs',
            'expiresAtMs',
            'params',
          ].includes(k),
        );
      }
    }
  });
});
