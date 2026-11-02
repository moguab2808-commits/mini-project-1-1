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
import { CAMERA_PRESETS, type CameraPreset } from '../scene/scene-contract.ts';

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
    return {
      canRequest: false,
      showRequest: false,
      message: '재도전 시간이 지났어요. 나가기를 눌러 주세요.',
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

/** 물방울 자국: 100×56.25 좌표. 전체 면적 합이 대략 최대 가림 면적이 된다 */
export function dropletsFor(pattern: number, maxCoverage: number, count = 28): Droplet[] {
  const rand = seededRandom(pattern);
  const total = 100 * 56.25 * Math.min(0.7, maxCoverage) * 1.25;
  const base = Math.sqrt(total / count / Math.PI);
  return Array.from({ length: count }, () => ({
    cx: rand() * 100,
    cy: rand() * 56.25,
    r: base * (0.6 + rand() * 0.9),
  }));
}

/** 바람 방향 화살표의 화면 회전각(도, CSS 시계 방향). 후공 화면은 판이 180도 돌아 보이므로 반대로 그린다 */
export function windArrowRotationDeg(directionRad: number, mySeat: Seat): number {
  const screenRad = mySeat === 0 ? directionRad : directionRad + Math.PI;
  return -(screenRad * 180) / Math.PI;
}

/** 보유한 알 점: 처음 알 개수 중 남은 알은 채운 점 */
export function stoneDots(view: GameView, seat: Seat, pieceCount: number): boolean[] {
  const alive = view.stones.filter((s) => s.ownerId === seat).length;
  return Array.from({ length: pieceCount }, (_, i) => i < alive);
}

export function nicknameOf(start: GameStart, seat: Seat): string {
  return start.players[seat].nickname;
}

/** 시점 버튼(숫자 키 1~5와 같은 순서). 장면 계약 `CAMERA_PRESETS` 순서를 따른다 */
export const CAMERA_LABELS: Record<CameraPreset, string> = {
  default: '기본',
  first: '1인칭',
  top: '위에서',
  side: '옆에서',
  opponent: '상대 쪽',
};

/** 숫자 키(`Digit1`~`Digit5`, 숫자 패드 포함)의 시점. 해당 없으면 null */
export function cameraPresetForCode(code: string): CameraPreset | null {
  const m = /^(?:Digit|Numpad)([1-5])$/.exec(code);
  return m ? CAMERA_PRESETS[Number(m[1]) - 1]! : null;
}

/** 조작 도움말 한 줄 */
export const CONTROLS_HELP =
  '알 클릭 후 누르고 떼서 발사 · A·D/←→ 판 돌리기 · E 방해요소 · 1~5 시점 · 오른쪽 드래그 시점 회전 · 휠 확대';
