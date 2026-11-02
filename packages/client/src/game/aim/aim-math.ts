// 조준 각도·세기 막대·떨림 계산. React·DOM에 의존하지 않는 순수 함수다.

/** 각도를 (−π, π] 범위로 정규화한다. 서버 `ShotSubmit.angle`이 이 범위만 받는다. */
export function normalizeAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0;
  const twoPi = Math.PI * 2;
  let a = angle % twoPi;
  if (a > Math.PI) a -= twoPi;
  else if (a <= -Math.PI) a += twoPi;
  return a;
}

/** `from`에서 `to`로 가는 최단 회전량(−π, π] */
export function shortestAngleDelta(from: number, to: number): number {
  return normalizeAngle(to - from);
}

/** 세기 막대가 0→100→0을 한 번 오르내리는 시간(초) */
export const BAR_PERIOD_SEC = 1;

/** 막대 위상(주기 단위, 0 이상 2 미만으로 감김)을 0~100 세기로 바꾸는 삼각파 */
export function powerFromPhase(phase: number): number {
  const p = ((phase % 2) + 2) % 2;
  return (p <= 1 ? p : 2 - p) * 100;
}

/**
 * 시간 기반 의사잡음 [−1, 1]. 서로 나누어떨어지지 않는 주파수의 사인 합이라 반복이 눈에 띄지 않고,
 * 같은 시각이면 같은 값이라 테스트가 결정적이다.
 */
export function tremor(timeMs: number): number {
  const t = timeMs / 1000;
  const v =
    0.5 * Math.sin(t * 2 * Math.PI * 3.1) +
    0.3 * Math.sin(t * 2 * Math.PI * 5.3 + 1.7) +
    0.2 * Math.sin(t * 2 * Math.PI * 8.9 + 4.1);
  return Math.max(-1, Math.min(1, v));
}

/** 먼 거리 조준(strain 1)의 최대 조준 떨림(도) */
export const STRAIN_JITTER_DEG = 4;
/** 책상 흔들기 효과 중 최대 조준 떨림(도) */
export const DESK_SHAKE_JITTER_DEG = 6;

/** 화면 흔들림 세기(0~1) 원인별 값. 장면이 카메라를 흔든다 */
export const SHAKE = {
  /** 먼 거리 조준: strain에 곱한다 */
  strain: 0.35,
  /** 내게 걸린 바람 */
  wind: 0.6,
  /** 책상 흔들기(양쪽 화면) */
  deskShake: 1,
} as const;
