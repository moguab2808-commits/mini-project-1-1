import type { EmoteId } from '@alkkagi/shared';

/** 경과 시간만으로 정하는 표시용 몸짓. 게임 난수·상태는 바꾸지 않는다. */
export function emoteMotion(kind: EmoteId, ageMs: number) {
  const t = Math.max(0, Math.min(1, ageMs / 1500));
  const envelope = Math.sin(Math.PI * t);
  return {
    pitch:
      kind === 'doze'
        ? Math.pow(Math.sin(t * Math.PI * 2), 2) * 0.55
        : kind === 'yawn'
          ? -envelope * 0.4
          : kind === 'surprise'
            ? -envelope * 0.2
            : 0,
    wave: kind === 'gg' ? Math.sin(t * Math.PI * 7) * 3 * envelope : 0,
    beckon: kind === 'taunt' ? Math.sin(t * Math.PI * 8) * 0.7 : 0,
    bounce: kind === 'laugh' ? Math.abs(Math.sin(t * Math.PI * 6)) * 0.8 : 0,
    envelope,
  };
}
