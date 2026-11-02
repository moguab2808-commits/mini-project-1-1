import { describe, expect, it } from 'vitest';
import {
  ApiErrorBodySchema,
  CharacterChangeSchema,
  LoginSchema,
  NicknameSchema,
  PasswordChangeSchema,
  SessionReplacedSchema,
  SignupSchema,
  normalizeNickname,
} from './auth.ts';

describe('NicknameSchema', () => {
  it('2~12자의 한글·영문·숫자를 받는다', () => {
    for (const ok of ['가나', 'ab', '곰돌이123', 'A'.repeat(12), '가'.repeat(12)]) {
      expect(NicknameSchema.safeParse(ok).success, ok).toBe(true);
    }
  });

  it('길이·문자 경계를 벗어나면 거부한다', () => {
    for (const bad of ['a', 'a'.repeat(13), '', '공 백', 'a_b', 'a-b', '😀😀', 'ㄱㄴ', '곰!']) {
      expect(NicknameSchema.safeParse(bad).success, bad).toBe(false);
    }
  });

  it('NFC로 정규화한 값을 돌려준다(분해된 한글도 같은 닉네임)', () => {
    const decomposed = '\u1100\u1161\u11A8'.repeat(2); // 각각(NFD 분해형)
    expect(decomposed).not.toBe('각각');
    expect(NicknameSchema.parse(decomposed)).toBe('각각');
    expect(normalizeNickname(decomposed)).toBe('각각');
  });

  it('표시용 대소문자는 바꾸지 않는다', () => {
    expect(NicknameSchema.parse('MixedCase')).toBe('MixedCase');
  });
});

describe('SignupSchema', () => {
  it('비밀번호는 8~64자다', () => {
    expect(SignupSchema.safeParse({ nickname: '곰돌이', password: 'a'.repeat(8) }).success).toBe(
      true,
    );
    expect(SignupSchema.safeParse({ nickname: '곰돌이', password: 'a'.repeat(64) }).success).toBe(
      true,
    );
    expect(SignupSchema.safeParse({ nickname: '곰돌이', password: 'a'.repeat(7) }).success).toBe(
      false,
    );
    expect(SignupSchema.safeParse({ nickname: '곰돌이', password: 'a'.repeat(65) }).success).toBe(
      false,
    );
  });

  it('필드 누락·잘못된 타입을 거부한다', () => {
    expect(SignupSchema.safeParse({ nickname: '곰돌이' }).success).toBe(false);
    expect(SignupSchema.safeParse({ nickname: 1, password: 'password1' }).success).toBe(false);
    expect(SignupSchema.safeParse(null).success).toBe(false);
  });
});

describe('LoginSchema', () => {
  it('짧은 비밀번호도 형식 오류가 아니라 자격 증명 검사로 넘긴다', () => {
    expect(LoginSchema.safeParse({ nickname: '곰돌이', password: 'x' }).success).toBe(true);
  });

  it('빈 비밀번호와 65자 이상은 거부한다', () => {
    expect(LoginSchema.safeParse({ nickname: '곰돌이', password: '' }).success).toBe(false);
    expect(LoginSchema.safeParse({ nickname: '곰돌이', password: 'a'.repeat(65) }).success).toBe(
      false,
    );
  });
});

describe('PasswordChangeSchema', () => {
  it('새 비밀번호는 8~64자여야 한다', () => {
    expect(
      PasswordChangeSchema.safeParse({ currentPassword: 'old', newPassword: 'newpassword' })
        .success,
    ).toBe(true);
    expect(
      PasswordChangeSchema.safeParse({ currentPassword: 'old', newPassword: 'short' }).success,
    ).toBe(false);
  });
});

describe('CharacterChangeSchema', () => {
  it('캐릭터 6종만 받는다', () => {
    for (const id of ['bear', 'cat', 'fox', 'rabbit', 'owl', 'frog']) {
      expect(CharacterChangeSchema.safeParse({ characterId: id }).success, id).toBe(true);
    }
    expect(CharacterChangeSchema.safeParse({ characterId: 'dog' }).success).toBe(false);
  });
});

describe('ApiErrorBodySchema·SessionReplacedSchema', () => {
  it('REST 오류 본문은 INTERNAL_ERROR를 포함한 코드만 받는다', () => {
    expect(
      ApiErrorBodySchema.safeParse({ error: { code: 'INTERNAL_ERROR', message: 'x' } }).success,
    ).toBe(true);
    expect(ApiErrorBodySchema.safeParse({ error: { code: 'NOPE', message: 'x' } }).success).toBe(
      false,
    );
  });

  it('session:replaced의 reason은 new_connection·password_changed만 받는다', () => {
    expect(SessionReplacedSchema.safeParse({ reason: 'new_connection' }).success).toBe(true);
    expect(SessionReplacedSchema.safeParse({ reason: 'password_changed' }).success).toBe(true);
    expect(SessionReplacedSchema.safeParse({ reason: 'other' }).success).toBe(false);
    expect(SessionReplacedSchema.safeParse({}).success).toBe(false);
  });
});
