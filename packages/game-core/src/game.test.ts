// 실행: 루트에서 npm test (Vitest)
import assert from 'node:assert/strict';
import { describe, test } from 'vitest';
import type { GameView, Seat } from '@alkkagi/shared';
import type { CoreEvent } from './index.ts';
import { TestGame as Game } from './testing.ts';

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
  test('라운드가 바뀔 때마다 두 좌석 모두 교체되고 직전 종류는 다시 나오지 않는다(DEC-055·DEC-067)', () => {
    const g = mk();
    const all: CoreEvent[] = [...g.drainEvents()];
    const ids = new Set<string>();
    const kinds: [string[], string[]] = [[], []];
    const holds = (): void => {
      for (const s of [0, 1] as const) {
        const h = g.getViewFor(s).private.held!;
        ids.add(h.hazardInstanceId);
        kinds[s].push(h.kind);
      }
    };
    holds();
    let t = T0;
    while (!g.isFinished) {
      const before = g.getViewFor(0).turnId;
      const heldBefore = g.getViewFor(0).private.held!.hazardInstanceId;
      const roundEnds = g.getViewFor(0).activePlayerId !== 0; // 후공(1)이 쏘면 라운드가 끝난다
      t = passTurn(g, t);
      for (const e of g.drainEvents()) {
        all.push(e);
        if (e.type === 'hazard:granted') {
          assert.equal(e.payload.turnId, before + 1, '교체 지급은 새 턴 id를 담는다');
        }
      }
      if (g.isFinished) break;
      if (roundEnds) holds();
      else
        assert.equal(
          g.getViewFor(0).private.held!.hazardInstanceId,
          heldBefore,
          '라운드 첫 턴이 끝날 때는 이어진다',
        );
    }
    const grants = all.filter((e) => e.type === 'hazard:granted');
    assert.equal(grants.length, 20, '시작 2개 + 라운드 교체 9번 × 2좌석(종료 라운드는 교체 없음)');
    assert.equal(
      grants.filter((e) => e.type === 'hazard:granted' && e.payload.replaced).length,
      18,
    );
    assert.equal(ids.size, 20, '교체마다 새 인스턴스 id');
    for (const ks of kinds) {
      for (let i = 1; i < ks.length; i++) assert.notEqual(ks[i], ks[i - 1], '직전 종류 제외');
      assert.equal(ks.includes('desk_shake'), false);
    }
    const over = all.find((e) => e.type === 'game:over');
    assert.ok(over && over.type === 'game:over' && over.payload.reason === 'final_round');
    assert.equal(over.payload.winnerId, null, '남은 알 수가 같으면 무승부');
  });

  test('같은 시드면 두 좌석의 지급 순서가 같다', () => {
    const run = () => {
      const g = mk({ seed: 7 });
      const out: string[] = [];
      let t = T0;
      for (let i = 0; i < 6; i++) {
        t = passTurn(g, t);
        out.push(...[0, 1].map((s) => g.getViewFor(s as Seat).private.held!.kind));
      }
      return out;
    };
    assert.deepEqual(run(), run());
  });

  test('보유는 항상 1개이며 교체 때 게이지·쿨타임·이전 효과가 지워진다', () => {
    const g = mk();
    g.debugGrant(0, 'wall');
    use(g, 0, T0, { x: 0, y: 0, orientation: 'horizontal' });
    assert.equal(g.debugState().walls.length, 1);
    g.debugGrant(1, 'board_spin');
    use(g, 1, T0 + 10);
    assert.equal(g.debugState().players[1]!.gauge > 0, true);
    // 라운드(두 좌석이 한 번씩 쏜 뒤)가 바뀌면 교체한다(DEC-067)
    passTurn(g, passTurn(g, T0));
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
        assert.equal(use(g, 1, T0, { x: 0, y: 0 }).ok, true);
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
    assert.equal(
      v.boardRotationDeg,
      -45,
      '누적 회전은 반시계가 양수다(BoardRotateSchema와 같은 부호)',
    );
    const s0 = v.stones.find((s) => s.id === 0)!;
    assert.ok(Math.abs(s0.x) <= 23 && Math.abs(s0.y) <= 23, '모서리의 알도 판 안으로 보정');
    const s1 = v.stones.find((s) => s.id === 1)!; // 초기 (−23+46*2/6, −11.5)
    const rad = -Math.PI / 4;
    const ox = -23 + (2 * 46) / 6;
    const oy = -11.5;
    assert.ok(Math.abs(s1.x - (ox * Math.cos(rad) - oy * Math.sin(rad))) < 0.05);
  });

  test('책상 흔들기: 알이 2.2cm 이내로만 움직이고 제거되지 않는다', () => {
    const g = mk();
    g.debugGrant(0, 'desk_shake');
    const before = g.getViewFor(0).stones;
    assert.equal(use(g, 0, T0).ok, true);
    const after = g.getViewFor(0).stones;
    assert.equal(after.length, before.length);
    for (const a of after) {
      const b = before.find((s) => s.id === a.id)!;
      assert.ok(
        Math.hypot(a.x - b.x, a.y - b.y) <= 2.2 + 2.3,
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
    assert.equal(code(g.submitShot(env(0, T0 + 4000), base)), 'OK');
    assert.equal(code(g.submitShot(env(0, T0 + 4001), base)), 'SHOT_ALREADY_SUBMITTED');
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
    // 판 돌리기 피로도 25: 네 번 쓰면 과열
    for (let i = 1; i <= 3; i++) assert.equal(code(use(g, 0, T0 + i)), 'OK');
    assert.equal(g.getViewFor(0).private.overheated, false);
    assert.equal(code(use(g, 0, T0 + 4)), 'OK');
    assert.equal(g.getViewFor(0).private.overheated, true);
    assert.equal(g.getViewFor(0).private.usable, false);
    assert.equal(code(use(g, 0, T0 + 5)), 'HAZARD_OVERHEATED');
    g.advanceTo(T0 + 19_000);
    assert.equal(g.getViewFor(0).private.overheated, true, '게이지가 남아 있다');
    g.advanceTo(T0 + 20_100);
    assert.equal(g.getViewFor(0).private.overheated, false);
    assert.equal(code(use(g, 0, T0 + 20_200)), 'OK');
  });
});

describe('바람 상시 적용', () => {
  test('보유하면 상대에게 계속 적용되고 방향은 2~4초마다 무작위로 바뀐다', () => {
    const g = mk();
    g.debugGrant(0, 'wind');
    const starts = g
      .drainEvents()
      .flatMap((e) =>
        e.type === 'hazard:triggered' && e.payload.phase === 'start' ? [e.payload] : [],
      );
    assert.equal(starts.length, 1);
    assert.equal(starts[0]!.kind, 'wind');
    assert.equal(starts[0]!.targetSeat, 1);
    const windOf = () => g.getViewFor(1).effects.find((e) => e.kind === 'wind');
    const dirs = new Set<number>();
    for (let ms = 0; ms <= 20_000; ms += 500) {
      g.advanceTo(T0 + ms);
      const w = windOf();
      assert.ok(w, `${ms}ms에도 바람이 적용 중이다`);
      assert.equal(w.targetSeat, 1);
      dirs.add(w.params!.directionRad!);
    }
    // 20초 동안 2~4초 간격이면 5~10번 바뀐다
    assert.ok(dirs.size >= 5 && dirs.size <= 11, `${dirs.size}`);
    const ends = g
      .drainEvents()
      .filter((e) => e.type === 'hazard:triggered' && e.payload.phase === 'end');
    assert.equal(ends.length, 0, '방향 변경은 효과를 끝내지 않는다');
  });

  test('다른 방해요소로 교체하면 바람이 끝난다', () => {
    const g = mk();
    g.debugGrant(0, 'wind');
    const grant = g as unknown as { grantOne(seat: Seat, replaced: boolean, kind: 'wall'): void };
    grant.grantOne(0, true, 'wall');
    assert.equal(
      g.getViewFor(1).effects.some((e) => e.kind === 'wind'),
      false,
    );
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
    'stoneCounts',
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

  test('발사 각도가 (−π, π] 밖이면 INVALID_INPUT이다', () => {
    const g = mk();
    for (const a of [7, -Math.PI, 1e300, Number.NaN]) {
      const r = shoot(g, 0, T0 + 10, 50, a);
      assert.equal(r.ok, false);
      assert.equal(!r.ok && r.error.code, 'INVALID_INPUT');
    }
    assert.equal(shoot(g, 0, T0 + 20, 50, Math.PI).ok, true);
  });
});

describe('손이 닿는 거리 (DEC-036)', () => {
  const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? 'OK' : r.error!.code);
  const snap = (g: Game) =>
    JSON.stringify([g.getViewFor(0), g.getViewFor(1), g.debugPrngStates(), g.debugState()]);

  test('먼 알의 발사는 OUT_OF_REACH로 거부되고 상태·난수가 바뀌지 않는다', () => {
    const g = mk();
    g.debugSetStone(0, 0, 15); // 좌석 0 기준점 (0, −30)에서 45cm
    const before = snap(g);
    assert.equal(code(shoot(g, 0, T0, 50, 0, 0)), 'OUT_OF_REACH');
    assert.equal(snap(g), before);
  });

  test('판을 돌려 가까이 가져오면 칠 수 있다', () => {
    const g = mk();
    g.debugSetStone(0, 0, 15);
    const v = g.getViewFor(0);
    assert.equal(
      g.rotateBoard(env(0, T0), { gameId: 'g1', turnId: v.turnId, deltaDeg: 90 }).ok,
      true,
    );
    const s0 = g.getViewFor(0).stones.find((s) => s.id === 0)!;
    assert.ok(Math.abs(s0.x + 15) < 1e-6 && Math.abs(s0.y) < 1e-6, `반시계 90°: ${s0.x},${s0.y}`);
    assert.equal(code(shoot(g, 0, T0 + 10, 10, 0, 0)), 'OK');
  });

  test('경계 바로 안은 칠 수 있다(maxReach 40cm)', () => {
    const g = mk();
    g.debugSetStone(0, 0, 9.99);
    assert.equal(code(shoot(g, 0, T0, 10, 0, 0)), 'OK');
  });
});

describe('기본 판 돌리기 (DEC-036)', () => {
  const code = (r: { ok: boolean; error?: { code: string } }) => (r.ok ? 'OK' : r.error!.code);
  const snap = (g: Game) =>
    JSON.stringify([g.getViewFor(0), g.getViewFor(1), g.debugPrngStates(), g.debugState()]);
  const rot = (g: Game, seat: Seat, t: number, deltaDeg: number, over: object = {}) =>
    g.rotateBoard(env(seat, t), {
      gameId: 'g1',
      turnId: g.getViewFor(0).turnId,
      deltaDeg,
      ...over,
    });

  test('거부: 상대 턴·낡은 턴·범위 밖·이동 중·기절 중, 거부는 상태·난수를 바꾸지 않는다', () => {
    const g = mk();
    g.debugGrant(1, 'stun');
    const rej = (expected: string, f: () => ReturnType<Game['rotateBoard']>) => {
      const before = snap(g);
      assert.equal(code(f()), expected);
      assert.equal(snap(g), before);
    };
    rej('NOT_YOUR_TURN', () => rot(g, 1, T0, 10));
    rej('STALE_TURN', () => rot(g, 0, T0, 10, { turnId: 99 }));
    rej('STALE_TURN', () => rot(g, 0, T0, 10, { gameId: 'other' }));
    rej('INVALID_INPUT', () => rot(g, 0, T0, 91));
    rej('INVALID_INPUT', () => rot(g, 0, T0, Number.NaN));
    // 기절 중
    assert.equal(use(g, 1, T0).ok, true);
    g.advanceTo(T0 + 100);
    rej('BOARD_ROTATE_NOT_ALLOWED', () => rot(g, 0, T0 + 100, 10));
    // 기절이 풀린 뒤 발사하면 이동 중에는 돌릴 수 없다
    g.advanceTo(T0 + 4000);
    assert.equal(code(rot(g, 0, T0 + 4000, 10)), 'OK');
    assert.equal(code(shoot(g, 0, T0 + 4010, 30, 0)), 'OK');
    g.advanceTo(T0 + 4050);
    rej('BOARD_ROTATE_NOT_ALLOWED', () => rot(g, 0, T0 + 4050, 10));
  });

  test('경기 시작 전에는 GAME_NOT_ACTIVE다', () => {
    const waiting = new Game({
      gameId: 'g1',
      board: 'standard',
      pieceCount: 5,
      seed: 1,
      startMs: T0,
    });
    const r = waiting.rotateBoard(env(0, T0), { gameId: 'g1', turnId: 1, deltaDeg: 10 });
    assert.equal(code(r), 'GAME_NOT_ACTIVE');
  });

  test('속도 한도: 마지막 회전 이후 경과 시간×90°/s + 15°까지 잘라 적용한다', () => {
    const g = mk();
    assert.equal(code(rot(g, 0, T0, 10)), 'OK');
    assert.equal(g.getViewFor(0).boardRotationDeg, 10);
    assert.equal(code(rot(g, 0, T0 + 100, 80)), 'OK', '잘라도 성공');
    assert.ok(Math.abs(g.getViewFor(0).boardRotationDeg - (10 + 9 + 15)) < 1e-9);
    assert.equal(code(rot(g, 0, T0 + 100, -50)), 'OK');
    assert.ok(Math.abs(g.getViewFor(0).boardRotationDeg - (34 - 15)) < 1e-9);
    const rev = g.getViewFor(0).revision;
    assert.equal(code(rot(g, 0, T0 + 100, 0)), 'OK');
    assert.equal(g.getViewFor(0).revision, rev, '0° 회전은 상태를 바꾸지 않는다');
  });

  test('알·벽·끈끈이가 판과 함께 반시계로 돌고 양쪽 뷰의 누적 각이 같다', () => {
    const g = mk();
    g.debugGrant(1, 'wall');
    assert.equal(use(g, 1, T0, { x: 4.4, y: 4.4, orientation: 'horizontal' }).ok, true);
    g.debugGrant(1, 'sticky'); // 교체 지급이 아니므로 벽 효과는 남는다
    g.debugSetStone(0, -10, 0);
    assert.equal(code(rot(g, 0, T0 + 10, 90)), 'OK');
    const v0 = g.getViewFor(0);
    const v1 = g.getViewFor(1);
    assert.equal(v0.boardRotationDeg, 90);
    assert.equal(v1.boardRotationDeg, 90);
    const s0 = v0.stones.find((s) => s.id === 0)!;
    assert.ok(Math.abs(s0.x) < 1e-6 && Math.abs(s0.y + 10) < 1e-6, `${s0.x},${s0.y}`);
    const wall = v0.effects.find((e) => e.kind === 'wall')!;
    assert.ok(Math.abs(wall.params!.x! + 4.4) < 1e-9 && Math.abs(wall.params!.y! - 4.4) < 1e-9);
    assert.ok(Math.abs(wall.params!.angleDeg! - 90) < 1e-9);
    const w = g.debugState().walls[0]!;
    assert.ok(Math.abs(w.cx + 4.4) < 1e-9 && Math.abs(w.angle - Math.PI / 2) < 1e-9);
  });

  test('판 돌리기 방해요소는 그대로 시계 방향 45°이고 기본 판 돌리기와 누적 각을 함께 쓴다', () => {
    const g = mk();
    assert.equal(code(rot(g, 0, T0, 30)), 'OK');
    g.debugGrant(1, 'board_spin');
    assert.equal(use(g, 1, T0 + 10).ok, true);
    assert.equal(g.getViewFor(0).boardRotationDeg, 30 - 45);
  });
});

describe('후레쉬·물총 조준과 가림 (DEC-036)', () => {
  const FACE_OF_1 = { x: 0, y: 30, h: 24 };
  const MISS = { x: 25, y: 30, h: 0 };
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-6;

  function fire(g: Game, kind: 'flashlight' | 'water_gun', t: number, target?: object) {
    g.debugGrant(0, kind);
    const id = g.getViewFor(0).private.held!.hazardInstanceId;
    const r = g.useHazard(env(0, t), { gameId: 'g1', hazardInstanceId: id, target } as never);
    assert.equal(r.ok, true);
    return id;
  }
  const coverage = (g: Game) => g.getViewFor(1).private.blind?.coverage;

  test('조준이 상대 얼굴에 머물면 가림이 초당 0.8씩 올라 1에서 멈춘다', () => {
    const g = mk();
    fire(g, 'flashlight', T0, FACE_OF_1);
    const start = g.drainEvents().find((e) => e.type === 'hazard:triggered');
    assert.ok(start && start.type === 'hazard:triggered');
    assert.deepEqual(start.payload.params, { aimX: 0, aimY: 30, aimH: 24, coverage: 0 });
    assert.equal(coverage(g), 0);
    const rev = g.getViewFor(0).revision;
    g.advanceTo(T0 + 500);
    assert.ok(close(coverage(g)!, 0.4), `${coverage(g)}`);
    assert.ok(g.getViewFor(0).revision > rev, '가림이 바뀌면 뷰를 다시 보낸다');
    const eff = g.getViewFor(0).effects.find((e) => e.kind === 'flashlight')!;
    assert.ok(close(eff.params!.coverage!, 0.4));
    assert.equal(g.getViewFor(0).private.blind, undefined, '시전자 뷰에는 가림이 없다');
    g.advanceTo(T0 + 2000);
    assert.equal(coverage(g), 1);
  });

  test('조준을 옮겨 빗나가면 초당 0.5씩 줄고, 남의 효과·낡은 id의 조준은 무시된다', () => {
    const g = mk();
    const id = fire(g, 'flashlight', T0, FACE_OF_1);
    g.advanceTo(T0 + 1500);
    assert.equal(coverage(g), 1);
    const snapBefore = JSON.stringify([g.getViewFor(0), g.getViewFor(1), g.debugState()]);
    const stale = g.aimHazard(env(0, T0 + 1500), {
      gameId: 'g1',
      hazardInstanceId: 'old',
      target: MISS,
    });
    const other = g.aimHazard(env(1, T0 + 1500), {
      gameId: 'g1',
      hazardInstanceId: id,
      target: MISS,
    });
    const game = g.aimHazard(env(0, T0 + 1500), {
      gameId: 'x',
      hazardInstanceId: id,
      target: MISS,
    });
    for (const r of [stale, other, game]) assert.equal(!r.ok && r.error.code, 'STALE_HAZARD');
    assert.equal(JSON.stringify([g.getViewFor(0), g.getViewFor(1), g.debugState()]), snapBefore);
    assert.equal(
      g.aimHazard(env(0, T0 + 1500), { gameId: 'g1', hazardInstanceId: id, target: MISS }).ok,
      true,
    );
    const eff = g.getViewFor(0).effects.find((e) => e.kind === 'flashlight')!;
    assert.deepEqual([eff.params!.aimX, eff.params!.aimY, eff.params!.aimH], [25, 30, 0]);
    g.advanceTo(T0 + 2500);
    assert.ok(close(coverage(g)!, 0.5), `${coverage(g)}`);
    g.advanceTo(T0 + 3999);
    assert.equal(coverage(g), 0, '0 아래로 내려가지 않는다');
    g.advanceTo(T0 + 4000);
    assert.equal(g.getViewFor(1).private.blind?.kind, 'flashlight', 'E 유지 중에는 계속 활성');
  });

  test('조준점 없이 발동하면 빗나감으로 시작해 가림이 오르지 않는다', () => {
    const g = mk();
    fire(g, 'water_gun', T0);
    g.advanceTo(T0 + 1000);
    assert.equal(coverage(g), 0);
    assert.equal(g.getViewFor(1).private.blind?.kind, 'water_gun');
    assert.ok(g.getViewFor(1).private.blind!.expiresAtMs > T0 + 5000);
  });

  test('판을 돌려도 조준점은 그대로다(좌석 공간 기준)', () => {
    const g = mk();
    fire(g, 'flashlight', T0, FACE_OF_1);
    const v = g.getViewFor(0);
    assert.equal(
      g.rotateBoard(env(0, T0 + 100), { gameId: 'g1', turnId: v.turnId, deltaDeg: 45 }).ok,
      true,
    );
    const eff = g.getViewFor(0).effects.find((e) => e.kind === 'flashlight')!;
    assert.deepEqual([eff.params!.aimX, eff.params!.aimY, eff.params!.aimH], [0, 30, 24]);
    g.advanceTo(T0 + 600);
    assert.ok(close(coverage(g)!, 0.48), `${coverage(g)}`);
  });
});

describe('추가 방해요소 계약', () => {
  test('막대 가속은 보유 중 상시이며 교체하면 제거된다', () => {
    const g = mk();
    g.debugGrant(0, 'bar_speed');
    g.advanceTo(T0 + 20000);
    assert.ok(g.getViewFor(1).effects.some((e) => e.kind === 'bar_speed' && e.targetSeat === 1));
    const grant = g as unknown as { grantOne(seat: Seat, replaced: boolean, kind: 'wall'): void };
    grant.grantOne(0, true, 'wall');
    assert.equal(
      g.getViewFor(1).effects.some((e) => e.kind === 'bar_speed' && e.targetSeat === 1),
      false,
    );
  });
  test('책상 흔들기는 지급되지 않으며 상대 턴의 판 돌리기는 양방향 가능하다', () => {
    for (let seed = 1; seed <= 100; seed++) {
      const g = mk({ seed });
      for (const seat of [0, 1] as const)
        assert.notEqual(g.getViewFor(seat).private.held?.kind, 'desk_shake');
    }
    for (const direction of [-1, 1] as const) {
      const g = mk();
      g.debugGrant(1, 'board_spin');
      const v = g.getViewFor(1);
      assert.equal(
        g.rotateBoard(env(1, T0), { gameId: 'g1', turnId: v.turnId, deltaDeg: 10 }).ok,
        false,
      );
      assert.equal(
        g.useHazard(env(1, T0), {
          gameId: 'g1',
          hazardInstanceId: v.private.held!.hazardInstanceId,
          direction,
        }).ok,
        true,
      );
      assert.notEqual(g.getViewFor(1).boardRotationDeg, 0);
    }
  });
});
