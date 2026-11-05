// 실행: 루트에서 npm test (Vitest). 계정·로비 화면의 순수 로직·REST 클라이언트·저장 설정을 검증한다.
import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  DEFAULT_APPEARANCE,
  ROOM_CODE_ALPHABET,
  RoomCodeSchema,
  THEME_IDS,
  type RoomSummary,
  type ThemeId,
} from '@alkkagi/shared';
import { ApiError, createApi } from './api.ts';
import {
  applyCodeCellInput,
  canEnter,
  defaultRoomTitle,
  formatRecord,
  formatWinRate,
  generateRoomCode,
  groupRoomsByTheme,
  isCompleteCode,
  normalizeCodeInput,
  validateLogin,
  validatePasswordChange,
  validateSignup,
  winRatePercent,
} from './logic.ts';
import {
  RATE_LIMIT_MESSAGE,
  GENERIC_ERROR_MESSAGE,
  authErrorMessage,
  roomClosedMessage,
  roomErrorMessage,
  sessionEndMessage,
} from './messages.ts';
import {
  DEFAULT_VOLUME,
  clampVolume,
  hasSeenRules,
  loadVolume,
  loadVolumeOf,
  loadSoundOn,
  saveSoundOn,
  saveVolumeOf,
  DEFAULT_VOLUMES,
  markRulesSeen,
  saveVolume,
} from './settings.ts';

const record = (totalGames: number, wins: number, losses: number) => ({
  totalGames,
  wins,
  losses,
  draws: totalGames - wins - losses,
});

test('승률: 전체 경기 수(무승부 포함)로 나누고 경기가 없으면 표시하지 않는다', () => {
  assert.equal(winRatePercent(record(0, 0, 0)), null);
  assert.equal(formatWinRate(record(0, 0, 0)), '-');
  assert.equal(formatWinRate(record(3, 1, 1)), '33%');
  assert.equal(formatWinRate(record(3, 2, 0)), '67%');
  assert.equal(formatWinRate(record(4, 4, 0)), '100%');
});

test('전적 표기: 판수·승·패·무', () => {
  assert.equal(formatRecord(record(10, 6, 3)), '10판 6승 3패 1무');
});

test('가입 검사: 닉네임·비밀번호 길이와 확인 일치', () => {
  const ok = { nickname: '곰돌이1', password: 'password1', passwordConfirm: 'password1' };
  assert.equal(validateSignup(ok), null);
  assert.match(validateSignup({ ...ok, nickname: 'a' }) ?? '', /닉네임/);
  assert.match(validateSignup({ ...ok, nickname: '곰 돌이' }) ?? '', /닉네임/);
  assert.match(validateSignup({ ...ok, nickname: '가'.repeat(13) }) ?? '', /닉네임/);
  assert.match(
    validateSignup({ ...ok, password: 'short', passwordConfirm: 'short' }) ?? '',
    /비밀번호/,
  );
  assert.match(
    validateSignup({ ...ok, password: 'a'.repeat(65), passwordConfirm: 'a'.repeat(65) }) ?? '',
    /비밀번호/,
  );
  assert.equal(validateSignup({ ...ok, passwordConfirm: 'password2' }), '비밀번호 확인이 달라요.');
});

test('로그인·비밀번호 변경 검사', () => {
  assert.notEqual(validateLogin('', 'x'), null);
  assert.notEqual(validateLogin('곰', ''), null);
  assert.equal(validateLogin('곰', 'x'), null);
  const ok = { currentPassword: 'old', newPassword: 'newpass12', newPasswordConfirm: 'newpass12' };
  assert.equal(validatePasswordChange(ok), null);
  assert.notEqual(validatePasswordChange({ ...ok, currentPassword: '' }), null);
  assert.notEqual(
    validatePasswordChange({ ...ok, newPassword: 'short', newPasswordConfirm: 'short' }),
    null,
  );
  assert.notEqual(validatePasswordChange({ ...ok, newPasswordConfirm: 'different1' }), null);
});

test('코드 입력: 영문은 대문자로, 기호·공백은 버리고, 6자까지만 받는다', () => {
  assert.equal(normalizeCodeInput('ab3 de-f'), 'AB3DEF');
  assert.equal(normalizeCodeInput('abcdefghij'), 'ABCDEF');
  assert.equal(normalizeCodeInput(' k7m2\n'), 'K7M2');
  assert.equal(isCompleteCode('AB3DEF'), true);

  // 코드 칸 입력: 글자가 있는 칸에 입력하면 그 자리만 바꾼다(앞뒤로 입력돼도 같다)
  assert.deepEqual(applyCodeCellInput('ABCDEF', 2, 'CX'), { code: 'ABXDEF', focus: 3 });
  assert.deepEqual(applyCodeCellInput('ABCDEF', 2, 'XC'), { code: 'ABXDEF', focus: 3 });
  assert.deepEqual(applyCodeCellInput('ABCDEF', 2, 'CC'), { code: 'ABCDEF', focus: 3 });
  assert.deepEqual(applyCodeCellInput('ABCDEF', 5, 'FZ'), { code: 'ABCDEZ', focus: 5 });
  // 빈 칸에 입력하면 이어 붙이고 다음 빈 칸으로, 지우면 그 칸만 빠진다
  assert.deepEqual(applyCodeCellInput('AB', 2, 'c'), { code: 'ABC', focus: 3 });
  assert.deepEqual(applyCodeCellInput('AB', 4, 'z'), { code: 'ABZ', focus: 3 });
  assert.deepEqual(applyCodeCellInput('ABCDEF', 2, ''), { code: 'ABDEF', focus: 2 });
  // 허용하지 않는 글자는 무시한다
  assert.deepEqual(applyCodeCellInput('AB', 2, '-'), { code: 'AB', focus: 2 });
  assert.equal(isCompleteCode('AB3DE'), false);
});

test('방 코드 생성: 6자리이고 혼동 문자가 없으며 서버 스키마를 만족한다', () => {
  for (let i = 0; i < 200; i += 1) {
    const code = generateRoomCode();
    assert.equal(code.length, 6);
    assert.ok(RoomCodeSchema.safeParse(code).success, code);
    assert.ok(![...code].some((c) => '0OI1'.includes(c)), code);
  }
  // 난수가 경계값(0, 1에 가까운 값)이어도 알파벳 범위를 벗어나지 않는다
  assert.equal(
    generateRoomCode(() => 0),
    ROOM_CODE_ALPHABET[0]!.repeat(6),
  );
  assert.equal(
    generateRoomCode(() => 0.9999999),
    ROOM_CODE_ALPHABET.at(-1)!.repeat(6),
  );
});

test('방 제목 기본값은 20자를 넘지 않는다. 게임 중인 방에는 입장할 수 없다', () => {
  assert.equal(defaultRoomTitle('곰돌이'), '곰돌이의 방');
  assert.ok(defaultRoomTitle('가'.repeat(12)).length <= 20);
  assert.equal(canEnter({ status: 'waiting' }), true);
  assert.equal(canEnter({ status: 'playing' }), false);
});

test('방 목록을 테마별 지역으로 나눈다: 순서는 THEME_IDS, 대기·전체 수, 빈 지역 포함(DEC-070)', () => {
  const room = (roomId: number, theme: ThemeId, status: 'waiting' | 'playing') =>
    ({ roomId, theme, status }) as Pick<RoomSummary, 'roomId' | 'theme' | 'status'>;
  const regions = groupRoomsByTheme([
    room(1, 'beach', 'waiting'),
    room(2, 'bar', 'playing'),
    room(3, 'bar', 'waiting'),
    room(4, 'beach', 'playing'),
    room(5, 'bar', 'waiting'),
  ]);
  assert.deepEqual(
    regions.map((r) => r.theme),
    [...THEME_IDS],
  );
  const [bar, rooftop, classroom, beach] = regions;
  assert.deepEqual(
    bar!.rooms.map((r) => r.roomId),
    [2, 3, 5],
    '입력 순서를 유지한다',
  );
  assert.equal(bar!.waiting, 2);
  assert.equal(bar!.total, 3);
  assert.deepEqual([rooftop!.rooms.length, rooftop!.waiting, rooftop!.total], [0, 0, 0]);
  assert.deepEqual([classroom!.rooms.length, classroom!.waiting, classroom!.total], [0, 0, 0]);
  assert.deepEqual([beach!.waiting, beach!.total], [1, 2]);
});

test('오류 안내: 코드별 문구, 모르는 코드는 일반 오류 문구', () => {
  assert.equal(authErrorMessage('RATE_LIMITED'), RATE_LIMIT_MESSAGE);
  assert.equal(RATE_LIMIT_MESSAGE, '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.');
  assert.match(authErrorMessage('NICKNAME_TAKEN'), /닉네임/);
  assert.match(authErrorMessage('INVALID_CREDENTIALS'), /닉네임 또는 비밀번호/);
  assert.equal(authErrorMessage('SOMETHING_NEW'), GENERIC_ERROR_MESSAGE);
  assert.equal(authErrorMessage(undefined), GENERIC_ERROR_MESSAGE);
  assert.match(roomErrorMessage('INVALID_CODE'), /코드/);
  assert.match(roomErrorMessage('ROOM_PLAYING'), /게임/);
  assert.match(roomErrorMessage('ROOM_NOT_FOUND'), /찾을 수 없/);
  assert.equal(roomErrorMessage('ROOM_NOT_FOUND', true), '입장할 수 있는 방이 없어요.');
  assert.match(roomErrorMessage('ALREADY_IN_ROOM'), /이미/);
  assert.equal(roomErrorMessage('RATE_LIMITED'), RATE_LIMIT_MESSAGE);
  assert.equal(roomErrorMessage('INTERNAL_ERROR'), GENERIC_ERROR_MESSAGE);
});

test('끊김·방 닫힘 사유 안내', () => {
  for (const reason of [
    'disconnect',
    'connect_error',
    'new_connection',
    'password_changed',
  ] as const) {
    assert.ok(sessionEndMessage(reason).length > 0);
  }
  assert.notEqual(sessionEndMessage('new_connection'), sessionEndMessage('disconnect'));
  assert.match(roomClosedMessage('host_left'), /방장/);
  assert.match(roomClosedMessage('rematch_timeout'), /재도전/);
});

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

const me = { nickname: '곰돌이', appearance: DEFAULT_APPEARANCE, record: record(0, 0, 0) };
const look = { ...DEFAULT_APPEARANCE, hair: 2, lips: 4 };

test('REST 클라이언트: 경로·메서드·본문과 성공 응답 해석', async () => {
  const calls: { path: string; method: string | undefined; body: unknown }[] = [];
  const api = createApi((path, init) => {
    calls.push({
      path,
      method: init?.method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (path === '/api/auth/signup') return Promise.resolve(jsonResponse(201, {}));
    if (path === '/api/auth/logout') return Promise.resolve(new Response(null, { status: 204 }));
    if (path === '/api/me/password') return Promise.resolve(new Response(null, { status: 204 }));
    if (path === '/api/rooms') return Promise.resolve(jsonResponse(200, { rooms: [] }));
    return Promise.resolve(jsonResponse(200, { user: me }));
  });
  await api.signup({ nickname: '곰돌이', password: 'password1' });
  assert.deepEqual(await api.login({ nickname: '곰돌이', password: 'password1' }), me);
  assert.deepEqual(await api.me(), me);
  assert.deepEqual(await api.changeAppearance(look), me);
  await api.changePassword({ currentPassword: 'password1', newPassword: 'password2' });
  assert.deepEqual(await api.listRooms(), []);
  await api.logout();
  assert.deepEqual(
    calls.map((c) => `${c.method ?? ''} ${c.path}`),
    [
      'POST /api/auth/signup',
      'POST /api/auth/login',
      'GET /api/me',
      'PATCH /api/me/appearance',
      'PATCH /api/me/password',
      'GET /api/rooms',
      'POST /api/auth/logout',
    ],
  );
  assert.deepEqual(calls[3]?.body, { appearance: look });
  assert.equal(calls[2]?.body, undefined);
});

test('REST 클라이언트: 오류 본문의 상태와 코드를 ApiError로 올린다', async () => {
  const api = createApi(() =>
    Promise.resolve(
      jsonResponse(429, { error: { code: 'RATE_LIMITED', message: 'x' } }, { 'Retry-After': '12' }),
    ),
  );
  await assert.rejects(
    () => api.login({ nickname: '곰돌이', password: 'p' }),
    (error: unknown) =>
      error instanceof ApiError && error.status === 429 && error.code === 'RATE_LIMITED',
  );
  const conflict = createApi(() =>
    Promise.resolve(jsonResponse(409, { error: { code: 'NICKNAME_TAKEN', message: 'x' } })),
  );
  await assert.rejects(
    () => conflict.signup({ nickname: '곰돌이', password: 'password1' }),
    (error: unknown) => error instanceof ApiError && error.code === 'NICKNAME_TAKEN',
  );
});

test('REST 클라이언트: JSON이 아닌 오류 응답은 일반 오류로 다룬다', async () => {
  const api = createApi(() =>
    Promise.resolve(new Response('<html>bad gateway</html>', { status: 502 })),
  );
  await assert.rejects(
    () => api.me(),
    (error: unknown) =>
      error instanceof ApiError && error.status === 502 && error.code === 'INTERNAL_ERROR',
  );
});

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

test('설정 저장: 음량 범위 보정, 저장·복원, 저장소가 없거나 던져도 기본값', () => {
  assert.equal(clampVolume(150), 100);
  assert.equal(clampVolume(-5), 0);
  assert.equal(clampVolume(Number.NaN), DEFAULT_VOLUME);
  assert.equal(loadVolume(memoryStorage()), DEFAULT_VOLUME);
  const storage = memoryStorage();
  saveVolume(35, storage);
  assert.equal(loadVolume(storage), 35);
  assert.equal(loadVolume(memoryStorage({ 'alkkagi.volume': 'abc' })), DEFAULT_VOLUME);
  // 배경음악·배경 소리는 따로 저장하고 기본값이 다르다(DEC-084)
  assert.equal(loadVolumeOf('music', memoryStorage()), DEFAULT_VOLUMES.music);
  saveVolumeOf('music', 20, storage);
  assert.equal(loadVolumeOf('music', storage), 20);
  assert.equal(loadVolumeOf('sfx', storage), 35);
  assert.equal(loadVolumeOf('ambience', storage), DEFAULT_VOLUMES.ambience);
  // 켜기·끄기는 음량과 따로 저장하고 기본은 켜짐
  assert.equal(loadSoundOn('music', memoryStorage()), true);
  saveSoundOn('music', false, storage);
  assert.equal(loadSoundOn('music', storage), false);
  assert.equal(loadSoundOn('sfx', storage), true);
  assert.equal(loadVolumeOf('music', storage), 20);
  assert.equal(loadVolume(null), DEFAULT_VOLUME);
  const broken = {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  };
  assert.equal(loadVolume(broken), DEFAULT_VOLUME);
  assert.doesNotThrow(() => {
    saveVolume(10, broken);
  });
  assert.equal(hasSeenRules(broken), false);
  assert.doesNotThrow(() => {
    markRulesSeen(broken);
  });
});

test('규칙 카드: 한 번 본 브라우저에서는 다시 열지 않는다', () => {
  const storage = memoryStorage();
  assert.equal(hasSeenRules(storage), false);
  markRulesSeen(storage);
  assert.equal(hasSeenRules(storage), true);
});
