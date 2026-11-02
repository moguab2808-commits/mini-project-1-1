// 인증 API의 요청·응답 스키마. docs/design/API.md의 REST API와 docs/PRD.md의 회원등록 규칙을 옮긴 것이다.
import { z } from 'zod';
import { CharacterIdSchema } from './protocol.ts';

/** 인증 API가 쓰는 오류 코드. 경기 오류 코드(ERROR_CODES)와 따로 둔다. */
export const AUTH_ERROR_CODES = [
  'INVALID_INPUT',
  'UNAUTHENTICATED',
  'INVALID_CREDENTIALS',
  'NICKNAME_TAKEN',
  'RATE_LIMITED',
] as const;
export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 12;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 64;

/** 닉네임은 유니코드 NFC로 정규화해 저장·비교한다. 대소문자 무시 비교는 DB의 lower() 유니크 인덱스가 한다. */
export function normalizeNickname(nickname: string): string {
  return nickname.normalize('NFC');
}

/** 2~12자, 한글·영문·숫자만 허용한다(공백·특수문자 불가). NFC 정규화한 값으로 검사한다. */
export const NicknameSchema = z
  .string()
  .transform(normalizeNickname)
  .pipe(
    z
      .string()
      .min(NICKNAME_MIN)
      .max(NICKNAME_MAX)
      .regex(/^[가-힣A-Za-z0-9]+$/, '한글·영문·숫자만 쓸 수 있다'),
  );

export type CharacterId = z.infer<typeof CharacterIdSchema>;

export const PasswordSchema = z.string().min(PASSWORD_MIN).max(PASSWORD_MAX);

/** 로그인·현재 비밀번호는 정책을 알려 주지 않도록 길이 하한만 완화하고, 해시 비용 남용을 막으려 상한은 둔다. */
const ExistingPasswordSchema = z.string().min(1).max(PASSWORD_MAX);

export const SignupSchema = z.object({ nickname: NicknameSchema, password: PasswordSchema });
export type Signup = z.infer<typeof SignupSchema>;

export const LoginSchema = z.object({ nickname: NicknameSchema, password: ExistingPasswordSchema });
export type Login = z.infer<typeof LoginSchema>;

export const PasswordChangeSchema = z.object({
  currentPassword: ExistingPasswordSchema,
  newPassword: PasswordSchema,
});
export type PasswordChange = z.infer<typeof PasswordChangeSchema>;

export const CharacterChangeSchema = z.object({ characterId: CharacterIdSchema });
export type CharacterChange = z.infer<typeof CharacterChangeSchema>;

/** API 문서의 `Record`. 내장 유틸리티 타입 Record와 겹치지 않게 이름을 바꿨다. draws = totalGames - wins - losses. 서버가 계산해 보낸다. */
export const PlayerRecordSchema = z.object({
  totalGames: z.number().int().nonnegative(),
  wins: z.number().int().nonnegative(),
  losses: z.number().int().nonnegative(),
  draws: z.number().int().nonnegative(),
});
export type PlayerRecord = z.infer<typeof PlayerRecordSchema>;

/** GET /api/me·로그인 응답의 사용자. 사용자 번호는 넣지 않는다. */
export const MeSchema = z.object({
  nickname: z.string(),
  characterId: CharacterIdSchema,
  record: PlayerRecordSchema,
});
export type Me = z.infer<typeof MeSchema>;

export type ApiErrorBody = { error: { code: AuthErrorCode; message: string } };
