// 로컬 창 ↔ SharedWorker 권한 측(AI 대전은 전용 Worker) 메시지. LocalGameSession 내부 구현이며 GameSession 계약에 넣지 않는다.
import type { BoardId, CommandResult, Seat, ThemeId } from '@alkkagi/shared';
import type { GameEventMap } from '../session/game-session.ts';

export type LocalCommand =
  | { kind: 'emote'; payload: unknown }
  | { kind: 'shot'; payload: unknown }
  | { kind: 'hazard'; payload: unknown }
  | { kind: 'forfeit'; payload: unknown }
  | { kind: 'rematch'; payload: unknown }
  | { kind: 'rotate'; payload: unknown };

export type ClientMessage =
  | {
      t: 'hello';
      seat: Seat;
      board?: BoardId;
      /** 방 테마. 없거나 잘못된 값이면 기본 테마 */
      theme?: ThemeId;
      pieceCount?: number;
      /** AI 대전: 화면 표시용 내 닉네임·외형. 서버로 보내지 않는다. 로컬 2인은 쓰지 않는다 */
      profile?: { nickname?: string; appearance?: unknown };
    }
  | ({ t: 'cmd'; id: number } & LocalCommand)
  /** 발동 중인 후레쉬·물총 조준점(`hazard:aim`). 응답 없음 */
  | { t: 'hazardAim'; payload: unknown }
  /** 조준·몸짓 상태(`aim:update`). 응답 없이 상대에게 `aim:state`로 중계된다 */
  | { t: 'aim'; payload: unknown }
  | { t: 'ping' }
  | { t: 'bye' };

export const REJECT_REASONS = ['SEAT_TAKEN', 'SEAT_DEPARTED', 'INVALID_HELLO'] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export type WorkerMessage =
  | { t: 'welcome'; seat: Seat }
  | { t: 'rejected'; reason: RejectReason }
  | { t: 'result'; id: number; result: CommandResult }
  | {
      t: 'event';
      type: keyof GameEventMap;
      payload: GameEventMap[keyof GameEventMap];
    };
