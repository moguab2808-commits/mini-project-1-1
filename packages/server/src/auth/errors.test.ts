import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiErrorBodySchema } from '@alkkagi/shared';
import { ApiError, errorHandler } from './errors.ts';

function appThatThrows(error: unknown) {
  const app = express();
  app.get('/boom', () => {
    throw error;
  });
  app.post('/json', express.json(), (_req, res) => res.status(204).end());
  app.use(errorHandler);
  return app;
}

afterEach(() => vi.restoreAllMocks());

describe('errorHandler', () => {
  it('처리하지 못한 오류는 원인을 숨기고 ApiErrorBody 형태의 500 INTERNAL_ERROR로 응답한다', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await request(appThatThrows(new Error('password=hunter2 연결 실패'))).get('/boom');

    expect(res.status).toBe(500);
    expect(ApiErrorBodySchema.parse(res.body).error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    // 서버 로그에는 오류 이름과 메시지만 남긴다.
    expect(log).toHaveBeenCalledOnce();
  });

  it('ApiError는 지정한 상태와 코드를 ApiErrorBody로 돌려준다', async () => {
    const res = await request(appThatThrows(new ApiError(409, 'NICKNAME_TAKEN', '중복'))).get(
      '/boom',
    );
    expect(res.status).toBe(409);
    expect(ApiErrorBodySchema.parse(res.body)).toEqual({
      error: { code: 'NICKNAME_TAKEN', message: '중복' },
    });
  });

  it('깨진 JSON 본문은 INVALID_INPUT 400이다', async () => {
    const res = await request(appThatThrows(new Error('unused')))
      .post('/json')
      .set('Content-Type', 'application/json')
      .send('{"nickname":');
    expect(res.status).toBe(400);
    expect(ApiErrorBodySchema.parse(res.body).error.code).toBe('INVALID_INPUT');
  });
});
