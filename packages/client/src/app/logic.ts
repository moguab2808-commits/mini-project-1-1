// 계정·로비 화면이 쓰는 순수 로직(입력 검증, 전적 표시, 방 코드). 화면 컴포넌트에서 분리해 단위 검증한다.
import {
  NICKNAME_MAX,
  NICKNAME_MIN,
  NicknameSchema,
  PASSWORD_MAX,
  PASSWORD_MIN,
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  ROOM_TITLE_MAX,
  type PlayerRecord,
  type RoomSummary,
} from '@alkkagi/shared';

/** 승률(%)을 반올림한 정수로 돌려준다. 분모는 전체 경기 수(무승부 포함)이며 경기가 없으면 null이다. */
export function winRatePercent(record: PlayerRecord): number | null {
  if (record.totalGames <= 0) return null;
  return Math.round((record.wins / record.totalGames) * 100);
}

export function formatWinRate(record: PlayerRecord): string {
  const percent = winRatePercent(record);
  return percent === null ? '-' : `${String(percent)}%`;
}

/** 판수 / 승 / 패 / 무 */
export function formatRecord(record: PlayerRecord): string {
  return `${String(record.totalGames)}판 ${String(record.wins)}승 ${String(record.losses)}패 ${String(record.draws)}무`;
}

export interface SignupInput {
  nickname: string;
  password: string;
  passwordConfirm: string;
}

/** 가입 입력 검사. 첫 오류 문구를 돌려주고 문제가 없으면 null이다. 비밀번호 확인은 화면에서만 비교한다. */
export function validateSignup(input: SignupInput): string | null {
  const nickname = NicknameSchema.safeParse(input.nickname);
  if (!nickname.success) {
    return `닉네임은 한글·영문·숫자로 ${String(NICKNAME_MIN)}~${String(NICKNAME_MAX)}자여야 해요.`;
  }
  if (input.password.length < PASSWORD_MIN || input.password.length > PASSWORD_MAX) {
    return `비밀번호는 ${String(PASSWORD_MIN)}자 이상 ${String(PASSWORD_MAX)}자 이하여야 해요.`;
  }
  if (input.password !== input.passwordConfirm) return '비밀번호 확인이 달라요.';
  return null;
}

export function validateLogin(nickname: string, password: string): string | null {
  if (nickname.trim() === '' || password === '') return '닉네임과 비밀번호를 입력해 주세요.';
  return null;
}

export interface PasswordChangeInput {
  currentPassword: string;
  newPassword: string;
  newPasswordConfirm: string;
}

export function validatePasswordChange(input: PasswordChangeInput): string | null {
  if (input.currentPassword === '') return '현재 비밀번호를 입력해 주세요.';
  if (input.newPassword.length < PASSWORD_MIN || input.newPassword.length > PASSWORD_MAX) {
    return `새 비밀번호는 ${String(PASSWORD_MIN)}자 이상 ${String(PASSWORD_MAX)}자 이하여야 해요.`;
  }
  if (input.newPassword !== input.newPasswordConfirm) return '새 비밀번호 확인이 달라요.';
  return null;
}

/** 코드 입력칸에 들어온 값(직접 입력·붙여넣기)을 영문 대문자·숫자만 남기고 6자로 자른다. */
export function normalizeCodeInput(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ROOM_CODE_LENGTH);
}

/**
 * 코드 칸 하나(`index`)에 입력이 들어왔을 때의 새 코드와 다음에 포커스할 칸을 구한다. 이미 글자가 있는 칸에
 * 입력하면 칸 값에 옛 글자와 새 글자가 함께 들어오므로 옛 글자를 빼고 새 글자로 그 자리를 바꾼다.
 */
export function applyCodeCellInput(
  code: string,
  index: number,
  rawValue: string,
): { code: string; focus: number } {
  const old = code[index] ?? '';
  let typed = normalizeCodeInput(rawValue);
  if (typed === '') {
    return { code: code.slice(0, index) + code.slice(index + 1), focus: index };
  }
  if (old !== '' && typed.length > 1) {
    const at = typed.indexOf(old);
    if (at >= 0) typed = typed.slice(0, at) + typed.slice(at + 1);
  }
  const next = normalizeCodeInput(code.slice(0, index) + typed + code.slice(index + old.length));
  return { code: next, focus: Math.min(index + typed.length, next.length, ROOM_CODE_LENGTH - 1) };
}

export function isCompleteCode(code: string): boolean {
  return code.length === ROOM_CODE_LENGTH;
}

/** 비공개 방 코드 6자리(혼동되는 0/O·1/I 제외). `random`은 [0, 1)을 돌려주는 함수다. */
export function generateRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
    const index = Math.min(
      ROOM_CODE_ALPHABET.length - 1,
      Math.floor(random() * ROOM_CODE_ALPHABET.length),
    );
    code += ROOM_CODE_ALPHABET[index];
  }
  return code;
}

export function defaultRoomTitle(nickname: string): string {
  return `${nickname}의 방`.slice(0, ROOM_TITLE_MAX);
}

/** 목록에서 입장 버튼을 쓸 수 있는 방(대기 중). 게임 중인 방에는 입장할 수 없다(관전 없음). */
export function canEnter(room: Pick<RoomSummary, 'status'>): boolean {
  return room.status === 'waiting';
}
