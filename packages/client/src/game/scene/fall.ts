// 판 밖으로 제거된 알의 낙하 연출. 판정과 무관한 시각 효과이며 순수 함수로만 상태를 갱신한다.
import { PHYSICS } from '@alkkagi/shared';
import type { RemovedStone } from './snapshot-buffer.ts';

/** 판 윗면 아래로 내려가는 책상 윗면까지의 거리(cm). 알 중심 높이 기준 */
export const FALL_GROUND_Z = -9.5;
/** 낙하 연출 길이(초). 마지막 구간에서 작아지며 사라진다 */
export const FALL_LIFE = 1.5;
const SHRINK_START = 1.1;
const MIN_OUT_SPEED = 22;
const BOUNCE = 0.3;

export interface FallState {
  id: number;
  owner: 0 | 1;
  /** 서버 기준 좌표(최신 스냅샷 좌표계) */
  x: number;
  y: number;
  /** 판 윗면 기준 알 중심의 높이 변위(cm). 정지한 알은 0 */
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** 굴러 넘어지는 회전(라디안) */
  rotX: number;
  rotZ: number;
  age: number;
}

export function startFall(r: RemovedStone, startZ = 0): FallState {
  let { vx, vy } = r;
  const sp = Math.hypot(vx, vy);
  if (sp < MIN_OUT_SPEED) {
    // 거의 멈춘 채 경계에 걸쳐 제거된 알: 바깥 방향으로 살짝 굴러 떨어진다
    const d = Math.hypot(r.x, r.y);
    const ox = d > 1e-6 ? r.x / d : 1;
    const oy = d > 1e-6 ? r.y / d : 0;
    vx = ox * MIN_OUT_SPEED;
    vy = oy * MIN_OUT_SPEED;
  }
  return {
    id: r.id,
    owner: r.owner,
    x: r.x,
    y: r.y,
    z: startZ,
    vx,
    vy,
    vz: 0,
    rotX: 0,
    rotZ: 0,
    age: 0,
  };
}

/** dt초 진행한다(큰 dt는 잘라 낸다). 수명이 끝나면 true. */
export function stepFall(f: FallState, dtSec: number): boolean {
  const dt = Math.min(dtSec, 0.05);
  f.age += dt;
  f.vz -= PHYSICS.gravity * dt;
  f.z += f.vz * dt;
  f.x += f.vx * dt;
  f.y += f.vy * dt;
  if (f.z < FALL_GROUND_Z) {
    f.z = FALL_GROUND_Z;
    f.vz = f.vz < -30 ? -f.vz * BOUNCE : 0;
    const damp = Math.exp(-2 * dt);
    f.vx *= damp;
    f.vy *= damp;
  }
  // 구르는 회전: 진행 방향에 수직인 축. 서버 y는 월드 -Z라 부호를 맞춘다.
  const r = PHYSICS.stoneRadius;
  f.rotX += (f.vy / r) * dt;
  f.rotZ -= (f.vx / r) * dt;
  return f.age >= FALL_LIFE;
}

/** 사라지는 구간의 크기 배율(1 → 0) */
export function fallScale(f: FallState): number {
  if (f.age <= SHRINK_START) return 1;
  return Math.max(0, 1 - (f.age - SHRINK_START) / (FALL_LIFE - SHRINK_START));
}
