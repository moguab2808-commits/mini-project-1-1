// 손이 닿는 거리 판정(GAME "손이 닿는 거리", DEC-036). 서버 검증과 같은 수식을 쓰도록
// `@alkkagi/game-core`의 함수를 그대로 다시 내보낸다. 클라이언트에서 거리 계산을 따로 만들지 않는다.
import { facePoint, reachOf, seatAnchor, type Point3, type Reach } from '@alkkagi/game-core';
import type { Seat } from '@alkkagi/shared';

export { reachOf, seatAnchor };
export type { Reach };

/** 상대 얼굴 위치(판 좌표계, h는 판 윗면 기준). 후레쉬·물총 조준점이 아직 없을 때 기본값 */
export function opponentFacePoint(mySeat: Seat): Point3 {
  return facePoint(mySeat === 0 ? 1 : 0);
}
