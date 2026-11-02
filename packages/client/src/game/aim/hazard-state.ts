// 내 방해요소 칸의 표시·입력 가능 여부를 `view.private`와 권한 측 시각으로 계산한다.
// 상대 방해요소는 뷰에 없으므로 여기서도 다루지 않는다(비공개). 권한 측이 사용 때 다시 검증한다.
import { HAZARDS, HAZARD_TUNING, type GameView, type HazardKind } from '@alkkagi/shared';

export type HazardInputKind = 'immediate' | 'placement' | 'hold' | 'random';

/** 사용 입력 방식: 즉시형·배치형(벽·끈끈이)·손에 들고 조준(후레쉬·물총)·랜덤형(직접 사용 불가) */
export function inputKindOf(kind: HazardKind): HazardInputKind {
  if (kind === 'wall' || kind === 'sticky') return 'placement';
  if (kind === 'flashlight' || kind === 'water_gun') return 'hold';
  return HAZARDS[kind].category === 'random' ? 'random' : 'immediate';
}

export interface HeldHazardState {
  hazardInstanceId: string;
  kind: HazardKind;
  category: 'fatigue' | 'cooldown' | 'random';
  /** 피로도 게이지형이면 지금 시각의 추정 게이지(0~100), 아니면 null */
  gauge: number | null;
  overheated: boolean;
  /** 쿨타임 중이면 남은 초(올림), 아니면 null */
  cooldownRemainingSec: number | null;
  /** 지금 사용 입력을 보낼 수 있는가(경기 진행 중·분류 제한 모두 반영) */
  usable: boolean;
}

/**
 * 보유 방해요소 상태. 게이지는 `serverNowMs` 시점 값에서 초당 감소량으로 이어 계산하고,
 * 과열은 게이지가 0이 되면 풀린 것으로 본다(권한 측과 같은 규칙).
 */
export function heldHazardState(view: GameView, nowServerMs: number): HeldHazardState | null {
  const held = view.private.held;
  if (!held) return null;
  const category = HAZARDS[held.kind].category;
  const elapsedSec = Math.max(0, nowServerMs - view.serverNowMs) / 1000;
  const gauge =
    category === 'fatigue' && view.private.fatigueGauge !== null
      ? Math.max(0, view.private.fatigueGauge - HAZARD_TUNING.fatigueDecayPerSec * elapsedSec)
      : null;
  const overheated = category === 'fatigue' && view.private.overheated && (gauge ?? 0) > 0;
  const cooldownEnds = view.private.cooldownEndsAtMs;
  const cooldownRemainingMs =
    category === 'cooldown' && cooldownEnds !== null ? cooldownEnds - nowServerMs : 0;
  const cooling = cooldownRemainingMs > 0;
  const inPlay = view.phase === 'aiming' || view.phase === 'moving';
  return {
    hazardInstanceId: held.hazardInstanceId,
    kind: held.kind,
    category,
    gauge,
    overheated,
    cooldownRemainingSec: cooling ? Math.ceil(cooldownRemainingMs / 1000) : null,
    usable: inPlay && category !== 'random' && !overheated && !cooling,
  };
}
