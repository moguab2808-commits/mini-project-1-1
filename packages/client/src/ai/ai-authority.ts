// AI 대전 권한 측. 전용 Web Worker 안에서 game-runtime + game-core로 경기를 진행하고,
// 좌석 1을 AI 컨트롤러가 맡는다(docs/design/LOCAL.md "AI 대전", DEC-021). 서버 연결·저장은 없다.
// 사람 창과의 메시지는 로컬 2인과 같은 형식(`../local/messages.ts`)을 쓴다.
import { RoomRuntime, type RuntimeClock } from '@alkkagi/game-runtime';
import {
  BOARD_IDS,
  DEFAULT_THEME,
  THEME_IDS,
  CharacterIdSchema,
  RematchRequestSchema,
  RULES,
  type BoardId,
  type CommandResult,
  type GameOver,
  type GameStart,
  type RematchState,
  type Seat,
  type ThemeId,
} from '@alkkagi/shared';
import type { PortLike } from '../local/local-authority.ts';
import type { ClientMessage, WorkerMessage } from '../local/messages.ts';
import type { GameEventMap } from '../session/game-session.ts';
import { AiController, type AiTuning } from './ai-controller.ts';

export const HUMAN_SEAT: Seat = 0;
export const AI_SEAT: Seat = 1;
export const DEFAULT_AI_REMATCH_WINDOW_MS = 15000;
const DEFAULT_BOARD: BoardId = 'standard';
const DEFAULT_PIECE_COUNT = 5;
const AI_NICKNAME = 'AI';

const INVALID: CommandResult = {
  ok: false,
  error: { code: 'INVALID_INPUT', message: '명령 값이 올바르지 않다' },
};
const NOT_AVAILABLE: CommandResult = {
  ok: false,
  error: { code: 'REMATCH_NOT_AVAILABLE', message: '재도전할 수 없다' },
};
const NOT_ACTIVE: CommandResult = {
  ok: false,
  error: { code: 'GAME_NOT_ACTIVE', message: '진행 중인 경기가 없다' },
};

export interface AiAuthorityOptions {
  clock: RuntimeClock;
  /** [0, 1) 난수. 경기 시드·AI 시드를 정한다. 기본은 `Math.random` */
  random?: () => number;
  rematchWindowMs?: number;
  aiTuning?: Partial<AiTuning>;
  onError?: (error: unknown) => void;
}

type CharacterId = GameStart['players'][0]['characterId'];

export class AiAuthority {
  private readonly opts: AiAuthorityOptions;
  private readonly random: () => number;
  private port: PortLike | null = null;
  private runtime: RoomRuntime | null = null;
  private controller: AiController | null = null;
  private config: { board: BoardId; theme: ThemeId; pieceCount: number } | null = null;
  private human: { nickname: string; characterId: CharacterId } = {
    nickname: '나',
    characterId: 'bear',
  };
  private gameCount = 0;
  private rematch: { gameId: string; deadlineMs: number; cancel: () => void } | null = null;
  private closed = false;

  constructor(options: AiAuthorityOptions) {
    this.opts = options;
    this.random = options.random ?? Math.random;
  }

  /** 사람 창 하나만 받는다. 좌석은 0으로 고정이다 */
  attach(port: PortLike): void {
    port.onmessage = (event) => {
      try {
        this.handle(port, event.data as ClientMessage);
      } catch (error) {
        this.opts.onError?.(error);
      }
    };
  }

  private handle(port: PortLike, msg: ClientMessage): void {
    if (this.closed) return;
    if (!this.port) {
      if (msg?.t !== 'hello') return;
      if (msg.seat !== HUMAN_SEAT) {
        port.postMessage({ t: 'rejected', reason: 'INVALID_HELLO' });
        return;
      }
      this.port = port;
      this.config = {
        board: BOARD_IDS.includes(msg.board as BoardId) ? (msg.board as BoardId) : DEFAULT_BOARD,
        theme: THEME_IDS.includes(msg.theme as ThemeId) ? (msg.theme as ThemeId) : DEFAULT_THEME,
        pieceCount: (RULES.pieceCounts as readonly number[]).includes(msg.pieceCount as number)
          ? (msg.pieceCount as number)
          : DEFAULT_PIECE_COUNT,
      };
      const character = CharacterIdSchema.safeParse(msg.profile?.characterId);
      const nickname = typeof msg.profile?.nickname === 'string' ? msg.profile.nickname.trim() : '';
      this.human = {
        nickname: nickname.slice(0, 20) || '나',
        characterId: character.success ? character.data : 'bear',
      };
      port.postMessage({ t: 'welcome', seat: HUMAN_SEAT });
      this.startGame();
      return;
    }
    if (port !== this.port) return;
    switch (msg?.t) {
      case 'cmd':
        this.command(msg);
        return;
      case 'hazardAim':
        void this.runtime?.aimHazard(HUMAN_SEAT, msg.payload as never);
        return;
      case 'aim':
        this.runtime?.relayAim(HUMAN_SEAT, msg.payload);
        return;
      case 'bye':
        this.close();
        return;
      default:
        return;
    }
  }

  private command(msg: Extract<ClientMessage, { t: 'cmd' }>): void {
    const runtime = this.runtime;
    let result: Promise<CommandResult>;
    if (msg.kind === 'rematch') result = Promise.resolve(this.requestRematch(msg.payload));
    else if (!runtime) result = Promise.resolve(NOT_ACTIVE);
    else if (msg.kind === 'shot') result = runtime.submitShot(HUMAN_SEAT, msg.payload as never);
    else if (msg.kind === 'hazard') result = runtime.useHazard(HUMAN_SEAT, msg.payload as never);
    else if (msg.kind === 'forfeit') result = runtime.forfeit(HUMAN_SEAT, msg.payload as never);
    else if (msg.kind === 'rotate') result = runtime.rotateBoard(HUMAN_SEAT, msg.payload as never);
    else result = Promise.resolve(INVALID);
    void result.then((r) => {
      this.post({ t: 'result', id: msg.id, result: r });
    });
  }

  // ───────── 경기 ─────────

  private startGame(): void {
    const config = this.config ?? {
      board: DEFAULT_BOARD,
      theme: DEFAULT_THEME,
      pieceCount: DEFAULT_PIECE_COUNT,
    };
    this.runtime ??= new RoomRuntime({
      clock: this.opts.clock,
      transport: {
        send: (seat, type, payload) => {
          if (seat === HUMAN_SEAT) {
            this.post({ t: 'event', type, payload } as WorkerMessage);
          } else {
            // AI는 자기 좌석으로 온 이벤트만 본다. 틱 처리 중 재진입을 피하려고 다음 마이크로태스크에 넘긴다
            const controller = this.controller;
            queueMicrotask(() => {
              controller?.receive(type as keyof GameEventMap, payload as never);
            });
          }
        },
      },
      onFinished: (result) => {
        this.openRematch(result);
      },
      onError: this.opts.onError,
      rematchWindowMs: this.opts.rematchWindowMs ?? DEFAULT_AI_REMATCH_WINDOW_MS,
    });
    const runtime = this.runtime;
    this.controller?.dispose();
    this.controller = new AiController({
      seat: AI_SEAT,
      clock: this.opts.clock,
      seed: this.seed(),
      tuning: this.opts.aiTuning,
      onError: this.opts.onError,
      actions: {
        submitShot: (cmd) => runtime.submitShot(AI_SEAT, cmd),
        useHazard: (cmd) => runtime.useHazard(AI_SEAT, cmd),
        rotateBoard: (cmd) => runtime.rotateBoard(AI_SEAT, cmd),
        aimHazard: (cmd) => {
          void runtime.aimHazard(AI_SEAT, cmd);
        },
        sendAim: (update) => {
          runtime.relayAim(AI_SEAT, update);
        },
      },
    });
    this.gameCount += 1;
    this.rematch?.cancel();
    this.rematch = null;
    runtime.startGame({
      gameId: `ai-${String(this.gameCount)}`,
      board: config.board,
      theme: config.theme,
      pieceCount: config.pieceCount,
      seed: this.seed(),
      players: [
        this.human,
        { nickname: AI_NICKNAME, characterId: aiCharacterFor(this.human.characterId) },
      ],
    });
  }

  private seed(): number {
    return Math.floor(this.random() * 0x1_0000_0000);
  }

  // ───────── 재도전: AI는 항상 받는다 ─────────

  private openRematch(result: GameOver): void {
    this.rematch?.cancel();
    this.rematch = null;
    const deadlineMs = result.rematchDeadlineMs;
    if (deadlineMs === null || this.closed) return;
    const gameId = result.gameId;
    const cancel = this.opts.clock.setTimer(
      () => {
        if (this.rematch?.gameId !== gameId) return;
        this.rematch = null;
        this.publishRematch(gameId, deadlineMs, false, 'expired');
      },
      Math.max(0, deadlineMs - this.opts.clock.now()),
    );
    this.rematch = { gameId, deadlineMs, cancel };
  }

  private requestRematch(payload: unknown): CommandResult {
    const parsed = RematchRequestSchema.safeParse(payload);
    if (!parsed.success) return INVALID;
    const r = this.rematch;
    if (!r || r.gameId !== parsed.data.gameId || this.opts.clock.now() >= r.deadlineMs) {
      return NOT_AVAILABLE;
    }
    this.publishRematch(r.gameId, r.deadlineMs, true, 'accepted');
    this.startGame();
    return { ok: true };
  }

  private publishRematch(
    gameId: string,
    deadlineMs: number,
    myRequested: boolean,
    outcome: RematchState['outcome'],
  ): void {
    this.post({
      t: 'event',
      type: 'rematch:state',
      payload: {
        gameId,
        myRequested,
        opponentRequested: outcome === 'accepted',
        deadlineMs,
        outcome,
      },
    });
  }

  /** 사람이 나가면 경기를 버린다. 결과는 어디에도 보내지 않는다 */
  private close(): void {
    if (this.closed) return;
    this.closed = true;
    this.rematch?.cancel();
    this.rematch = null;
    this.controller?.dispose();
    this.controller = null;
    this.runtime?.dispose();
    this.runtime = null;
    if (this.port) this.port.onmessage = null;
    this.port = null;
  }

  private post(message: WorkerMessage): void {
    try {
      this.port?.postMessage(message);
    } catch (error) {
      this.opts.onError?.(error);
    }
  }
}

/** 사람과 다른 캐릭터를 고른다 */
function aiCharacterFor(human: CharacterId): CharacterId {
  return human === 'cat' ? 'fox' : 'cat';
}
