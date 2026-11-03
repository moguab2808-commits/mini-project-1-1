// 브라우저에 저장하는 설정(효과음 음량, 규칙 카드를 이미 봤는지). 저장소를 못 쓰는 환경에서도 화면은 동작한다.
const VOLUME_KEY = 'alkkagi.volume';
const RULES_SEEN_KEY = 'alkkagi.rulesSeen';

export const DEFAULT_VOLUME = 70;

export function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadVolume(storage: Pick<Storage, 'getItem'> | null = safeStorage()): number {
  try {
    const raw = storage?.getItem(VOLUME_KEY);
    return raw === null || raw === undefined ? DEFAULT_VOLUME : clampVolume(Number(raw));
  } catch {
    return DEFAULT_VOLUME;
  }
}

export function saveVolume(
  value: number,
  storage: Pick<Storage, 'setItem'> | null = safeStorage(),
): void {
  try {
    storage?.setItem(VOLUME_KEY, String(clampVolume(value)));
  } catch {
    // 저장하지 못해도 이번 접속에서는 값이 유지된다.
  }
}

/** 처음 로그인한 사용자에게만 규칙 카드를 보여 주려고, 이 브라우저에서 본 적이 있는지 기억한다. */
export function hasSeenRules(storage: Pick<Storage, 'getItem'> | null = safeStorage()): boolean {
  try {
    return storage?.getItem(RULES_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

export function markRulesSeen(storage: Pick<Storage, 'setItem'> | null = safeStorage()): void {
  try {
    storage?.setItem(RULES_SEEN_KEY, '1');
  } catch {
    // 저장하지 못하면 다음 로그인에 카드가 다시 보일 뿐이다.
  }
}
