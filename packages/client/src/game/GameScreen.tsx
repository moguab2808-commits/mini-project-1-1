// 임시 자리표시자. HUD·입력 구현이 이 파일을 대체한다.
import type { GameStore } from './game-store.ts';
import type { GameSession } from '../session/game-session.ts';

export interface GameScreenProps {
  session: GameSession;
  store: GameStore;
  /** 나가기 버튼·결과 화면 '나가기'가 부른다. 로컬은 안내 화면으로 이동한다 */
  onExit: () => void;
}

export function GameScreen(props: GameScreenProps) {
  void props;
  return <p>게임 화면 준비 중</p>;
}
