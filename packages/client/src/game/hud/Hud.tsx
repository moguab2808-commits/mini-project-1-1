// 게임 화면 HUD 오버레이. 상태는 모두 props로 받는 표시 전용 컴포넌트다.
// 내 방해요소·게이지는 `view.private`만 쓰고 상대 방해요소는 표시하지 않는다.
import { useState } from 'react';
import type { GameOver, GameStart, GameView, RematchState, Seat } from '@alkkagi/shared';
import type { Announcement, GameClientState } from '../game-store.ts';
import { heldHazardState } from '../aim/hazard-state.ts';
import type { AimNotice, RotateDir } from '../aim/aim-controller.ts';
import { CAMERA_PRESETS, type CameraPreset } from '../scene/scene-contract.ts';
import { CharacterFace } from './CharacterFace.tsx';
import { HazardIcon } from './HazardIcon.tsx';
import {
  HAZARD_HINTS,
  HAZARD_NAMES,
  OUTCOME_TEXT,
  REASON_TEXT,
  CAMERA_LABELS,
  CONTROLS_HELP,
  blindCoverage,
  dropletsFor,
  flashRadiusPct,
  isRandomKind,
  nicknameOf,
  outcomeFor,
  rematchUi,
  roundLabel,
  stoneDots,
  turnSecondsLeft,
  visibleDroplets,
  windArrowRotationDeg,
} from './hud-model.ts';
import './hud.css';

export interface HudProps {
  start: GameStart;
  view: GameView;
  mySeat: Seat;
  grantCard: GameClientState['grantCard'];
  announcements: Announcement[];
  result: GameOver | null;
  rematch: RematchState | null;
  notice: AimNotice | null;
  /** 조건이 이어지는 동안의 안내(손이 안 닿음, 들기 모드 등) */
  hint: string | null;
  /** 기본 판 돌리기 버튼 활성(내 턴·조준 단계 등) */
  canRotate: boolean;
  onRotatePress: (dir: RotateDir) => void;
  onRotateRelease: (dir: RotateDir) => void;
  cameraPreset: CameraPreset;
  onCameraPreset: (preset: CameraPreset) => void;
  /** 권한 측 현재 시각 추정(ms) */
  nowServerMs: number;
  /** 클라이언트 시계 현재 시각(ms). 받음 카드·발동 안내의 만료 비교용 */
  nowClientMs: number;
  onSlotClick: () => void;
  onForfeit: () => void;
  onRematch: () => void;
  onExit: () => void;
}

export function Hud(props: HudProps) {
  const { start, view, mySeat, nowServerMs, nowClientMs } = props;
  const opponent: Seat = mySeat === 0 ? 1 : 0;
  const finished = props.result !== null || view.phase === 'finished';
  const cardVisible = !!props.grantCard && props.grantCard.untilMs > nowClientMs;
  const windEffect = view.effects.find(
    (e) =>
      e.kind === 'wind' &&
      e.startsAtMs <= nowServerMs &&
      nowServerMs < e.expiresAtMs &&
      e.params?.directionRad !== undefined,
  );

  return (
    <div className="gs-hud gs-shadow">
      <Profile
        className="opponent"
        start={start}
        view={view}
        seat={opponent}
        active={view.activePlayerId === opponent && !finished}
      />
      <Profile
        className="me"
        start={start}
        view={view}
        seat={mySeat}
        active={view.activePlayerId === mySeat && !finished}
      />
      <TopBar
        start={start}
        view={view}
        mySeat={mySeat}
        nowServerMs={nowServerMs}
        finished={finished}
      />

      {!finished && (
        <HazardSlot
          view={view}
          nowServerMs={nowServerMs}
          hideIcon={cardVisible}
          onClick={props.onSlotClick}
        />
      )}
      {cardVisible && props.grantCard && (
        <div className="gs-grant" role="status">
          <HazardIcon kind={props.grantCard.kind} size={72} />
          <strong>{HAZARD_NAMES[props.grantCard.kind]}</strong>
          <span>
            {props.grantCard.replaced ? '새 방해요소로 바뀌었어요' : '방해요소를 받았어요'}
          </span>
        </div>
      )}

      <Announcements start={start} announcements={props.announcements} nowClientMs={nowClientMs} />
      {windEffect?.params?.directionRad !== undefined && (
        <>
          <div
            className="gs-wind"
            style={{
              transform: `rotate(${windArrowRotationDeg(windEffect.params.directionRad, mySeat)}deg)`,
            }}
            aria-label="바람 방향"
          >
            <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
              <path
                d="M6 28h38M32 14l14 14-14 14"
                fill="none"
                stroke="#faf3e4"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="gs-wind-label">바람</div>
        </>
      )}

      {props.notice && (
        <div className="gs-notice" role="status">
          {props.notice.text}
        </div>
      )}
      {!finished && props.hint && (
        <div className="gs-hint" role="status">
          {props.hint}
        </div>
      )}
      <BlindOverlay view={view} nowServerMs={nowServerMs} />
      {!finished && (
        <>
          <CameraButtons current={props.cameraPreset} onSelect={props.onCameraPreset} />
          <RotateButtons
            enabled={props.canRotate}
            onPress={props.onRotatePress}
            onRelease={props.onRotateRelease}
          />
          <div className="gs-help">{CONTROLS_HELP}</div>
          <ForfeitButton onForfeit={props.onForfeit} />
        </>
      )}
      {props.result && (
        <ResultOverlay
          result={props.result}
          rematch={props.rematch}
          mySeat={mySeat}
          nowServerMs={nowServerMs}
          onRematch={props.onRematch}
          onExit={props.onExit}
        />
      )}
    </div>
  );
}

function Profile(props: {
  className: 'me' | 'opponent';
  start: GameStart;
  view: GameView;
  seat: Seat;
  active: boolean;
}) {
  const player = props.start.players[props.seat];
  const dots = stoneDots(props.view, props.seat, props.start.pieceCount);
  const left = dots.filter(Boolean).length;
  return (
    <div className={`gs-profile ${props.className}${props.active ? ' active' : ''}`}>
      <span className="gs-face">
        <CharacterFace characterId={player.characterId} />
      </span>
      <div>
        <div className="gs-nick">{player.nickname}</div>
        {/* 로컬 경기는 전적이 없어 승률을 '-'로 표시한다 */}
        <div className="gs-sub">승률 -</div>
        <div className="gs-dots" role="img" aria-label={`남은 알 ${left}개`}>
          {dots.map((on, i) => (
            <span key={i} className={`gs-dot${on ? ' on' : ''}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TopBar(props: {
  start: GameStart;
  view: GameView;
  mySeat: Seat;
  nowServerMs: number;
  finished: boolean;
}) {
  const left = turnSecondsLeft(props.view, props.nowServerMs);
  const mine = props.view.activePlayerId === props.mySeat;
  return (
    <div className="gs-top">
      <div className={`gs-time${left !== null && left <= 5 ? ' low' : ''}`}>
        {props.finished || left === null ? '-' : left}
      </div>
      <div className="gs-round">{roundLabel(props.view, props.start.finalRound)}</div>
      {!props.finished && (
        <div className="gs-turn">
          {mine ? '내 차례' : `${nicknameOf(props.start, props.view.activePlayerId)}님의 차례`}
        </div>
      )}
    </div>
  );
}

function HazardSlot(props: {
  view: GameView;
  nowServerMs: number;
  hideIcon: boolean;
  onClick: () => void;
}) {
  const held = heldHazardState(props.view, props.nowServerMs);
  if (!held || props.hideIcon) {
    return (
      <div className="gs-slot-wrap">
        <div className="gs-slot empty" aria-label="방해요소 칸(비어 있음)" />
      </div>
    );
  }
  const random = isRandomKind(held.kind);
  const classes = ['gs-slot'];
  if (!held.usable) classes.push('dim');
  if (held.cooldownRemainingSec !== null) classes.push('cooldown');
  return (
    <div className="gs-slot-wrap">
      {held.gauge !== null && (
        <div
          className={`gs-gauge${held.overheated ? ' hot' : ''}`}
          role="meter"
          aria-label={held.overheated ? '피로도 게이지(과열)' : '피로도 게이지'}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(held.gauge)}
        >
          <i style={{ width: `${held.gauge}%` }} />
        </div>
      )}
      <button
        type="button"
        className={classes.join(' ')}
        title={HAZARD_HINTS[held.kind]}
        aria-label={`${HAZARD_NAMES[held.kind]} 사용 (E)`}
        aria-disabled={!held.usable}
        onClick={props.onClick}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <HazardIcon kind={held.kind} />
        {held.cooldownRemainingSec !== null && (
          <span className="gs-slot-cool">{held.cooldownRemainingSec}</span>
        )}
        {random && <span className="gs-slot-na">자동</span>}
        <span className="gs-slot-key">E</span>
      </button>
      <div className="gs-slot-name">{HAZARD_NAMES[held.kind]}</div>
    </div>
  );
}

function Announcements(props: {
  start: GameStart;
  announcements: Announcement[];
  nowClientMs: number;
}) {
  const visible = props.announcements.filter((a) => a.untilMs > props.nowClientMs);
  if (visible.length === 0) return null;
  return (
    <div className="gs-announce" role="status">
      {visible.map((a) => (
        <div key={`${a.kind}:${a.sourceSeat}:${a.startsAtMs}`}>
          <HazardIcon kind={isRandomKind(a.kind) ? 'aircon' : a.kind} size={36} />
          <span>
            {nicknameOf(props.start, a.sourceSeat)}님이 [{HAZARD_NAMES[a.kind]}]를 사용했어요
          </span>
        </div>
      ))}
    </div>
  );
}

/** 시야 가림 물방울 개수(최대 면적 기준 배치) */
const DROPLET_COUNT = 28;

/**
 * 후레쉬·물총 시야 가림. 본인 뷰(`private.blind`)에만 있어 상대 화면에는 나타나지 않는다.
 * 가림 정도는 서버 `coverage`(상대 조준이 얼굴에 머무른 정도)를 따르고, 스냅샷 사이 변화는
 * CSS 전환(크기·투명도)으로 부드럽게 잇는다.
 */
function BlindOverlay(props: { view: GameView; nowServerMs: number }) {
  const blind = props.view.private.blind;
  if (!blind) return null;
  const coverage = blindCoverage(blind, props.nowServerMs);
  if (blind.kind === 'flashlight') {
    // 중앙부터 하얗게 바랜다: 고정 그라데이션 타원을 가림 비율만큼 키운다
    const r = flashRadiusPct(coverage);
    return (
      <div
        className="gs-blind gs-blind-flash"
        style={{
          opacity: coverage > 0 ? 1 : 0,
          transform: `scale(${(r / 50).toFixed(4)})`,
        }}
        aria-hidden="true"
      />
    );
  }
  const drops = dropletsFor(blind.pattern, blind.maxCoverage, DROPLET_COUNT);
  const shown = visibleDroplets(DROPLET_COUNT, coverage, blind.maxCoverage);
  return (
    <svg className="gs-blind" viewBox="0 0 100 56.25" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <filter id="gs-blur">
          <feGaussianBlur stdDeviation="0.5" />
        </filter>
      </defs>
      <g
        filter="url(#gs-blur)"
        fill="rgba(170,210,235,0.62)"
        stroke="rgba(240,250,255,0.55)"
        strokeWidth="0.25"
      >
        {drops.map((d, i) => (
          <circle
            key={i}
            className="gs-drop"
            cx={d.cx}
            cy={d.cy}
            r={d.r}
            style={{ opacity: i < shown ? 1 : 0 }}
          />
        ))}
      </g>
    </svg>
  );
}

function CameraButtons(props: { current: CameraPreset; onSelect: (preset: CameraPreset) => void }) {
  return (
    <div className="gs-cams" role="group" aria-label="시점">
      {CAMERA_PRESETS.map((preset, i) => (
        <button
          key={preset}
          type="button"
          className={`gs-chip${props.current === preset ? ' on' : ''}`}
          aria-pressed={props.current === preset}
          title={`${CAMERA_LABELS[preset]} 시점 (${i + 1})`}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => props.onSelect(preset)}
        >
          {CAMERA_LABELS[preset]}
          <span className="gs-chip-key">{i + 1}</span>
        </button>
      ))}
    </div>
  );
}

/** 판 돌리기 버튼: 누르고 있는 동안만 돈다(시안 `spinL`·`spinR`) */
function RotateButtons(props: {
  enabled: boolean;
  onPress: (dir: RotateDir) => void;
  onRelease: (dir: RotateDir) => void;
}) {
  const button = (dir: RotateDir, label: string, aria: string) => (
    <button
      type="button"
      className="gs-chip gs-spin-btn"
      disabled={!props.enabled}
      aria-label={aria}
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // 포인터 캡처를 지원하지 않아도 떼기 이벤트로 멈춘다
        }
        props.onPress(dir);
      }}
      onPointerUp={() => props.onRelease(dir)}
      onPointerCancel={() => props.onRelease(dir)}
      onLostPointerCapture={() => props.onRelease(dir)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (!e.repeat) props.onPress(dir);
        }
      }}
      onKeyUp={(e) => {
        if (e.key === 'Enter' || e.key === ' ') props.onRelease(dir);
      }}
      onBlur={() => props.onRelease(dir)}
    >
      {label}
    </button>
  );
  return (
    <div className="gs-spin">
      {button(1, '↺ 판 돌리기', '판을 왼쪽(반시계)으로 돌리기, A 또는 ←')}
      {button(-1, '판 돌리기 ↻', '판을 오른쪽(시계)으로 돌리기, D 또는 →')}
    </div>
  );
}

function ForfeitButton(props: { onForfeit: () => void }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="gs-forfeit">
      {confirming ? (
        <>
          <span>기권할까요?</span>
          <button type="button" className="gs-btn danger" onClick={props.onForfeit}>
            기권
          </button>
          <button type="button" className="gs-btn" onClick={() => setConfirming(false)}>
            취소
          </button>
        </>
      ) : (
        <button type="button" className="gs-btn" onClick={() => setConfirming(true)}>
          기권
        </button>
      )}
    </div>
  );
}

function ResultOverlay(props: {
  result: GameOver;
  rematch: RematchState | null;
  mySeat: Seat;
  nowServerMs: number;
  onRematch: () => void;
  onExit: () => void;
}) {
  const outcome = outcomeFor(props.result, props.mySeat);
  const ui = rematchUi(props.result, props.rematch, props.nowServerMs);
  return (
    <div className="gs-result" role="dialog" aria-label="경기 결과">
      <div className="gs-result-box">
        <div className={`gs-result-title ${outcome}`}>{OUTCOME_TEXT[outcome]}</div>
        <div className="gs-result-reason">{REASON_TEXT[props.result.reason]}</div>
        <div className="gs-result-msg">
          {ui.message}
          {ui.secondsLeft !== null && ui.showRequest && ` (${ui.secondsLeft}초)`}
        </div>
        <div className="gs-result-actions">
          {ui.showRequest && (
            <button
              type="button"
              className="gs-btn primary"
              disabled={!ui.canRequest}
              onClick={props.onRematch}
            >
              재도전하기
            </button>
          )}
          <button type="button" className="gs-btn" onClick={props.onExit}>
            나가기
          </button>
        </div>
      </div>
    </div>
  );
}
