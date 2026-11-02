// 경기 수치와 방해요소·판 데이터. 값의 근거는 docs/design/GAME.md의 기술 초기값이다.
// 제안값(미승인)이므로 바꿀 때는 GAME.md의 수치 변경 절차를 따른다.

export const HAZARD_KINDS = [
  'board_spin',
  'flashlight',
  'water_gun',
  'desk_shake',
  'wall',
  'sticky',
  'stun',
  'bar_speed',
  'wind',
] as const;
export type HazardKind = (typeof HAZARD_KINDS)[number];

export const BOARD_IDS = ['standard', 'circle'] as const;
export type BoardId = (typeof BOARD_IDS)[number];

/** 경기 안 좌석. users.id가 아니다. */
export type Seat = 0 | 1;

export const RULES = {
  finalRound: 10,
  turnSeconds: 30,
  /** 같은 플레이어의 연속 시간초과가 이 횟수에 닿으면 강제 기권 */
  timeoutForfeitStreak: 3,
  /** 방해요소를 새로 받는 라운드 */
  grantRounds: [1, 3, 5, 7, 9],
  pieceCounts: [5, 7, 9],
} as const;

export const PHYSICS = {
  tickHz: 120,
  /** 알 지름 2.2cm */
  stoneRadius: 1.1,
  /** 지면 감속 cm/s² */
  friction: 100,
  maxShotSpeed: 117,
  /** 세기 이상이면 떠오른다 */
  liftPower: 80,
  /** 떠오름 높이 H(p)=liftMaxHeight*(p-liftBase)/(100-liftBase) */
  liftBase: 79,
  liftMaxHeight: 4.4,
  gravity: 981,
  stoneRestitution: 0.9,
  wallRestitution: 0.7,
  /** 이 속도(cm/s) 미만이 settleSeconds 지속되면 정지 */
  settleSpeed: 0.11,
  settleSeconds: 0.3,
  maxSimSeconds: 10,
  /** 부동소수 비교 허용 오차 cm */
  boundaryEpsilon: 1e-6,
  /** 효과로 옮긴 알을 경계에서 안쪽으로 되돌리는 거리 cm */
  boundaryInset: 0.01,
} as const;

export type HazardCategory = 'fatigue' | 'cooldown' | 'random';

export interface HazardMeta {
  kind: HazardKind;
  category: HazardCategory;
  /** 효과 지속(연출 포함) ms */
  durationMs: number;
  /** 피로도 게이지형의 사용 비용 */
  fatigueCost?: number;
  /** 쿨타임형의 쿨타임 ms */
  cooldownMs?: number;
}

export const HAZARDS: Record<HazardKind, HazardMeta> = {
  board_spin: { kind: 'board_spin', category: 'fatigue', durationMs: 1000, fatigueCost: 50 },
  flashlight: { kind: 'flashlight', category: 'fatigue', durationMs: 2000, fatigueCost: 40 },
  water_gun: { kind: 'water_gun', category: 'fatigue', durationMs: 3000, fatigueCost: 45 },
  desk_shake: { kind: 'desk_shake', category: 'fatigue', durationMs: 500, fatigueCost: 40 },
  wall: { kind: 'wall', category: 'cooldown', durationMs: 5000, cooldownMs: 20000 },
  sticky: { kind: 'sticky', category: 'cooldown', durationMs: 5000, cooldownMs: 20000 },
  stun: { kind: 'stun', category: 'cooldown', durationMs: 3000, cooldownMs: 30000 },
  bar_speed: { kind: 'bar_speed', category: 'random', durationMs: 1000 },
  wind: { kind: 'wind', category: 'random', durationMs: 1000 },
};

export const HAZARD_TUNING = {
  fatigueMax: 100,
  /** 초당 감소량. 과열 중에도 감소한다 */
  fatigueDecayPerSec: 5,
  boardSpinDeg: 45,
  deskShakeMaxDistance: 1.1,
  wallLength: 8.8,
  wallThickness: 0.6,
  /** 벽 중심이 놓이는 격자 간격 (알 지름) */
  gridStep: 2.2,
  stickyDiameter: 8.8,
  /** 끈끈이 안의 지면 알에 더해지는 감속 cm/s² */
  stickyExtraFriction: 500,
  barSpeedMultiplier: 2,
  /** 랜덤형은 지급 시각부터 이 길이 구간마다 1회 발동 */
  randomIntervalMs: 15000,
  /** 흐림 최대 면적 비율 */
  blindMaxCoverage: 0.7,
} as const;

export type BoardDefinition =
  | { id: BoardId; shape: 'square'; size: number }
  | { id: BoardId; shape: 'circle'; diameter: number };

export const BOARDS: Record<BoardId, BoardDefinition> = {
  standard: { id: 'standard', shape: 'square', size: 46 },
  circle: { id: 'circle', shape: 'circle', diameter: 52 },
};
