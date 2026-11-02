// 방 이벤트·REST의 스키마. docs/design/API.md의 "방 이벤트 필드"와 REST `GET /api/rooms`를 옮긴 것이다.
import { z } from 'zod';
import { MeSchema } from './auth.ts';
import { BoardIdSchema } from './protocol.ts';

/**
 * 방 Socket.IO 명령의 ack 오류 코드. 코드 표의 기준은 docs/design/API.md다.
 * `INVALID_INPUT`·`RATE_LIMITED`·`INTERNAL_ERROR`는 REST(`AUTH_ERROR_CODES`)에도 있다.
 */
export const ROOM_ERROR_CODES = [
  'INVALID_INPUT',
  'RATE_LIMITED',
  'INVALID_CODE',
  'ROOM_PLAYING',
  'ROOM_NOT_FOUND',
  'CODE_TAKEN',
  'ALREADY_IN_ROOM',
  'INTERNAL_ERROR',
] as const;
export type RoomErrorCode = (typeof ROOM_ERROR_CODES)[number];

/** 비공개 방 코드: 6자리, 영문 대문자·숫자에서 혼동되는 0/O, 1/I를 뺀다. */
export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const RoomCodeSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{6}$/);

export const ROOM_TITLE_MAX = 20;

export const RoomCreateSchema = z
  .object({
    title: z.string().min(1).max(ROOM_TITLE_MAX),
    isPublic: z.boolean(),
    pieceCount: z.union([z.literal(5), z.literal(7), z.literal(9)]),
    board: BoardIdSchema,
    code: RoomCodeSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.isPublic && value.code !== undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['code'],
        message: '공개 방에는 코드를 보내지 않는다',
      });
    }
    if (!value.isPublic && value.code === undefined) {
      ctx.addIssue({
        code: 'custom',
        path: ['code'],
        message: '비공개 방에는 코드가 필요하다',
      });
    }
  });
export type RoomCreate = z.infer<typeof RoomCreateSchema>;

/**
 * 공개 방은 `roomId`, 비공개 방은 `code`로 입장한다. `code`의 형식은 검사하지 않는다.
 * 형식이 틀린 코드도 맞지 않는 코드와 같이 `INVALID_CODE`로 응답하기 위해서다.
 */
export const RoomJoinSchema = z
  .object({
    roomId: z.number().int().positive().optional(),
    code: z.string().min(1).max(32).optional(),
  })
  .refine((value) => value.roomId !== undefined || value.code !== undefined, {
    message: 'roomId 또는 code가 필요하다',
  });
export type RoomJoin = z.infer<typeof RoomJoinSchema>;

export const ROOM_STATUSES = ['waiting', 'playing'] as const;
export const RoomStatusSchema = z.enum(ROOM_STATUSES);
export type RoomStatus = z.infer<typeof RoomStatusSchema>;

/** 방 안에서 보이는 사용자. 사용자 번호는 넣지 않는다. */
export const MemberSchema = MeSchema;
export type Member = z.infer<typeof MemberSchema>;

/** `GET /api/rooms`의 항목. 비공개 방의 코드·알 개수·판·참여 인원은 넣지 않는다. */
export const RoomSummarySchema = z.object({
  roomId: z.number().int(),
  title: z.string(),
  isPublic: z.boolean(),
  status: RoomStatusSchema,
  host: MemberSchema,
});
export type RoomSummary = z.infer<typeof RoomSummarySchema>;

/** `room:state`. `code`는 비공개 방의 방장에게만 담는다. */
export const RoomStateSchema = z.object({
  roomId: z.number().int(),
  title: z.string(),
  isPublic: z.boolean(),
  pieceCount: z.number().int(),
  board: BoardIdSchema,
  status: RoomStatusSchema,
  host: MemberSchema,
  guest: MemberSchema.nullable(),
  isHost: z.boolean(),
  code: z.string().optional(),
});
export type RoomState = z.infer<typeof RoomStateSchema>;

export const RoomClosedSchema = z.object({ reason: z.literal('host_left') });
export type RoomClosed = z.infer<typeof RoomClosedSchema>;

/** 방 명령의 ack. 성공에는 명령별 값(`roomId` 등)이 붙는다. */
export type RoomAck<T extends object = object> =
  ({ ok: true } & T) | { ok: false; error: { code: RoomErrorCode; message: string } };
