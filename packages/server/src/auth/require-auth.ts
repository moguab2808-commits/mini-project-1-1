import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Db } from '../db/pool.ts';
import { errors } from './errors.ts';
import { endSession } from './sessions.ts';
import { findUserById } from './users.ts';

/** 세션이 없거나 사용자가 사라졌으면 401. 통과하면 res.locals.user에 사용자를 둔다. */
export function createRequireAuth(db: Db): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction) => {
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
}
