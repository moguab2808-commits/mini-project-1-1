import type { ErrorRequestHandler } from 'express';
import type { ApiErrorBody, AuthErrorCode } from '@alkkagi/shared';

/** HTTP 상태와 오류 코드를 가진 API 오류. 응답 본문은 { error: { code, message } }다. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export const errors = {
  invalidInput: (message: string) => new ApiError(400, 'INVALID_INPUT', message),
  unauthenticated: () => new ApiError(401, 'UNAUTHENTICATED', '로그인이 필요하다.'),
  invalidCredentials: () =>
    new ApiError(401, 'INVALID_CREDENTIALS', '닉네임 또는 비밀번호가 올바르지 않다.'),
  nicknameTaken: () => new ApiError(409, 'NICKNAME_TAKEN', '이미 사용 중인 닉네임이다.'),
};

type BodyParserError = { type?: string; status?: number };

const errorBody = (code: AuthErrorCode, message: string): ApiErrorBody => ({
  error: { code, message },
});

/** 모든 오류를 { error: { code, message } }로 바꾼다. 예기치 못한 오류의 내용은 응답에 싣지 않는다. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof ApiError) {
    res.status(err.status).json(errorBody(err.code, err.message));
    return;
  }
  const bodyError = err as BodyParserError;
  if (bodyError.type === 'entity.parse.failed' || bodyError.type === 'entity.too.large') {
    res.status(400).json(errorBody('INVALID_INPUT', '요청 본문이 올바르지 않다.'));
    return;
  }

  // 비밀번호·쿠키가 섞일 수 있는 요청 내용은 남기지 않고 오류 이름과 메시지만 기록한다.
  console.error('처리하지 못한 오류:', err instanceof Error ? `${err.name}: ${err.message}` : err);
  res.status(500).json(errorBody('INTERNAL_ERROR', '서버에서 오류가 발생했다.'));
};
