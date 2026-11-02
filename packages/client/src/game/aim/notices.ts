// 거부된 명령의 HUD 짧은 안내 문구. 거부는 화면 오류가 아니라 상태 복귀 + 한 줄 안내로 처리한다.
import type { GameErrorCode } from '@alkkagi/shared';

/** 안내 표시 시간(ms) */
export const NOTICE_MS = 1800;

const TEXT: Partial<Record<GameErrorCode, string>> = {
  STALE_TURN: '턴이 바뀌어서 발사하지 못했어요',
  NOT_YOUR_TURN: '내 턴이 아니에요',
  SHOT_ALREADY_SUBMITTED: '이미 발사했어요',
  INVALID_STONE: '이 알은 쓸 수 없어요',
  PLAYER_STUNNED: '기절 중이라 조작할 수 없어요',
  GAME_NOT_ACTIVE: '지금은 쓸 수 없어요',
  STALE_HAZARD: '방해요소가 바뀌었어요',
  HAZARD_COOLDOWN: '아직 쿨타임이에요',
  HAZARD_OVERHEATED: '과열 중이라 쓸 수 없어요',
  HAZARD_INVALID_TARGET: '여기에는 놓을 수 없어요',
  HAZARD_NOT_USABLE: '직접 쓸 수 없는 방해요소예요',
  INVALID_INPUT: '입력이 올바르지 않아요',
};

export function noticeFor(code: GameErrorCode): string {
  return TEXT[code] ?? '요청을 처리하지 못했어요';
}

/** 이 코드를 받으면 조준 상태를 처음으로 되돌린다(낡은 턴·이미 발사·내 턴 아님·경기 종료) */
export function resetsAim(code: GameErrorCode): boolean {
  return (
    code === 'STALE_TURN' ||
    code === 'NOT_YOUR_TURN' ||
    code === 'SHOT_ALREADY_SUBMITTED' ||
    code === 'GAME_NOT_ACTIVE' ||
    code === 'INVALID_STONE'
  );
}
