// 발사 결과 미리보기. 권한 측과 같은 물리(`stepPhysics`)·정지 판정으로 한 번의 발사를 끝까지 돌려 본다.
// AI 컨트롤러가 자기 GameView로 후보 발사를 평가할 때 쓴다(docs/design/LOCAL.md "AI 대전").
// 순수 함수이며 입력을 바꾸지 않는다. 방해요소 발동·턴 진행은 다루지 않는다.
import { HAZARD_TUNING, type BoardDefinition, type Seat } from '@alkkagi/shared';
import type { Obb } from './geometry.ts';
import { advanceMotion, launch, type Stone, type World } from './physics.ts';

export interface PreviewStone {
  id: number;
  ownerId: Seat;
  x: number;
  y: number;
}

export interface ShotPreviewInput {
  board: BoardDefinition;
  stones: ReadonlyArray<PreviewStone>;
  walls?: ReadonlyArray<Obb>;
  /** 끈끈이 중심(판 좌표 cm). 반지름은 규칙 값을 쓴다 */
  stickies?: ReadonlyArray<{ x: number; y: number }>;
  stoneId: number;
  angle: number;
  power: number;
}

export interface ShotPreview {
  /** 판에서 떨어진 알 id */
  removed: number[];
  /** 정지 후 살아 있는 알 위치 */
  stones: PreviewStone[];
}

export function previewShot(input: ShotPreviewInput): ShotPreview {
  const stones: Stone[] = input.stones.map((s) => ({
    id: s.id,
    owner: s.ownerId,
    x: s.x,
    y: s.y,
    vx: 0,
    vy: 0,
    h: 0,
    vz: 0,
    airborne: false,
    alive: true,
  }));
  const world: World = {
    board: input.board,
    stones,
    walls: (input.walls ?? []).map((w) => ({ ...w })),
    stickies: (input.stickies ?? []).map((s) => ({
      cx: s.x,
      cy: s.y,
      radius: HAZARD_TUNING.stickyDiameter / 2,
    })),
  };
  const shooter = stones.find((s) => s.id === input.stoneId);
  const removed: number[] = [];
  if (shooter) {
    launch(shooter, input.angle, input.power);
    // 권한 측 `Game`의 틱과 같은 함수로 정지까지 돌린다(정지 판정이 한쪽만 바뀌지 않게).
    const clock = { elapsed: 0, settle: 0 };
    for (;;) {
      const step = advanceMotion(world, clock);
      removed.push(...step.removed);
      if (step.outcome !== 'moving') break;
    }
  }
  return {
    removed,
    stones: stones
      .filter((s) => s.alive)
      .map((s) => ({ id: s.id, ownerId: s.owner, x: s.x, y: s.y })),
  };
}
