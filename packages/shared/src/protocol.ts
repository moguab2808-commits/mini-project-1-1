// 명령·이벤트·뷰의 Zod 스키마. docs/design/API.md의 필드를 옮긴 것이다.
import { z } from 'zod';
import { AppearanceSchema } from './avatar.ts';
import { BOARD_IDS, HAZARD_KINDS, THEME_IDS } from './constants.ts';

export const SeatSchema = z.union([z.literal(0), z.literal(1)]);
export const HazardKindSchema = z.enum(HAZARD_KINDS);
export const BoardIdSchema = z.enum(BOARD_IDS);
export const ThemeIdSchema = z.enum(THEME_IDS);

export const ERROR_CODES = [
  'INVALID_INPUT',
  'GAME_NOT_ACTIVE',
  'STALE_TURN',
  'SHOT_ALREADY_SUBMITTED',
  'NOT_YOUR_TURN',
  'INVALID_STONE',
  'PLAYER_STUNNED',
  'STALE_HAZARD',
  'HAZARD_COOLDOWN',
  'EMOTE_COOLDOWN',
  'HAZARD_OVERHEATED',
  'HAZARD_INVALID_TARGET',
  'HAZARD_NOT_USABLE',
  'REMATCH_NOT_AVAILABLE',
  'OUT_OF_REACH',
  'BOARD_ROTATE_NOT_ALLOWED',
  /** 서버 어댑터가 명령을 처리하다 예외가 났다. 클라이언트는 일반 오류 안내로 처리한다 */
  'INTERNAL_ERROR',
] as const;
export type GameErrorCode = (typeof ERROR_CODES)[number];

export type CommandResult =
  { ok: true } | { ok: false; error: { code: GameErrorCode; message: string } };

const finite = z.number().refine(Number.isFinite, 'finite');

/** 각도는 판 좌표계 라디안이며 (−π, π]만 받는다. 범위 밖·NaN은 INVALID_INPUT이다. */
export const ShotSubmitSchema = z.object({
  gameId: z.string().min(1),
  turnId: z.number().int().nonnegative(),
  stoneId: z.number().int().nonnegative(),
  angle: finite.refine((a) => a > -Math.PI && a <= Math.PI, '(-π, π]'),
  /** 0 초과 100 이하. 0은 발사하지 않는다 */
  power: finite.refine((p) => p > 0 && p <= 100, '(0, 100]'),
});
export type ShotSubmit = z.infer<typeof ShotSubmitSchema>;

/** 판 좌표계 점. `h`는 판 윗면 기준 높이로 후레쉬·물총 조준점에만 쓴다 */
const Point3Schema = z.object({ x: finite, y: finite, h: finite });

export const HazardTargetSchema = z.object({
  x: finite,
  y: finite,
  /** 후레쉬·물총: 조준점 높이. 손 위치→조준점 방향으로 발동 영역을 쏜다 */
  h: finite.optional(),
  orientation: z.enum(['horizontal', 'vertical']).optional(),
  /** 중력 구역: 미끄러지는 방향(판 좌표계 라디안). 권한 측이 45° 단위로 반올림한다 */
  directionRad: finite.optional(),
});
/** 분신술: 고른 내 알. 위치형이 아니라 따로 둔다 */
const DecoyTargetSchema = z.object({ stoneId: z.number().int().nonnegative() });
export type HazardTarget = z.infer<typeof HazardTargetSchema>;

export const HazardUseSchema = z.object({
  gameId: z.string().min(1),
  hazardInstanceId: z.string().min(1),
  target: z.union([HazardTargetSchema, DecoyTargetSchema]).optional(),
  direction: z.union([z.literal(-1), z.literal(1)]).optional(),
});
export type HazardUse = z.infer<typeof HazardUseSchema>;

/** `board:rotate`: 기본 판 돌리기. 내 턴·조준 단계에서만. 양수는 반시계(판 좌표계) */
export const BoardRotateSchema = z.object({
  gameId: z.string().min(1),
  turnId: z.number().int().nonnegative(),
  deltaDeg: finite.refine((d) => Math.abs(d) <= 90, '|deltaDeg| <= 90'),
});
export type BoardRotate = z.infer<typeof BoardRotateSchema>;

/** `hazard:aim`: 발동 중인 내 후레쉬·물총의 조준점을 옮긴다. ack 없이 최신 값만 의미가 있다 */
export const HazardAimSchema = z.object({
  gameId: z.string().min(1),
  hazardInstanceId: z.string().min(1),
  target: Point3Schema,
  active: z.boolean().optional(),
});
export type HazardAim = z.infer<typeof HazardAimSchema>;

/**
 * `aim:update`(C→S) / `aim:state`(S→C, 상대에게만 중계): 캐릭터 몸짓을 상대 화면에 보이기 위한
 * 조준 상태. 권한 상태가 아니며 서버는 검증 후 중계만 한다(DEC-036). 초당 20회 이하로 보낸다.
 */
export const AIM_MODES = ['idle', 'aim', 'charge', 'rotate', 'hold_hazard'] as const;
export const AimUpdateSchema = z.object({
  gameId: z.string().min(1),
  mode: z.enum(AIM_MODES),
  pull: finite.min(0).max(1).optional(),
  lookYaw: finite.min(-1.1).max(1.1).optional(),
  lookPitch: finite.min(-0.6).max(0.6).optional(),
  stoneId: z.number().int().nonnegative().optional(),
  /** 판 좌표계 라디안 */
  angle: finite.optional(),
  /** 0~100 */
  power: finite.refine((p) => p >= 0 && p <= 100, '[0, 100]').optional(),
  /** `hold_hazard`일 때 손에 든 방해요소 */
  kind: HazardKindSchema.optional(),
  /** `hold_hazard`일 때 조준점 */
  target: Point3Schema.optional(),
});
export type AimUpdate = z.infer<typeof AimUpdateSchema>;
export type AimState = AimUpdate & { seat: 0 | 1 };

/** 경기 표시 전용 감정표현. 규칙 상태·revision·전적에는 들어가지 않는다. */
export const EMOTE_IDS = ['yawn', 'taunt', 'doze', 'gg', 'laugh', 'surprise'] as const;
export const EmoteIdSchema = z.enum(EMOTE_IDS);
export type EmoteId = z.infer<typeof EmoteIdSchema>;
export const EmoteSendSchema = z
  .object({
    gameId: z.string().min(1),
    emote: EmoteIdSchema,
  })
  .strict();
export type EmoteSend = z.infer<typeof EmoteSendSchema>;
export const EmoteShownSchema = z
  .object({
    gameId: z.string().min(1),
    seat: SeatSchema,
    emote: EmoteIdSchema,
    atMs: finite,
  })
  .strict();
export type EmoteShown = z.infer<typeof EmoteShownSchema>;

export const GameForfeitSchema = z.object({ gameId: z.string().min(1) });
export type GameForfeit = z.infer<typeof GameForfeitSchema>;

export const GAME_OVER_REASONS = [
  'all_stones_out',
  'final_round',
  'forfeit',
  'timeout_forfeit',
] as const;

export const GameResultSchema = z.object({
  gameId: z.string(),
  winnerId: SeatSchema.nullable(),
  reason: z.enum(GAME_OVER_REASONS),
  remainingStones: z.tuple([z.number().int(), z.number().int()]),
  rematchDeadlineMs: z.number().nullable(),
});
export type GameOver = z.infer<typeof GameResultSchema>;

export const REMATCH_OUTCOMES = ['pending', 'accepted', 'expired'] as const;

/** `rematch:state` (docs/design/API.md). `gameId`는 끝난 경기의 id다. */
export const RematchStateSchema = z.object({
  gameId: z.string(),
  myRequested: z.boolean(),
  opponentRequested: z.boolean(),
  deadlineMs: z.number(),
  outcome: z.enum(REMATCH_OUTCOMES),
});
export type RematchState = z.infer<typeof RematchStateSchema>;

export const RematchRequestSchema = z.object({ gameId: z.string().min(1) });
export type RematchRequest = z.infer<typeof RematchRequestSchema>;

export const HazardGrantedSchema = z.object({
  gameId: z.string(),
  hazardInstanceId: z.string(),
  kind: HazardKindSchema,
  round: z.number().int(),
  /** 지급 뒤의 턴(교체 지급은 새 턴). 경기 시작 지급은 첫 턴 id다 */
  turnId: z.number().int(),
  replaced: z.boolean(),
});
export type HazardGranted = z.infer<typeof HazardGrantedSchema>;

export const HazardParamsSchema = z.object({
  x: z.number().optional(),
  y: z.number().optional(),
  orientation: z.enum(['horizontal', 'vertical']).optional(),
  directionRad: z.number().optional(),
  multiplier: z.number().optional(),
  angleDeg: z.number().optional(),
  /** 후레쉬·물총: 현재 조준점(판 좌표계)과 상대 얼굴 가림 정도(0~1, 최대 면적 대비) */
  aimX: z.number().optional(),
  aimY: z.number().optional(),
  aimH: z.number().optional(),
  coverage: z.number().optional(),
  /** 폭탄 `end`: 터져서 끝났는가(교체로 사라지면 false) */
  exploded: z.boolean().optional(),
  /** 분신술: 고른 알(시전자에게만) */
  stoneId: z.number().int().optional(),
});
export type HazardParams = z.infer<typeof HazardParamsSchema>;

export const HazardTriggeredSchema = z.object({
  gameId: z.string(),
  kind: HazardKindSchema,
  phase: z.enum(['start', 'end']),
  sourceSeat: SeatSchema,
  targetSeat: SeatSchema,
  startsAtMs: z.number(),
  expiresAtMs: z.number(),
  params: HazardParamsSchema.optional(),
});
export type HazardTriggered = z.infer<typeof HazardTriggeredSchema>;

export const TurnChangeSchema = z.object({
  gameId: z.string(),
  turnId: z.number().int(),
  round: z.number().int(),
  activePlayerId: SeatSchema,
  deadlineMs: z.number(),
  serverNowMs: z.number(),
  reason: z.enum(['start', 'resolved', 'timeout']),
});
export type TurnChange = z.infer<typeof TurnChangeSchema>;

export const GAME_PHASES = ['waiting', 'aiming', 'moving', 'resolving', 'finished'] as const;

const StoneViewSchema = z.object({
  id: z.number().int(),
  ownerId: SeatSchema,
  x: z.number(),
  y: z.number(),
  h: z.number(),
});

const EffectViewSchema = z.object({
  kind: HazardKindSchema,
  targetSeat: SeatSchema,
  startsAtMs: z.number(),
  expiresAtMs: z.number(),
  params: HazardParamsSchema.optional(),
});

const PrivateViewSchema = z.object({
  held: z
    .object({ hazardInstanceId: z.string(), kind: HazardKindSchema, round: z.number().int() })
    .nullable(),
  fatigueGauge: z.number().nullable(),
  overheated: z.boolean(),
  cooldownEndsAtMs: z.number().nullable(),
  usable: z.boolean(),
  timeoutStreak: z.number().int(),
  blind: z
    .object({
      kind: z.enum(['flashlight', 'water_gun']),
      startsAtMs: z.number(),
      expiresAtMs: z.number(),
      maxCoverage: z.number(),
      /** 현재 가림 정도(0~1, maxCoverage 대비). 상대 조준이 얼굴에 머무를수록 오른다 */
      coverage: z.number(),
      pattern: z.number().int(),
    })
    .optional(),
});

export const GameViewSchema = z.object({
  gameId: z.string(),
  serverTick: z.number().int(),
  serverNowMs: z.number(),
  revision: z.number().int(),
  phase: z.enum(GAME_PHASES),
  turnId: z.number().int(),
  round: z.number().int(),
  activePlayerId: SeatSchema,
  deadlineMs: z.number(),
  boardRotationDeg: z.number(),
  stones: z.array(StoneViewSchema),
  effects: z.array(EffectViewSchema),
  result: GameResultSchema.nullable(),
  /** 좌석별 진짜 남은 알 수. 상대 뷰의 `stones`에는 분신술 허상이 섞이므로 HUD는 이 값을 쓴다 */
  stoneCounts: z.tuple([z.number().int(), z.number().int()]),
  /** 시전자 뷰에만: 내 분신술 허상(상대 뷰에서는 `stones`에 일반 알로 들어간다) */
  decoys: z.array(z.object({ decoyId: z.number().int(), x: z.number(), y: z.number() })).optional(),
  private: PrivateViewSchema,
});
export type GameView = z.infer<typeof GameViewSchema>;

export const GameStartSchema = z.object({
  gameId: z.string(),
  seat: SeatSchema,
  players: z.tuple([
    z.object({ seat: SeatSchema, nickname: z.string(), appearance: AppearanceSchema }),
    z.object({ seat: SeatSchema, nickname: z.string(), appearance: AppearanceSchema }),
  ]),
  board: BoardIdSchema,
  theme: ThemeIdSchema,
  pieceCount: z.number().int(),
  finalRound: z.number().int(),
  turnSeconds: z.number().int(),
  view: GameViewSchema,
});
export type GameStart = z.infer<typeof GameStartSchema>;
