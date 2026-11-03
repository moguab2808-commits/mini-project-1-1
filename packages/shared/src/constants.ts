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
  // 추가 10종 (DEC-055, docs/design/GAME.md "추가 방해요소 10종과 턴 교체")
  'magnet',
  'gravity_zone',
  'ice_floor',
  'decoy',
  'fake_wall',
  'heavy_stones',
  'reverse_zone',
  'mine',
  'pit',
  'moving_wall',
] as const;
export type HazardKind = (typeof HAZARD_KINDS)[number];

export const BOARD_IDS = ['standard', 'circle'] as const;
export type BoardId = (typeof BOARD_IDS)[number];

/** 방 테마(DEC-050·052·053). 장면 표시에만 쓰며 게임 규칙·물리에 넘기지 않는다. 첫 값이 기본 테마다 */
export const THEME_IDS = ['bar', 'rooftop', 'classroom', 'beach'] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const DEFAULT_THEME: ThemeId = 'bar';
export const THEME_LABEL: Record<ThemeId, string> = {
  bar: '바',
  rooftop: '밤 옥상',
  classroom: '교실',
  beach: '해변',
};

/** 경기 안 좌석. users.id가 아니다. */
export type Seat = 0 | 1;

export const RULES = {
  finalRound: 10,
  turnSeconds: 30,
  /** 같은 플레이어의 연속 시간초과가 이 횟수에 닿으면 강제 기권 */
  timeoutForfeitStreak: 3,
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

/** `per_turn`: 턴당 1회. 지급된 턴에 한 번 쓰면 다음 교체까지 다시 쓸 수 없다(DEC-055) */
export type HazardCategory = 'fatigue' | 'cooldown' | 'random' | 'per_turn';

/** 신규 지급 풀: 책상 흔들기를 뺀 18종. 교체 때 그 좌석의 직전 종류를 다시 뺀다(DEC-055) */
export const GRANT_POOL: readonly HazardKind[] = HAZARD_KINDS.filter((k) => k !== 'desk_shake');

/** 교체 때까지 이어지는 효과의 지속(ms). 교체에서 지워지므로 실제로는 만료되지 않는다 */
export const UNTIL_SWAP_MS = 24 * 60 * 60 * 1000;

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

/** 설치형(벽·끈끈이·추가 위치형 6종)의 지속은 15초, 미끄럼 장판은 13초다(10초·8초에서 5초 늘림) */
export const HAZARDS: Record<HazardKind, HazardMeta> = {
  board_spin: { kind: 'board_spin', category: 'fatigue', durationMs: 1000, fatigueCost: 25 },
  flashlight: { kind: 'flashlight', category: 'fatigue', durationMs: 4000, fatigueCost: 40 },
  water_gun: { kind: 'water_gun', category: 'fatigue', durationMs: 5000, fatigueCost: 45 },
  desk_shake: { kind: 'desk_shake', category: 'fatigue', durationMs: 500, fatigueCost: 40 },
  wall: { kind: 'wall', category: 'cooldown', durationMs: 15000, cooldownMs: 20000 },
  sticky: { kind: 'sticky', category: 'cooldown', durationMs: 15000, cooldownMs: 20000 },
  stun: { kind: 'stun', category: 'cooldown', durationMs: 4000, cooldownMs: 30000 },
  bar_speed: { kind: 'bar_speed', category: 'random', durationMs: 1000 },
  wind: { kind: 'wind', category: 'random', durationMs: 1000 },
  magnet: { kind: 'magnet', category: 'cooldown', durationMs: 15000, cooldownMs: 20000 },
  gravity_zone: {
    kind: 'gravity_zone',
    category: 'cooldown',
    durationMs: 15000,
    cooldownMs: 20000,
  },
  ice_floor: { kind: 'ice_floor', category: 'per_turn', durationMs: 13000 },
  decoy: { kind: 'decoy', category: 'per_turn', durationMs: UNTIL_SWAP_MS },
  fake_wall: { kind: 'fake_wall', category: 'cooldown', durationMs: 15000, cooldownMs: 20000 },
  heavy_stones: { kind: 'heavy_stones', category: 'per_turn', durationMs: UNTIL_SWAP_MS },
  reverse_zone: {
    kind: 'reverse_zone',
    category: 'cooldown',
    durationMs: 15000,
    cooldownMs: 20000,
  },
  mine: { kind: 'mine', category: 'per_turn', durationMs: UNTIL_SWAP_MS },
  pit: { kind: 'pit', category: 'cooldown', durationMs: 15000, cooldownMs: 20000 },
  moving_wall: { kind: 'moving_wall', category: 'cooldown', durationMs: 15000, cooldownMs: 20000 },
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

  // ── 추가 10종 (제안값, GAME.md "수치 제안값") ──
  /** 자석 영향 원 반지름 cm, 중심 쪽 가속 cm/s². 범위에 닿은 알을 블랙홀처럼 중심으로 빨아들여 중심에 세운다. 떠 있는 알에도 적용 */
  magnetRadius: 8.8,
  magnetAccel: 5400,
  /** 자석 범위 안에서 중심과 수직인(비껴가는) 속도를 초당 줄이는 비율. 클수록 곧장 빨려 든다 */
  magnetTangentDamping: 12,
  /** 중력 구역 정사각 한 변 cm, 가속 cm/s². 방향은 45° 단위 */
  gravityZoneSize: 13.2,
  gravityAccel: 450,
  /** 미끄럼 장판: 지면 감속 배율(끈끈이 추가 감속에는 곱하지 않는다) */
  iceFrictionMultiplier: 0.4,
  /** 분신술: 원래 자리에서 이 거리 범위 안의 빈 자리 3곳 */
  decoyMinDistance: 4.4,
  decoyMaxDistance: 11,
  /** 분신술 자리끼리·다른 알과의 최소 중심 거리 */
  decoySeparation: 3.3,
  /** 분신술 자리의 판 경계 안쪽 여유 */
  decoyEdgeInset: 2.2,
  decoyMaxTries: 64,
  /** 알 무게 변화: 내 알 질량 배율 */
  heavyMassMultiplier: 3,
  reverseZoneDiameter: 8.8,
  /** 폭탄 본체 반지름(알과 같음), 폭발 반경, 중심에서 더하는 속도 cm/s(거리에 따라 선형 감소) */
  mineRadius: 1.1,
  mineBlastRadius: 8.8,
  mineBlastSpeed: 100,
  pitDiameter: 6.6,
  /** 이동 장애물: 왕복 축 방향 진폭 cm, 한 번 왕복 ms */
  movingWallAmplitude: 8.8,
  movingWallPeriodMs: 3000,
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
