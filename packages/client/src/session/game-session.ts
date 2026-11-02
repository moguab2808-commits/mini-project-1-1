// 경기 진행 방법을 숨기는 인터페이스 (docs/design/LOCAL.md "GameSession 시그니처").
// 화면은 이 인터페이스에만 의존하고, 로컬은 LocalGameSession, 온라인은 RemoteGameSession이 구현한다.
import type {
  CommandResult,
  GameForfeit,
  GameOver,
  GameStart,
  GameView,
  HazardGranted,
  HazardTriggered,
  HazardUse,
  RematchState,
  Seat,
  ShotSubmit,
  TurnChange,
} from '@alkkagi/shared';

export type GameMode = 'local' | 'ai' | 'online';

export interface GameEventMap {
  'game:start': GameStart;
  /** 받은 플레이어에게만 간다 */
  'hazard:granted': HazardGranted;
  'game:state': GameView;
  'hazard:triggered': HazardTriggered;
  'turn:change': TurnChange;
  'game:over': GameOver;
  'rematch:state': RematchState;
}

export interface GameSession {
  readonly mode: GameMode;
  /** 이 창이 맡은 좌석 */
  readonly playerId: Seat;
  submitShot(cmd: ShotSubmit): Promise<CommandResult>;
  useHazard(cmd: HazardUse): Promise<CommandResult>;
  forfeit(cmd: GameForfeit): Promise<CommandResult>;
  requestRematch(gameId: string): Promise<CommandResult>;
  on<K extends keyof GameEventMap>(type: K, handler: (event: GameEventMap[K]) => void): () => void;
  /** 창 닫기·이동. 진행 중이면 이탈로 처리한다 */
  dispose(): void;
}
