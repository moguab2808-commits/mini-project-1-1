import { Router, type RequestHandler } from 'express';
import type { RoomService } from './room-service.ts';

/** `GET /api/rooms`. 목록은 폴링하지 않고 로비 진입·새로고침 때만 호출한다(DEC-024). */
export function createRoomsRouter(requireAuth: RequestHandler, service: RoomService): Router {
  const router = Router();
  router.use(requireAuth);
  router.get('/', async (_req, res) => {
    res.status(200).json({ rooms: await service.list() });
  });
  return router;
}
