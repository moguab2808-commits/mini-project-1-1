// 3D 장면(`scene/`)과 HUD·입력·조준 로직(`hud/`, `aim/`) 사이의 계약.
// 장면은 그리기와 포인터→판 좌표 변환만 맡고, 조준·세기·배치 판단은 모두 호출 쪽 로직이 한다.
//
// 좌표: 판 중심 원점, 단위 cm, 서버(game-core) 기준 좌표계다(선공 기준 x 오른쪽·y 상대 방향).
// 후공 화면은 장면이 카메라를 180도 돌려 "내 알이 아래쪽"으로 보이게 하고, 포인터 좌표는
// 항상 서버 기준 좌표로 역변환해 넘긴다(GAME "물리와 입력 경계").
import type { DisplayEmote } from '../emotes.ts';
import type { AimUpdate, GameStart, GameView, HazardKind, Seat } from '@alkkagi/shared';

export interface AimRenderState {
  stoneId: number;
  /** 서버 기준 좌표계 라디안 (−π, π] */
  angle: number;
  /** 0~100. 충전 중이 아니면 0 */
  power: number;
  /** 마우스로 당긴 거리의 정규화 값 */
  pull?: number;
  /** 마우스 버튼을 누른 채 세기 막대가 움직이는 중 */
  charging: boolean;
  /** 손이 닿는가. false면 회색 조준선(칠 수 없음) */
  reachable: boolean;
  /** 먼 거리 조준 어려움 0~1(0은 편안). 장면은 팔 떨림을 표시한다 */
  strain: number;
}

export interface PlacementRenderState {
  /** 판 위 위치형 10종(벽·끈끈이·추가 8종)과 분신술(내 알 고르기) */
  kind: Extract<
    HazardKind,
    | 'wall'
    | 'sticky'
    | 'ice_floor'
    | 'magnet'
    | 'gravity_zone'
    | 'fake_wall'
    | 'reverse_zone'
    | 'mine'
    | 'pit'
    | 'moving_wall'
    | 'decoy'
  >;
  x: number;
  y: number;
  /** 벽·가짜벽·이동 장애물(왕복 축)만 쓴다. 판 좌표계 기준 */
  orientation: 'horizontal' | 'vertical';
  /** 중력 구역 방향(판 좌표계 라디안) */
  directionRad?: number;
  /** 분신술: 고른 내 알 */
  stoneId?: number | null;
  /** 초록(true)·빨강(false) */
  valid: boolean;
}

export interface BoardPointerEvent {
  type: 'move' | 'down' | 'up' | 'cancel';
  /** 포인터가 가리키는 판 평면의 점. 판 평면 밖을 가리키면 null */
  point: { x: number; y: number } | null;
  /**
   * 후레쉬·물총 조준점: 포인터 광선이 상대 좌석의 세로 평면(y = ±SEAT_GEOMETRY.anchorDistance)과
   * 만나는 점(판 좌표계, h는 판 윗면 기준 높이). 그 평면 앞에서 판에 먼저 닿으면 판 위 점(h=0)이다.
   */
  aimPoint: { x: number; y: number; h: number } | null;
  /** 포인터 아래에 있는 알(가장 가까운 것). 없으면 null */
  stoneId: number | null;
  /** 마우스 버튼 (0 왼쪽, 2 오른쪽) */
  button: number;
}

/** 캐릭터 몸짓 입력. 내 것은 로컬 조준 상태, 상대 것은 `aim:state` 중계값이다 */
export type CharacterPose = Omit<AimUpdate, 'gameId'>;

/** 결과에 따른 표정·몸짓. 로직 쪽이 상태 변화에서 만들어 넘긴다 */
export type ReactionKind =
  | 'great' // 상대 알을 떨어뜨림
  | 'miss' // 아무것도 못 떨어뜨림
  | 'own' // 내 알만 떨어짐
  | 'trade' // 둘 다 떨어짐
  | 'shocked' // 내 알이 떨어짐(상대 발사로)
  | 'taunt' // 상대가 실수함
  | 'hit' // 방해요소에 당함
  | 'win'
  | 'lose'
  | 'draw';

export interface Reaction {
  seat: Seat;
  kind: ReactionKind;
  /** 같은 반응을 구분하는 증가 번호 */
  id: number;
}

/** 기본 시점과 1인칭. 게임 화면은 기본만 쓰고 알을 칠 때 장면이 1인칭으로 바꾼다(개발 장면은 first 고정 가능) */
export const CAMERA_PRESETS = ['default', 'first'] as const;
export type CameraPreset = (typeof CAMERA_PRESETS)[number];

export interface SceneProps {
  start: GameStart;
  /** 최신 스냅샷. 장면이 이전 스냅샷과 보간한다 */
  view: GameView;
  mySeat: Seat;
  aim: AimRenderState | null;
  placement: PlacementRenderState | null;
  onLook?: (yaw: number, pitch: number) => void;
  onPointer: (event: BoardPointerEvent) => void;
  /** 좌석별 몸짓(팔 IK·몸 기울임·손에 든 방해요소). null이면 쉬는 자세 */
  poses: [CharacterPose | null, CharacterPose | null];
  /** 새로 생긴 반응(배열 끝이 최신). 장면은 처음 보는 id만 재생한다 */
  reactions: readonly Reaction[];
  emotes?: readonly [DisplayEmote | null, DisplayEmote | null];
  /**
   * 평소 시점(생략하면 `default`: 내 캐릭터 눈높이보다 조금 높은 곳에서 내려다본다).
   * 알을 조준·발사하는 동안(`aim`이 있을 때)은 장면이 1인칭으로 바꾸고 끝나면 이 시점으로 돌아온다.
   * 오른쪽 드래그는 고개를 돌리고 놓으면 정면으로 돌아온다. 휠 확대는 없다.
   */
  cameraPreset?: CameraPreset;
  /** 같은 시점을 다시 적용하도록 증가시키는 번호(개발 장면용) */
  cameraPresetNonce?: number;
  /** 화면 흔들림 세기 0~1(바람·책상 흔들기·먼 거리 조준). 장면이 카메라를 흔든다 */
  shake: number;
}
