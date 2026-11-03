// HUD 표시값 계산. React에 의존하지 않는 순수 함수라 단위 테스트로 검증한다.
// 상대 방해요소는 뷰에 없으므로 여기에도 만들지 않는다(비공개).
import {
  HAZARDS,
  type GameOver,
  type GameStart,
  type GameView,
  type HazardKind,
  type RematchState,
  type Seat,
} from '@alkkagi/shared';

export const HAZARD_NAMES: Record<HazardKind, string> = {
  board_spin: '판 돌리기',
  flashlight: '후레쉬',
  water_gun: '물총',
  desk_shake: '책상 흔들기',
  wall: '벽',
  sticky: '끈끈이',
  stun: '기절',
  bar_speed: '세기 막대 속도 조절',
  wind: '바람',
  magnet: '자석',
  gravity_zone: '중력 구역',
  ice_floor: '미끄럼 장판',
  decoy: '분신술',
  fake_wall: '가짜벽',
  heavy_stones: '알 무게 변화',
  reverse_zone: '방향 반전 구역',
  mine: '폭탄',
  pit: '바닥 없어지기',
  moving_wall: '이동 장애물',
};

/** 방해요소 효과 설명(칸 툴팁용) */
export const HAZARD_HINTS: Record<HazardKind, string> = {
  board_spin: '판과 알이 45도 돌아가요',
  flashlight: '손에 들고 상대 얼굴을 비추면 상대 화면이 밝게 바래요',
  water_gun: '손에 들고 상대 얼굴을 맞히면 상대 화면에 물방울이 맺혀요',
  desk_shake: '모든 알이 조금씩 밀려요',
  wall: '판 위에 벽을 세워요',
  sticky: '지나가는 알이 느려져요',
  stun: '상대가 잠시 조작할 수 없어요',
  bar_speed: '자동으로 발동해요',
  wind: '자동으로 발동해요',
  magnet: '판 위에 놓으면 지나가는 알이 끌려가요',
  gravity_zone: '구역을 지나는 알이 정한 방향으로 미끄러져요 (R로 방향 바꾸기)',
  ice_floor: '판 전체가 미끄러워져요 (턴당 1회)',
  decoy: '내 알 하나를 골라 허상 2개와 섞어요 (턴당 1회)',
  fake_wall: '벽 3개를 세우지만 진짜는 1개뿐이에요',
  heavy_stones: '내 알이 무거워져 덜 밀려요 (턴당 1회)',
  reverse_zone: '들어온 알이 왔던 쪽으로 되돌아가요',
  mine: '움직이는 알이 닿으면 터져요 (턴당 1회)',
  pit: '판에 구멍을 뚫어요',
  moving_wall: '왕복하는 벽을 세워요 (R로 방향 바꾸기)',
};

export function isRandomKind(kind: HazardKind): boolean {
  return HAZARDS[kind].category === 'random';
}

/** 남은 시간 표시용 초(올림, 0 이상) */
export function remainingSeconds(deadlineMs: number, nowServerMs: number): number {
  return Math.max(0, Math.ceil((deadlineMs - nowServerMs) / 1000));
}

/** 조준 단계가 아니면 마감 시계를 멈춘 것으로 보여 줄 필요가 없으므로 그대로 표시한다. 종료 후엔 null */
export function turnSecondsLeft(view: GameView, nowServerMs: number): number | null {
  if (view.phase === 'finished' || view.phase === 'waiting') return null;
  return remainingSeconds(view.deadlineMs, nowServerMs);
}

export function roundLabel(view: GameView, finalRound: number): string {
  return view.round >= finalRound ? '최종 라운드' : `라운드 ${view.round} / ${finalRound}`;
}

export type Outcome = 'win' | 'lose' | 'draw';

export function outcomeFor(result: GameOver, mySeat: Seat): Outcome {
  if (result.winnerId === null) return 'draw';
  return result.winnerId === mySeat ? 'win' : 'lose';
}

export const OUTCOME_TEXT: Record<Outcome, string> = { win: '승리!', lose: '패배', draw: '무승부' };

export const REASON_TEXT: Record<GameOver['reason'], string> = {
  all_stones_out: '알을 모두 떨어뜨렸어요',
  final_round: '최종 라운드가 끝났어요',
  forfeit: '기권으로 끝났어요',
  timeout_forfeit: '시간 초과가 이어져 끝났어요',
};

export interface RematchUi {
  /** 재도전 버튼 활성 */
  canRequest: boolean;
  /** 재도전 버튼 표시 */
  showRequest: boolean;
  message: string | null;
  /** 남은 초. 기한이 없거나 끝나면 null */
  secondsLeft: number | null;
}

/** 결과 화면의 재도전 안내. `rematch`가 오기 전에는 결과의 기한을 쓴다 */
export function rematchUi(
  result: GameOver,
  rematch: RematchState | null,
  nowServerMs: number,
): RematchUi {
  const deadline = rematch?.deadlineMs ?? result.rematchDeadlineMs;
  const left = deadline === null ? null : remainingSeconds(deadline, nowServerMs);
  if (rematch?.outcome === 'expired' || (rematch === null && left === 0 && deadline !== null)) {
    // 마감 전에 무산됐으면 상대가 나간 것이다
    const early = rematch?.outcome === 'expired' && left !== null && left > 0;
    return {
      canRequest: false,
      showRequest: false,
      message: early
        ? '상대가 나가서 재도전할 수 없어요. 나가기를 눌러 주세요.'
        : '재도전 시간이 지났어요. 나가기를 눌러 주세요.',
      secondsLeft: null,
    };
  }
  if (rematch?.outcome === 'accepted') {
    return {
      canRequest: false,
      showRequest: false,
      message: '새 경기를 준비하고 있어요',
      secondsLeft: null,
    };
  }
  if (result.rematchDeadlineMs === null && rematch === null) {
    // 기권 등으로 재도전이 없는 결과
    return { canRequest: false, showRequest: false, message: null, secondsLeft: null };
  }
  let message: string | null = null;
  if (rematch?.myRequested) message = '상대의 답을 기다리는 중이에요';
  else if (rematch?.opponentRequested) message = '상대가 재도전을 원해요';
  return {
    canRequest: !rematch?.myRequested,
    showRequest: true,
    message,
    secondsLeft: left,
  };
}

type Blind = NonNullable<GameView['private']['blind']>;

/** 가림 면적 상한(PRD "최대 70%"). 서버 maxCoverage가 더 커도 넘지 않는다 */
export const BLIND_CAP = 0.7;

/**
 * 가림 면적 비율(0~0.7) = 서버가 주는 현재 가림 정도(`coverage`, 0~1) × 최대 면적.
 * 상대 조준이 얼굴에 머무를수록 오르고 빗나가면 줄어든다(DEC-036). 효과 시간 밖이면 0이다.
 * 스냅샷 사이의 변화는 화면이 CSS 전환으로 부드럽게 잇는다.
 */
export function blindCoverage(blind: Blind, nowServerMs: number): number {
  if (nowServerMs < blind.startsAtMs || nowServerMs >= blind.expiresAtMs) return 0;
  const c = Number.isFinite(blind.coverage) ? Math.min(1, Math.max(0, blind.coverage)) : 0;
  return Math.min(BLIND_CAP, blind.maxCoverage) * c;
}

/** 후레쉬: 중앙부터 하얗게 바래는 타원의 반지름(%). 타원 면적이 화면의 coverage가 되게 한다 */
export function flashRadiusPct(coverage: number): number {
  return Math.sqrt(Math.max(0, coverage) / Math.PI) * 100;
}

/** 물총: 최대 면적 기준으로 배치한 물방울 중 지금 보일 개수(가림 비율에 비례) */
export function visibleDroplets(count: number, coverage: number, maxCoverage: number): number {
  const cap = Math.min(BLIND_CAP, maxCoverage);
  if (cap <= 0 || coverage <= 0) return 0;
  return Math.min(count, Math.ceil((count * coverage) / cap));
}

/** 물방울 위치용 시드 난수(같은 pattern이면 같은 배치) */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Droplet {
  cx: number;
  cy: number;
  r: number;
}

/** 물방울 격자(가로×세로). 화면 전체에 고르게 퍼지도록 칸마다 하나씩 흩뿌린다 */
export const DROPLET_COLS = 8;
export const DROPLET_ROWS = 6;

/**
 * 물방울 자국: 100×56.25 좌표. 화면 전체를 칸으로 나눠 칸마다 하나씩 흩뿌리고(빈 곳 없이 전체에 퍼짐),
 * 순서를 섞어 가림이 오를수록 화면 곳곳에 고르게 늘어난다. 물방울 면적 합은 화면 전체와 비슷하다.
 */
export function dropletsFor(
  pattern: number,
  maxCoverage: number,
  count = DROPLET_COLS * DROPLET_ROWS,
): Droplet[] {
  const rand = seededRandom(pattern);
  const cw = 100 / DROPLET_COLS;
  const ch = 56.25 / DROPLET_ROWS;
  const total = 100 * 56.25 * (0.6 + 0.4 * Math.min(1, maxCoverage / BLIND_CAP));
  const base = Math.sqrt(total / count / Math.PI);
  const drops = Array.from({ length: count }, (_, i) => {
    const cell = i % (DROPLET_COLS * DROPLET_ROWS);
    const col = cell % DROPLET_COLS;
    const row = Math.floor(cell / DROPLET_COLS);
    return {
      cx: (col + 0.15 + rand() * 0.7) * cw,
      cy: (row + 0.15 + rand() * 0.7) * ch,
      r: base * (0.7 + rand() * 0.6),
    };
  });
  for (let i = drops.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [drops[i], drops[j]] = [drops[j]!, drops[i]!];
  }
  return drops;
}

/** 물총 물막(화면 전체 흐림·푸른 기)의 세기 0~1. 가림 비율을 최대 가림 대비로 본다 */
export function waterFilmStrength(coverage: number, maxCoverage: number): number {
  const cap = Math.min(BLIND_CAP, maxCoverage);
  return cap > 0 ? Math.min(1, Math.max(0, coverage / cap)) : 0;
}

/** 바람 방향 화살표의 화면 회전각(도, CSS 시계 방향). 후공 화면은 판이 180도 돌아 보이므로 반대로 그린다 */
export function windArrowRotationDeg(directionRad: number, mySeat: Seat): number {
  const screenRad = mySeat === 0 ? directionRad : directionRad + Math.PI;
  return -(screenRad * 180) / Math.PI;
}

/** 보유한 알 점: 처음 알 개수 중 남은 알은 채운 점 */
export function stoneDots(view: GameView, seat: Seat, pieceCount: number): boolean[] {
  // 상대 뷰의 stones에는 분신술 허상이 섞이므로 진짜 남은 알 수(stoneCounts)를 쓴다(DEC-058)
  const alive = view.stoneCounts[seat];
  return Array.from({ length: pieceCount }, (_, i) => i < alive);
}

export function nicknameOf(start: GameStart, seat: Seat): string {
  return start.players[seat].nickname;
}

/** 조작 도움말 한 줄 */
export const CONTROLS_HELP =
  '알을 누른 채 뒤로 당겨 놓아 발사 · 오른쪽 클릭 취소 · A·D/←→ 판 돌리기 · E 방해요소(물총·후레쉬는 유지) · 오른쪽 드래그 둘러보기';
