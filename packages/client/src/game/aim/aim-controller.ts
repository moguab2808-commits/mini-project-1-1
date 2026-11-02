// 조준·발사·방해요소 입력 상태 머신. React·DOM·Three.js에 의존하지 않는 순수 TypeScript다.
//
// 입력: 장면이 주는 `BoardPointerEvent`(서버 기준 좌표)와 키·휠·슬롯 클릭.
// 출력: `SceneProps.aim`·`placement`에 줄 렌더 상태와 HUD 안내.
// 조준 방향·세기는 서버 권한 상태가 아니다(DEC-026). 바람·세기 막대 효과를 반영한 최종값만 `shot:submit`으로 보낸다.
import {
  BOARDS,
  HAZARD_TUNING,
  PHYSICS,
  type BoardDefinition,
  type CommandResult,
  type GameStart,
  type GameView,
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
  PlacementRenderState,
} from '../scene/scene-contract.ts';
import {
  BAR_PERIOD_SEC,
  WIND_DEG_PER_SEC,
  normalizeAngle,
  powerFromPhase,
  shortestAngleDelta,
} from './aim-math.ts';
import { heldHazardState, inputKindOf } from './hazard-state.ts';
import { NOTICE_MS, noticeFor, resetsAim } from './notices.ts';

/** 컨트롤러가 세션에 요구하는 명령. `GameSession`이 그대로 만족한다. */
export interface AimActions {
  submitShot(cmd: ShotSubmit): Promise<CommandResult>;
  useHazard(cmd: HazardUse): Promise<CommandResult>;
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

export interface AimSnapshot {
  aim: AimRenderState | null;
  placement: PlacementRenderState | null;
  notice: AimNotice | null;
}

/** 한 번에 처리하는 시간 증분 상한(ms). 백그라운드 탭 복귀 때 막대·바람이 튀지 않게 한다 */
const MAX_STEP_MS = 250;

type Point = { x: number; y: number };

export type ControllerKey = 'e' | 'r' | 'escape';

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

  private pointer: Point | null = null;
  private lastAdvanceMs: number | null = null;
  private notice: AimNotice | null = null;

  private snapshot: AimSnapshot = { aim: null, placement: null, notice: null };
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
    }
    this.syncEligibility();
    this.syncPlacement();
    this.refresh();
  }

  /** 시간 진행(막대·바람·마감). 화면 프레임마다 부른다 */
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
    if (key === 'e') this.useSlot();
    else if (key === 'r') this.rotatePlacement();
    else this.cancelCurrent();
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

  /** 오른쪽 클릭 컨텍스트 메뉴 등 창 단위 취소가 필요할 때 */
  cancelCurrent(): void {
    if (this.placement) {
      this.placement = null;
      this.placementSending = false;
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
    if (event.point) this.updateMouseAngle(event.point);
  }

  private onDown(event: BoardPointerEvent): void {
    if (this.placement) {
      // 배치 모드 중 클릭은 알 선택·충전으로 전달하지 않는다
      if (event.button === 0) this.confirmPlacement();
      else if (event.button === 2) this.cancelCurrent();
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
  }

  private fire(): void {
    const view = this.view;
    const stoneId = this.stoneId;
    const power = this.power;
    this.cancelCharge();
    if (!view || stoneId === null || !this.canAim() || !(power > 0)) return; // 세기 0이면 조준 상태로 복귀
    const key = turnKeyOf(view);
    this.shotSentKey = key;
    this.submitting = true;
    const cmd: ShotSubmit = {
      gameId: view.gameId,
      turnId: view.turnId,
      stoneId,
      angle: this.finalAngle(),
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
    if (!view || this.placement || this.placementSending) return;
    const held = heldHazardState(view, this.now());
    if (!held || !held.usable) return; // 칸을 흐리게 표시하는 상태에서는 입력을 보내지 않는다
    const input = inputKindOf(held.kind);
    if (input === 'random') return;
    if (input === 'immediate') {
      // 세기 막대 충전을 끊지 않고 보낸다
      void this.actions
        .useHazard({ gameId: view.gameId, hazardInstanceId: held.hazardInstanceId })
        .then((result) => this.onHazardResult(result, false));
      return;
    }
    if (this.charging) return; // 충전 중에는 배치 모드로 들어가지 않는다
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

  private onHazardResult(result: CommandResult, leavePlacement: boolean): void {
    if (!result.ok) {
      this.showNotice(noticeFor(result.error.code));
      // 위치만 틀렸으면 배치 모드를 유지해 다른 곳을 고르게 한다
      if (result.error.code !== 'HAZARD_INVALID_TARGET') leavePlacement = true;
    } else {
      leavePlacement = true;
    }
    if (leavePlacement) this.placement = null;
    this.placementSending = false;
    this.refresh();
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
      .then((result) => this.onHazardResult(result, false));
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

  private updateMouseAngle(point: Point): void {
    if (this.stoneId === null) return;
    const stone = this.ownStone(this.stoneId);
    if (!stone) return;
    const dx = point.x - stone.x;
    const dy = point.y - stone.y;
    // 알 중심 바로 위는 방향이 정해지지 않으므로 직전 값을 유지한다
    if (Math.hypot(dx, dy) < PHYSICS.stoneRadius * 0.25) return;
    this.mouseAngle = Math.atan2(dy, dx);
  }

  /** 마우스 각도에 바람 편향을 더한 최종 각도 (−π, π] */
  private finalAngle(): number {
    return normalizeAngle(this.mouseAngle + this.windBias);
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

  /** 시간 진행: 만료 정리, 바람 편향, 세기 막대 */
  private advance(): void {
    const nowMs = this.now();
    const last = this.lastAdvanceMs;
    this.lastAdvanceMs = nowMs;
    const view = this.view;
    if (!view) return;
    const dtMs = last === null ? 0 : Math.min(MAX_STEP_MS, Math.max(0, nowMs - last));

    if (this.stoneId !== null || this.charging) {
      if (!this.canAim()) {
        this.resetAim(); // 마감·기절·단계 변화
        return;
      }
    }
    if (this.stoneId === null || dtMs <= 0) return;

    // 바람: 조준 방향을 바람 방향 쪽으로 초당 60도 돌린다(지나치지 않는다). 직접 조작과 함께 반영된다.
    const wind = this.activeEffect('wind', nowMs);
    if (wind?.params?.directionRad !== undefined) {
      const maxStep = ((WIND_DEG_PER_SEC * Math.PI) / 180) * (dtMs / 1000);
      const diff = shortestAngleDelta(this.finalAngle(), wind.params.directionRad);
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

  // ───────── 내부: 안내·스냅샷 ─────────

  private showNotice(text: string): void {
    this.notice = { text, untilMs: this.now() + NOTICE_MS };
  }

  private refresh(): void {
    const next = this.buildSnapshot();
    if (sameSnapshot(this.snapshot, next)) return;
    this.snapshot = next;
    for (const l of this.listeners) l();
  }

  private buildSnapshot(): AimSnapshot {
    let aim: AimRenderState | null = null;
    if (!this.placement && this.stoneId !== null && this.canAim()) {
      aim = {
        stoneId: this.stoneId,
        angle: this.finalAngle(),
        power: this.charging ? this.power : 0,
        charging: this.charging,
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
    const notice = this.notice && this.notice.untilMs > this.now() ? this.notice : null;
    return { aim, placement, notice };
  }
}

function turnKeyOf(view: GameView): string {
  return `${view.gameId}:${view.turnId}`;
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
      ea.charging === eb.charging);
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
  return aimSame && placementSame && a.notice === b.notice;
}
