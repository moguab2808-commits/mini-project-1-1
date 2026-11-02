import { describe, expect, it } from 'vitest';
import {
  advanceClock,
  createSnapshotState,
  pushSnapshot,
  sampleStones,
  takeDueRemovals,
  type RemovedStone,
  type SampledStone,
  type SnapshotInput,
} from './snapshot-buffer.ts';

// 120Hz 틱: 4틱 = 33.3ms(약 30Hz 스냅샷)
function view(
  tick: number,
  stones: Array<[number, number, number, number?]>,
  rot = 0,
  gameId = 'g',
): SnapshotInput {
  return {
    gameId,
    serverTick: tick,
    boardRotationDeg: rot,
    stones: stones.map(([id, x, y, h]) => ({ id, ownerId: 0 as const, x, y, h: h ?? 0 })),
  };
}

describe('스냅샷 보간', () => {
  it('두 스냅샷 사이를 선형 보간한다', () => {
    const st = createSnapshotState();
    pushSnapshot(st, view(0, [[1, 0, 0]]));
    pushSnapshot(st, view(12, [[1, 10, 0, 2]])); // 100ms 간격
    st.clockMs = 50;
    const out: SampledStone[] = [];
    expect(sampleStones(st, out)).toBe(1);
    expect(out[0]?.x).toBeCloseTo(5);
    expect(out[0]?.h).toBeCloseTo(1);
  });

  it('정지 상태에서는 시계가 최신 스냅샷에 멈춰 정확한 위치를 준다', () => {
    const st = createSnapshotState();
    pushSnapshot(st, view(0, [[1, 0, 0]]));
    pushSnapshot(st, view(4, [[1, 3.3, 1.1]]));
    const out: SampledStone[] = [];
    for (let i = 0; i < 60; i++) advanceClock(st, 16.7);
    sampleStones(st, out);
    expect(out[0]?.x).toBe(3.3);
    expect(out[0]?.y).toBe(1.1);
    expect(st.clockMs).toBeCloseTo((4 * 1000) / 120);
  });

  it('오래된 틱은 버리고 같은 틱은 교체한다', () => {
    const st = createSnapshotState();
    pushSnapshot(st, view(8, [[1, 1, 0]]));
    expect(pushSnapshot(st, view(4, [[1, 9, 9]]))).toBe(false);
    expect(pushSnapshot(st, view(8, [[1, 2, 0]]))).toBe(true);
    const out: SampledStone[] = [];
    sampleStones(st, out);
    expect(out[0]?.x).toBe(2);
    expect(st.snaps.length).toBe(1);
  });

  it('판이 회전하면 이전 스냅샷을 최신 좌표계로 환산해 현을 가로지르지 않는다', () => {
    const st = createSnapshotState();
    // 서버가 알 (10, 0)을 90도 돌려 (0, 10)으로 옮겼다. 같은 위치이므로 보간 중에도 (0, 10)이어야 한다.
    pushSnapshot(st, view(0, [[1, 10, 0]], 0));
    pushSnapshot(st, view(4, [[1, 0, 10]], 90));
    st.clockMs = 10;
    const out: SampledStone[] = [];
    sampleStones(st, out);
    expect(out[0]?.x).toBeCloseTo(0);
    expect(out[0]?.y).toBeCloseTo(10);
  });

  it('새 gameId는 버퍼를 비운다', () => {
    const st = createSnapshotState();
    pushSnapshot(st, view(100, [[1, 1, 1]]));
    pushSnapshot(st, view(0, [[2, 0, 0]], 0, 'g2'));
    const out: SampledStone[] = [];
    expect(sampleStones(st, out)).toBe(1);
    expect(out[0]?.id).toBe(2);
    expect(st.pending.length).toBe(0);
  });
});

describe('제거된 알', () => {
  it('사라진 알을 마지막 위치·속도와 함께 렌더 시계가 지난 뒤 꺼낸다', () => {
    const st = createSnapshotState();
    pushSnapshot(
      st,
      view(0, [
        [1, 20, 0],
        [2, 0, 0],
      ]),
    );
    pushSnapshot(
      st,
      view(4, [
        [1, 21, 0],
        [2, 0, 0],
      ]),
    );
    pushSnapshot(st, view(8, [[2, 0, 0]]));
    const due: RemovedStone[] = [];
    st.clockMs = 40; // 8틱 = 66.7ms 이전
    takeDueRemovals(st, due);
    expect(due.length).toBe(0);
    // 사라지는 동안에는 직전 속도로 나아가며 계속 보인다
    const out: SampledStone[] = [];
    expect(sampleStones(st, out)).toBe(2);
    st.clockMs = 70;
    takeDueRemovals(st, due);
    expect(due.length).toBe(1);
    expect(due[0]?.id).toBe(1);
    expect(due[0]?.x).toBeCloseTo(21);
    expect(due[0]?.vx).toBeGreaterThan(20);
    expect(sampleStones(st, out)).toBe(1);
    takeDueRemovals(st, due);
    expect(due.length).toBe(1);
  });
});
