// 명령·이벤트·뷰의 Zod 스키마. docs/design/API.md의 필드를 옮긴 것이다.
import { z } from 'zod';
import { BOARD_IDS, HAZARD_KINDS } from './constants.ts';

export const SeatSchema = z.union([z.literal(0), z.literal(1)]);
export const HazardKindSchema = z.enum(HAZARD_KINDS);
export const BoardIdSchema = z.enum(BOARD_IDS);
export const CharacterIdSchema = z.enum(['bear', 'cat', 'fox', 'rabbit', 'owl', 'frog']);

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
  'HAZARD_OVERHEATED',
  'HAZARD_INVALID_TARGET',
  'HAZARD_NOT_USABLE',
  'REMATCH_NOT_AVAILABLE',
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

export const HazardTargetSchema = z.object({
  x: finite,
  y: finite,
  orientation: z.enum(['horizontal', 'vertical']).optional(),
});
export type HazardTarget = z.infer<typeof HazardTargetSchema>;

export const HazardUseSchema = z.object({
  gameId: z.string().min(1),
  hazardInstanceId: z.string().min(1),
  target: HazardTargetSchema.optional(),
});
export type HazardUse = z.infer<typeof HazardUseSchema>;

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
  private: PrivateViewSchema,
});
export type GameView = z.infer<typeof GameViewSchema>;

export const GameStartSchema = z.object({
  gameId: z.string(),
  seat: SeatSchema,
  players: z.tuple([
    z.object({ seat: SeatSchema, nickname: z.string(), characterId: CharacterIdSchema }),
    z.object({ seat: SeatSchema, nickname: z.string(), characterId: CharacterIdSchema }),
  ]),
  board: BoardIdSchema,
  pieceCount: z.number().int(),
  finalRound: z.number().int(),
  turnSeconds: z.number().int(),
  view: GameViewSchema,
});
export type GameStart = z.infer<typeof GameStartSchema>;
