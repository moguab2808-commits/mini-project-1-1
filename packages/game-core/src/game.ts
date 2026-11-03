import {
  BOARD_TURN,
  GRANT_POOL,
  HAZARDS,
  HAZARD_TUNING,
  PHYSICS,
  RULES,
  type BoardDefinition,
  type BoardId,
  type BoardRotate,
  type CommandResult,
  type GameErrorCode,
  type GameForfeit,
  type GameOver,
  type GameView,
  type HazardAim,
  type HazardGranted,
  type HazardKind,
  type HazardParams,
  type HazardTriggered,
  type HazardUse,
  type Seat,
  type ShotSubmit,
  type TurnChange,
} from '@alkkagi/shared';
import { beamHitsFace, reachOf, type Point3 } from './reach.ts';
import {
  boardOf,
  clampInside,
  circleVsObb,
  insideBoard,
  makeWall,
  rotate,
  spawnPositions,
  type Obb,
} from './geometry.ts';
import {
  effectFootprint,
  fakeWallTriple,
  gravityZoneObb,
  isInstallKind,
  isOnWallGrid,
  isPlacementValid,
  isStickyPlaceable,
  isWallPlaceable,
  movingWallAngle,
  movingWallAt,
  type Footprint,
  type PlacementWorld,
} from './placement.ts';
import { Prng, deriveSeed } from './prng.ts';
import {
  DT,
  advanceMotion,
  launch,
  type Mine,
  type MotionClock,
  type ReverseZone,
  type Stone,
  type World,
} from './physics.ts';

export interface GameConfig {
  gameId: string;
  board: BoardId;
  pieceCount: number;
  /** 경기 난수 시드. 클라이언트에 보내지 않는다 */
  seed: number;
  /** 경기 시작 시각(주입한 시계 기준 ms) */
  startMs: number;
  /** 지정하지 않으면 시드 난수로 정한다 */
  firstSeat?: Seat;
}

/** 방 큐가 붙이는 명령 봉투. seat는 서버가 연결에서 변환한 값이다. */
export interface Envelope {
  seat: Seat;
  observedAtMs: number;
}

export type CoreEvent =
  | { type: 'hazard:granted'; toSeat: Seat; payload: HazardGranted }
  /** `toSeat`이 있으면 그 좌석에만 보낸다(분신술·알 무게 변화는 시전자에게만, DEC-055) */
  | { type: 'hazard:triggered'; payload: HazardTriggered; toSeat?: Seat }
  | { type: 'turn:change'; payload: TurnChange }
  | { type: 'game:over'; payload: GameOver };

export type Phase = 'waiting' | 'aiming' | 'moving' | 'resolving' | 'finished';

export interface Effect {
  id: number;
  kind: HazardKind;
  source: Seat;
  target: Seat;
  startsAtMs: number;
  expiresAtMs: number;
  params?: HazardParams;
  wall?: Obb;
  sticky?: { cx: number; cy: number; radius: number };
  blindPattern?: number;
  /** 직접 사용한 방해요소의 인스턴스 id(`hazard:aim` 대조용) */
  instanceId?: string;
  /** 후레쉬·물총: 사용자가 조준 중인 점(좌석 공간 기준이라 판 회전과 무관). 없으면 빗나감 */
  aim?: Point3;
  /** 후레쉬·물총: 현재 가림 정도 0~1(blindMaxCoverage 대비) */
  coverage?: number;
  /** 후레쉬·물총: 마지막으로 revision을 올린 때의 가림 정도 */
  publishedCoverage?: number;
  /** 가짜벽의 가짜 벽: 표시만 하고 충돌하지 않는다. 어느 뷰에도 넣지 않는다 */
  fake?: boolean;
  /** 시전자 뷰·이벤트에만 담는다(분신술·알 무게 변화) */
  casterOnly?: boolean;
  /** 자석·구멍 영역 */
  field?: { cx: number; cy: number; radius: number };
  /** 중력 구역 정사각형과 방향 단위 벡터 */
  zone?: { zone: Obb; dx: number; dy: number };
  reverse?: ReverseZone;
  mine?: Mine;
  /** 이동 장애물의 왕복 가운데와 벽 각(라디안) */
  movingWall?: { cx: number; cy: number; angle: number };
  /** 분신술 허상 */
  decoys?: Array<{ decoyId: number; x: number; y: number }>;
}

/** `hazard:use.target`의 종류별 허용 필드(API "추가 방해요소 10종 필드"). 없는 종류는 기존 규칙을 쓴다 */
const TARGET_FIELDS: Partial<Record<HazardKind, readonly string[] | null>> = {
  magnet: ['x', 'y'],
  reverse_zone: ['x', 'y'],
  mine: ['x', 'y'],
  pit: ['x', 'y'],
  gravity_zone: ['x', 'y', 'directionRad'],
  fake_wall: ['x', 'y', 'orientation'],
  moving_wall: ['x', 'y', 'orientation'],
  decoy: ['stoneId'],
  ice_floor: null,
  heavy_stones: null,
};

/** 추가 10종의 target 형식이 맞는가. 필드가 모자라거나 남으면 false */
function targetShapeOk(kind: HazardKind, target: object | undefined): boolean {
  if (!(kind in TARGET_FIELDS)) return true;
  const want = TARGET_FIELDS[kind];
  const has = target
    ? Object.entries(target)
        .filter(([, v]) => v !== undefined)
        .map(([k]) => k)
    : [];
  if (!want) return has.length === 0 && target === undefined;
  return has.length === want.length && want.every((k) => has.includes(k));
}

/** 라디안을 (−π, π]로 */
function normalizeRad(a: number): number {
  let r = a % (2 * Math.PI);
  if (r <= -Math.PI) r += 2 * Math.PI;
  if (r > Math.PI) r -= 2 * Math.PI;
  return r === 0 ? 0 : r;
}

type Target = {
  x?: number;
  y?: number;
  h?: number;
  orientation?: 'horizontal' | 'vertical';
  directionRad?: number;
  stoneId?: number;
};

const isBlind = (k: HazardKind): k is 'flashlight' | 'water_gun' =>
  k === 'flashlight' || k === 'water_gun';
/** 가림 정도가 이만큼 바뀌면 revision을 올려 뷰를 다시 보낸다(매 틱 전송을 피한다) */
const COVERAGE_PUBLISH_STEP = 0.05;

export interface PlayerState {
  held: { instanceId: string; kind: HazardKind; round: number } | null;
  gauge: number;
  overheated: boolean;
  cooldownEndsAtMs: number | null;
  timeoutStreak: number;
  /** 바람 방향 변경 일정(바람 보유 중에만) */
  random: { rng: Prng; nextAtMs: number } | null;
  /** 턴당 1회형을 이번 보유에서 이미 썼다 */
  usedThisGrant: boolean;
  /** 지급 번호(경기 안 전체 순번). 지급별 시드 스트림에 쓴다 */
  grantNo: number;
}

const TICK_MS = 1000 / PHYSICS.tickHz;
const other = (s: Seat): Seat => (s === 0 ? 1 : 0);

function fail(code: GameErrorCode, message: string): CommandResult {
  return { ok: false, error: { code, message } };
}

const OK: CommandResult = { ok: true };

/** `hazard:use` target을 후레쉬·물총 조준점으로. h가 없으면 판 위 점(h = 0)이다 */
function aimPointOf(t: { x: number; y: number; h?: number }): Point3 {
  return { x: t.x, y: t.y, h: t.h ?? 0 };
}

export class Game {
  readonly gameId: string;
  readonly boardId: BoardId;
  readonly board: BoardDefinition;
  readonly pieceCount: number;

  private readonly seed: number;
  private readonly startMs: number;
  private readonly firstSeat: Seat;
  /** 좌석별 지급 추첨 스트림 */
  protected readonly grantRngs: [Prng, Prng];
  protected readonly shakeRng: Prng;
  protected readonly visualRng: Prng;

  protected phase: Phase = 'waiting';
  private tick = 0;
  private now: number;
  private revision = 0;
  protected completedTurns = 0;
  private turnCounter = 0;
  private grantCounter = 0;
  private effectCounter = 0;
  /** 분신술 허상 id. 알 id(0..2×pieceCount−1)와 겹치지 않게 그 뒤에서 센다 */
  private decoyCounter = 0;
  /** 판의 누적 회전(도). 판 좌표계에서 반시계가 양수다(BoardRotateSchema와 같은 부호) */
  private boardRotationDeg = 0;
  /** 좌석별 마지막 기본 판 돌리기 시각. 속도 한도 계산에 쓴다 */
  protected readonly lastBoardTurnMs: [number | null, number | null] = [null, null];
  private result: GameOver | null = null;

  private active: Seat = 0;
  private turnId = 0;
  private deadlineMs = 0;
  private shotCommitted = false;
  private motion: MotionClock = { elapsed: 0, settle: 0 };

  protected readonly world: World;
  protected effects: Effect[] = [];
  protected readonly players: [PlayerState, PlayerState];
  private events: CoreEvent[] = [];

  constructor(config: GameConfig) {
    this.gameId = config.gameId;
    this.boardId = config.board;
    this.board = boardOf(config.board);
    this.pieceCount = config.pieceCount;
    this.seed = config.seed >>> 0;
    this.startMs = config.startMs;
    this.now = config.startMs;
    this.grantRngs = [new Prng(deriveSeed(this.seed, 1)), new Prng(deriveSeed(this.seed, 5))];
    this.shakeRng = new Prng(deriveSeed(this.seed, 2));
    this.visualRng = new Prng(deriveSeed(this.seed, 3));
    this.firstSeat = config.firstSeat ?? (new Prng(deriveSeed(this.seed, 4)).int(2) as Seat);

    const stones: Stone[] = [];
    let id = 0;
    for (const seat of [0, 1] as const) {
      for (const [x, y] of spawnPositions(this.board, seat, this.pieceCount)) {
        stones.push({
          id: id++,
          owner: seat,
          x,
          y,
          vx: 0,
          vy: 0,
          h: 0,
          vz: 0,
          airborne: false,
          alive: true,
        });
      }
    }
    this.world = { board: this.board, stones, walls: [], stickies: [] };
    const blank = (): PlayerState => ({
      held: null,
      gauge: 0,
      overheated: false,
      cooldownEndsAtMs: null,
      timeoutStreak: 0,
      random: null,
      usedThisGrant: false,
      grantNo: 0,
    });
    this.players = [blank(), blank()];
  }

  // ───────── 진행 ─────────

  /** 경기 시작: 방해요소 지급 → 첫 턴. 시작 시 phase는 waiting에서 aiming이 된다. */
  start(): void {
    if (this.phase !== 'waiting') return;
    this.revision++;
    this.grantAll(false);
    this.active = this.firstSeat;
    this.startTurn('start');
  }

  /** 주입한 시각까지 고정 틱을 진행하고 시간 기반 정산을 한다. */
  advanceTo(nowMs: number): void {
    if (this.phase === 'waiting' || this.phase === 'finished') return;
    while (this.startMs + (this.tick + 1) * TICK_MS <= nowMs + 1e-9) {
      this.tick++;
      const t = this.startMs + this.tick * TICK_MS;
      this.settleTime(t);
      if (this.isFinished) return;
      this.physicsTick();
      if (this.isFinished) return;
    }
    this.settleTime(nowMs);
  }

  /** 쌓인 이벤트를 비운다. 순서는 발생 순서다. */
  drainEvents(): CoreEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  get isFinished(): boolean {
    return this.phase === 'finished';
  }

  // ───────── 명령 ─────────

  submitShot(env: Envelope, cmd: ShotSubmit): CommandResult {
    this.advanceTo(env.observedAtMs);
    if (!(cmd.power > 0 && cmd.power <= 100) || !(cmd.angle > -Math.PI && cmd.angle <= Math.PI)) {
      return fail('INVALID_INPUT', '발사 값이 범위 밖이다');
    }
    if (this.phase !== 'aiming' && this.phase !== 'moving') {
      return fail('GAME_NOT_ACTIVE', '진행 중인 경기가 없다');
    }
    if (cmd.gameId !== this.gameId || cmd.turnId !== this.turnId) {
      return fail('STALE_TURN', '낡은 턴의 발사다');
    }
    if (env.seat !== this.active) return fail('NOT_YOUR_TURN', '내 턴이 아니다');
    if (this.shotCommitted) return fail('SHOT_ALREADY_SUBMITTED', '이미 발사했다');
    const stone = this.world.stones.find((s) => s.id === cmd.stoneId);
    if (!stone || !stone.alive || stone.owner !== env.seat) {
      return fail('INVALID_STONE', '쓸 수 없는 알이다');
    }
    if (this.isStunned(env.seat, env.observedAtMs)) return fail('PLAYER_STUNNED', '기절 중이다');
    if (!reachOf(env.seat, stone.x, stone.y).reachable) {
      return fail('OUT_OF_REACH', '손이 닿지 않는 알이다');
    }

    launch(stone, cmd.angle, cmd.power);
    this.shotCommitted = true;
    this.players[env.seat].timeoutStreak = 0;
    this.phase = 'moving';
    this.motion = { elapsed: 0, settle: 0 };
    this.revision++;
    return OK;
  }

  useHazard(env: Envelope, cmd: HazardUse): CommandResult {
    this.advanceTo(env.observedAtMs);
    if (this.phase !== 'aiming' && this.phase !== 'moving') {
      return fail('GAME_NOT_ACTIVE', '진행 중인 경기가 없다');
    }
    const p = this.players[env.seat];
    if (cmd.gameId !== this.gameId || !p.held || p.held.instanceId !== cmd.hazardInstanceId) {
      return fail('STALE_HAZARD', '보유한 방해요소가 아니다');
    }
    const meta = HAZARDS[p.held.kind];
    const kind = meta.kind;
    const now = env.observedAtMs;
    const t = cmd.target as Target | undefined;
    if (!targetShapeOk(kind, cmd.target)) return fail('INVALID_INPUT', '대상 형식이 맞지 않다');
    if (meta.category === 'random') return fail('HAZARD_NOT_USABLE', '직접 쓸 수 없다');
    if (meta.category === 'per_turn' && p.usedThisGrant) {
      return fail('HAZARD_NOT_USABLE', '이번 턴에 이미 썼다');
    }
    if (meta.category === 'fatigue' && p.overheated)
      return fail('HAZARD_OVERHEATED', '과열 중이다');
    if (meta.category === 'cooldown' && p.cooldownEndsAtMs !== null && now < p.cooldownEndsAtMs) {
      return fail('HAZARD_COOLDOWN', '쿨타임 중이다');
    }

    let wall: Obb | undefined;
    let sticky: Effect['sticky'];
    if (kind === 'wall') {
      if (!t || !t.orientation || t.x === undefined || t.y === undefined) {
        return fail('HAZARD_INVALID_TARGET', '벽 위치·방향이 맞지 않다');
      }
      if (!isOnWallGrid(t.x) || !isOnWallGrid(t.y)) {
        return fail('HAZARD_INVALID_TARGET', '벽 위치·방향이 맞지 않다');
      }
      wall = makeWall(t.x, t.y, t.orientation);
      if (!this.wallPlaceable(wall)) return fail('HAZARD_INVALID_TARGET', '벽을 놓을 수 없다');
    } else if (kind === 'sticky') {
      if (!t || t.x === undefined || t.y === undefined) {
        return fail('HAZARD_INVALID_TARGET', '끈끈이 위치가 없다');
      }
      sticky = { cx: t.x, cy: t.y, radius: HAZARD_TUNING.stickyDiameter / 2 };
      if (!this.stickyPlaceable(sticky))
        return fail('HAZARD_INVALID_TARGET', '끈끈이를 놓을 수 없다');
    } else if (isInstallKind(kind)) {
      // 추가 위치형: 형식은 위에서 확인했다
      const orientation = t!.orientation ?? 'horizontal';
      if (!isPlacementValid(kind, t!.x!, t!.y!, orientation, this.placementWorld())) {
        return fail('HAZARD_INVALID_TARGET', '그 자리에 놓을 수 없다');
      }
    }
    let decoyPlan: ReturnType<Game['planDecoys']> = null;
    if (kind === 'decoy') {
      decoyPlan = this.planDecoys(env.seat, t!.stoneId!, p.grantNo);
      if (!decoyPlan) return fail('HAZARD_INVALID_TARGET', '분신술을 쓸 수 없는 알이다');
    }

    // ── 검증 통과: 여기서부터 상태·난수를 바꾼다 ──
    if (meta.category === 'fatigue') {
      if (!isBlind(kind)) {
        p.gauge = Math.min(HAZARD_TUNING.fatigueMax, p.gauge + (meta.fatigueCost ?? 0));
        if (p.gauge >= HAZARD_TUNING.fatigueMax) p.overheated = true;
      }
    } else if (meta.category === 'per_turn') {
      p.usedThisGrant = true;
    } else {
      p.cooldownEndsAtMs = now + (meta.cooldownMs ?? 0);
    }
    const instanceId = p.held.instanceId;
    const src = env.seat;
    const tgt = other(env.seat);

    if (isInstallKind(kind) && kind !== 'wall' && kind !== 'sticky') {
      this.installNew(kind, src, now, t!, p.grantNo, instanceId);
      this.revision++;
      return OK;
    }
    if (kind === 'decoy' || kind === 'heavy_stones' || kind === 'ice_floor') {
      const eff = this.addEffect(
        kind,
        src,
        tgt,
        now,
        meta.durationMs,
        kind === 'heavy_stones'
          ? { multiplier: HAZARD_TUNING.heavyMassMultiplier }
          : kind === 'decoy'
            ? { stoneId: t!.stoneId! }
            : undefined,
      );
      eff.instanceId = instanceId;
      if (kind !== 'ice_floor') eff.casterOnly = true;
      if (decoyPlan) {
        const stone = this.world.stones.find((s) => s.id === t!.stoneId)!;
        [stone.x, stone.y] = decoyPlan.real;
        eff.decoys = decoyPlan.decoys.map(([x, y]) => ({
          decoyId: this.world.stones.length + ++this.decoyCounter - 1,
          x,
          y,
        }));
      }
      this.syncWorld();
      this.emitTriggered(eff, 'start');
      this.revision++;
      return OK;
    }

    // 후레쉬·물총: target이 있으면 첫 조준점(h가 없으면 판 위 점), 없으면 빗나감으로 시작한다.
    const aim: Point3 | undefined =
      isBlind(kind) && t && t.x !== undefined && t.y !== undefined
        ? aimPointOf({ x: t.x, y: t.y, ...(t.h !== undefined ? { h: t.h } : {}) })
        : undefined;
    const params: HazardParams | undefined =
      wall && t
        ? {
            x: wall.cx,
            y: wall.cy,
            orientation: t.orientation,
            angleDeg: (wall.angle * 180) / Math.PI,
          }
        : sticky
          ? { x: sticky.cx, y: sticky.cy }
          : kind === 'board_spin'
            ? { angleDeg: HAZARD_TUNING.boardSpinDeg * (cmd.direction ?? 1) }
            : isBlind(kind)
              ? { ...(aim ? { aimX: aim.x, aimY: aim.y, aimH: aim.h } : {}), coverage: 0 }
              : undefined;
    const eff = this.addEffect(kind, src, tgt, now, meta.durationMs, params);
    eff.instanceId = instanceId;
    if (wall) eff.wall = wall;
    if (sticky) eff.sticky = sticky;
    if (isBlind(kind)) {
      eff.blindPattern = this.visualRng.int(0x7fffffff);
      eff.coverage = 0;
      eff.publishedCoverage = 0;
      if (aim) eff.aim = aim;
    }
    this.syncWorld();
    if (kind === 'board_spin')
      this.applyBoardRotation(-HAZARD_TUNING.boardSpinDeg * (cmd.direction ?? 1));
    else if (kind === 'desk_shake') this.applyDeskShake();
    this.emitTriggered(eff, 'start');
    this.revision++;
    return OK;
  }

  /** 추가 위치형 7종을 놓는다. 검증은 끝난 상태다 */
  private installNew(
    kind: 'magnet' | 'gravity_zone' | 'fake_wall' | 'reverse_zone' | 'mine' | 'pit' | 'moving_wall',
    src: Seat,
    now: number,
    t: Target,
    grantNo: number,
    instanceId: string,
  ): void {
    const meta = HAZARDS[kind];
    const tgt = other(src);
    const x = t.x!;
    const y = t.y!;
    const T = HAZARD_TUNING;
    if (kind === 'fake_wall') {
      // 진짜 1개는 지급별 스트림으로 고른다. 세 벽은 좌표순이라 순서로 진짜를 알 수 없다
      const walls = fakeWallTriple(x, y, t.orientation!).sort((a, b) => a.cx - b.cx || a.cy - b.cy);
      const realIdx = new Prng(deriveSeed(this.seed, 5000 + grantNo)).int(3);
      walls.forEach((w, i) => {
        const eff = this.addEffect('wall', src, tgt, now, meta.durationMs, {
          x: w.cx,
          y: w.cy,
          orientation: t.orientation!,
          angleDeg: (w.angle * 180) / Math.PI,
        });
        eff.instanceId = instanceId;
        eff.wall = w;
        if (i !== realIdx) eff.fake = true;
      });
      this.syncWorld();
      for (const e of this.effects.filter((e) => e.instanceId === instanceId && e.wall)) {
        this.emitTriggered(e, 'start');
      }
      return;
    }
    let params: HazardParams = { x, y };
    const extra: Partial<Effect> = {};
    if (kind === 'magnet' || kind === 'pit') {
      extra.field = {
        cx: x,
        cy: y,
        radius: kind === 'magnet' ? T.magnetRadius : T.pitDiameter / 2,
      };
    } else if (kind === 'reverse_zone') {
      const radius = T.reverseZoneDiameter / 2;
      const inside = new Set(
        this.groundStones()
          .filter((s) => Math.hypot(s.x - x, s.y - y) <= radius)
          .map((s) => s.id),
      );
      extra.reverse = { cx: x, cy: y, radius, inside, done: new Set() };
    } else if (kind === 'mine') {
      extra.mine = { cx: x, cy: y, exploded: false };
    } else if (kind === 'gravity_zone') {
      const step = Math.PI / 4;
      const dir = normalizeRad(Math.round(t.directionRad! / step) * step);
      params = { x, y, directionRad: dir, angleDeg: 0 };
      extra.zone = { zone: gravityZoneObb(x, y, 0), dx: Math.cos(dir), dy: Math.sin(dir) };
    } else if (kind === 'moving_wall') {
      const angle = movingWallAngle(t.orientation!);
      params = { x, y, orientation: t.orientation!, angleDeg: (angle * 180) / Math.PI };
      extra.movingWall = { cx: x, cy: y, angle };
    }
    const eff = this.addEffect(kind, src, tgt, now, meta.durationMs, params);
    Object.assign(eff, extra);
    eff.instanceId = instanceId;
    this.syncWorld();
    this.emitTriggered(eff, 'start');
  }

  /**
   * 분신술 자리 3곳을 지급별 스트림으로 정한다. 대상이 내 멈춘 지면 알이 아니거나 자리가 모자라면 null.
   * 상태를 바꾸지 않으며, 저장된 난수 스트림도 쓰지 않는다(실패한 입력이 난수를 바꾸지 않는다).
   */
  private planDecoys(
    seat: Seat,
    stoneId: number,
    grantNo: number,
  ): { real: [number, number]; decoys: Array<[number, number]> } | null {
    const T = HAZARD_TUNING;
    const R = PHYSICS.stoneRadius;
    const stone = this.world.stones.find((s) => s.id === stoneId);
    if (!stone || !stone.alive || stone.owner !== seat || stone.airborne || stone.h > 0)
      return null;
    if (Math.hypot(stone.vx, stone.vy) >= PHYSICS.settleSpeed) return null;
    const rng = new Prng(deriveSeed(this.seed, 6000 + grantNo));
    const others = this.world.stones.filter((s) => s.alive && s.id !== stoneId);
    const walls = this.effects.flatMap((e) => (e.wall ? [e.wall] : []));
    const pits = this.effects.flatMap((e) => (e.kind === 'pit' && e.field ? [e.field] : []));
    const spots: Array<[number, number]> = [];
    for (let i = 0; i < T.decoyMaxTries && spots.length < 3; i++) {
      const a = rng.next() * 2 * Math.PI;
      const d = T.decoyMinDistance + rng.next() * (T.decoyMaxDistance - T.decoyMinDistance);
      const x = stone.x + Math.cos(a) * d;
      const y = stone.y + Math.sin(a) * d;
      if (!insideBoard(this.board, x, y, T.decoyEdgeInset)) continue;
      if (others.some((s) => Math.hypot(s.x - x, s.y - y) < T.decoySeparation)) continue;
      if (spots.some(([sx, sy]) => Math.hypot(sx - x, sy - y) < T.decoySeparation)) continue;
      if (walls.some((w) => circleVsObb(x, y, R, w))) continue;
      if (pits.some((pt) => Math.hypot(pt.cx - x, pt.cy - y) < pt.radius + R)) continue;
      spots.push([x, y]);
    }
    if (spots.length < 3) return null;
    const realIdx = rng.int(3);
    return { real: spots[realIdx]!, decoys: spots.filter((_, i) => i !== realIdx) };
  }

  /**
   * 기본 판 돌리기(`board:rotate`, DEC-036). 내 턴의 조준 단계에서 기절이 아닐 때만 받는다.
   * 검사 순서: INVALID_INPUT → GAME_NOT_ACTIVE → STALE_TURN(gameId·turnId) → NOT_YOUR_TURN
   * → BOARD_ROTATE_NOT_ALLOWED(조준 단계 아님·발사함·기절). 속도 한도를 넘는 각은 한도까지
   * 잘라 적용하고 성공으로 응답한다. 양수 deltaDeg는 반시계(판 좌표계)다.
   */
  rotateBoard(env: Envelope, cmd: BoardRotate): CommandResult {
    this.advanceTo(env.observedAtMs);
    if (!Number.isFinite(cmd.deltaDeg) || Math.abs(cmd.deltaDeg) > 90) {
      return fail('INVALID_INPUT', '회전 각이 범위 밖이다');
    }
    if (this.phase !== 'aiming' && this.phase !== 'moving') {
      return fail('GAME_NOT_ACTIVE', '진행 중인 경기가 없다');
    }
    if (cmd.gameId !== this.gameId || cmd.turnId !== this.turnId) {
      return fail('STALE_TURN', '낡은 턴의 명령이다');
    }
    if (env.seat !== this.active) return fail('NOT_YOUR_TURN', '내 턴이 아니다');
    if (this.phase !== 'aiming' || this.shotCommitted) {
      return fail('BOARD_ROTATE_NOT_ALLOWED', '조준 단계가 아니다');
    }
    if (this.isStunned(env.seat, env.observedAtMs)) {
      return fail('BOARD_ROTATE_NOT_ALLOWED', '기절 중이다');
    }

    const last = this.lastBoardTurnMs[env.seat];
    const elapsedSec = last === null ? Infinity : Math.max(0, env.observedAtMs - last) / 1000;
    const limit = BOARD_TURN.maxDegPerSec * elapsedSec + BOARD_TURN.burstDeg;
    const delta = Math.max(-limit, Math.min(limit, cmd.deltaDeg));
    this.lastBoardTurnMs[env.seat] = env.observedAtMs;
    if (delta !== 0) {
      this.applyBoardRotation(delta);
      this.revision++;
    }
    return OK;
  }

  /**
   * 발동 중인 내 후레쉬·물총의 조준점을 옮긴다(`hazard:aim`, DEC-036). 응답을 쓰지 않는 명령이라
   * 맞는 효과가 없으면 상태를 바꾸지 않고 거부 결과만 돌려준다. 조준점만 바꾸므로 revision은
   * 올리지 않는다(가림 정도가 바뀌면 틱에서 올린다).
   */
  aimHazard(env: Envelope, cmd: HazardAim): CommandResult {
    this.advanceTo(env.observedAtMs);
    if (this.phase !== 'aiming' && this.phase !== 'moving') {
      return fail('GAME_NOT_ACTIVE', '진행 중인 경기가 없다');
    }
    const t = cmd.target;
    if (!Number.isFinite(t.x) || !Number.isFinite(t.y) || !Number.isFinite(t.h)) {
      return fail('INVALID_INPUT', '조준점이 올바르지 않다');
    }
    const eff =
      cmd.gameId === this.gameId
        ? this.effects.find(
            (e) =>
              isBlind(e.kind) &&
              e.source === env.seat &&
              e.instanceId === cmd.hazardInstanceId &&
              e.startsAtMs <= env.observedAtMs &&
              env.observedAtMs < e.expiresAtMs,
          )
        : undefined;
    if (!eff) return fail('STALE_HAZARD', '발동 중인 후레쉬·물총이 아니다');
    if (cmd.active === false) {
      eff.expiresAtMs = env.observedAtMs;
      this.revision++;
      return OK;
    }
    eff.aim = { x: t.x, y: t.y, h: t.h };
    eff.params = { ...eff.params, aimX: t.x, aimY: t.y, aimH: t.h };
    return OK;
  }

  forfeit(env: Envelope, cmd: GameForfeit): CommandResult {
    this.advanceTo(env.observedAtMs);
    if (this.phase === 'waiting' || this.phase === 'finished' || cmd.gameId !== this.gameId) {
      return fail('GAME_NOT_ACTIVE', '진행 중인 경기가 없다');
    }
    this.finish(other(env.seat), 'forfeit');
    return OK;
  }

  // ───────── 뷰 ─────────

  /** 뷰를 만들지 않고 전송 여부만 가리려는 호출자를 위한 값(틱·revision·phase). */
  meta(): { tick: number; revision: number; phase: Phase } {
    return { tick: this.tick, revision: this.revision, phase: this.phase };
  }

  /** 허용 목록 방식으로 새로 만든 플레이어별 뷰. 상대 비공개 정보를 넣지 않는다. */
  getViewFor(seat: Seat): GameView {
    const now = this.now;
    const p = this.players[seat];
    const held = p.held;
    const meta = held ? HAZARDS[held.kind] : null;
    const cooldownActive = p.cooldownEndsAtMs !== null && now < p.cooldownEndsAtMs;
    const inPlay = this.phase === 'aiming' || this.phase === 'moving';
    const usable =
      !!meta &&
      inPlay &&
      meta.category !== 'random' &&
      !(meta.category === 'per_turn' && p.usedThisGrant) &&
      !(meta.category === 'fatigue' && p.overheated) &&
      !(meta.category === 'cooldown' && cooldownActive);
    // 시전자 전용 효과(분신술·알 무게 변화)는 상대 뷰에 넣지 않는다. 가짜벽의 진짜 여부는 어디에도 없다
    const visible = this.effects.filter((e) => !e.casterOnly || e.source === seat);
    const myDecoys = this.effects
      .filter((e) => e.source === seat && e.decoys)
      .flatMap((e) => e.decoys!);
    const foreignDecoys = this.effects
      .filter((e) => e.source !== seat && e.decoys)
      .flatMap((e) => e.decoys!.map((d) => ({ ...d, owner: e.source })));
    const blindEff = this.effects.find(
      (e) =>
        (e.kind === 'flashlight' || e.kind === 'water_gun') &&
        e.target === seat &&
        e.startsAtMs <= now &&
        now < e.expiresAtMs,
    );
    return {
      gameId: this.gameId,
      serverTick: this.tick,
      serverNowMs: now,
      revision: this.revision,
      phase: this.phase,
      turnId: this.turnId,
      round: this.round,
      activePlayerId: this.active,
      deadlineMs: this.deadlineMs,
      boardRotationDeg: this.boardRotationDeg,
      stones: [
        ...this.world.stones
          .filter((s) => s.alive)
          .map((s) => ({ id: s.id, ownerId: s.owner, x: s.x, y: s.y, h: s.h })),
        // 상대의 분신술 허상은 일반 알처럼 보낸다(DEC-058)
        ...foreignDecoys.map((d) => ({ id: d.decoyId, ownerId: d.owner, x: d.x, y: d.y, h: 0 })),
      ],
      effects: visible.map((e) => ({
        kind: e.kind,
        targetSeat: e.target,
        startsAtMs: e.startsAtMs,
        expiresAtMs: e.expiresAtMs,
        ...(e.params ? { params: { ...e.params } } : {}),
      })),
      result: this.result
        ? { ...this.result, remainingStones: [...this.result.remainingStones] }
        : null,
      stoneCounts: this.remaining(),
      ...(myDecoys.length > 0
        ? { decoys: myDecoys.map((d) => ({ decoyId: d.decoyId, x: d.x, y: d.y })) }
        : {}),
      private: {
        held: held
          ? { hazardInstanceId: held.instanceId, kind: held.kind, round: held.round }
          : null,
        fatigueGauge: meta?.category === 'fatigue' ? p.gauge : null,
        overheated: meta?.category === 'fatigue' ? p.overheated : false,
        cooldownEndsAtMs:
          meta?.category === 'cooldown' && cooldownActive ? p.cooldownEndsAtMs : null,
        usable,
        timeoutStreak: p.timeoutStreak,
        ...(blindEff && blindEff.blindPattern !== undefined
          ? {
              blind: {
                kind: blindEff.kind as 'flashlight' | 'water_gun',
                startsAtMs: blindEff.startsAtMs,
                expiresAtMs: blindEff.expiresAtMs,
                maxCoverage: HAZARD_TUNING.blindMaxCoverage,
                coverage: blindEff.coverage ?? 0,
                pattern: blindEff.blindPattern,
              },
            }
          : {}),
      },
    };
  }

  // ───────── 내부: 턴·라운드 ─────────

  private get round(): number {
    return Math.min(RULES.finalRound, Math.floor(this.completedTurns / 2) + 1);
  }

  private startTurn(reason: TurnChange['reason']): void {
    this.turnId = ++this.turnCounter;
    this.shotCommitted = false;
    this.deadlineMs = this.now + RULES.turnSeconds * 1000;
    this.phase = 'aiming';
    this.revision++;
    this.events.push({
      type: 'turn:change',
      payload: {
        gameId: this.gameId,
        turnId: this.turnId,
        round: this.round,
        activePlayerId: this.active,
        deadlineMs: this.deadlineMs,
        serverNowMs: this.now,
        reason,
      },
    });
  }

  /** 종료 판정 → 교체 지급 → 다음 턴 주인 변경 → 새 턴 */
  private resolveTurn(reason: 'resolved' | 'timeout'): void {
    this.phase = 'resolving';
    this.completedTurns++;
    const [n0, n1] = this.remaining();
    if (n0 === 0 || n1 === 0) {
      this.finish(n0 === 0 && n1 === 0 ? null : n0 === 0 ? 1 : 0, 'all_stones_out');
      return;
    }
    if (this.completedTurns >= 2 * RULES.finalRound) {
      this.finish(n0 === n1 ? null : n0 > n1 ? 0 : 1, 'final_round');
      return;
    }
    // 발사 턴이 바뀔 때마다 두 좌석 모두 교체한다(DEC-055). 종료된 턴에는 교체하지 않는다
    this.grantAll(true);
    this.active = other(this.active);
    this.startTurn(reason);
  }

  private remaining(): [number, number] {
    const n: [number, number] = [0, 0];
    for (const s of this.world.stones) if (s.alive) n[s.owner]++;
    return n;
  }

  private finish(winner: Seat | null, reason: GameOver['reason']): void {
    if (this.phase === 'finished') return;
    this.phase = 'finished';
    this.revision++;
    this.result = {
      gameId: this.gameId,
      winnerId: winner,
      reason,
      remainingStones: this.remaining(),
      rematchDeadlineMs: null,
    };
    this.events.push({ type: 'game:over', payload: { ...this.result } });
  }

  // ───────── 내부: 시간 정산·물리 틱 ─────────

  private settleTime(t: number): void {
    if (t > this.now) this.now = t;
    // 랜덤형 자동 발동
    for (const seat of [0, 1] as const) {
      const p = this.players[seat];
      while (p.random && p.held && p.random.nextAtMs <= t) {
        this.shiftWind(seat, p.random.nextAtMs);
      }
    }
    // 효과 만료
    this.expireEffects(t);
    // 턴 마감 (정확히 마감 시각이면 시간초과가 우선)
    if (this.phase === 'aiming' && !this.shotCommitted && t >= this.deadlineMs) {
      const p = this.players[this.active];
      p.timeoutStreak++;
      if (p.timeoutStreak >= RULES.timeoutForfeitStreak) {
        this.finish(other(this.active), 'timeout_forfeit');
      } else {
        this.resolveTurn('timeout');
      }
    }
  }

  private physicsTick(): void {
    for (const p of this.players) {
      const beam = this.effects.find(
        (e) => isBlind(e.kind) && this.players[e.source] === p && e.expiresAtMs > this.now,
      );
      if (beam) {
        const meta = HAZARDS[beam.kind];
        beam.expiresAtMs = this.now + meta.durationMs;
        this.revision++;
        p.gauge = Math.min(
          HAZARD_TUNING.fatigueMax,
          p.gauge + ((meta.fatigueCost ?? 0) * DT) / (meta.durationMs / 1000),
        );
        if (p.gauge >= HAZARD_TUNING.fatigueMax) {
          p.overheated = true;
          beam.expiresAtMs = this.now;
        }
      } else if (p.gauge > 0) {
        p.gauge = Math.max(0, p.gauge - HAZARD_TUNING.fatigueDecayPerSec * DT);
        if (p.gauge === 0) p.overheated = false;
      }
    }
    this.updateBlindCoverage();
    if (this.phase !== 'moving') return;
    this.updateMovingWalls();
    const { outcome } = advanceMotion(this.world, this.motion);
    this.revision++;
    this.endExplodedMines();
    this.sweepDecoys();
    if (outcome !== 'moving') this.resolveTurn('resolved');
  }

  // ───────── 내부: 방해요소 ─────────

  /**
   * 후레쉬·물총 가림 정도를 한 틱만큼 갱신한다. 손→조준점 원뿔이 상대 얼굴에 맞으면 오르고
   * 빗나가면(조준점 없음 포함) 내려가며 [0, 1]로 자른다. 크게 바뀌면 revision을 올린다.
   */
  private updateBlindCoverage(): void {
    for (const e of this.effects) {
      if (!isBlind(e.kind) || e.startsAtMs > this.now) continue;
      const hit = e.aim !== undefined && beamHitsFace(e.source, e.aim);
      const prev = e.coverage ?? 0;
      const rate = hit ? HAZARD_TUNING.blindGainPerSec : -HAZARD_TUNING.blindDecayPerSec;
      const next = Math.min(1, Math.max(0, prev + rate * DT));
      if (next === prev) continue;
      e.coverage = next;
      e.params = { ...e.params, coverage: next };
      const published = e.publishedCoverage ?? 0;
      if (Math.abs(next - published) >= COVERAGE_PUBLISH_STEP || next === 0 || next === 1) {
        e.publishedCoverage = next;
        this.revision++;
      }
    }
  }

  private grantAll(replaced: boolean): void {
    for (const seat of [0, 1] as const) this.grantOne(seat, replaced);
  }

  protected grantOne(seat: Seat, replaced: boolean, forceKind?: HazardKind): void {
    const p = this.players[seat];
    if (replaced) this.clearEffectsFrom(seat);
    // 18종에서 그 좌석의 직전 종류를 뺀 균등 추첨(좌석별 스트림)
    const prev = p.held?.kind;
    const pool = GRANT_POOL.filter((k) => k !== prev);
    const kind = forceKind ?? pool[this.grantRngs[seat].int(pool.length)]!;
    const instanceId = `${this.gameId}-h${++this.grantCounter}`;
    p.held = { instanceId, kind, round: this.round };
    p.grantNo = this.grantCounter;
    p.gauge = 0;
    p.overheated = false;
    p.cooldownEndsAtMs = null;
    p.usedThisGrant = false;
    if (kind === 'bar_speed') {
      p.random = null;
      const effect = this.addEffect(
        kind,
        seat,
        other(seat),
        this.now,
        Number.MAX_SAFE_INTEGER - this.now,
        { multiplier: HAZARD_TUNING.barSpeedMultiplier },
      );
      this.emitTriggered(effect, 'start');
    } else if (kind === 'wind') {
      // 바람: 보유 중 상대에게 상시 적용하고 방향은 몇 초마다 무작위로 바뀐다
      const rng = new Prng(deriveSeed(this.seed, 100 + this.grantCounter));
      const effect = this.addEffect(
        kind,
        seat,
        other(seat),
        this.now,
        Number.MAX_SAFE_INTEGER - this.now,
        { directionRad: rng.next() * 2 * Math.PI },
      );
      p.random = { rng, nextAtMs: this.now + windShiftDelay(rng) };
      this.emitTriggered(effect, 'start');
    } else {
      p.random = null;
    }
    this.events.push({
      type: 'hazard:granted',
      toSeat: seat,
      payload: {
        gameId: this.gameId,
        hazardInstanceId: instanceId,
        kind,
        round: this.round,
        // 지급은 항상 새 턴 시작 직전이다(startTurn이 turnCounter를 올린다)
        turnId: this.turnCounter + 1,
        replaced,
      },
    });
  }

  /** 바람 방향을 무작위로 바꾼다(효과는 그대로 이어지고 상태 revision만 오른다) */
  private shiftWind(seat: Seat, at: number): void {
    const r = this.players[seat].random!;
    const eff = this.effects.find((e) => e.kind === 'wind' && e.source === seat);
    if (eff) {
      eff.params = { ...eff.params, directionRad: r.rng.next() * 2 * Math.PI };
      this.revision++;
    }
    r.nextAtMs = at + windShiftDelay(r.rng);
  }

  private addEffect(
    kind: HazardKind,
    source: Seat,
    target: Seat,
    startsAtMs: number,
    durationMs: number,
    params?: HazardParams,
  ): Effect {
    const eff: Effect = {
      id: ++this.effectCounter,
      kind,
      source,
      target,
      startsAtMs,
      expiresAtMs: startsAtMs + durationMs,
      ...(params ? { params } : {}),
    };
    this.effects.push(eff);
    return eff;
  }

  private emitTriggered(eff: Effect, phase: 'start' | 'end'): void {
    this.events.push({
      type: 'hazard:triggered',
      ...(eff.casterOnly ? { toSeat: eff.source } : {}),
      payload: {
        gameId: this.gameId,
        kind: eff.kind,
        phase,
        sourceSeat: eff.source,
        targetSeat: eff.target,
        startsAtMs: eff.startsAtMs,
        expiresAtMs: eff.expiresAtMs,
        ...(eff.params ? { params: { ...eff.params } } : {}),
      },
    });
  }

  private expireEffects(t: number): void {
    const gone = this.effects.filter((e) => e.expiresAtMs <= t);
    if (gone.length === 0) return;
    this.effects = this.effects.filter((e) => e.expiresAtMs > t);
    for (const e of gone) this.emitTriggered(e, 'end');
    this.syncWorld();
    this.revision++;
  }

  /** 교체 때 이전 방해요소의 지속 효과를 지운다. 이미 판·알에 반영된 즉시 효과는 되돌리지 않는다. */
  private clearEffectsFrom(seat: Seat): void {
    const gone = this.effects.filter((e) => e.source === seat);
    if (gone.length === 0) return;
    this.effects = this.effects.filter((e) => e.source !== seat);
    for (const e of gone) {
      const params = e.kind === 'mine' ? { ...e.params, exploded: false } : e.params;
      this.emitTriggered({ ...e, expiresAtMs: this.now, ...(params ? { params } : {}) }, 'end');
    }
    this.syncWorld();
  }

  private isStunned(seat: Seat, t: number): boolean {
    return this.effects.some(
      (e) => e.kind === 'stun' && e.target === seat && e.startsAtMs <= t && t < e.expiresAtMs,
    );
  }

  /** 활성 효과로 물리 세계의 설치물·배율을 다시 만든다. 가짜 벽은 충돌에 넣지 않는다 */
  private syncWorld(): void {
    const w = this.world;
    const fx = this.effects;
    w.walls = fx.flatMap((e) => (e.wall && !e.fake ? [e.wall] : []));
    w.stickies = fx.flatMap((e) => (e.sticky ? [e.sticky] : []));
    w.magnets = fx.flatMap((e) => (e.kind === 'magnet' && e.field ? [e.field] : []));
    w.pits = fx.flatMap((e) => (e.kind === 'pit' && e.field ? [e.field] : []));
    w.gravityZones = fx.flatMap((e) => (e.zone ? [e.zone] : []));
    w.reverseZones = fx.flatMap((e) => (e.reverse ? [e.reverse] : []));
    w.mines = fx.flatMap((e) => (e.mine && !e.mine.exploded ? [e.mine] : []));
    w.frictionScale = fx.some((e) => e.kind === 'ice_floor')
      ? HAZARD_TUNING.iceFrictionMultiplier
      : 1;
    const mass: [number, number] = [1, 1];
    for (const e of fx)
      if (e.kind === 'heavy_stones') mass[e.source] = HAZARD_TUNING.heavyMassMultiplier;
    w.massBySeat = mass;
    this.updateMovingWalls();
  }

  /** 이동 장애물의 이번 시각 위치·속도 */
  private updateMovingWalls(): void {
    this.world.movingWalls = this.effects.flatMap((e) =>
      e.movingWall
        ? [
            movingWallAt(
              e.movingWall.cx,
              e.movingWall.cy,
              e.movingWall.angle,
              e.startsAtMs,
              this.now,
            ),
          ]
        : [],
    );
  }

  /** 지면 알에 닿은 분신술 허상을 지운다(내 알·상대 알 모두, DEC-057) */
  private sweepDecoys(): void {
    const R = PHYSICS.stoneRadius;
    const ground = this.groundStones();
    for (const e of this.effects) {
      if (!e.decoys || e.decoys.length === 0) continue;
      const left = e.decoys.filter(
        (d) => !ground.some((s) => Math.hypot(s.x - d.x, s.y - d.y) < 2 * R),
      );
      if (left.length !== e.decoys.length) {
        e.decoys = left;
        this.revision++;
      }
    }
  }

  /** 터진 폭탄 효과를 끝낸다 */
  private endExplodedMines(): void {
    const done = this.effects.filter((e) => e.mine?.exploded);
    if (done.length === 0) return;
    this.effects = this.effects.filter((e) => !e.mine?.exploded);
    for (const e of done) {
      this.emitTriggered(
        { ...e, expiresAtMs: this.now, params: { ...e.params, exploded: true } },
        'end',
      );
    }
    this.syncWorld();
    this.revision++;
  }

  private groundStones(): Stone[] {
    return this.world.stones.filter((s) => s.alive && !s.airborne);
  }

  /** 배치 판정 입력. 클라이언트와 같게 공개 효과 params로 만들고, 가짜 벽도 설치물로 센다 */
  private placementWorld(): PlacementWorld {
    const others: Footprint[] = [];
    for (const e of this.effects) {
      if (e.kind === 'wall' || e.kind === 'sticky') continue;
      const f = effectFootprint(e.kind, e.params);
      if (f) others.push(f);
    }
    return {
      board: this.board,
      stones: this.groundStones(),
      walls: this.effects.flatMap((e) => (e.wall ? [e.wall] : [])),
      stickies: this.world.stickies,
      others,
    };
  }

  private wallPlaceable(w: Obb): boolean {
    return isWallPlaceable(w, this.placementWorld());
  }

  private stickyPlaceable(a: { cx: number; cy: number; radius: number }): boolean {
    return isStickyPlaceable(a, this.placementWorld());
  }

  /**
   * 판 중심 기준 회전(양수 반시계, 판 좌표계). 알·속도·벽·끈끈이를 함께 돌리고 알을 판 안에 유지한다.
   * 판 돌리기 방해요소는 −45°(시계 방향), 기본 판 돌리기는 명령의 각을 쓴다. 후레쉬·물총 조준점은
   * 좌석 공간 기준이라 돌리지 않는다.
   */
  private applyBoardRotation(deg: number): void {
    const rad = (deg * Math.PI) / 180;
    for (const s of this.world.stones) {
      if (!s.alive) continue;
      [s.x, s.y] = rotate(s.x, s.y, rad);
      [s.vx, s.vy] = rotate(s.vx, s.vy, rad);
    }
    for (const e of this.effects) {
      if (e.wall) {
        [e.wall.cx, e.wall.cy] = rotate(e.wall.cx, e.wall.cy, rad);
        e.wall.angle += rad;
        if (e.params) {
          e.params.x = e.wall.cx;
          e.params.y = e.wall.cy;
          e.params.angleDeg = (e.wall.angle * 180) / Math.PI;
        }
      }
      if (e.sticky) {
        [e.sticky.cx, e.sticky.cy] = rotate(e.sticky.cx, e.sticky.cy, rad);
        if (e.params) {
          e.params.x = e.sticky.cx;
          e.params.y = e.sticky.cy;
        }
      }
      // 추가 설치물: 위치·방향·각을 판과 함께 돌린다
      const turnPoint = (o: { cx: number; cy: number }) => {
        [o.cx, o.cy] = rotate(o.cx, o.cy, rad);
      };
      if (e.field) turnPoint(e.field);
      if (e.reverse) turnPoint(e.reverse);
      if (e.mine) turnPoint(e.mine);
      if (e.zone) {
        turnPoint(e.zone.zone);
        e.zone.zone.angle += rad;
        [e.zone.dx, e.zone.dy] = rotate(e.zone.dx, e.zone.dy, rad);
      }
      if (e.movingWall) {
        turnPoint(e.movingWall);
        e.movingWall.angle += rad;
      }
      if (e.decoys) {
        for (const d of e.decoys) {
          [d.x, d.y] = clampInside(this.board, ...rotate(d.x, d.y, rad));
        }
      }
      const at = e.field ?? e.reverse ?? e.mine ?? e.zone?.zone ?? e.movingWall;
      if (at && e.params) {
        e.params.x = at.cx;
        e.params.y = at.cy;
      }
      if (e.zone && e.params) {
        e.params.directionRad = normalizeRad(Math.atan2(e.zone.dy, e.zone.dx));
        e.params.angleDeg = (e.zone.zone.angle * 180) / Math.PI;
      }
      if (e.movingWall && e.params) e.params.angleDeg = (e.movingWall.angle * 180) / Math.PI;
    }
    this.boardRotationDeg += deg;
    this.updateMovingWalls();
    this.keepInsideAndSeparate();
    this.sweepDecoys();
  }

  /** 알마다 독립으로 방향·거리를 뽑아 옮긴다(알 id 순) */
  private applyDeskShake(): void {
    for (const s of [...this.world.stones].sort((a, b) => a.id - b.id)) {
      if (!s.alive) continue;
      const dir = this.shakeRng.next() * 2 * Math.PI;
      const dist = this.shakeRng.next() * HAZARD_TUNING.deskShakeMaxDistance;
      s.x += Math.cos(dir) * dist;
      s.y += Math.sin(dir) * dist;
    }
    this.keepInsideAndSeparate();
    this.sweepDecoys();
  }

  /**
   * 효과로 옮긴 알을 판 안으로 되돌리고 알끼리·벽과의 겹침을 푼다. 이 효과 자체로 알을 제거하지 않는다.
   * 경계 clamp → 알 분리 → 벽 밀어내기를 겹침이 없어질 때까지 반복하고, 마지막은 항상 경계 clamp로 끝낸다.
   */
  private keepInsideAndSeparate(): void {
    const R = PHYSICS.stoneRadius;
    for (let pass = 0; pass < 50; pass++) {
      for (const s of this.world.stones) {
        if (s.alive) [s.x, s.y] = clampInside(this.board, s.x, s.y);
      }
      let moved = false;
      const g = this.groundStones().sort((a, b) => a.id - b.id);
      for (let i = 0; i < g.length; i++) {
        for (let j = i + 1; j < g.length; j++) {
          const a = g[i]!;
          const b = g[j]!;
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d >= 2 * R - 1e-9) continue;
          if (d === 0) {
            dx = 1;
            dy = 0;
          } else {
            dx /= d;
            dy /= d;
          }
          const push = (2 * R - d) / 2 + 1e-6;
          a.x -= dx * push;
          a.y -= dy * push;
          b.x += dx * push;
          b.y += dy * push;
          moved = true;
        }
      }
      for (const s of g) {
        for (const w of this.world.walls) {
          const c = circleVsObb(s.x, s.y, R, w);
          if (!c) continue;
          s.x += c.nx * (c.depth + 1e-6);
          s.y += c.ny * (c.depth + 1e-6);
          moved = true;
        }
      }
      if (!moved) return;
    }
    for (const s of this.world.stones) {
      if (s.alive) [s.x, s.y] = clampInside(this.board, s.x, s.y);
    }
  }
}

/** 다음 바람 방향 변경까지의 시간(ms) */
function windShiftDelay(rng: Prng): number {
  const { windShiftMinMs: lo, windShiftMaxMs: hi } = HAZARD_TUNING;
  return lo + rng.next() * (hi - lo);
}
