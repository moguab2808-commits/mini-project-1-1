import type { RoomErrorCode } from '@alkkagi/shared';

/** 방 명령이 거부된 이유. ack의 `{ ok: false, error }`로 바뀐다. */
export class RoomError extends Error {
  constructor(
    readonly code: RoomErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const roomErrors = {
  invalidInput: () => new RoomError('INVALID_INPUT', '요청 값이 올바르지 않다.'),
  rateLimited: () => new RoomError('RATE_LIMITED', '요청이 너무 많다. 잠시 후 다시 시도해 달라.'),
  invalidCode: () => new RoomError('INVALID_CODE', '방 코드가 맞지 않는다.'),
  roomPlaying: () => new RoomError('ROOM_PLAYING', '게임이 시작된 방이다.'),
  roomNotFound: () => new RoomError('ROOM_NOT_FOUND', '방을 찾을 수 없다.'),
  codeTaken: () => new RoomError('CODE_TAKEN', '이미 쓰는 방 코드다. 다시 시도해 달라.'),
  alreadyInRoom: () => new RoomError('ALREADY_IN_ROOM', '이미 다른 방에 있다.'),
};
