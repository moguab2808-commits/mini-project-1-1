// 조준·발사·방해요소·판 돌리기 입력 상태 머신. React·DOM·Three.js에 의존하지 않는 순수 TypeScript다.
//
// 입력: 장면이 주는 `BoardPointerEvent`(서버 기준 좌표)와 키·휠·슬롯 클릭·판 돌리기 버튼.
// 출력: `SceneProps.aim`·`placement`·내 몸짓(pose)·화면 흔들림(shake)과 HUD 안내.
// 조준 방향·세기는 서버 권한 상태가 아니다(DEC-026). 바람·떨림·세기 막대 효과를 반영한 최종값만
// `shot:submit`으로 보낸다. 몸짓은 표시용으로 `aim:update`로 중계한다(DEC-036).
import {
  BOARDS,
  BOARD_TURN,
  HAZARDS,
  HAZARD_TUNING,
  PHYSICS,
  type AimUpdate,
  type BoardDefinition,
  type BoardRotate,
  type CommandResult,
  type GameStart,
  type GameView,
  type HazardAim,
  type HazardUse,
  type Seat,
  type ShotSubmit,
} from '@alkkagi/shared';
import {
  isPlacementValid,
  snapToWallGrid,
  wallFromParams,
  type PlacementWorld,
} from '@alkkagi/game-core';
import type {
  AimRenderState,
  BoardPointerEvent,
  CharacterPose,
  PlacementRenderState,
} from '../scene/scene-contract.ts';
import {
  BAR_PERIOD_SEC,
  DESK_SHAKE_JITTER_DEG,
  SHAKE,
  STRAIN_JITTER_DEG,
  normalizeAngle,
  powerFromPhase,
  shortestAngleDelta,
  tremor,
} from './aim-math.ts';
import { heldHazardState, inputKindOf } from './hazard-state.ts';
import { HINTS, NOTICE_MS, noticeFor, resetsAim } from './notices.ts';
import { opponentFacePoint, reachOf, type Reach } from './reach.ts';

/** 컨트롤러가 세션에 요구하는 명령. `GameSession`이 그대로 만족한다. */
export interface AimActions {
  submitShot(cmd: ShotSubmit): Promise<CommandResult>;
  useHazard(cmd: HazardUse): Promise<CommandResult>;
  rotateBoard(cmd: BoardRotate): Promise<CommandResult>;
  aimHazard(cmd: HazardAim): void;
  sendAim(update: AimUpdate): void;
}

export interface AimControllerOptions {
  actions: AimActions;
  mySeat: Seat;
  /** 권한 측 현재 시각 추정(ms). 마감·효과 만료·막대 진행 계산에 쓴다 */
  now: () => number;
}

export interface AimNotice {
  text: string;
  /** 지울 시각(권한 측 시계 ms) */
  untilMs: number;
}

export type HoldKind = 'flashlight' | 'water_gun';

export interface AimSnapshot {
  aim: AimRenderState | null;
  placement: PlacementRenderState | null;
  notice: AimNotice | null;
  /** 내 캐릭터 몸짓(장면 `poses[mySeat]`) */
  pose: CharacterPose;
  /** 화면 흔들림 0~1 = 원인별 최댓값(먼 거리 조준·내게 걸린 바람·책상 흔들기) */
  shake: number;
  /** 조건이 이어지는 동안 보여 줄 안내(손이 안 닿음, 들기 모드 등). 없으면 null */
  hint: string | null;
  /** 지금 기본 판 돌리기를 할 수 있는가(HUD 버튼 활성) */
  canRotate: boolean;
  /** 후레쉬·물총을 손에 든 상태. `fired`면 발동 뒤 조준 중 */
  holding: { kind: HoldKind; fired: boolean } | null;
}

/** 한 번에 처리하는 시간 증분 상한(ms). 백그라운드 탭 복귀 때 막대·바람이 튀지 않게 한다 */
const MAX_STEP_MS = 250;
/** 판 돌리기·후레쉬 조준·몸짓 중계 전송 간격(약 20Hz) */
export const STREAM_INTERVAL_MS = 50;
/** 발동 수락 뒤 효과가 뷰에 보이지 않아도 들기 상태를 유지하는 여유(ms) */
const BEAM_GRACE_MS = 1000;

type Point = { x: number; y: number };
type Point3 = { x: number; y: number; h: number };

export type ControllerKey = 'e' | 'r' | 'escape';
/** 판 돌리기 방향: +1 반시계(A·←·↺), −1 시계(D·→·↻) */
export type RotateDir = 1 | -1;

interface HoldState {
  kind: HoldKind;
  instanceId: string;
  /** aiming: 들고 겨누는 중(발동 전), sending: 발동 응답 대기, active: 발동 뒤 조준 중 */
  phase: 'aiming' | 'sending' | 'active';
  firedAtMs: number;
  effectSeen: boolean;
}

export class AimController {
  private readonly actions: AimActions;
  private readonly mySeat: Seat;
  private readonly now: () => number;

  private view: GameView | null = null;
  private board: BoardDefinition = BOARDS.standard;

  // 조준 상태
  private stoneId: number | null = null;
  private mouseAngle: number;
  private windBias = 0;
  private charging = false;
  private phase = 0;
  private power = 0;
  /** 이 턴(gameId:turnId)에 이미 발사를 보냈다. 결과 도착 전·후 중복 발사를 막는다 */
  private shotSentKey: string | null = null;
  private submitting = false;
  private turnKey = '';

  // 배치 상태
  private placement: {
    kind: 'wall' | 'sticky';
    instanceId: string;
    x: number;
    y: number;
    orientation: 'horizontal' | 'vertical';
  } | null = null;
  private placementSending = false;

  // 후레쉬·물총 들기
  private hold: HoldState | null = null;
  private aimPoint: Point3 | null = null;
  private hazardAimSent: Point3 | null = null;
  private hazardAimSentMs: number | null = null;

  // 기본 판 돌리기: 누르고 있는 입력(키·버튼)별 방향
  private readonly rotateInputs = new Map<string, RotateDir>();
  private rotating = false;
  private rotatePendingDeg = 0;
  private rotateSentMs: number | null = null;

  // 몸짓 중계
  private poseSent: CharacterPose | null = null;
  private poseSentMs: number | null = null;

  private pull = 0;
  private look: { yaw: number; pitch: number } | undefined;

  onLook = (yaw: number, pitch: number): void => {
    this.look = { yaw, pitch };
    this.refresh();
  };

  private pointer: Point | null = null;
  private lastAdvanceMs: number | null = null;
  private notice: AimNotice | null = null;

  private snapshot: AimSnapshot = {
    aim: null,
    placement: null,
    notice: null,
    pose: { mode: 'idle' },
    shake: 0,
    hint: null,
    canRotate: false,
    holding: null,
  };
  private readonly listeners = new Set<() => void>();

  constructor(options: AimControllerOptions) {
    this.actions = options.actions;
    this.mySeat = options.mySeat;
    this.now = options.now;
    this.mouseAngle = this.defaultAngle();
  }

  // ───────── 구독 ─────────

  getSnapshot = (): AimSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  // ───────── 상태 입력 ─────────

  /** 새 경기(재도전 포함) 시작. 판 정보를 받고 입력 상태를 모두 초기화한다 */
  setStart(start: GameStart): void {
    this.board = BOARDS[start.board];
    this.view = start.view;
    this.resetAim();
    this.shotSentKey = null;
    this.placement = null;
    this.placementSending = false;
    this.hold = null;
    this.hazardAimSent = null;
    this.hazardAimSentMs = null;
    this.rotatePendingDeg = 0;
    this.rotateSentMs = null;
    this.poseSent = null;
    this.poseSentMs = null;
    this.notice = null;
    this.turnKey = turnKeyOf(start.view);
    this.lastAdvanceMs = null;
    this.refresh();
  }

  /** 새 스냅샷을 받았을 때 부른다. 턴·단계·기절이 바뀌면 조준 상태를 초기화한다 */
  setView(view: GameView): void {
    this.view = view;
    const key = turnKeyOf(view);
    if (key !== this.turnKey) {
      this.turnKey = key;
      this.resetAim();
      this.rotatePendingDeg = 0; // 지난 턴의 회전량은 버린다(STALE 거부 대상)
    }
    this.syncEligibility();
    this.syncPlacement();
    this.syncHold();
    this.refresh();
  }

  /** 시간 진행(막대·바람·판 돌리기·마감). 화면 프레임마다 부른다 */
  tick(): void {
    this.advance();
    this.refresh();
  }

  // ───────── 포인터 ─────────

  onPointer = (event: BoardPointerEvent): void => {
    this.advance();
    const view = this.view;
    if (!view) return;
    if (event.point) this.pointer = event.point;
    if (event.aimPoint) this.aimPoint = event.aimPoint;

    switch (event.type) {
      case 'move':
        this.onMove(event);
        break;
      case 'down':
        this.onDown(event);
        break;
      case 'up':
        this.onUp(event);
        break;
      case 'cancel':
        this.cancelCharge();
        break;
    }
    this.refresh();
  };

  /** 키 입력. `e` 방해요소 사용, `r` 벽 방향 전환, `escape` 취소 */
  onKey(key: ControllerKey): void {
    this.advance();
    if (key === 'e') {
      this.useSlot();
      this.fireHold();
    } else if (key === 'r') this.rotatePlacement();
    else this.cancelCurrent();
    this.refresh();
  }

  releaseHazard(): void {
    const h = this.hold;
    if (h && this.view)
      this.actions.aimHazard({
        gameId: this.view.gameId,
        hazardInstanceId: h.instanceId,
        target: this.aimPoint ?? opponentFacePoint(this.mySeat),
        active: false,
      });
    this.hold = null;
    this.refresh();
  }

  /** 마우스 휠. 배치 모드의 벽 방향만 바꾼다 */
  onWheel(): void {
    this.rotatePlacement();
    this.refresh();
  }

  /** 방해요소 칸 클릭(E 키와 같다) */
  onSlotClick(): void {
    this.advance();
    this.useSlot();
    this.refresh();
  }

  /** 판 돌리기 입력을 누름. `source`는 키·버튼 구분용(같은 입력의 반복 호출은 무시된다) */
  pressRotate(source: string, dir: RotateDir): void {
    this.advance();
    this.rotateInputs.set(source, dir);
    this.refresh();
  }

  /** 판 돌리기 입력을 뗌. 모든 입력이 떨어지면 남은 회전량을 바로 보낸다 */
  releaseRotate(source: string): void {
    this.advance();
    this.rotateInputs.delete(source);
    if (this.rotateDir() === 0) {
      this.rotating = false;
      this.flushRotate(this.now());
    }
    this.refresh();
  }

  /** 창 포커스를 잃는 등 모든 판 돌리기 입력을 뗌 */
  releaseAllRotate(): void {
    for (const source of [...this.rotateInputs.keys()]) this.releaseRotate(source);
  }

  /** 오른쪽 클릭 컨텍스트 메뉴 등 창 단위 취소가 필요할 때 */
  cancelCurrent(): void {
    if (this.placement) {
      this.placement = null;
      this.placementSending = false;
    } else if (this.hold) {
      // 발동 전에만 취소한다. 발동 뒤에는 지속 시간 동안 조준이 이어진다
      if (this.hold.phase === 'aiming') this.hold = null;
    } else {
      this.cancelCharge();
    }
  }

  // ───────── 내부: 포인터 처리 ─────────

  private onMove(event: BoardPointerEvent): void {
    if (this.placement) {
      this.movePlacement();
      return;
    }
    if (this.hold) return; // 조준점은 onPointer에서 이미 갱신했다
    if (event.point) this.updateMouseAngle(event.point);
  }

  private onDown(event: BoardPointerEvent): void {
    if (this.placement) {
      // 배치 모드 중 클릭은 알 선택·충전으로 전달하지 않는다
      if (event.button === 0) this.confirmPlacement();
      else if (event.button === 2) this.cancelCurrent();
      return;
    }
    if (this.hold) {
      // 들기·발동 중 클릭은 알 선택·충전으로 전달하지 않는다
      if (this.hold.phase === 'aiming') {
        if (event.button === 0) return;
        else if (event.button === 2) this.hold = null;
      }
      return;
    }
    if (event.button === 2) {
      this.cancelCharge();
      return;
    }
    if (event.button !== 0 || !this.canAim()) return;
    const view = this.view!;
    const own =
      event.stoneId !== null &&
      view.stones.some((s) => s.id === event.stoneId && s.ownerId === this.mySeat);
    if (own) {
      if (this.stoneId !== event.stoneId) {
        this.stoneId = event.stoneId;
        this.windBias = 0;
      }
      this.charging = true;
      this.phase = 0;
      this.power = 0;
      return;
    }
    if (this.stoneId === null || this.charging) return;
    if (event.point) this.updateMouseAngle(event.point);
    this.charging = true;
    this.phase = 0;
    this.power = 0;
  }

  private onUp(event: BoardPointerEvent): void {
    if (event.button !== 0 || !this.charging) return;
    this.fire();
  }

  private cancelCharge(): void {
    this.charging = false;
    this.phase = 0;
    this.power = 0;
    this.stoneId = null;
    this.pull = 0;
  }

  private fire(): void {
    const view = this.view;
    const stoneId = this.stoneId;
    const power = this.power;
    const nowMs = this.now();
    const angle = this.finalAngle(nowMs);
    const reachable = this.currentReach()?.reachable;
    this.cancelCharge();
    if (!view || stoneId === null || !this.canAim() || !(power > 0)) return; // 세기 0이면 조준 상태로 복귀
    if (!reachable) return; // 손이 안 닿으면 보내지 않는다(HUD 안내 유지)
    const key = turnKeyOf(view);
    this.shotSentKey = key;
    this.submitting = true;
    const cmd: ShotSubmit = {
      gameId: view.gameId,
      turnId: view.turnId,
      stoneId,
      angle,
      power: Math.min(100, power),
    };
    void this.actions.submitShot(cmd).then(
      (result) => this.onShotResult(key, result),
      () => this.onShotResult(key, null),
    );
  }

  private onShotResult(key: string, result: CommandResult | null): void {
    this.submitting = false;
    if (result?.ok) {
      // 수락: 이 턴의 조준은 끝났다. 새 턴 스냅샷이 오면 초기화된다
      this.resetAim();
    } else {
      if (this.shotSentKey === key) this.shotSentKey = null;
      if (result && !result.ok) {
        this.showNotice(noticeFor(result.error.code));
        if (resetsAim(result.error.code)) this.resetAim();
      } else {
        this.showNotice('발사를 보내지 못했어요');
      }
    }
    this.refresh();
  }

  // ───────── 내부: 방해요소 ─────────

  private useSlot(): void {
    const view = this.view;
    if (!view || this.placement || this.placementSending || this.hold) return;
    const held = heldHazardState(view, this.now());
    if (!held || !held.usable) return; // 칸을 흐리게 표시하는 상태에서는 입력을 보내지 않는다
    const input = inputKindOf(held.kind);
    if (input === 'random') return;
    if (input === 'immediate') {
      // 세기 막대 충전을 끊지 않고 보낸다
      void this.actions
        .useHazard({
          gameId: view.gameId,
          hazardInstanceId: held.hazardInstanceId,
          ...(held.kind === 'board_spin'
            ? { direction: this.rotateDir() < 0 ? (-1 as const) : (1 as const) }
            : {}),
        })
        .then(
          (result) => this.onHazardResult(result),
          () => this.onHazardResult(null),
        );
      return;
    }
    if (this.charging) return; // 충전 중에는 배치·들기 모드로 들어가지 않는다
    if (input === 'hold') {
      this.hold = {
        kind: held.kind as HoldKind,
        instanceId: held.hazardInstanceId,
        phase: 'aiming',
        firedAtMs: 0,
        effectSeen: false,
      };
      return;
    }
    const kind = held.kind as 'wall' | 'sticky';
    this.placement = {
      kind,
      instanceId: held.hazardInstanceId,
      x: 0,
      y: 0,
      orientation: 'horizontal',
    };
    this.movePlacement();
  }

  /** 즉시 사용·배치 결과. null은 전송 실패(연결 끊김 등으로 거부된 Promise) */
  private onHazardResult(result: CommandResult | null): void {
    if (!result) this.showNotice('방해요소를 보내지 못했어요');
    else if (!result.ok) this.showNotice(noticeFor(result.error.code));
    // 위치만 틀렸으면 배치 모드를 유지해 다른 곳을 고르게 한다
    const keepPlacement =
      result !== null && !result.ok && result.error.code === 'HAZARD_INVALID_TARGET';
    if (!keepPlacement) this.placement = null;
    this.placementSending = false;
    this.refresh();
  }

  /** 들고 있는 후레쉬·물총을 지금 조준점으로 발동한다 */
  private fireHold(): void {
    const h = this.hold;
    const view = this.view;
    if (!h || !view || h.phase !== 'aiming') return;
    const target = this.aimPoint ?? opponentFacePoint(this.mySeat);
    h.phase = 'sending';
    const instanceId = h.instanceId;
    void this.actions
      .useHazard({
        gameId: view.gameId,
        hazardInstanceId: instanceId,
        target: { x: target.x, y: target.y, h: target.h },
      })
      .then(
        (result) => this.onHoldResult(instanceId, target, result),
        () => this.onHoldResult(instanceId, target, null),
      );
  }

  private onHoldResult(instanceId: string, target: Point3, result: CommandResult | null): void {
    const h = this.hold;
    if (!h || h.instanceId !== instanceId) {
      if (result?.ok && this.view)
        this.actions.aimHazard({
          gameId: this.view.gameId,
          hazardInstanceId: instanceId,
          target,
          active: false,
        });
      return;
    }
    if (result?.ok) {
      const nowMs = this.now();
      h.phase = 'active';
      h.firedAtMs = nowMs;
      h.effectSeen = false;
      this.hazardAimSent = target;
      this.hazardAimSentMs = nowMs;
    } else {
      this.hold = null;
      this.showNotice(result ? noticeFor(result.error.code) : '방해요소를 보내지 못했어요');
    }
    this.refresh();
  }

  /** 내가 시전한(상대가 대상인) 해당 효과가 지금 활성인가 */
  private beamActive(kind: HoldKind, nowMs: number): boolean {
    const opponent: Seat = this.mySeat === 0 ? 1 : 0;
    return (
      this.view?.effects.some(
        (e) =>
          e.kind === kind &&
          e.targetSeat === opponent &&
          e.startsAtMs <= nowMs &&
          nowMs < e.expiresAtMs,
      ) ?? false
    );
  }

  /** 발동 뒤: 효과가 활성인 동안 조준점을 약 20Hz로 보내고, 끝나면 들기 상태를 접는다 */
  private advanceHold(nowMs: number): void {
    const h = this.hold;
    const view = this.view;
    if (!h || !view || h.phase !== 'active') return;
    const active = this.beamActive(h.kind, nowMs);
    if (active) h.effectSeen = true;
    const graceEnd = h.firedAtMs + HAZARDS[h.kind].durationMs + BEAM_GRACE_MS;
    if ((h.effectSeen && !active) || (!active && nowMs >= graceEnd)) {
      this.hold = null;
      return;
    }
    const p = this.aimPoint;
    if (!active || !p || samePoint3(p, this.hazardAimSent)) return;
    if (!due(this.hazardAimSentMs, nowMs)) return;
    this.hazardAimSent = p;
    this.hazardAimSentMs = sentAt(this.hazardAimSentMs, nowMs);
    this.actions.aimHazard({
      gameId: view.gameId,
      hazardInstanceId: h.instanceId,
      target: { x: p.x, y: p.y, h: p.h },
    });
  }

  /** 들기 중 보유가 바뀌거나 경기가 끝나면 접는다(발동 뒤에는 보유가 비므로 경기 종료만 본다) */
  private syncHold(): void {
    const h = this.hold;
    const view = this.view;
    if (!h || !view) return;
    const inPlay = view.phase === 'aiming' || view.phase === 'moving';
    if (!inPlay) {
      this.hold = null;
    } else if (h.phase === 'aiming' && view.private.held?.hazardInstanceId !== h.instanceId) {
      this.hold = null;
    }
  }

  private movePlacement(): void {
    const p = this.placement;
    if (!p) return;
    const pt = this.pointer ?? { x: 0, y: 0 };
    if (p.kind === 'wall') {
      p.x = snapToWallGrid(pt.x);
      p.y = snapToWallGrid(pt.y);
    } else {
      p.x = pt.x;
      p.y = pt.y;
    }
  }

  private rotatePlacement(): void {
    const p = this.placement;
    if (!p || p.kind !== 'wall') return;
    p.orientation = p.orientation === 'horizontal' ? 'vertical' : 'horizontal';
  }

  private confirmPlacement(): void {
    const p = this.placement;
    const view = this.view;
    if (!p || !view || this.placementSending) return;
    if (!this.placementValid(p)) return; // 빨간 후보는 보내지 않는다
    this.placementSending = true;
    void this.actions
      .useHazard({
        gameId: view.gameId,
        hazardInstanceId: p.instanceId,
        target: {
          x: p.x,
          y: p.y,
          ...(p.kind === 'wall' ? { orientation: p.orientation } : {}),
        },
      })
      .then(
        (result) => this.onHazardResult(result),
        () => this.onHazardResult(null),
      );
  }

  private placementValid(p: NonNullable<typeof this.placement>): boolean {
    const view = this.view;
    if (!view) return false;
    return isPlacementValid(p.kind, p.x, p.y, p.orientation, this.placementWorld(view));
  }

  /** 서버 검증과 같은 입력: 지면 알, 활성 벽·끈끈이(공개 효과 params) */
  private placementWorld(view: GameView): PlacementWorld {
    const now = this.now();
    const walls: PlacementWorld['walls'][number][] = [];
    const stickies: PlacementWorld['stickies'][number][] = [];
    for (const e of view.effects) {
      if (e.expiresAtMs <= now || !e.params) continue;
      if (e.kind === 'wall') {
        const w = wallFromParams(e.params);
        if (w) walls.push(w);
      } else if (e.kind === 'sticky' && e.params.x !== undefined && e.params.y !== undefined) {
        stickies.push({
          cx: e.params.x,
          cy: e.params.y,
          radius: HAZARD_TUNING.stickyDiameter / 2,
        });
      }
    }
    return {
      board: this.board,
      stones: view.stones.filter((s) => s.h <= 0),
      walls,
      stickies,
    };
  }

  /** 보유 방해요소가 바뀌었거나 경기가 끝나면 배치 모드를 접는다 */
  private syncPlacement(): void {
    const p = this.placement;
    const view = this.view;
    if (!p || !view) return;
    const inPlay = view.phase === 'aiming' || view.phase === 'moving';
    if (!inPlay || view.private.held?.hazardInstanceId !== p.instanceId) {
      this.placement = null;
      this.placementSending = false;
    }
  }

  // ───────── 내부: 기본 판 돌리기 ─────────

  /** 누르고 있는 입력의 합 방향. 반대 방향을 함께 누르면 0 */
  private rotateDir(): -1 | 0 | 1 {
    let sum = 0;
    for (const d of this.rotateInputs.values()) sum += d;
    return sum > 0 ? 1 : sum < 0 ? -1 : 0;
  }

  /** 내 턴·조준 단계·기절 아님·마감 전·충전 아님·배치/들기 아님 */
  private canRotate(): boolean {
    return this.canAim() && !this.charging && !this.placement && !this.hold;
  }

  private advanceRotate(nowMs: number, dtMs: number): void {
    const dir = this.rotateDir();
    if (!this.canRotate()) {
      this.rotating = false;
      this.rotatePendingDeg = 0;
      return;
    }
    this.rotating = dir !== 0;
    if (this.rotating && dtMs > 0) {
      this.rotatePendingDeg += (dir * BOARD_TURN.maxDegPerSec * dtMs) / 1000;
    }
    if (due(this.rotateSentMs, nowMs)) this.flushRotate(nowMs);
  }

  /** 모인 회전량을 `board:rotate`로 보낸다. 거부는 조용히 무시한다(다음 스냅샷이 실제 각도를 준다) */
  private flushRotate(nowMs: number): void {
    const view = this.view;
    const delta = this.rotatePendingDeg;
    this.rotatePendingDeg = 0;
    if (!view || delta === 0 || !this.canRotate()) return;
    this.rotateSentMs = sentAt(this.rotateSentMs, nowMs);
    const deltaDeg = Math.max(-90, Math.min(90, delta));
    void this.actions
      .rotateBoard({ gameId: view.gameId, turnId: view.turnId, deltaDeg })
      .then(undefined, () => undefined);
  }

  // ───────── 내부: 조준 ─────────

  private defaultAngle(): number {
    return this.mySeat === 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  private resetAim(): void {
    this.stoneId = null;
    this.windBias = 0;
    this.mouseAngle = this.defaultAngle();
    this.cancelCharge();
  }

  private isStunned(view: GameView, nowMs: number): boolean {
    return view.effects.some(
      (e) =>
        e.kind === 'stun' &&
        e.targetSeat === this.mySeat &&
        e.startsAtMs <= nowMs &&
        nowMs < e.expiresAtMs,
    );
  }

  /** 지금 조준 입력을 받을 수 있는가: 내 턴 조준 중, 기절 아님, 마감 전, 이 턴에 아직 발사 안 함 */
  private canAim(): boolean {
    const view = this.view;
    if (!view) return false;
    const now = this.now();
    return (
      view.phase === 'aiming' &&
      view.activePlayerId === this.mySeat &&
      now < view.deadlineMs &&
      !this.isStunned(view, now) &&
      this.shotSentKey !== turnKeyOf(view) &&
      !this.submitting
    );
  }

  private syncEligibility(): void {
    if (!this.canAim() && (this.stoneId !== null || this.charging)) {
      // 선택한 알이 사라졌거나 조준할 수 없는 상태가 되면 초기화
      this.resetAim();
    } else if (this.stoneId !== null && !this.ownStone(this.stoneId)) {
      this.resetAim();
    }
  }

  private ownStone(id: number): { x: number; y: number } | null {
    const s = this.view?.stones.find((st) => st.id === id && st.ownerId === this.mySeat);
    return s ? { x: s.x, y: s.y } : null;
  }

  /** 선택한 알의 손 닿는 거리. 선택이 없으면 null */
  private currentReach(): Reach | null {
    if (this.stoneId === null) return null;
    const s = this.ownStone(this.stoneId);
    return s ? reachOf(this.mySeat, s.x, s.y) : null;
  }

  private updateMouseAngle(point: Point): void {
    if (this.stoneId === null) return;
    const stone = this.ownStone(this.stoneId);
    if (!stone) return;
    const dx = point.x - stone.x;
    const dy = point.y - stone.y;
    // 알 중심 바로 위는 방향이 정해지지 않으므로 직전 값을 유지한다

    if (Math.hypot(dx, dy) < PHYSICS.stoneRadius) return;
    this.pull = Math.min(1, Math.hypot(dx, dy) / 12);
    this.mouseAngle = Math.atan2(-dy, -dx);
  }

  /** 떨림 없는 조준 각도(마우스 + 바람 편향) */
  private baseAngle(): number {
    return normalizeAngle(this.mouseAngle + this.windBias);
  }

  /** 먼 거리 조준·책상 흔들기로 생기는 조준 떨림(라디안). 시간 기반이라 같은 시각이면 같은 값이다 */
  private jitter(nowMs: number): number {
    const strain = this.currentReach()?.strain ?? 0;
    const deg =
      strain * STRAIN_JITTER_DEG + (this.deskShakeActive(nowMs) ? DESK_SHAKE_JITTER_DEG : 0);
    return deg > 0 ? ((deg * Math.PI) / 180) * tremor(nowMs) : 0;
  }

  /** 최종 조준 각도(바람 편향 + 떨림) (−π, π] */
  private finalAngle(nowMs: number): number {
    return normalizeAngle(this.baseAngle() + this.jitter(nowMs));
  }

  private activeEffect(kind: 'wind' | 'bar_speed', nowMs: number) {
    return this.view?.effects.find(
      (e) =>
        e.kind === kind &&
        e.targetSeat === this.mySeat &&
        e.startsAtMs <= nowMs &&
        nowMs < e.expiresAtMs,
    );
  }

  /** 책상 흔들기는 양쪽 화면·조준을 흔든다(대상 좌석과 무관) */
  private deskShakeActive(nowMs: number): boolean {
    return (
      this.view?.effects.some(
        (e) => e.kind === 'desk_shake' && e.startsAtMs <= nowMs && nowMs < e.expiresAtMs,
      ) ?? false
    );
  }

  /** 시간 진행: 만료 정리, 바람 편향, 세기 막대, 판 돌리기, 후레쉬·물총 조준 전송 */
  private advance(): void {
    const nowMs = this.now();
    const last = this.lastAdvanceMs;
    this.lastAdvanceMs = nowMs;
    const view = this.view;
    if (!view) return;
    const dtMs = last === null ? 0 : Math.min(MAX_STEP_MS, Math.max(0, nowMs - last));

    if ((this.stoneId !== null || this.charging) && !this.canAim()) {
      this.resetAim(); // 마감·기절·단계 변화
    }
    if (this.stoneId !== null && dtMs > 0) {
      // 바람: 조준 방향을 바람 방향 쪽으로 돌린다(지나치지 않는다). 직접 조작과 함께 반영된다.
      const wind = this.activeEffect('wind', nowMs);
      if (wind?.params?.directionRad !== undefined) {
        const maxStep = ((HAZARD_TUNING.windDegPerSec * Math.PI) / 180) * (dtMs / 1000);
        const diff = shortestAngleDelta(this.baseAngle(), wind.params.directionRad);
        this.windBias += Math.sign(diff) * Math.min(Math.abs(diff), maxStep);
      }

      // 세기 막대: 0→100→0, 2초 주기. 속도 조절 효과가 있으면 배율만큼 빠르다
      if (this.charging) {
        const bar = this.activeEffect('bar_speed', nowMs);
        const mult = bar ? (bar.params?.multiplier ?? HAZARD_TUNING.barSpeedMultiplier) : 1;
        // 위상은 한 번 오르내릴 때 2만큼 늘어난다(오름 1, 내림 1)
        this.phase = (this.phase + ((dtMs / 1000) * mult * 2) / BAR_PERIOD_SEC) % 2;
        this.power = powerFromPhase(this.phase);
      }
    }
    this.advanceRotate(nowMs, dtMs);
    this.advanceHold(nowMs);
  }

  // ───────── 내부: 안내·스냅샷 ─────────

  private showNotice(text: string): void {
    this.notice = { text, untilMs: this.now() + NOTICE_MS };
  }

  private refresh(): void {
    const next = this.buildSnapshot();
    if (!sameSnapshot(this.snapshot, next)) {
      this.snapshot = next;
      for (const l of this.listeners) l();
    }
    this.streamPose(next.pose);
  }

  /** 몸짓이 바뀌면 최대 20Hz로 `aim:update`를 보낸다 */
  private streamPose(pose: CharacterPose): void {
    const view = this.view;
    if (!view || view.phase === 'waiting' || view.phase === 'finished') return;
    if (this.poseSent && samePose(this.poseSent, pose)) return;
    const nowMs = this.now();
    if (!due(this.poseSentMs, nowMs)) return; // 다음 프레임 tick이 다시 시도한다
    this.poseSent = pose;
    this.poseSentMs = sentAt(this.poseSentMs, nowMs);
    this.actions.sendAim({ gameId: view.gameId, ...pose });
  }

  private buildSnapshot(): AimSnapshot {
    const nowMs = this.now();
    let aim: AimRenderState | null = null;
    if (!this.placement && !this.hold && this.stoneId !== null && this.canAim()) {
      const reach = this.currentReach();
      aim = {
        stoneId: this.stoneId,
        angle: this.finalAngle(nowMs),
        power: this.charging ? this.power : 0,
        charging: this.charging,
        pull: this.pull,
        reachable: reach?.reachable ?? false,
        strain: reach?.strain ?? 0,
      };
    }
    const p = this.placement;
    const placement: PlacementRenderState | null = p
      ? {
          kind: p.kind,
          x: p.x,
          y: p.y,
          orientation: p.orientation,
          valid: this.placementValid(p) && !this.placementSending,
        }
      : null;
    const notice = this.notice && this.notice.untilMs > nowMs ? this.notice : null;

    // 화면 흔들림: 원인별 최댓값
    const shake = Math.max(
      aim ? aim.strain * SHAKE.strain : 0,
      this.activeEffect('wind', nowMs) ? SHAKE.wind : 0,
      this.deskShakeActive(nowMs) ? SHAKE.deskShake : 0,
    );

    const h = this.hold;
    let hint: string | null = null;
    if (h) hint = h.phase === 'active' ? HINTS.aimHazard : HINTS.holdHazard;
    else if (aim && !aim.reachable) hint = HINTS.outOfReach;

    let pose: CharacterPose;
    if (h) {
      pose = {
        mode: 'hold_hazard',
        kind: h.kind,
        target: this.aimPoint ?? opponentFacePoint(this.mySeat),
      };
    } else if (this.rotating) {
      pose = { mode: 'rotate' };
    } else if (aim) {
      pose = aim.charging
        ? { mode: 'charge', stoneId: aim.stoneId, angle: aim.angle, power: aim.power }
        : { mode: 'aim', stoneId: aim.stoneId, angle: aim.angle };
    } else {
      pose = { mode: 'idle' };
    }

    if (aim) pose.pull = aim.pull;
    pose.lookYaw = this.look?.yaw;
    pose.lookPitch = this.look?.pitch;
    return {
      aim,
      placement,
      notice,
      pose,
      shake,
      hint,
      canRotate: this.canRotate(),
      holding: h ? { kind: h.kind, fired: h.phase !== 'aiming' } : null,
    };
  }
}

function turnKeyOf(view: GameView): string {
  return `${view.gameId}:${view.turnId}`;
}

/** 마지막 전송에서 간격이 지났는가(시계가 뒤로 가면 바로 보낸다) */
function due(lastMs: number | null, nowMs: number): boolean {
  return lastMs === null || nowMs - lastMs >= STREAM_INTERVAL_MS || nowMs < lastMs;
}

/**
 * 이번 전송의 기준 시각. 프레임 간격(약 16ms)에 맞춰 늦게 보낸 만큼을 다음 간격에서 빼 주어
 * 평균 20Hz에 가깝게 보내되 넘지는 않는다. 오래 쉬었으면 지금부터 다시 센다.
 */
function sentAt(lastMs: number | null, nowMs: number): number {
  if (lastMs === null || nowMs < lastMs || nowMs - lastMs >= 2 * STREAM_INTERVAL_MS) return nowMs;
  return lastMs + STREAM_INTERVAL_MS;
}

function samePoint3(a: Point3 | null | undefined, b: Point3 | null | undefined): boolean {
  return a === b || (!!a && !!b && a.x === b.x && a.y === b.y && a.h === b.h);
}

function samePose(a: CharacterPose, b: CharacterPose): boolean {
  return (
    a.pull === b.pull &&
    a.lookYaw === b.lookYaw &&
    a.lookPitch === b.lookPitch &&
    a.mode === b.mode &&
    a.stoneId === b.stoneId &&
    a.angle === b.angle &&
    a.power === b.power &&
    a.kind === b.kind &&
    samePoint3(a.target, b.target)
  );
}

function sameSnapshot(a: AimSnapshot, b: AimSnapshot): boolean {
  const ea = a.aim;
  const eb = b.aim;
  const aimSame =
    ea === eb ||
    (!!ea &&
      !!eb &&
      ea.stoneId === eb.stoneId &&
      ea.angle === eb.angle &&
      ea.power === eb.power &&
      ea.charging === eb.charging &&
      ea.reachable === eb.reachable &&
      ea.strain === eb.strain);
  const pa = a.placement;
  const pb = b.placement;
  const placementSame =
    pa === pb ||
    (!!pa &&
      !!pb &&
      pa.kind === pb.kind &&
      pa.x === pb.x &&
      pa.y === pb.y &&
      pa.orientation === pb.orientation &&
      pa.valid === pb.valid);
  const ha = a.holding;
  const hb = b.holding;
  const holdingSame = ha === hb || (!!ha && !!hb && ha.kind === hb.kind && ha.fired === hb.fired);
  return (
    aimSame &&
    placementSame &&
    holdingSame &&
    a.notice === b.notice &&
    a.shake === b.shake &&
    a.hint === b.hint &&
    a.canRotate === b.canRotate &&
    samePose(a.pose, b.pose)
  );
}
