// AI 대전의 GameSession(mode `ai`). 전용 Web Worker의 AI 권한 측과 로컬 2인과 같은 메시지로 통신한다.
// 서버 연결이 없고 결과를 어디에도 보내지 않는다(DEC-021).
import type { BoardId } from '@alkkagi/shared';
import { LocalGameSession, type SessionPort } from '../local/local-game-session.ts';
import type { GameMode } from '../session/game-session.ts';
import { HUMAN_SEAT } from './ai-authority.ts';

export interface AiMatchSettings {
  board: BoardId;
  pieceCount: 5 | 7 | 9;
}

export interface AiGameSessionOptions extends AiMatchSettings {
  /** 화면 표시용 내 정보(로그인 사용자). 서버로 보내지 않는다 */
  profile?: { nickname?: string; characterId?: string };
}

export class AiGameSession extends LocalGameSession {
  override readonly mode: GameMode = 'ai';

  /** `port`는 전용 워커(또는 테스트 대역). 하트비트는 쓰지 않는다: 워커가 창과 수명을 같이한다 */
  constructor(port: SessionPort, options: AiGameSessionOptions) {
    super(port, {
      seat: HUMAN_SEAT,
      board: options.board,
      pieceCount: options.pieceCount,
      profile: options.profile,
      heartbeatMs: 0,
    });
  }
}

/** 브라우저에서 AI 대전 워커를 띄워 세션을 만든다. `dispose()`가 워커도 끝낸다 */
export function startAiGame(options: AiGameSessionOptions): AiGameSession {
  const worker = new Worker(new URL('./ai-worker.ts', import.meta.url), {
    type: 'module',
    name: 'alkkagi-ai',
  });
  const port: SessionPort = {
    postMessage: (message) => {
      worker.postMessage(message);
    },
    get onmessage() {
      return worker.onmessage as SessionPort['onmessage'];
    },
    set onmessage(handler) {
      worker.onmessage = handler as ((event: MessageEvent) => void) | null;
    },
    close: () => {
      worker.terminate();
    },
  };
  return new AiGameSession(port, options);
}
