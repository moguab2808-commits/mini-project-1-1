// 게임 화면: 3D 장면(`GameScene`)과 HUD를 합성하고 조준·방해요소·판 돌리기 입력(`AimController`)과
// 캐릭터 반응(`ReactionTracker`)을 연결한다. 입력 판단은 모두 `aim/`의 순수 TypeScript 로직이 하고,
// 이 파일은 이벤트 연결만 맡는다.
import { useEffect, useState, useSyncExternalStore } from 'react';
import { SoundButton } from '../app/sound-button.tsx';
import type { EmoteId, Seat } from '@alkkagi/shared';
import { AimController, type RotateDir } from './aim/aim-controller.ts';
import type { GameClientState, GameStore } from './game-store.ts';
import { Hud } from './hud/Hud.tsx';
import { ReactionTracker } from './reactions.ts';
import { GameScene } from './scene/GameScene.tsx';
import type { CharacterPose } from './scene/scene-contract.ts';
import { EmoteController, emoteForKey } from './emotes.ts';
import { GameAudioDirector } from './game-audio.ts';
import { audio } from '../audio/engine.ts';
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
  const [emoteController] = useState(
    () =>
      new EmoteController(
        (cmd) => session.sendEmote(cmd),
        () => performance.now(),
      ),
  );
  const [sound] = useState(() => new GameAudioDirector(session.playerId));
  emoteController.update(
    state.start?.gameId ?? null,
    state.result ? 'finished' : (state.view?.phase ?? null),
  );
  const [reactionTracker] = useState(() => new ReactionTracker(session.playerId));
  const aim = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const reactions = useSyncExternalStore(reactionTracker.subscribe, reactionTracker.getReactions);
  const [, setTick] = useState(0);

  useFrameRecording(state);

  // 소리(DEC-084): 테마 배경음악·배경 소리를 요청하고 경기 이벤트를 효과음으로 바꾼다
  const theme = state.start?.theme ?? null;
  useEffect(() => {
    if (!theme) return;
    const offMusic = audio.requestMusic(theme, 10);
    const offAmb = audio.requestAmbience(theme, 10);
    return () => {
      offMusic();
      offAmb();
    };
  }, [theme]);
  useEffect(() => {
    const live = () => !store.getState().result;
    const offs = [
      session.on('emote:shown', (event) => {
        if (event.gameId === store.getState().start?.gameId && live()) sound.onEmote(event.emote);
      }),
      session.on('game:state', (view) => sound.onView(view, performance.now())),
      session.on('turn:change', (e) => sound.onTurn(e)),
      session.on('hazard:granted', () => sound.onGranted()),
      session.on('hazard:triggered', (e) => sound.onHazard(e)),
      session.on('game:over', (r) => sound.onGameOver(r)),
    ];
    return () => {
      offs.forEach((off) => off());
      sound.dispose();
    };
  }, [session, store, sound]);

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
    const id = window.setInterval(() => {
      setTick((n) => n + 1);
      sound.tick(store.getState().view, store.serverNow());
    }, HUD_TICK_MS);
    return () => window.clearInterval(id);
  }, [state.start, sound, store]);

  // 창 단위 키보드·휠·컨텍스트 메뉴 연결.
  // 키는 `code`로 판단해 한글 입력 상태에서도 같다: E 방해요소, R 벽 방향, A·D·←·→ 판 돌리기, ESC 취소.
  // 시점은 기본 하나이고 알을 칠 때만 장면이 1인칭으로 바꾼다(시점 선택 키·버튼 없음).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      const emote = emoteForKey(e.code);
      if (emote) {
        e.preventDefault();
        if (!e.repeat) {
          void emoteController.use(emote);
        }
        return;
      }
      const rotate = ROTATE_KEYS[e.code];
      if (rotate !== undefined) {
        if (e.code.startsWith('Arrow')) e.preventDefault(); // 페이지 스크롤 방지
        if (!e.repeat) controller.pressRotate(e.code, rotate);
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
      if (e.code === 'KeyE') controller.releaseHazard();
      if (ROTATE_KEYS[e.code] !== undefined) controller.releaseRotate(e.code);
    };
    const onWheel = () => controller.onWheel();
    const onContextMenu = (e: Event) => e.preventDefault(); // 오른쪽 클릭은 취소·고개 돌리기에 쓴다
    const onBlur = () => {
      controller.releaseHazard();
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
  }, [controller, emoteController]);

  const { start, view } = state;
  if (!start || !view) {
    return (
      <div className="gs-root">
        <SoundButton />
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
      <SoundButton />
      <div className="gs-scene">
        <GameScene
          start={start}
          view={view}
          mySeat={mySeat}
          aim={aim.aim}
          placement={aim.placement}
          onPointer={controller.onPointer}
          onLook={controller.onLook}
          poses={poses}
          reactions={reactions}
          shake={aim.shake}
          emotes={state.emotes}
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
        nowServerMs={nowServerMs}
        nowClientMs={nowServerMs - state.clockOffsetMs}
        emotes={state.emotes}
        emoteRemainingMs={emoteController.remainingMs()}
        onEmote={(emote: EmoteId) => {
          void emoteController.use(emote);
        }}
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
