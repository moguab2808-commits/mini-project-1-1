import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  ROOM_CODE_ALPHABET,
  ROOM_CODE_LENGTH,
  RoomClosedSchema,
  RoomCodeSchema,
  RoomCreateSchema,
  RoomJoinSchema,
} from './rooms.ts';

const publicRoom = {
  title: '내 방',
  isPublic: true,
  pieceCount: 5,
  board: 'standard',
};

test('방 코드는 6자리이고 0/O, 1/I를 쓰지 않는다', () => {
  assert.equal(ROOM_CODE_ALPHABET.length, 32);
  for (const ch of '01OI') assert.equal(ROOM_CODE_ALPHABET.includes(ch), false, ch);
  assert.equal(RoomCodeSchema.safeParse('ABCDEF').success, true);
  assert.equal(RoomCodeSchema.safeParse('A'.repeat(ROOM_CODE_LENGTH)).success, true);
  for (const code of ['ABCDE', 'ABCDEFG', 'abcdef', 'ABCDE0', 'ABCDEO', 'ABCDE1', 'ABCDEI']) {
    assert.equal(RoomCodeSchema.safeParse(code).success, false, code);
  }
});

test('방 생성: 공개 방은 코드를 받지 않고 비공개 방은 코드가 필요하다', () => {
  assert.equal(RoomCreateSchema.safeParse(publicRoom).success, true);
  assert.equal(RoomCreateSchema.safeParse({ ...publicRoom, code: 'ABCDEF' }).success, false);
  const priv = { ...publicRoom, isPublic: false };
  assert.equal(RoomCreateSchema.safeParse(priv).success, false);
  assert.equal(RoomCreateSchema.safeParse({ ...priv, code: 'ABCDEF' }).success, true);
  assert.equal(RoomCreateSchema.safeParse({ ...priv, code: 'abc' }).success, false);
});

test('방 생성: 제목 1~20자, 알 개수 5·7·9, 알 수 없는 판은 거부한다', () => {
  assert.equal(RoomCreateSchema.safeParse({ ...publicRoom, title: '' }).success, false);
  assert.equal(RoomCreateSchema.safeParse({ ...publicRoom, title: 'a'.repeat(20) }).success, true);
  assert.equal(RoomCreateSchema.safeParse({ ...publicRoom, title: 'a'.repeat(21) }).success, false);
  for (const pieceCount of [4, 6, 8, 10, '5']) {
    assert.equal(RoomCreateSchema.safeParse({ ...publicRoom, pieceCount }).success, false);
  }
  assert.equal(RoomCreateSchema.safeParse({ ...publicRoom, board: 'hexagon' }).success, false);
});

test('방 생성: 방 테마는 생략하면 bar이고 알 수 없는 테마는 거부한다(DEC-052)', () => {
  assert.equal(RoomCreateSchema.parse(publicRoom).theme, 'bar');
  for (const theme of ['bar', 'rooftop', 'classroom', 'beach'] as const) {
    assert.equal(RoomCreateSchema.parse({ ...publicRoom, theme }).theme, theme);
  }
  for (const theme of ['space', '', 1, null]) {
    assert.equal(RoomCreateSchema.safeParse({ ...publicRoom, theme }).success, false);
  }
});

test('방 입장: roomId·code 중 하나는 있어야 하고 code 형식은 검사하지 않는다', () => {
  assert.equal(RoomJoinSchema.safeParse({}).success, false);
  assert.equal(RoomJoinSchema.safeParse({ roomId: 1 }).success, true);
  assert.equal(RoomJoinSchema.safeParse({ code: 'abc' }).success, true);
  assert.equal(RoomJoinSchema.safeParse({ roomId: 0 }).success, false);
  assert.equal(RoomJoinSchema.safeParse({ roomId: 1.5 }).success, false);
});

test('room:closed는 roomId가 필요하고 사유는 방장 이탈과 재도전 시간 초과만 받는다', () => {
  assert.equal(RoomClosedSchema.safeParse({ roomId: 1, reason: 'host_left' }).success, true);
  assert.equal(RoomClosedSchema.safeParse({ roomId: 1, reason: 'rematch_timeout' }).success, true);
  assert.equal(RoomClosedSchema.safeParse({ roomId: 1, reason: 'other' }).success, false);
  assert.equal(RoomClosedSchema.safeParse({ reason: 'host_left' }).success, false); // roomId 필수
});
