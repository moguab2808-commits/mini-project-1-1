import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import type pg from 'pg';
import type { z } from 'zod';
import {
  CharacterChangeSchema,
  LoginSchema,
  PasswordChangeSchema,
  SignupSchema,
} from '@alkkagi/shared';
import type { Db } from '../db/pool.ts';
import type { ConnectionRegistry } from '../realtime/connections.ts';
import { errors } from './errors.ts';
import { getDummyHash, hashPassword, verifyPassword } from './password.ts';
import { deleteOtherSessions, endSession, startSession } from './sessions.ts';
import {
  findUserById,
  findUserByNickname,
  insertUser,
  randomCharacterId,
  toMe,
  updateUserCharacter,
  updateUserPassword,
  type User,
} from './users.ts';

export type AuthDeps = {
  db: Db;
  pool: pg.Pool;
  registry: ConnectionRegistry;
  sessionCookieName: string;
};

const NICKNAME_UNIQUE_INDEX = 'users_nickname_lower_idx';
const UNIQUE_VIOLATION = '23505';

type PgErrorLike = { code?: string; constraint?: string };

/** drizzle이 감싼 오류의 원인(cause)까지 내려가 PostgreSQL 오류를 찾는다. */
function findPgError(error: unknown): PgErrorLike | undefined {
  for (let current = error; current && typeof current === 'object';) {
    const candidate = current as PgErrorLike & { cause?: unknown };
    if (typeof candidate.code === 'string') return candidate;
    current = candidate.cause;
  }
  return undefined;
}

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
  const { db, pool, registry, sessionCookieName } = deps;

  /** 세션이 없거나 사용자가 사라졌으면 401. 통과하면 res.locals.user에 사용자를 둔다. */
  const requireAuth: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
    const userId = req.session.userId;
    if (userId === undefined) throw errors.unauthenticated();
    const user = await findUserById(db, userId);
    if (!user) {
      await endSession(req);
      throw errors.unauthenticated();
    }
    res.locals.user = user;
    next();
  };

  const auth = Router();

  auth.post('/signup', async (req, res) => {
    const { nickname, password } = parse(SignupSchema, req.body);
    const passwordHash = await hashPassword(password);
    try {
      await insertUser(db, { nickname, passwordHash, characterId: randomCharacterId() });
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

    await updateUserPassword(db, user.id, await hashPassword(newPassword));
    // 현재 세션만 남기고 같은 사용자의 다른 세션과 그 연결을 끝낸다(DEC-028).
    await deleteOtherSessions(pool, user.id, req.sessionID);
    registry.replaceIfNotSession(user.id, req.sessionID);
    res.status(204).end();
  });

  me.patch('/character', async (req, res: AuthedResponse) => {
    const { characterId } = parse(CharacterChangeSchema, req.body);
    const updated = await updateUserCharacter(db, res.locals.user.id, characterId);
    res.status(200).json({ user: toMe(updated) });
  });

  return { auth, me };
}
