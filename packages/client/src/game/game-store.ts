// GameSession 이벤트를 화면이 읽을 상태로 모은다. React에는 `useSyncExternalStore`로 연결한다.
import type {
  GameOver,
  GameStart,
  GameView,
  HazardGranted,
  HazardTriggered,
  RematchState,
  Seat,
} from '@alkkagi/shared';
import type { GameSession } from '../session/game-session.ts';

/** 방해요소 받음 카드 표시 시간(PRD 게임 화면) */
export const GRANT_CARD_MS = 1500;
/** 방해요소 발동 안내 표시 시간 */
export const ANNOUNCE_MS = 2000;

export interface Announcement extends HazardTriggered {
  /** 화면에서 지울 시각(클라이언트 시계 ms) */
  untilMs: number;
}

export interface GameClientState {
  mySeat: Seat;
  start: GameStart | null;
  view: GameView | null;
  /** 가장 최근 `game:state`를 받은 클라이언트 시각(ms) */
  viewReceivedAtMs: number;
  /** 내 `hazard:granted`로 보여 줄 카드. 본인 이벤트만 오므로 상대 정보는 없다 */
  grantCard: (HazardGranted & { untilMs: number }) | null;
  /** 진행 중인 효과 발동 안내(시작 이벤트). `end`가 오면 지운다 */
  announcements: Announcement[];
  result: GameOver | null;
  rematch: RematchState | null;
  /** 권한 측 시각 − 클라이언트 시각(ms) 추정. 마감·쿨타임 남은 시간 계산에 쓴다 */
  clockOffsetMs: number;
}

export class GameStore {
  private state: GameClientState;
  private readonly listeners = new Set<() => void>();
  private readonly unsubscribe: (() => void)[] = [];

  constructor(
    private readonly session: GameSession,
    private readonly nowMs: () => number = () => Date.now(),
  ) {
    this.state = {
      mySeat: session.playerId,
      start: null,
      view: null,
      viewReceivedAtMs: 0,
      grantCard: null,
      announcements: [],
      result: null,
      rematch: null,
      clockOffsetMs: 0,
    };
    const on = session.on.bind(session);
    this.unsubscribe.push(
      on('game:start', (start) => {
        // 새 경기(재도전 포함): 화면 상태를 초기화한다
        this.set({
          start,
          view: start.view,
          viewReceivedAtMs: this.nowMs(),
          grantCard: null,
          announcements: [],
          result: null,
          rematch: null,
          clockOffsetMs: start.view.serverNowMs - this.nowMs(),
        });
      }),
      on('game:state', (view) => {
        const cur = this.state.view;
        if (cur && view.gameId === cur.gameId && view.revision < cur.revision) return;
        this.set({
          view,
          viewReceivedAtMs: this.nowMs(),
          clockOffsetMs: view.serverNowMs - this.nowMs(),
        });
      }),
      on('hazard:granted', (g) => {
        this.set({ grantCard: { ...g, untilMs: this.nowMs() + GRANT_CARD_MS } });
      }),
      on('hazard:triggered', (e) => {
        const now = this.nowMs();
        const rest = this.state.announcements.filter(
          (a) => a.untilMs > now && !(a.kind === e.kind && a.sourceSeat === e.sourceSeat),
        );
        this.set({
          announcements:
            e.phase === 'start' ? [...rest, { ...e, untilMs: now + ANNOUNCE_MS }] : rest,
        });
      }),
      on('game:over', (result) => {
        this.set({ result });
      }),
      on('rematch:state', (rematch) => {
        this.set({ rematch });
      }),
    );
  }

  getState = (): GameClientState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /** 권한 측 현재 시각 추정(ms) */
  serverNow(): number {
    return this.nowMs() + this.state.clockOffsetMs;
  }

  dispose(): void {
    for (const u of this.unsubscribe) u();
    this.unsubscribe.length = 0;
    this.listeners.clear();
  }

  private set(patch: Partial<GameClientState>): void {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l();
  }
}
