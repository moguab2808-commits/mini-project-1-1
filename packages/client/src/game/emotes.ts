import {
  EMOTE_IDS,
  type EmoteId,
  type EmoteSend,
  type EmoteShown,
  type CommandResult,
  type GameView,
} from '@alkkagi/shared';

/** 원본 권한 시각은 중복 순서 판정에, 수신 시각은 표시 수명에 쓴다. */
export type DisplayEmote = EmoteShown & { receivedAtMs?: number };
export function emoteAgeMs(
  event: DisplayEmote,
  nowClientMs: number,
  nowAuthorityMs: number,
): number {
  return event.receivedAtMs === undefined
    ? nowAuthorityMs - event.atMs
    : nowClientMs - event.receivedAtMs;
}

export const EMOTE_DURATION_MS = 1500;
export const EMOTE_COOLDOWN_MS = 3000;
export const EMOTE_LABELS: Record<EmoteId, string> = {
  yawn: '하품하기',
  taunt: '도발',
  doze: '졸기',
  gg: '인사',
  laugh: '웃기',
  surprise: '놀람',
};
export const EMOTE_TEXT: Record<EmoteId, string> = {
  yawn: '하아암~',
  taunt: '덤벼!',
  doze: 'Zzz',
  gg: 'GG',
  laugh: 'ㅋㅋ',
  surprise: '헉!',
};
export function emoteForKey(code: string): EmoteId | null {
  const match = /^(?:Digit|Numpad)([1-6])$/.exec(code);
  return match ? (EMOTE_IDS[Number(match[1]) - 1] ?? null) : null;
}

/** 입력 빈도 제한은 렌더 프레임과 독립적이다. 권한 측 수락 이벤트만 화면에 표시한다. */
export class EmoteController {
  private gameId: string | null = null;
  private phase: GameView['phase'] | null = null;
  private lastSentMs = -Infinity;
  private attempt = 0;
  constructor(
    private readonly send: (cmd: EmoteSend) => Promise<CommandResult>,
    private readonly now: () => number,
  ) {}
  update(gameId: string | null, phase: GameView['phase'] | null) {
    if (this.gameId !== gameId) {
      this.lastSentMs = -Infinity;
      this.attempt++;
    }
    this.gameId = gameId;
    this.phase = phase;
  }
  get active(): boolean {
    return this.phase === 'aiming' || this.phase === 'moving' || this.phase === 'resolving';
  }
  remainingMs(): number {
    return Math.max(0, EMOTE_COOLDOWN_MS - (this.now() - this.lastSentMs));
  }
  async use(emote: EmoteId): Promise<void> {
    if (!this.gameId || !this.active || this.remainingMs() > 0) return;
    this.lastSentMs = this.now();
    const attempt = ++this.attempt;
    try {
      const result = await this.send({ gameId: this.gameId, emote });
      if (!result.ok && result.error.code !== 'EMOTE_COOLDOWN' && this.attempt === attempt)
        this.lastSentMs = -Infinity;
    } catch {
      if (this.attempt === attempt) this.lastSentMs = -Infinity;
    }
  }
}
