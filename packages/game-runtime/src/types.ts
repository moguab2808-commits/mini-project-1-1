import type { Game, GameConfig } from '@alkkagi/game-core';
import type {
  AimState,
  CommandResult,
  EmoteShown,
  GameOver,
  GameStart,
  GameView,
  HazardGranted,
  HazardTriggered,
  Seat,
  TurnChange,
} from '@alkkagi/shared';

/**
 * 런타임이 의존하는 주입 인터페이스. 서버(IMPL-009)·로컬 SharedWorker·AI Web Worker가
 * 같은 `RoomRuntime`을 쓰고 시계·전송·로거·종료 콜백만 다르게 넣는다(DEC-030).
 */

/**
 * 단조 시계. 되돌아가지 않아야 하며(`Date.now` 직접 사용 금지), API가 시간 필드를 서버 기준
 * epoch 밀리초로 정하므로 epoch 기준으로 맞춘 단조 시각이어야 한다
 * (예: `Math.round(performance.timeOrigin + performance.now())`).
 * 경기 시각·`serverNowMs`·마감 시각이 이 값을 그대로 쓴다.
 */
export interface RuntimeClock {
  /** epoch 기준 단조 현재 시각(ms) */
  now(): number;
  /** `delayMs` 뒤 한 번 호출한다. 돌려준 함수로 취소한다. */
  setTimer(callback: () => void, delayMs: number): () => void;
}

/** 서버→클라이언트 이벤트와 페이로드. API의 Socket.IO 이벤트 이름과 같다. */
export interface RuntimeEventMap {
  'game:start': GameStart;
  'game:state': GameView;
  'hazard:granted': HazardGranted;
  'hazard:triggered': HazardTriggered;
  'turn:change': TurnChange;
  'game:over': GameOver;
  /** 상대의 조준·몸짓 상태 중계(표시용, 권한 상태 아님. DEC-036). 항상 volatile로 보낸다 */
  'aim:state': AimState;
  'emote:shown': EmoteShown;
}

export interface SendOptions {
  /** true면 오래된 틱을 건너뛰어도 되는 전송이다(알 이동 중 스냅샷). 나머지는 신뢰 전송이다. */
  volatile: boolean;
}

/** 좌석 하나에게 이벤트를 보낸다. 같은 이벤트를 양쪽에 보내는 일은 런타임이 두 번 호출한다. */
export interface RuntimeTransport {
  send<K extends keyof RuntimeEventMap>(
    seat: Seat,
    type: K,
    payload: RuntimeEventMap[K],
    options: SendOptions,
  ): void;
}

/** OPERATIONS 서버 로그의 `event` 이름 중 런타임이 만드는 것 */
export type RuntimeLogEvent =
  | 'start_commit'
  | 'turn_start'
  | 'shot'
  | 'hazard_use'
  | 'hazard_trigger'
  | 'leave'
  | 'forfeit'
  | 'tick_skipped'
  | 'game_over';

export interface RuntimeLogEntry {
  event: RuntimeLogEvent;
  /** 단조 시각(ms). UTC 시각(`ts`)과 roomId·userId는 서버 로거가 덧붙인다. */
  mono: number;
  /** 경기가 없는 대기실 이벤트(시작 전 `leave`)는 null이다. */
  gameId: string | null;
  turnId?: number;
  serverTick?: number;
  ingressSeq?: number;
  /** 명령을 낸 좌석. userId는 서버가 좌석에서 매핑한다. */
  seat?: Seat;
  /** 명령 판정 결과는 API 오류 코드 이름, 성공은 `ok`. `tick_skipped`는 버린 지연(ms) 문자열 */
  result?: string;
  /** `leave`는 이탈 사유, `forfeit`는 기권 사유, `game_over`는 종료 사유 */
  reason?: string;
}

export interface RuntimeLogger {
  log(entry: RuntimeLogEntry): void;
}

/** OPERATIONS 서버 로그 `leave`의 `reason`과 같은 이름. `leave_button`은 `room:leave`로 직접 나가는 경우다. */
export type LeaveReason = 'disconnect' | 'leave_button' | 'session_replaced';

/** OPERATIONS 서버 로그 `forfeit`의 `reason` */
export type ForfeitReason = 'leave' | 'command' | 'timeout';

/** 런타임이 `Game`에서 쓰는 범위. 테스트가 대역을 넣을 수 있게 좁혀 둔다. */
export type GameLike = Pick<
  Game,
  | 'gameId'
  | 'start'
  | 'advanceTo'
  | 'drainEvents'
  | 'isFinished'
  | 'getViewFor'
  | 'meta'
  | 'submitShot'
  | 'useHazard'
  | 'forfeit'
  | 'rotateBoard'
  | 'aimHazard'
>;

export interface RuntimeOptions {
  clock: RuntimeClock;
  transport: RuntimeTransport;
  logger?: RuntimeLogger;
  /** 경기가 끝나면 한 번 호출한다. 전적 저장(`finishOnce`)은 서버가 여기서 한다. */
  onFinished?: (result: GameOver) => void;
  /** 전송·콜백·로거·틱 처리에서 던진 오류를 받는다. 오류가 나도 틱 루프는 계속 돈다. */
  onError?: (error: unknown) => void;
  /** 기본은 `new Game(config)`. 테스트에서 대역을 넣을 때만 쓴다. */
  createGame?: (config: GameConfig) => GameLike;
  /** 재도전 대기 시간(ms). `game:over`의 `rematchDeadlineMs`를 채운다. 없으면 null이다. */
  rematchWindowMs?: number;
}

export type { CommandResult };
