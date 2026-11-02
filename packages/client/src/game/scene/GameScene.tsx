// 임시 자리표시자. 3D 장면 구현이 이 파일을 대체한다(SceneProps 계약은 scene-contract.ts).
import type { SceneProps } from './scene-contract.ts';

export function GameScene(props: SceneProps) {
  return <div data-testid="scene-stub">{props.view.stones.length} stones</div>;
}
