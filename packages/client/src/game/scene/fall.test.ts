import { describe, expect, it } from 'vitest';
import { FALL_GROUND_Z, FALL_LIFE, fallScale, startFall, stepFall } from './fall.ts';

const removed = { id: 3, owner: 1 as const, x: 23, y: 0, vx: 40, vy: 0, atMs: 0 };

describe('낙하 연출', () => {
  it('중력으로 떨어지며 바닥에서 멈추고 수명이 끝나면 true를 준다', () => {
    const f = startFall(removed);
    let done = false;
    let minZ = 0;
    for (let i = 0; i < 200 && !done; i++) {
      done = stepFall(f, 1 / 60);
      minZ = Math.min(minZ, f.z);
    }
    expect(done).toBe(true);
    expect(minZ).toBe(FALL_GROUND_Z);
    expect(f.z).toBeGreaterThanOrEqual(FALL_GROUND_Z);
    expect(f.age).toBeGreaterThanOrEqual(FALL_LIFE);
  });

  it('진행 방향으로 계속 나아가고 회전한다', () => {
    const f = startFall(removed);
    for (let i = 0; i < 10; i++) stepFall(f, 1 / 60);
    expect(f.x).toBeGreaterThan(23);
    expect(f.rotZ).not.toBe(0);
  });

  it('거의 멈춘 알은 바깥 방향으로 굴러 떨어진다', () => {
    const f = startFall({ ...removed, x: 0, y: -26, vx: 0, vy: 0 });
    expect(f.vy).toBeLessThan(0);
    stepFall(f, 1 / 60);
    expect(f.y).toBeLessThan(-26);
  });

  it('큰 dt도 한 번에 0.05초까지만 진행한다', () => {
    const f = startFall(removed);
    stepFall(f, 5);
    expect(f.age).toBeCloseTo(0.05);
  });

  it('크기 배율은 1에서 시작해 수명 끝에 0이 된다', () => {
    const f = startFall(removed);
    expect(fallScale(f)).toBe(1);
    f.age = FALL_LIFE;
    expect(fallScale(f)).toBe(0);
  });
});
