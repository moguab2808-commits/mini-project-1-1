// 브라우저에 저장하는 설정(음량 3종, 규칙 카드를 이미 봤는지). 저장소를 못 쓰는 환경에서도 화면은 동작한다.
const RULES_SEEN_KEY = 'alkkagi.rulesSeen';

/** 음량 종류(DEC-084): 배경음악·배경 소리·효과음 */
export type VolumeKind = 'music' | 'ambience' | 'sfx';

/** 효과음은 예전 키를 그대로 써서 기존 설정을 잇는다 */
const VOLUME_KEYS: Record<VolumeKind, string> = {
  sfx: 'alkkagi.volume',
  music: 'alkkagi.volume.music',
  ambience: 'alkkagi.volume.ambience',
};

export const DEFAULT_VOLUME = 70;
export const DEFAULT_VOLUMES: Record<VolumeKind, number> = {
  sfx: DEFAULT_VOLUME,
  music: 50,
  ambience: 50,
};

export function clampVolume(value: number, fallback = DEFAULT_VOLUME): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function loadVolumeOf(
  kind: VolumeKind,
  storage: Pick<Storage, 'getItem'> | null = safeStorage(),
): number {
  const fallback = DEFAULT_VOLUMES[kind];
  try {
    const raw = storage?.getItem(VOLUME_KEYS[kind]);
    return raw === null || raw === undefined ? fallback : clampVolume(Number(raw), fallback);
  } catch {
    return fallback;
  }
}

export function saveVolumeOf(
  kind: VolumeKind,
  value: number,
  storage: Pick<Storage, 'setItem'> | null = safeStorage(),
): void {
  try {
    storage?.setItem(VOLUME_KEYS[kind], String(clampVolume(value, DEFAULT_VOLUMES[kind])));
  } catch {
    // 저장하지 못해도 이번 접속에서는 값이 유지된다.
  }
}

/** 소리 켜기·끄기(음량과 따로 저장, 기본 켜짐). 배경음악만 끄는 등 갈래별로 끈다 */
const ENABLED_KEYS: Record<VolumeKind, string> = {
  music: 'alkkagi.sound.music',
  ambience: 'alkkagi.sound.ambience',
  sfx: 'alkkagi.sound.sfx',
};

export function loadSoundOn(
  kind: VolumeKind,
  storage: Pick<Storage, 'getItem'> | null = safeStorage(),
): boolean {
  try {
    return storage?.getItem(ENABLED_KEYS[kind]) !== '0';
  } catch {
    return true;
  }
}

export function saveSoundOn(
  kind: VolumeKind,
  on: boolean,
  storage: Pick<Storage, 'setItem'> | null = safeStorage(),
): void {
  try {
    storage?.setItem(ENABLED_KEYS[kind], on ? '1' : '0');
  } catch {
    // 저장하지 못해도 이번 접속에서는 값이 유지된다.
  }
}

/** 효과음 음량(예전 이름) */
export function loadVolume(storage: Pick<Storage, 'getItem'> | null = safeStorage()): number {
  return loadVolumeOf('sfx', storage);
}

export function saveVolume(
  value: number,
  storage: Pick<Storage, 'setItem'> | null = safeStorage(),
): void {
  saveVolumeOf('sfx', value, storage);
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
