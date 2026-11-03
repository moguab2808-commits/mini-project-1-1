import { Router, type Response } from 'express';
import type { z } from 'zod';
import {
  AppearanceChangeSchema,
  LoginSchema,
  PasswordChangeSchema,
  SignupSchema,
} from '@alkkagi/shared';
import type { Db } from '../db/pool.ts';
import { UNIQUE_VIOLATION, findPgError } from '../db/pg-error.ts';
import type { ConnectionRegistry } from '../realtime/connections.ts';
import { errors } from './errors.ts';
import { createRequireAuth } from './require-auth.ts';
import { getDummyHash, hashPassword, verifyPassword } from './password.ts';
import { deleteOtherSessions, endSession, startSession } from './sessions.ts';
import {
  findUserByNickname,
  insertUser,
  toMe,
  updateUserAppearance,
  updateUserPassword,
  type User,
} from './users.ts';

export type AuthDeps = {
  db: Db;
  registry: ConnectionRegistry;
  sessionCookieName: string;
};

const NICKNAME_UNIQUE_INDEX = 'users_nickname_lower_idx';

function parse<S extends z.ZodType>(schema: S, body: unknown): z.infer<S> {
  const result = schema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join('.') || '요청';
    throw errors.invalidInput(`${field} 값이 올바르지 않다.`);
  }
  return result.data;
}

type AuthedLocals = { user: User };
export type AuthedResponse = Response<unknown, AuthedLocals>;

export function createAuthRouter(deps: AuthDeps): { auth: Router; me: Router } {
  const { db, registry, sessionCookieName } = deps;

  const requireAuth = createRequireAuth(db);

  const auth = Router();

  auth.post('/signup', async (req, res) => {
    const { nickname, password } = parse(SignupSchema, req.body);
    const passwordHash = await hashPassword(password);
    try {
      await insertUser(db, { nickname, passwordHash });
    } catch (error) {
      // 먼저 조회하지 않고 INSERT가 유니크 인덱스에 걸린 것으로 판별해 동시 가입 경합도 막는다.
      const pgError = findPgError(error);
      if (pgError?.code === UNIQUE_VIOLATION && pgError.constraint === NICKNAME_UNIQUE_INDEX) {
        throw errors.nicknameTaken();
      }
      throw error;
    }
    // 가입은 세션을 만들지 않는다. 사용자가 로그인한다.
    res.status(201).json({});
  });

  auth.post('/login', async (req, res) => {
    const { nickname, password } = parse(LoginSchema, req.body);
    const user = await findUserByNickname(db, nickname);
    // 닉네임이 없어도 같은 비용으로 검증해 닉네임 없음과 비밀번호 틀림을 구분하지 못하게 한다.
    const matches = await verifyPassword(user?.password ?? (await getDummyHash()), password);
    if (!user || !matches) throw errors.invalidCredentials();
    await startSession(req, user.id);
    res.status(200).json({ user: toMe(user) });
  });

  auth.post('/logout', async (req, res) => {
    const { userId, id } = { userId: req.session.userId, id: req.sessionID };
    await endSession(req);
    if (userId !== undefined) registry.disconnectSession(userId, id);
    res.clearCookie(sessionCookieName);
    res.status(204).end();
  });

  const me = Router();
  me.use(requireAuth);

  me.get('/', (_req, res: AuthedResponse) => {
    res.status(200).json({ user: toMe(res.locals.user) });
  });

  me.patch('/password', async (req, res: AuthedResponse) => {
    const { currentPassword, newPassword } = parse(PasswordChangeSchema, req.body);
    const user = res.locals.user;
    if (!(await verifyPassword(user.password, currentPassword))) throw errors.invalidCredentials();

    const passwordHash = await hashPassword(newPassword);
    // 새 비밀번호 저장과 다른 세션 삭제를 한 트랜잭션으로 묶어, 중간에 실패해도 비밀번호만 바뀐 채
    // 다른 세션이 남지 않게 한다. 연결 끊기는 커밋 뒤에 한다(DEC-028).
    await db.transaction(async (tx) => {
      await updateUserPassword(tx, user.id, passwordHash);
      await deleteOtherSessions(tx, user.id, req.sessionID);
    });
    registry.replaceIfNotSession(user.id, req.sessionID);
    res.status(204).end();
  });

  me.patch('/appearance', async (req, res: AuthedResponse) => {
    const { appearance } = parse(AppearanceChangeSchema, req.body);
    const updated = await updateUserAppearance(db, res.locals.user.id, appearance);
    res.status(200).json({ user: toMe(updated) });
  });

  return { auth, me };
}
