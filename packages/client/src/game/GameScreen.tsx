// 게임 화면: 3D 장면(`GameScene`)과 HUD를 합성하고 조준·방해요소·판 돌리기 입력(`AimController`)과
// 캐릭터 반응(`ReactionTracker`)을 연결한다. 입력 판단은 모두 `aim/`의 순수 TypeScript 로직이 하고,
// 이 파일은 이벤트 연결만 맡는다.
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Seat } from '@alkkagi/shared';
import { AimController, type RotateDir } from './aim/aim-controller.ts';
import type { GameClientState, GameStore } from './game-store.ts';
import { Hud } from './hud/Hud.tsx';
import { cameraPresetForCode } from './hud/hud-model.ts';
import { ReactionTracker } from './reactions.ts';
import { GameScene } from './scene/GameScene.tsx';
import type { CameraPreset, CharacterPose } from './scene/scene-contract.ts';
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

/** 판 돌리기 키(`KeyboardEvent.code`, 한글 입력 상태와 무관). 양수는 반시계 */
const ROTATE_KEYS: Record<string, RotateDir> = {
  KeyA: 1,
  ArrowLeft: 1,
  KeyD: -1,
  ArrowRight: -1,
};

/** 입력창에 포커스가 있으면 게임 단축키를 처리하지 않는다 */
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/** 상대 몸짓(`aim:state` 중계값). 장면에는 gameId·seat 없이 몸짓만 넘긴다 */
function opponentPose(state: GameClientState): CharacterPose | null {
  const aim = state.opponentAim;
  if (!aim || aim.gameId !== state.start?.gameId) return null;
  const pose: CharacterPose = { ...aim };
  delete (pose as Partial<typeof aim>).gameId;
  delete (pose as Partial<typeof aim>).seat;
  return pose;
}

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
  const [reactionTracker] = useState(() => new ReactionTracker(session.playerId));
  const aim = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const reactions = useSyncExternalStore(reactionTracker.subscribe, reactionTracker.getReactions);
  const [camera, setCamera] = useState<{ preset: CameraPreset; nonce: number }>({
    preset: 'default',
    nonce: 0,
  });
  const [, setTick] = useState(0);

  useFrameRecording(state);

  // 새 경기·새 스냅샷을 입력 로직에 전달한다(경기 시작 효과가 먼저 실행되도록 이 순서를 지킨다)
  useEffect(() => {
    if (state.start) controller.setStart(state.start);
  }, [controller, state.start]);
  useEffect(() => {
    if (state.view) {
      controller.setView(state.view);
      reactionTracker.onView(state.view);
    }
  }, [controller, reactionTracker, state.view]);

  // 반응: 방해요소 발동·경기 종료는 세션 이벤트에서 받는다
  useEffect(() => {
    const offs = [
      session.on('hazard:triggered', (e) => reactionTracker.onHazard(e)),
      session.on('game:over', (r) => reactionTracker.onGameOver(r)),
    ];
    return () => offs.forEach((off) => off());
  }, [session, reactionTracker]);

  // 막대·바람·판 돌리기·마감 진행은 화면 프레임마다, HUD 숫자는 짧은 간격으로 갱신한다
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

  // 창 단위 키보드·휠·컨텍스트 메뉴 연결.
  // 키는 `code`로 판단해 한글 입력 상태에서도 같다: E 방해요소, R 벽 방향, A·D·←·→ 판 돌리기,
  // 1~5 시점, ESC 취소.
  useEffect(() => {
    const selectCamera = (preset: CameraPreset) =>
      setCamera((c) => ({ preset, nonce: c.nonce + 1 }));
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      const rotate = ROTATE_KEYS[e.code];
      if (rotate !== undefined) {
        if (e.code.startsWith('Arrow')) e.preventDefault(); // 페이지 스크롤 방지
        if (!e.repeat) controller.pressRotate(e.code, rotate);
        return;
      }
      const preset = cameraPresetForCode(e.code);
      if (preset) {
        if (!e.repeat) selectCamera(preset);
        return;
      }
      if (e.code === 'KeyE') {
        if (!e.repeat) controller.onKey('e');
      } else if (e.code === 'KeyR') {
        if (!e.repeat) controller.onKey('r');
      } else if (e.code === 'Escape') {
        controller.onKey('escape');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (ROTATE_KEYS[e.code] !== undefined) controller.releaseRotate(e.code);
    };
    const onWheel = () => controller.onWheel();
    const onContextMenu = (e: Event) => e.preventDefault(); // 오른쪽 클릭은 취소·시점 회전에 쓴다
    const onBlur = () => {
      controller.releaseAllRotate();
      controller.onPointer({
        type: 'cancel',
        point: null,
        aimPoint: null,
        stoneId: null,
        button: 0,
      });
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
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

  const mySeat: Seat = state.mySeat;
  const opponent = opponentPose(state);
  const poses: [CharacterPose | null, CharacterPose | null] =
    mySeat === 0 ? [aim.pose, opponent] : [opponent, aim.pose];
  const nowServerMs = store.serverNow();
  return (
    <div className="gs-root">
      <div className="gs-scene">
        <GameScene
          start={start}
          view={view}
          mySeat={mySeat}
          aim={aim.aim}
          placement={aim.placement}
          onPointer={controller.onPointer}
          poses={poses}
          reactions={reactions}
          cameraPreset={camera.preset}
          cameraPresetNonce={camera.nonce}
          shake={aim.shake}
        />
      </div>
      <Hud
        start={start}
        view={view}
        mySeat={mySeat}
        grantCard={state.grantCard}
        announcements={state.announcements}
        result={state.result}
        rematch={state.rematch}
        notice={aim.notice}
        hint={aim.hint}
        canRotate={aim.canRotate}
        onRotatePress={(dir) => controller.pressRotate(dir === 1 ? 'btn-ccw' : 'btn-cw', dir)}
        onRotateRelease={(dir) => controller.releaseRotate(dir === 1 ? 'btn-ccw' : 'btn-cw')}
        cameraPreset={camera.preset}
        onCameraPreset={(preset) => setCamera((c) => ({ preset, nonce: c.nonce + 1 }))}
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
