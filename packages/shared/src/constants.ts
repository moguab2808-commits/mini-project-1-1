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
  board_spin: { kind: 'board_spin', category: 'fatigue', durationMs: 1000, fatigueCost: 25 },
  flashlight: { kind: 'flashlight', category: 'fatigue', durationMs: 4000, fatigueCost: 40 },
  water_gun: { kind: 'water_gun', category: 'fatigue', durationMs: 5000, fatigueCost: 45 },
  desk_shake: { kind: 'desk_shake', category: 'fatigue', durationMs: 500, fatigueCost: 40 },
  wall: { kind: 'wall', category: 'cooldown', durationMs: 8000, cooldownMs: 20000 },
  sticky: { kind: 'sticky', category: 'cooldown', durationMs: 8000, cooldownMs: 20000 },
  stun: { kind: 'stun', category: 'cooldown', durationMs: 4000, cooldownMs: 30000 },
  bar_speed: { kind: 'bar_speed', category: 'random', durationMs: 1000 },
  wind: { kind: 'wind', category: 'random', durationMs: 1000 },
};

export const HAZARD_TUNING = {
  fatigueMax: 100,
  /** 초당 감소량. 과열 중에도 감소한다 */
  fatigueDecayPerSec: 5,
  boardSpinDeg: 45,
  deskShakeMaxDistance: 2.2,
  wallLength: 13.2,
  wallThickness: 0.6,
  /** 벽 중심이 놓이는 격자 간격 (알 지름) */
  gridStep: 2.2,
  stickyDiameter: 13.2,
  /** 끈끈이 안의 지면 알에 더해지는 감속 cm/s² */
  stickyExtraFriction: 900,
  /** 바람이 상대 조준 방향을 돌리는 속도(°/s). 보유 중 상시 적용이라 약하게 둔다 */
  windDegPerSec: 30,
  /** 바람 방향이 무작위로 바뀌는 간격(ms) 범위 */
  windShiftMinMs: 2000,
  windShiftMaxMs: 4000,
  barSpeedMultiplier: 3,
  /** 흐림 최대 면적 비율 */
  blindMaxCoverage: 0.7,
  /** 후레쉬·물총 발동 영역(원뿔) 반각. 상대 얼굴 방향과 이 각 안이면 맞은 것이다 */
  blindBeamHalfAngleDeg: 10,
  /** 맞는 동안 가림이 초당 오르는 양(최대 면적 대비 비율) */
  blindGainPerSec: 0.8,
  /** 빗나가는 동안 가림이 초당 줄어드는 양 */
  blindDecayPerSec: 0.5,
} as const;

/**
 * 좌석·캐릭터 기하(판 좌표계 cm). 좌석 0은 −y 쪽, 좌석 1은 +y 쪽에 앉는다.
 * 손이 닿는 거리 판정과 후레쉬·물총 조준에 쓴다. 제안값이며 플레이 테스트로 조정한다.
 */
export const SEAT_GEOMETRY = {
  /** 캐릭터 어깨(손 닿는 거리의 기준점)의 판 중심으로부터 거리 */
  anchorDistance: 30,
  /** 이 거리까지는 편하게 친다(조준 흔들림 없음) */
  comfortReach: 26,
  /** 이 거리를 넘는 알은 칠 수 없다(OUT_OF_REACH). 판을 돌려 가까이 가져와야 한다 */
  maxReach: 40,
  /** 얼굴 중심 높이(판 윗면 기준) */
  headHeight: 24,
  /** 후레쉬·물총을 든 손의 위치: 어깨 기준점에서 판 중심 쪽으로 이만큼, 이 높이 */
  handForward: 8,
  handHeight: 12,
} as const;

/** 기본 판 돌리기(내 턴, 조준 전) */
export const BOARD_TURN = {
  /** 최대 회전 속도(°/s) */
  maxDegPerSec: 90,
  /** 속도 한도에 더해 한 번에 허용하는 여유(°). 전송 지연을 흡수한다 */
  burstDeg: 15,
} as const;

export type BoardDefinition =
  | { id: BoardId; shape: 'square'; size: number }
  | { id: BoardId; shape: 'circle'; diameter: number };

export const BOARDS: Record<BoardId, BoardDefinition> = {
  standard: { id: 'standard', shape: 'square', size: 46 },
  circle: { id: 'circle', shape: 'circle', diameter: 52 },
};
