import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_APPEARANCE, EMOTE_IDS } from '@alkkagi/shared';
import { CharacterRig, type CharacterFrame } from './characters.ts';
import { v3 } from './rig-math.ts';
import { PerspectiveCamera, Vector3 } from 'three';

/** 이 테스트는 WebGL 대신 실제 rig/IK의 3D 출력 행렬을 비교한다. 캔버스의 그리기만 생략한다. */
function stubCanvas() {
  const context = new Proxy({}, { get: () => () => {} });
  vi.stubGlobal('document', {
    createElement: () => ({ width: 0, height: 0, getContext: () => context }),
  });
  vi.stubGlobal(
    'Path2D',
    class {
      constructor(_path?: string) {
        void _path;
      }
    },
  );
}
afterEach(() => vi.unstubAllGlobals());

function frame(): CharacterFrame {
  return {
    dt: 1 / 60,
    t: 0,
    lookYaw: 0,
    lookPitch: 0,
    aim: {
      stoneId: 1,
      stone: v3(-2, 0, 12),
      dir: v3(0, 0, 1),
      pull: 0.7,
      reachable: true,
      strain: 0,
    },
    grab: null,
    hold: null,
    gesture: 'neutral',
    opponentHead: v3(0, 24, 60),
    watch: null,
    blind: 0,
    firstPerson: false,
    hideArms: false,
    camLocal: null,
    opacity: 1,
  };
}

/** 루트 아래 몸통 그룹 다음의 두 그룹은 실제 렌더링되는 좌우 손이다. */
function handMatrices(rig: CharacterRig) {
  return rig.root.children
    .filter((node) => node.type === 'Group')
    .slice(1)
    .map((hand) => ({
      matrix: [...hand.matrixWorld.elements],
      // 손가락 굽힘도 조준 상태와 같아야 한다.
      finger: hand.children
        .filter((node) => node.type === 'Group')
        .map((node) => [...node.matrixWorld.elements]),
    }));
}

describe('CharacterRig 감정표현 조준 경계', () => {
  it('머리 위 말풍선 중심이 화면 윗부분 밖으로 잘리지 않는다', () => {
    stubCanvas();
    const rig = new CharacterRig(DEFAULT_APPEARANCE, 1);
    const camera = new PerspectiveCamera(42, 1.5, 1, 900);
    camera.position.set(0, 24, 40);
    camera.lookAt(0, 0, -30);
    camera.updateMatrixWorld();
    const f = frame();
    f.aim = null;
    f.emote = { kind: 'gg', ageMs: 500 };
    rig.update(f);
    rig.layoutBubble(camera);
    rig.root.updateMatrixWorld(true);
    const bubble = rig.root.getObjectsByProperty('type', 'Sprite')[0]!;
    const ndc = bubble.getWorldPosition(new Vector3()).project(camera);
    expect(ndc.y).toBeLessThanOrEqual(0.780001);
    expect(ndc.y).toBeGreaterThanOrEqual(-0.780001);
    f.firstPerson = true;
    rig.update(f);
    expect(bubble.visible).toBe(false);
    rig.dispose();
  });
  it('여섯 감정표현이 실제 조준 중인 두 손·손가락 출력 행렬을 바꾸지 않는다', () => {
    stubCanvas();
    for (const kind of EMOTE_IDS) {
      const normal = new CharacterRig(DEFAULT_APPEARANCE, 1);
      const emote = new CharacterRig(DEFAULT_APPEARANCE, 1);
      const normalFrame = frame();
      const emoteFrame = frame();
      try {
        for (let n = 0; n < 60; n++) {
          normalFrame.t = emoteFrame.t = n / 60;
          emoteFrame.emote = { kind, ageMs: (n * 1000) / 60 };
          normal.update(normalFrame);
          emote.update(emoteFrame);
          expect(handMatrices(emote), kind).toEqual(handMatrices(normal));
          expect(
            emote.root.getObjectsByProperty('type', 'Sprite').some((bubble) => bubble.visible),
          ).toBe(true);
          expect(
            normal.root.getObjectsByProperty('type', 'Sprite').some((bubble) => bubble.visible),
          ).toBe(false);
        }
      } finally {
        normal.dispose();
        emote.dispose();
      }
    }
  });
});
