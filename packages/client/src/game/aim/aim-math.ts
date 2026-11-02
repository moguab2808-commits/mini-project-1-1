// 조준 각도·세기 막대 계산. React·DOM에 의존하지 않는 순수 함수다.

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
export const BAR_PERIOD_SEC = 2;

/** 막대 위상(주기 단위, 0 이상 2 미만으로 감김)을 0~100 세기로 바꾸는 삼각파 */
export function powerFromPhase(phase: number): number {
  const p = ((phase % 2) + 2) % 2;
  return (p <= 1 ? p : 2 - p) * 100;
}

/** 바람이 초당 조준 방향을 돌리는 각도(도). GAME 방해요소 수치 */
export const WIND_DEG_PER_SEC = 60;
