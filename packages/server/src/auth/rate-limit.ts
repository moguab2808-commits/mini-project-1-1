import { rateLimit, type RateLimitInfo } from 'express-rate-limit';
import type { RequestHandler } from 'express';

export const AUTH_RATE_LIMIT = { windowMs: 60_000, limit: 20 } as const;

/**
 * /api/auth/* 요청을 IP당 분당 20회로 제한한다. signup·login·logout이 카운터 하나를 공유하고
 * 성공·실패를 모두 센다. 닉네임별 실패 횟수 제한은 두지 않는다(AUTH, DEC-025).
 * 메모리 저장이라 서버가 재시작하면 초기화된다. IP는 trust proxy 설정에 의존한다.
 */
export function createAuthRateLimiter(): RequestHandler {
  return rateLimit({
    ...AUTH_RATE_LIMIT,
    standardHeaders: false,
    legacyHeaders: false,
    handler: (req, res) => {
      const info = (req as typeof req & { rateLimit?: RateLimitInfo }).rateLimit;
      const resetTime = info?.resetTime?.getTime() ?? Date.now() + AUTH_RATE_LIMIT.windowMs;
      const retryAfter = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      res.status(429).json({
        error: { code: 'RATE_LIMITED', message: '요청이 너무 많다. 잠시 후 다시 시도해 달라.' },
      });
    },
  });
}
