// 3D 인게임 장면. 그리기와 포인터 → 판 좌표 변환만 맡고 조준·세기·배치 판단은 호출 쪽이 한다(scene-contract.ts).
// 알·설치물·조준은 "최신 스냅샷 좌표계"를 월드 Y축으로 (표시 판 각 − 최신 판 각)만큼 돌린 그룹에 담는다.
// 서버는 판 돌리기 때 알·설치물의 좌표를 이미 회전해 보내므로, 표시 회전이 따라잡는 동안만 이 차이가 0이 아니다.
// 캐릭터·카메라·후레쉬/물총 효과는 좌석에 고정된 월드 좌표를 쓴다(좌석은 판 돌리기와 무관).
//
// 카메라 조작: 시점은 기본과 1인칭뿐이다. 알을 조준·발사하는 동안만 1인칭이고 끝나면 기본으로 돌아온다.
// 오른쪽 버튼을 DRAG_CLICK_PX(6px) 넘게 끌면 고개 돌리기이고, 놓으면 정면으로 돌아온다.
// 오른쪽 버튼을 누르는 순간 onPointer에 오른쪽 down을 보낸다(조준·배치 취소). 왼쪽 버튼을 누른 채 오른쪽을
// 누르면 브라우저는 pointerdown 대신 pointermove(버튼 조합 변경)만 보내므로 그 경우도 오른쪽 down으로 바꿔 보낸다.
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { BOARDS, HAZARD_TUNING, PHYSICS, SEAT_GEOMETRY, type Seat } from '@alkkagi/shared';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Group, PCFShadowMap, PerspectiveCamera, Raycaster, Vector2, Vector3 } from 'three';
import type { BoardPointerEvent, SceneProps } from './scene-contract.ts';
import { CharacterRig, type CharacterFrame, type CharacterId } from './characters.ts';
import { BlindFxLayer, type BlindDraw } from './blind-fx.ts';
import {
  aimPointFromRay,
  applyDrag,
  applyPreset,
  aspectDistanceScale,
  createCameraState,
  createRightDrag,
  EYE_LIFT,
  dragDown,
  dragMove,
  dragUp,
  orbitPosition,
  releaseLook,
  stepCamera,
  stunRoll,
} from './camera-math.ts';
import { stepFall, startFall, type FallState } from './fall.ts';
import { AimLayer, HazardLayer, StoneLayer, STONE_REST_Y, type HazardDraw } from './layers.ts';
import {
  FLICK_ONSET_SPEED,
  clamp,
  createFlickDetector,
  createReactionTracker,
  createSmoothPose,
  damp,
  gestureAt,
  reactionSteps,
  seatToWorld,
  serverDirToSeat,
  setV,
  stepFlick,
  stepSmoothPose,
  strainOf,
  takeNewReactions,
  v3,
  worldToSeat,
  type FlickInput,
  type GestureStep,
  type V3,
} from './rig-math.ts';
import {
  BOARD_TOP_Y,
  DEG,
  PICK_MARGIN,
  approachAngle,
  deskShakeOffset,
  pickStoneByRay,
  rayPlaneHit,
  worldToServer,
  type PickCandidate,
} from './scene-math.ts';
import {
  advanceClock,
  createSnapshotState,
  latestRotation,
  pushSnapshot,
  sampleStones,
  takeDueRemovals,
  type RemovedStone,
  type SampledStone,
} from './snapshot-buffer.ts';
import { buildStage, createStoneKit } from './stage.ts';

export function GameScene(props: SceneProps) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        shadows={{ type: PCFShadowMap }}
        dpr={[1, 2]}
        camera={{ fov: 42, near: 1, far: 900, position: [0, 62, 69] }}
        gl={{ antialias: true }}
        style={{ touchAction: 'none' }}
        data-testid="game-scene"
      >
        <SceneWorld {...props} />
      </Canvas>
    </div>
  );
}

interface SeatAnim {
  pose: ReturnType<typeof createSmoothPose>;
  flick: ReturnType<typeof createFlickDetector>;
  flickIn: FlickInput;
  steps: GestureStep[] | null;
  stepsStart: number;
  grab: { active: boolean; bx: number; bz: number; rot0: number };
  opacity: number;
  frame: CharacterFrame;
  aim: NonNullable<CharacterFrame['aim']>;
  hold: NonNullable<CharacterFrame['hold']>;
  grabLocal: V3;
  watchLocal: V3;
  oppHead: V3;
  camLocal: V3;
  onset: number | null;
}

interface Runtime {
  snap: ReturnType<typeof createSnapshotState>;
  samples: SampledStone[];
  sampleCount: number;
  falls: FallState[];
  due: RemovedStone[];
  visRot: number;
  gameId: string;
  viewPerfMs: number;
  lastView: SceneProps['view'] | null;
  hazards: HazardDraw[];
  candidates: PickCandidate[];
  deltaDeg: number;
  t: number;
  lastLatestRot: number;
  /** 알 id별 직전 위치·속도(알 id는 작은 정수) */
  prevX: Float64Array;
  prevY: Float64Array;
  prevSp: Float64Array;
  prevSeen: Int32Array;
  frameNo: number;
  cam: ReturnType<typeof createCameraState>;
  preset: { name: NonNullable<SceneProps['cameraPreset']>; nonce: number; seat: Seat };
  drag: ReturnType<typeof createRightDrag>;
  reactions: ReturnType<typeof createReactionTracker>;
  seats: [SeatAnim, SeatAnim];
  blinds: [BlindDraw | null, BlindDraw | null];
  blindStore: [BlindDraw, BlindDraw];
  coverage: [number, number];
  /** 좌석별 기절 진행도 0~1(기절 아니면 null) */
  stun: [number | null, number | null];
  fpLook: Vector3;
  lookV: Vector3;
}

const MAX_IDS = 256;

function makeSeatAnim(): SeatAnim {
  const aim = { stoneId: 0, stone: v3(), dir: v3(0, 0, 1), pull: 0, reachable: true, strain: 0 };
  const hold = { kind: 'flashlight' as const, target: v3() };
  const frame: CharacterFrame = {
    dt: 0,
    t: 0,
    aim: null,
    grab: null,
    hold: null,
    gesture: 'neutral',
    opponentHead: v3(),
    watch: null,
    blind: 0,
    firstPerson: false,
    hideArms: false,
    camLocal: null,
    opacity: 1,
  };
  return {
    pose: createSmoothPose(),
    flick: createFlickDetector(),
    flickIn: {
      nowSec: 0,
      mode: 'idle',
      stoneId: null,
      aimedSpeed: 0,
      onsetStoneId: null,
      active: false,
    },
    steps: null,
    stepsStart: 0,
    grab: { active: false, bx: 0, bz: 0, rot0: 0 },
    opacity: 1,
    frame,
    aim,
    hold: hold as NonNullable<CharacterFrame['hold']>,
    grabLocal: v3(),
    watchLocal: v3(),
    oppHead: v3(),
    camLocal: v3(),
    onset: null,
  };
}

function feed(rt: Runtime, view: SceneProps['view']) {
  if (rt.lastView === view) return;
  rt.lastView = view;
  rt.viewPerfMs = performance.now();
  if (rt.gameId !== view.gameId) {
    rt.gameId = view.gameId;
    rt.falls.length = 0;
    rt.visRot = view.boardRotationDeg;
  }
  pushSnapshot(rt.snap, view);
}

/** three 규약의 Y축 회전(rotation.y = θ) */
function rotY(x: number, z: number, deg: number, out: V3): V3 {
  const r = deg * DEG;
  const c = Math.cos(r);
  const s = Math.sin(r);
  out.x = x * c + z * s;
  out.z = -x * s + z * c;
  return out;
}

function SceneWorld(props: SceneProps) {
  const latest = useRef(props);
  useLayoutEffect(() => {
    latest.current = props;
  });

  const { board, pieceCount, players } = props.start;
  const stage = useMemo(() => buildStage(board), [board]);
  useEffect(() => () => stage.dispose(), [stage]);
  const stoneKit = useMemo(() => createStoneKit(PHYSICS.stoneRadius), []);
  useEffect(() => () => stoneKit.dispose(), [stoneKit]);
  const stones = useMemo(() => new StoneLayer(stoneKit, pieceCount * 2), [stoneKit, pieceCount]);
  useEffect(() => () => stones.dispose(), [stones]);
  const hazards = useMemo(() => new HazardLayer(), []);
  useEffect(() => () => hazards.dispose(), [hazards]);
  const aimLayer = useMemo(() => new AimLayer(), []);
  useEffect(() => () => aimLayer.dispose(), [aimLayer]);
  const blindFx = useMemo(() => new BlindFxLayer(), []);
  useEffect(() => () => blindFx.dispose(), [blindFx]);

  const worldGroup = useRef<Group>(null);
  const tableRef = useRef<Group>(null);
  const char0 = players[0].characterId as CharacterId;
  const char1 = players[1].characterId as CharacterId;
  const rigs = useMemo(
    () => [new CharacterRig(char0, 0), new CharacterRig(char1, 1)] as [CharacterRig, CharacterRig],
    [char0, char1],
  );
  useEffect(
    () => () => {
      rigs[0].dispose();
      rigs[1].dispose();
    },
    [rigs],
  );

  const rt = useMemo<Runtime>(() => {
    const r: Runtime = {
      snap: createSnapshotState(),
      samples: [],
      sampleCount: 0,
      falls: [],
      due: [],
      visRot: props.view.boardRotationDeg,
      gameId: props.view.gameId,
      viewPerfMs: performance.now(),
      lastView: null,
      hazards: [],
      candidates: [],
      deltaDeg: 0,
      t: 0,
      lastLatestRot: props.view.boardRotationDeg,
      prevX: new Float64Array(MAX_IDS),
      prevY: new Float64Array(MAX_IDS),
      prevSp: new Float64Array(MAX_IDS),
      prevSeen: new Int32Array(MAX_IDS).fill(-10),
      frameNo: 0,
      cam: createCameraState(props.cameraPreset ?? 'default', props.mySeat),
      preset: {
        name: props.cameraPreset ?? 'default',
        nonce: props.cameraPresetNonce ?? 0,
        seat: props.mySeat,
      },
      drag: createRightDrag(),
      reactions: createReactionTracker(),
      seats: [makeSeatAnim(), makeSeatAnim()],
      blinds: [null, null],
      blindStore: [
        { kind: 'flashlight', from: v3(), to: v3(), strength: 0 },
        { kind: 'flashlight', from: v3(), to: v3(), strength: 0 },
      ],
      coverage: [0, 0],
      stun: [null, null],
      fpLook: new Vector3(0, 0, 0),
      lookV: new Vector3(),
    };
    feed(r, props.view);
    return r;
    // 장면이 처음 만들어질 때만 초기 스냅샷을 넣고 이후 갱신은 useEffect가 맡는다
  }, []);
  useEffect(() => {
    feed(rt, props.view);
  }, [rt, props.view]);

  const { gl, camera, size } = useThree();

  // 포인터 → 판 좌표·조준점. 캔버스 이벤트를 직접 받아 서버 기준 좌표로 되돌린다.
  useEffect(() => {
    const el = gl.domElement;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const emit = (type: BoardPointerEvent['type'], e: PointerEvent, button = e.button) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -(((e.clientY - rect.top) / rect.height) * 2 - 1),
      );
      camera.updateMatrixWorld();
      raycaster.setFromCamera(ndc, camera);
      const o = raycaster.ray.origin;
      const d = raycaster.ray.direction;
      const hit = rayPlaneHit(o, d, BOARD_TOP_Y);
      let point: { x: number; y: number } | null = null;
      if (hit) {
        const [x, y] = worldToServer(hit.x, hit.z, rt.deltaDeg);
        point = { x, y };
      }
      const mySeat = latest.current.mySeat;
      const aimPoint = aimPointFromRay(o, d, mySeat === 0 ? 1 : 0);
      const stoneId = pickStoneByRay(
        o,
        d,
        rt.candidates,
        rt.sampleCount,
        PHYSICS.stoneRadius + PICK_MARGIN,
      );
      latest.current.onPointer({ type, point, aimPoint, stoneId, button });
    };
    const rightDown = (e: PointerEvent) => {
      emit('down', e, 2);
      dragDown(rt.drag, e.clientX, e.clientY);
    };
    const rightUp = (e: PointerEvent) => {
      if (dragUp(rt.drag) === 'click') emit('up', e, 2);
      releaseLook(rt.cam);
    };
    const onMove = (e: PointerEvent) => {
      // 다른 버튼을 누른 채 버튼을 더 누르거나 떼면 pointerdown·pointerup 대신 pointermove가 온다
      if (e.button === 2) {
        if (e.buttons & 2) rightDown(e);
        else rightUp(e);
      } else if (e.button === 0 && !(e.buttons & 1)) {
        emit('up', e, 0);
      } else if (e.button === 0 && e.buttons & 1) {
        emit('down', e, 0);
      }
      const dd = dragMove(rt.drag, e.clientX, e.clientY);
      if (dd) applyDrag(rt.cam, dd.dx, dd.dy);
      emit('move', e);
    };
    const onDown = (e: PointerEvent) => {
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // 캡처 실패는 입력을 막지 않는다
      }
      if (e.button === 2) {
        rightDown(e);
        return;
      }
      emit('down', e);
    };
    const onUp = (e: PointerEvent) => {
      if (e.button === 2) {
        rightUp(e);
        return;
      }
      emit('up', e);
    };
    const onCancel = (e: PointerEvent) => {
      dragUp(rt.drag);
      releaseLook(rt.cam);
      emit('cancel', e);
    };
    const onContext = (e: Event) => e.preventDefault();
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    el.addEventListener('contextmenu', onContext);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('contextmenu', onContext);
    };
  }, [gl, camera, rt]);

  // 프레임 루프에서 재사용하는 임시값
  const tmp = useMemo(
    () => ({
      w: v3(),
      gaze: new Vector3(),
      l: v3(),
      orb: v3(),
      fp: new Vector3(),
      head: new Vector3(),
      muzzle: new Vector3(),
      watchW: v3(),
    }),
    [],
  );

  useFrame((state, dtSec) => {
    const p = latest.current;
    const dt = Math.min(dtSec, 0.1);
    rt.t += dt;
    rt.frameNo++;
    const t = rt.t;
    const mySeat = p.mySeat;
    const cam = state.camera as PerspectiveCamera;

    // 시점 프리셋
    const pr = rt.preset;
    const presetName = p.cameraPreset ?? 'default';
    const presetNonce = p.cameraPresetNonce ?? 0;
    if (pr.name !== presetName || pr.nonce !== presetNonce || pr.seat !== mySeat) {
      pr.name = presetName;
      pr.nonce = presetNonce;
      pr.seat = mySeat;
      applyPreset(rt.cam, presetName, mySeat);
    }

    // 스냅샷 보간·낙하
    advanceClock(rt.snap, dt * 1000);
    rt.sampleCount = sampleStones(rt.snap, rt.samples);
    rt.due.length = 0;
    takeDueRemovals(rt.snap, rt.due);
    for (const r of rt.due) rt.falls.push(startFall(r));
    let w = 0;
    for (const f of rt.falls) {
      if (!stepFall(f, dt)) rt.falls[w++] = f;
    }
    rt.falls.length = w;

    // 판 돌리기: 표시 각이 최신 판 각에 다가간다(판 몸체째 회전)
    const latestRot = latestRotation(rt.snap);
    const frameShifted = latestRot !== rt.lastLatestRot;
    rt.lastLatestRot = latestRot;
    rt.visRot = approachAngle(rt.visRot, latestRot, dt);
    rt.deltaDeg = rt.visRot - latestRot;
    stage.boardPivot.rotation.y = rt.visRot * DEG;
    if (worldGroup.current) worldGroup.current.rotation.y = rt.deltaDeg * DEG;

    // 효과: 책상 흔들기·설치물·후레쉬/물총
    const nowServer = p.view.serverNowMs + (performance.now() - rt.viewPerfMs);
    let sx = 0;
    let sz = 0;
    let deskShake = 0;
    let n = 0;
    rt.blinds[0] = null;
    rt.blinds[1] = null;
    rt.coverage[0] = 0;
    rt.coverage[1] = 0;
    rt.stun[0] = null;
    rt.stun[1] = null;
    for (const e of p.view.effects) {
      if (e.kind === 'stun') {
        if (nowServer >= e.startsAtMs && nowServer < e.expiresAtMs) {
          const span = Math.max(1, e.expiresAtMs - e.startsAtMs);
          rt.stun[e.targetSeat] = (nowServer - e.startsAtMs) / span;
        }
      } else if (e.kind === 'desk_shake') {
        const span = Math.max(1, e.expiresAtMs - e.startsAtMs);
        const progress = (nowServer - e.startsAtMs) / span;
        [sx, sz] = deskShakeOffset(progress, nowServer / 1000, HAZARD_TUNING.deskShakeMaxDistance);
        if (progress >= 0 && progress < 1) deskShake = Math.max(deskShake, (1 - progress) * 0.8);
      } else if (e.kind === 'wall' || e.kind === 'sticky') {
        const x = e.params?.x;
        const y = e.params?.y;
        if (x === undefined || y === undefined) continue;
        let h = rt.hazards[n];
        if (!h) {
          h = { kind: 'wall', x: 0, y: 0, angle: 0, age: 0, seed: 0 };
          rt.hazards[n] = h;
        }
        h.kind = e.kind;
        h.x = x;
        h.y = y;
        const deg = e.params?.angleDeg ?? (e.params?.orientation === 'vertical' ? 90 : 0);
        h.angle = deg * DEG;
        h.age = Math.max(0, (nowServer - e.startsAtMs) / 1000);
        h.seed = (e.startsAtMs % 997) / 50;
        n++;
      } else if (e.kind === 'flashlight' || e.kind === 'water_gun') {
        const caster: Seat = e.targetSeat === 0 ? 1 : 0;
        const ax = e.params?.aimX;
        const ay = e.params?.aimY;
        if (nowServer < e.startsAtMs || nowServer > e.expiresAtMs) continue;
        rt.coverage[e.targetSeat] = Math.max(rt.coverage[e.targetSeat], e.params?.coverage ?? 0);
        const b = rt.blindStore[caster];
        b.kind = e.kind;
        if (ax !== undefined && ay !== undefined) setV(b.to, ax, e.params?.aimH ?? 0, -ay);
        else
          setV(
            b.to,
            0,
            SEAT_GEOMETRY.headHeight,
            -(e.targetSeat === 0 ? -1 : 1) * SEAT_GEOMETRY.anchorDistance,
          );
        const fadeIn = clamp((nowServer - e.startsAtMs) / 200, 0, 1);
        const fadeOut = clamp((e.expiresAtMs - nowServer) / 300, 0, 1);
        b.strength = Math.min(fadeIn, fadeOut);
        rt.blinds[caster] = b;
      }
    }
    const myBlind = p.view.private.blind;
    if (myBlind && nowServer >= myBlind.startsAtMs && nowServer <= myBlind.expiresAtMs) {
      rt.coverage[mySeat] = Math.max(rt.coverage[mySeat], myBlind.coverage);
    }
    if (tableRef.current) tableRef.current.position.set(sx, 0, sz);
    hazards.update(rt.hazards, n, t);

    // 알: 선택 판정용 월드 좌표, 속도(발사 감지·바라보기)
    const r = rt.deltaDeg * DEG;
    const cs = Math.cos(r);
    const sn = Math.sin(r);
    let target: SampledStone | null = null;
    let watchSp = 12;
    let watchFound = false;
    rt.seats[0].onset = null;
    rt.seats[1].onset = null;
    for (let i = 0; i < rt.sampleCount; i++) {
      const s = rt.samples[i];
      if (!s) continue;
      let c = rt.candidates[i];
      if (!c) {
        c = { id: 0, x: 0, y: 0, z: 0 };
        rt.candidates[i] = c;
      }
      c.id = s.id;
      c.x = s.x * cs + -s.y * sn;
      c.z = -s.x * sn + -s.y * cs;
      c.y = STONE_REST_Y + s.h;
      if (p.aim && s.id === p.aim.stoneId) target = s;
      const id = s.id;
      if (id < 0 || id >= MAX_IDS) continue;
      let sp = 0;
      if (rt.prevSeen[id] === rt.frameNo - 1 && !frameShifted && dt > 0) {
        sp = Math.hypot(s.x - (rt.prevX[id] ?? 0), s.y - (rt.prevY[id] ?? 0)) / dt;
      }
      const before = rt.prevSp[id] ?? 0;
      if (sp > FLICK_ONSET_SPEED && before < 8 && rt.prevSeen[id] === rt.frameNo - 1) {
        rt.seats[s.owner].onset = id;
      }
      rt.prevX[id] = s.x;
      rt.prevY[id] = s.y;
      rt.prevSp[id] = sp;
      rt.prevSeen[id] = rt.frameNo;
      if (sp > watchSp) {
        watchSp = sp;
        watchFound = true;
        setV(tmp.watchW, c.x + sx, c.y, c.z + sz);
      }
    }
    stones.update(rt.samples, rt.sampleCount, rt.falls, mySeat, p.aim?.stoneId ?? null);
    aimLayer.update(p.aim, target, p.placement, mySeat, rt.deltaDeg * DEG);

    // 반응
    const fresh = takeNewReactions(rt.reactions, p.reactions);
    for (const seat of [0, 1] as const) {
      const re = fresh[seat];
      if (re) {
        rt.seats[seat].steps = reactionSteps(re.kind);
        rt.seats[seat].stepsStart = t;
      }
    }

    // 캐릭터
    const def = BOARDS[p.start.board];
    const rimR = def.shape === 'square' ? def.size / 2 : def.diameter / 2;
    for (const seat of [0, 1] as const) {
      const sa = rt.seats[seat];
      const rig = rigs[seat];
      const other = rigs[seat === 0 ? 1 : 0];
      const fr = sa.frame;
      const pose = p.poses[seat];
      fr.lookYaw = pose?.lookYaw;
      fr.lookPitch = pose?.lookPitch;
      stepSmoothPose(sa.pose, pose, dt, seat === mySeat ? 30 : 12);
      const sp = sa.pose;
      // 내 조준은 로컬 상태가 더 빠르므로 그것을 우선한다
      let angle = sp.angle;
      let power = sp.power;
      let mode = sp.mode;
      let stoneId = sp.stoneId;
      if (seat === mySeat && p.aim) {
        angle = p.aim.angle;
        power = p.aim.charging ? p.aim.power : 0;
        stoneId = p.aim.stoneId;
        if (mode === 'idle') mode = p.aim.charging ? 'charge' : 'aim';
      }

      // 발사 감지
      let aimedSpeed = 0;
      const lastId = sa.flick.lastAimStone;
      if (
        lastId !== null &&
        lastId >= 0 &&
        lastId < MAX_IDS &&
        rt.prevSeen[lastId] === rt.frameNo
      ) {
        aimedSpeed = rt.prevSp[lastId] ?? 0;
      }
      const fi = sa.flickIn;
      fi.nowSec = t;
      fi.mode = mode;
      fi.stoneId = stoneId;
      fi.aimedSpeed = aimedSpeed;
      fi.onsetStoneId = sa.onset;
      fi.active = p.view.activePlayerId === seat;
      const flicked = stepFlick(sa.flick, fi);
      if (flicked !== null) {
        const fs = rt.samples.find((s, i) => i < rt.sampleCount && s.id === flicked);
        if (fs) {
          const wx = fs.x * cs + -fs.y * sn;
          const wz = -fs.x * sn + -fs.y * cs;
          setV(tmp.w, wx + sx, 0, wz + sz);
          worldToSeat(seat, tmp.w, tmp.l);
          const vx = fs.x - (rt.prevX[flicked] ?? fs.x);
          const vy = fs.y - (rt.prevY[flicked] ?? fs.y);
          serverDirToSeat(seat, Math.atan2(vy, vx) + rt.deltaDeg * DEG, sa.aim.dir);
          rig.startFlick(flicked, tmp.l, sa.aim.dir);
        }
      }

      // 조준
      fr.aim = null;
      if ((mode === 'aim' || mode === 'charge') && stoneId !== null) {
        for (let i = 0; i < rt.sampleCount; i++) {
          const s = rt.samples[i];
          if (!s || s.id !== stoneId) continue;
          const wx = s.x * cs + -s.y * sn;
          const wz = -s.x * sn + -s.y * cs;
          setV(tmp.w, wx + sx, STONE_REST_Y + s.h, wz + sz);
          worldToSeat(seat, tmp.w, sa.aim.stone);
          serverDirToSeat(seat, angle + rt.deltaDeg * DEG, sa.aim.dir);
          const mine = seat === mySeat && p.aim;
          sa.aim.stoneId = s.id;
          sa.aim.pull =
            mode === 'charge'
              ? mine
                ? (p.aim?.pull ?? power / 100)
                : (pose?.pull ?? power / 100)
              : 0;
          const reachD = Math.hypot(sa.aim.stone.x, sa.aim.stone.z);
          sa.aim.reachable = mine ? p.aim!.reachable : reachD <= SEAT_GEOMETRY.maxReach;
          sa.aim.strain = mine ? p.aim!.strain : strainOf(sa.aim.stone);
          fr.aim = sa.aim;
          break;
        }
      }

      // 판 잡기: 판 테두리 점을 판 좌표로 기억해 판과 함께 돈다
      fr.grab = null;
      if (mode === 'rotate') {
        const g = sa.grab;
        if (!g.active || Math.abs(rt.visRot - g.rot0) > 40) {
          const side = seat === 0 ? 1 : -1;
          const rx = 6 * (seat === 0 ? 1 : -1);
          const rz =
            (def.shape === 'square' ? rimR - 1.2 : Math.sqrt(rimR * rimR - rx * rx) - 1.2) * side;
          rotY(rx, rz, -rt.visRot, tmp.w);
          g.bx = tmp.w.x;
          g.bz = tmp.w.z;
          g.rot0 = rt.visRot;
          g.active = true;
        }
        rotY(g.bx, g.bz, rt.visRot, tmp.w);
        tmp.w.y = 1.2;
        tmp.w.x += sx;
        tmp.w.z += sz;
        worldToSeat(seat, tmp.w, sa.grabLocal);
        fr.grab = sa.grabLocal;
      } else sa.grab.active = false;

      // 손에 든 방해요소: 발동 중인 효과 > 들고 겨냥 중인 포즈
      fr.hold = null;
      const blind = rt.blinds[seat];
      if (blind) {
        sa.hold.kind = blind.kind;
        worldToSeat(seat, blind.to, sa.hold.target);
        fr.hold = sa.hold;
      } else if (mode === 'hold_hazard' && sp.kind) {
        sa.hold.kind = sp.kind;
        if (sp.hasTarget) {
          setV(tmp.w, sp.target.x, sp.target.z, -sp.target.y);
          worldToSeat(seat, tmp.w, sa.hold.target);
        } else {
          other.headWorld(tmp.head);
          setV(tmp.w, tmp.head.x, tmp.head.y, tmp.head.z);
          worldToSeat(seat, tmp.w, sa.hold.target);
        }
        fr.hold = sa.hold;
      }

      // 몸짓·바라보기·가림
      fr.gesture = sa.steps ? gestureAt(sa.steps, t - sa.stepsStart) : 'neutral';
      if (sa.steps && fr.gesture === 'neutral' && t - sa.stepsStart > 1) sa.steps = null;
      other.headWorld(tmp.head);
      setV(tmp.w, tmp.head.x, tmp.head.y, tmp.head.z);
      worldToSeat(seat, tmp.w, sa.oppHead);
      fr.opponentHead = sa.oppHead;
      fr.watch = watchFound ? worldToSeat(seat, tmp.watchW, sa.watchLocal) : null;
      fr.blind = rt.coverage[seat];
      fr.stunned = rt.stun[seat] !== null;

      // 1인칭·투명도(카메라와 판 사이를 가리는 캐릭터는 반투명)
      const fp = seat === mySeat && rt.cam.fpBlend > 0.5;
      fr.firstPerson = fp;
      // default(눈보다 높은 시점)에서는 조준·판 잡기·방해요소 들기 때만 내 팔을 보인다
      fr.hideArms = fp && rt.cam.fpLift > 0.5 && !fr.aim && !fr.grab && !fr.hold;
      setV(tmp.w, cam.position.x, cam.position.y, cam.position.z);
      fr.camLocal = fp ? worldToSeat(seat, tmp.w, sa.camLocal) : null;
      const seatZ = seat === 0 ? 1 : -1;
      const behind = cam.position.z * seatZ > SEAT_GEOMETRY.anchorDistance - 2;
      const horiz = Math.hypot(cam.position.x, cam.position.z);
      const occluding = !fp && behind && cam.position.y < horiz * 1.6;
      sa.opacity = damp(sa.opacity, occluding ? 0.38 : 1, 6, dt);
      fr.opacity = sa.opacity;
      fr.dt = dt;
      fr.t = t;
      rig.update(fr);
    }

    // 후레쉬·물총: 시전자 총구 → 조준점
    for (const seat of [0, 1] as const) {
      const b = rt.blinds[seat];
      if (!b) continue;
      rigs[seat].muzzleWorld(tmp.muzzle);
      setV(b.from, tmp.muzzle.x, tmp.muzzle.y, tmp.muzzle.z);
    }
    blindFx.update(rt.blinds, t);

    // 카메라
    // 알을 조준·발사하는 동안만 1인칭, 끝나면 평소 시점(기본)으로 돌아온다
    rt.cam.fpOn = true;
    rt.cam.fpLiftGoal = p.aim ? 0 : rt.preset.name === 'first' ? 0 : 1;
    stepCamera(rt.cam, dt);
    const e0 = rt.cam.fpBlend;
    const e = e0 * e0 * (3 - 2 * e0);
    orbitPosition(rt.cam, aspectDistanceScale(size.width / Math.max(1, size.height)), tmp.orb);
    const me = rigs[mySeat];
    me.headWorld(tmp.fp);
    // 눈 위치: 머리 중심에서 조금 위·앞
    const meSa = rt.seats[mySeat];
    const fwdZ = mySeat === 0 ? -1 : 1;
    const lift = rt.cam.fpLift;
    tmp.fp.y += 1.5 + EYE_LIFT.up * lift;
    tmp.fp.z += fwdZ * (2 - EYE_LIFT.back * lift);
    // 1인칭 시선: 판 중심 → 조준 중인 알·움직이는 알 쪽으로
    // default(lift)는 상대 캐릭터 얼굴까지 보이도록 판 너머를 보고, 조준 중에도 시선을 덜 옮긴다
    rt.lookV.set(0, -2 + 6 * lift, fwdZ * 8 * lift);
    const follow = 1 - 0.65 * lift;
    if (meSa.frame.aim) {
      seatToWorld(mySeat, meSa.frame.aim.stone, tmp.w);
      rt.lookV.x += (tmp.w.x - rt.lookV.x) * 0.7 * follow;
      rt.lookV.y += (tmp.w.y - rt.lookV.y) * 0.7 * follow;
      rt.lookV.z += (tmp.w.z - rt.lookV.z) * 0.7 * follow;
    } else if (watchFound) {
      rt.lookV.x += (tmp.watchW.x - rt.lookV.x) * 0.5 * follow;
      rt.lookV.y += (tmp.watchW.y - rt.lookV.y) * 0.5 * follow;
      rt.lookV.z += (tmp.watchW.z - rt.lookV.z) * 0.5 * follow;
    }
    rt.fpLook.lerp(rt.lookV, 1 - Math.exp(-dt * 4));
    cam.position.set(
      tmp.orb.x + (tmp.fp.x - tmp.orb.x) * e,
      tmp.orb.y + (tmp.fp.y - tmp.orb.y) * e,
      tmp.orb.z + (tmp.fp.z - tmp.orb.z) * e,
    );
    cam.up.set(0, 1, 0);
    // 위에서 바로 내려다볼 때 화면 위쪽이 상대 쪽이 되게 한다
    if (rt.cam.phi < 0.1 && e < 0.5)
      cam.up.set(-Math.sin(rt.cam.theta), 0, -Math.cos(rt.cam.theta));
    cam.lookAt(
      rt.cam.tx + (rt.fpLook.x - rt.cam.tx) * e,
      rt.cam.ty + (rt.fpLook.y - rt.cam.ty) * e,
      rt.cam.tz + (rt.fpLook.z - rt.cam.tz) * e,
    );
    if (e > 0.01) {
      cam.rotateY(rt.cam.fpYaw * e);
      cam.rotateX(rt.cam.fpPitch * e);
    }
    if (rt.cam.fpOn && p.onLook) {
      cam.getWorldDirection(tmp.gaze);
      const sign = mySeat === 0 ? -1 : 1;
      const yaw = Math.atan2(tmp.gaze.x * sign, tmp.gaze.z * sign);
      const pitch = Math.atan2(-tmp.gaze.y, Math.hypot(tmp.gaze.x, tmp.gaze.z));
      p.onLook(
        Math.round(Math.max(-1.1, Math.min(1.1, yaw)) * 100) / 100,
        Math.round(Math.max(-0.6, Math.min(0.6, pitch)) * 100) / 100,
      );
    }
    // 흔들림: 호출 쪽 값·책상 흔들기·1인칭 먼 거리 조준 중 큰 것
    const strain = meSa.frame.aim ? meSa.frame.aim.strain : 0;
    const shake = Math.max(p.shake, deskShake, strain * 0.35 * e);
    if (shake > 0.001) {
      const a = shake * 1.4;
      cam.position.x += Math.sin(t * 47) * a;
      cam.position.y += Math.sin(t * 53 + 1) * a * 0.7;
      cam.position.z += Math.sin(t * 41 + 2) * a;
      cam.rotateZ(Math.sin(t * 37) * shake * 0.012);
    }
    // 기절: 내 화면이 기절 시간 동안 한 바퀴(360°) 돈다
    const myStun = rt.stun[mySeat];
    if (myStun !== null) cam.rotateZ(stunRoll(myStun));
    const fov = 42 + (20 - EYE_LIFT.fovLess * rt.cam.fpLift) * e;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    stage.lamp.visible = cam.position.y < 70;
  });

  return (
    <>
      <color attach="background" args={['#3a2a1f']} />
      <ambientLight color={0xfff0dc} intensity={0.35} />
      <hemisphereLight args={[0xffe8c8, 0x4a3324, 1.0]} />
      <spotLight
        position={[0, 78, 0]}
        target-position={[0, 0, 0]}
        intensity={1500}
        decay={1.2}
        angle={0.95}
        penumbra={0.6}
        color={0xffd59a}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0006}
        shadow-camera-near={20}
        shadow-camera-far={160}
      />
      <directionalLight position={[-60, 50, 30]} intensity={0.9} color={0xc8d2ff} />
      <primitive object={stage.room} />
      <group ref={tableRef}>
        <primitive object={stage.table} />
        <group ref={worldGroup}>
          <primitive object={stones.group} />
          <primitive object={hazards.group} />
          <primitive object={aimLayer.group} />
        </group>
      </group>
      <primitive object={rigs[0].root} />
      <primitive object={rigs[1].root} />
      <primitive object={blindFx.group} />
    </>
  );
}
