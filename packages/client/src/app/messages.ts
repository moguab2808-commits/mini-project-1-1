// 오류 코드·끊김 사유에 대응하는 안내 문구. 요청 제한 문구는 PRD 화면 미정 사항(DEC-032)에서 정했다.
import type { RoomClosed, SessionReplaced } from '@alkkagi/shared';

export const RATE_LIMIT_MESSAGE = '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.';
export const GENERIC_ERROR_MESSAGE = '문제가 생겼어요. 잠시 후 다시 시도해 주세요.';
export const WAKING_SERVER_MESSAGE = '서버를 깨우는 중이에요';
export const NETWORK_ERROR_MESSAGE = '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.';

const AUTH_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: '닉네임 또는 비밀번호가 맞지 않아요.',
  NICKNAME_TAKEN: '이미 사용 중인 닉네임이에요.',
  RATE_LIMITED: RATE_LIMIT_MESSAGE,
  UNAUTHENTICATED: '로그인이 필요해요.',
};

const ROOM_MESSAGES: Record<string, string> = {
  INVALID_CODE: '방 코드가 맞지 않아요.',
  ROOM_PLAYING: '이미 게임이 시작된 방이에요.',
  ROOM_NOT_FOUND: '방을 찾을 수 없어요.',
  CODE_TAKEN: '방 코드가 겹쳤어요. 다시 시도해 주세요.',
  ALREADY_IN_ROOM: '이미 다른 방에 참여 중이에요.',
  RATE_LIMITED: RATE_LIMIT_MESSAGE,
};

/** REST 오류(`/api/*`)의 안내. 코드에 문구가 없으면 일반 오류 문구다. */
export function authErrorMessage(code: string | undefined): string {
  return (code && AUTH_MESSAGES[code]) || GENERIC_ERROR_MESSAGE;
}

/** 방 명령(ack)의 오류 안내. 즉시 참가에서 방이 없으면 입장할 방이 없다는 안내다. */
export function roomErrorMessage(code: string | undefined, quickJoin = false): string {
  if (quickJoin && code === 'ROOM_NOT_FOUND') return '입장할 수 있는 방이 없어요.';
  return (code && ROOM_MESSAGES[code]) || GENERIC_ERROR_MESSAGE;
}

/** 로비 연결이 끝나 로그인 화면으로 돌아올 때의 사유 안내. */
export function sessionEndMessage(
  reason: 'disconnect' | 'connect_error' | SessionReplaced['reason'],
): string {
  switch (reason) {
    case 'new_connection':
      return '다른 곳에서 접속해 로그아웃됐어요.';
    case 'password_changed':
      return '비밀번호가 바뀌어 로그아웃됐어요. 다시 로그인해 주세요.';
    case 'connect_error':
      return '서버에 연결하지 못했어요. 다시 로그인해 주세요.';
    case 'disconnect':
      return '연결이 끊겼어요. 다시 로그인해 주세요.';
  }
}

export function roomClosedMessage(reason: RoomClosed['reason']): string {
  return reason === 'host_left'
    ? '방장이 나가서 방이 닫혔어요.'
    : '재도전을 누르지 않아 방에서 나왔어요.';
}
