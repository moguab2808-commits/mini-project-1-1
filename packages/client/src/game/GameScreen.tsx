// 게임 화면: 3D 장면(`GameScene`)과 HUD를 합성하고 조준·방해요소 입력(`AimController`)을 연결한다.
// 입력 판단은 모두 `aim/`의 순수 TypeScript 로직이 하고, 이 파일은 이벤트 연결만 맡는다.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { AimController } from './aim/aim-controller.ts';
import type { GameStore } from './game-store.ts';
import { Hud } from './hud/Hud.tsx';
import { GameScene } from './scene/GameScene.tsx';
import { useFrameRecording } from './use-frame-recording.ts';
import type { GameSession } from '../session/game-session.ts';
import './hud/hud.css';

export interface GameScreenProps {
  session: GameSession;
  store: GameStore;
  /** 나가기 버튼·결과 화면 '나가기'가 부른다. 로컬은 안내 화면으로 이동한다 */
  onExit: () => void;
}

/** HUD 시간 표시(남은 시간·쿨타임·게이지)를 갱신하는 간격 */
const HUD_TICK_MS = 100;

export function GameScreen({ session, store, onExit }: GameScreenProps) {
  const state = useSyncExternalStore(store.subscribe, store.getState);
  const [controller] = useState(
    () =>
      new AimController({
        actions: session,
        mySeat: session.playerId,
        now: () => store.serverNow(),
      }),
  );
  const aim = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const [, setTick] = useState(0);

  useFrameRecording(state);

  // 새 경기·새 스냅샷을 입력 로직에 전달한다(경기 시작 효과가 먼저 실행되도록 이 순서를 지킨다)
  useEffect(() => {
    if (state.start) controller.setStart(state.start);
  }, [controller, state.start]);
  useEffect(() => {
    if (state.view) controller.setView(state.view);
  }, [controller, state.view]);

  // 막대·바람·마감 진행은 화면 프레임마다, HUD 숫자는 짧은 간격으로 갱신한다
  const playing = !!state.start && state.result === null;
  useEffect(() => {
    if (!playing) return;
    let raf = requestAnimationFrame(function frame() {
      controller.tick();
      raf = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(raf);
  }, [controller, playing]);
  useEffect(() => {
    if (!state.start) return;
    const id = window.setInterval(() => setTick((n) => n + 1), HUD_TICK_MS);
    return () => window.clearInterval(id);
  }, [state.start]);

  // 창 단위 키보드·휠·컨텍스트 메뉴 연결
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 'e') {
        if (!e.repeat) controller.onKey('e');
      } else if (key === 'r') {
        if (!e.repeat) controller.onKey('r');
      } else if (key === 'escape') {
        controller.onKey('escape');
      }
    };
    const onWheel = () => controller.onWheel();
    const onContextMenu = (e: Event) => e.preventDefault(); // 오른쪽 클릭은 취소 입력으로 쓴다
    const onBlur = () =>
      controller.onPointer({ type: 'cancel', point: null, stoneId: null, button: 0 });
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('contextmenu', onContextMenu);
      window.removeEventListener('blur', onBlur);
    };
  }, [controller]);

  const { start, view } = state;
  if (!start || !view) {
    return (
      <div className="gs-root">
        <div className="gs-wait" role="status">
          상대 창을 기다리는 중…
        </div>
      </div>
    );
  }

  const nowServerMs = store.serverNow();
  return (
    <div className="gs-root">
      <div className="gs-scene">
        <GameScene
          start={start}
          view={view}
          mySeat={state.mySeat}
          aim={aim.aim}
          placement={aim.placement}
          onPointer={controller.onPointer}
        />
      </div>
      <Hud
        start={start}
        view={view}
        mySeat={state.mySeat}
        grantCard={state.grantCard}
        announcements={state.announcements}
        result={state.result}
        rematch={state.rematch}
        notice={aim.notice}
        nowServerMs={nowServerMs}
        nowClientMs={nowServerMs - state.clockOffsetMs}
        onSlotClick={() => controller.onSlotClick()}
        onForfeit={() => {
          void session.forfeit({ gameId: start.gameId });
        }}
        onRematch={() => {
          if (state.result) void session.requestRematch(state.result.gameId);
        }}
        onExit={onExit}
      />
    </div>
  );
}
