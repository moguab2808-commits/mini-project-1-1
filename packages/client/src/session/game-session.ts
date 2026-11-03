// 경기 진행 방법을 숨기는 인터페이스 (docs/design/LOCAL.md "GameSession 시그니처").
// 화면은 이 인터페이스에만 의존하고, 로컬은 LocalGameSession, 온라인은 RemoteGameSession이 구현한다.
import type {
  AimState,
  AimUpdate,
  BoardRotate,
  CommandResult,
  EmoteSend,
  EmoteShown,
  GameForfeit,
  GameOver,
  GameStart,
  GameView,
  HazardAim,
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
  /** 상대의 조준·몸짓 상태(상대에게서 중계됨). 권한 상태가 아니다 */
  'aim:state': AimState;
  'emote:shown': EmoteShown;
}

export interface GameSession {
  readonly mode: GameMode;
  /** 이 창이 맡은 좌석 */
  readonly playerId: Seat;
  submitShot(cmd: ShotSubmit): Promise<CommandResult>;
  useHazard(cmd: HazardUse): Promise<CommandResult>;
  forfeit(cmd: GameForfeit): Promise<CommandResult>;
  requestRematch(gameId: string): Promise<CommandResult>;
  /** 기본 판 돌리기(`board:rotate`). 내 턴·조준 단계에서만 수락된다 */
  rotateBoard(cmd: BoardRotate): Promise<CommandResult>;
  /** 발동 중인 후레쉬·물총 조준점(`hazard:aim`). 응답 없이 최신 값만 의미가 있다 */
  aimHazard(cmd: HazardAim): void;
  /** 내 조준·몸짓 상태를 상대 화면에 보낸다(`aim:update`). 응답 없음, 초당 20회 이하 */
  sendAim(update: AimUpdate): void;
  sendEmote(cmd: EmoteSend): Promise<CommandResult>;
  on<K extends keyof GameEventMap>(type: K, handler: (event: GameEventMap[K]) => void): () => void;
  /** 창 닫기·이동. 진행 중이면 이탈로 처리한다 */
  dispose(): void;
}
