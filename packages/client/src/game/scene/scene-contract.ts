// 3D 장면(`scene/`)과 HUD·입력·조준 로직(`hud/`, `aim/`) 사이의 계약.
// 장면은 그리기와 포인터→판 좌표 변환만 맡고, 조준·세기·배치 판단은 모두 호출 쪽 로직이 한다.
//
// 좌표: 판 중심 원점, 단위 cm, 서버(game-core) 기준 좌표계다(선공 기준 x 오른쪽·y 상대 방향).
// 후공 화면은 장면이 카메라를 180도 돌려 "내 알이 아래쪽"으로 보이게 하고, 포인터 좌표는
// 항상 서버 기준 좌표로 역변환해 넘긴다(GAME "물리와 입력 경계").
import type { GameStart, GameView, HazardKind, Seat } from '@alkkagi/shared';

export interface AimRenderState {
  stoneId: number;
  /** 서버 기준 좌표계 라디안 (−π, π] */
  angle: number;
  /** 0~100. 충전 중이 아니면 0 */
  power: number;
  /** 마우스 버튼을 누른 채 세기 막대가 움직이는 중 */
  charging: boolean;
}

export interface PlacementRenderState {
  kind: Extract<HazardKind, 'wall' | 'sticky'>;
  x: number;
  y: number;
  /** 벽만 쓴다. 판 좌표계 기준 */
  orientation: 'horizontal' | 'vertical';
  /** 초록(true)·빨강(false) */
  valid: boolean;
}

export interface BoardPointerEvent {
  type: 'move' | 'down' | 'up' | 'cancel';
  /** 포인터가 가리키는 판 평면의 점. 판 평면 밖을 가리키면 null */
  point: { x: number; y: number } | null;
  /** 포인터 아래에 있는 알(가장 가까운 것). 없으면 null */
  stoneId: number | null;
  /** 마우스 버튼 (0 왼쪽, 2 오른쪽) */
  button: number;
}

export interface SceneProps {
  start: GameStart;
  /** 최신 스냅샷. 장면이 이전 스냅샷과 보간한다 */
  view: GameView;
  mySeat: Seat;
  aim: AimRenderState | null;
  placement: PlacementRenderState | null;
  onPointer: (event: BoardPointerEvent) => void;
}
