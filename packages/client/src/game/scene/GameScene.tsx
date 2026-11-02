// 3D 인게임 장면. 그리기와 포인터 → 판 좌표 변환만 맡고 조준·세기·배치 판단은 호출 쪽이 한다(scene-contract.ts).
// 알·설치물·조준은 "최신 스냅샷 좌표계"를 월드 Y축으로 (표시 판 각 − 최신 판 각)만큼 돌린 그룹에 담는다.
// 서버는 판 돌리기 때 알·설치물의 좌표를 이미 회전해 보내므로, 표시 회전이 따라잡는 동안만 이 차이가 0이 아니다.
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { HAZARD_TUNING, PHYSICS } from '@alkkagi/shared';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Group, PCFShadowMap, PerspectiveCamera, Raycaster, Vector2 } from 'three';
import type { BoardPointerEvent, SceneProps } from './scene-contract.ts';
import { buildCharacter } from './characters.ts';
import { stepFall, startFall, type FallState } from './fall.ts';
import { AimLayer, HazardLayer, StoneLayer, STONE_REST_Y, type HazardDraw } from './layers.ts';
import {
  BOARD_TOP_Y,
  DEG,
  PICK_MARGIN,
  approachAngle,
  cameraRig,
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
import { buildStage, createStoneKit, TABLE_Y } from './stage.ts';

const CHARACTER_Z = 60;
const CHARACTER_SCALE = 0.85;

export function GameScene(props: SceneProps) {
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        shadows={{ type: PCFShadowMap }}
        dpr={[1, 2]}
        camera={{ fov: 42, near: 1, far: 800, position: [0, 52, 50] }}
        gl={{ antialias: true }}
        style={{ touchAction: 'none' }}
        data-testid="game-scene"
      >
        <SceneWorld {...props} />
      </Canvas>
    </div>
  );
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
  shakeStartPerf: number;
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

  const worldGroup = useRef<Group>(null);
  const tableRef = useRef<Group>(null);
  const char0 = players[0].characterId;
  const char1 = players[1].characterId;
  const characters = useMemo(() => {
    const a = buildCharacter(char0);
    const b = buildCharacter(char1);
    // seat 0은 +Z쪽에서 판(-Z)을 보고, seat 1은 -Z쪽에서 판(+Z)을 본다
    a.root.position.set(0, TABLE_Y, CHARACTER_Z);
    a.root.rotation.y = Math.PI;
    a.root.scale.setScalar(CHARACTER_SCALE);
    b.root.scale.setScalar(CHARACTER_SCALE);
    b.root.position.set(0, TABLE_Y, -CHARACTER_Z);
    return { a, b };
  }, [char0, char1]);
  useEffect(
    () => () => {
      characters.a.dispose();
      characters.b.dispose();
    },
    [characters],
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
      shakeStartPerf: 0,
    };
    feed(r, props.view);
    return r;
    // 장면이 처음 만들어질 때만 초기 스냅샷을 넣고 이후 갱신은 useEffect가 맡는다
  }, []);
  useEffect(() => {
    feed(rt, props.view);
  }, [rt, props.view]);

  const { gl, camera, size } = useThree();

  // 포인터 → 판 좌표. 캔버스 이벤트를 직접 받아 판 평면 ray 교차점을 서버 기준 좌표로 되돌린다.
  useEffect(() => {
    const el = gl.domElement;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const emit = (type: BoardPointerEvent['type'], e: PointerEvent) => {
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
      const stoneId = pickStoneByRay(
        o,
        d,
        rt.candidates,
        rt.sampleCount,
        PHYSICS.stoneRadius + PICK_MARGIN,
      );
      latest.current.onPointer({ type, point, stoneId, button: e.button });
    };
    const onMove = (e: PointerEvent) => emit('move', e);
    const onDown = (e: PointerEvent) => {
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // 캡처 실패는 입력을 막지 않는다
      }
      emit('down', e);
    };
    const onUp = (e: PointerEvent) => emit('up', e);
    const onCancel = (e: PointerEvent) => emit('cancel', e);
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

  useFrame((state, dtSec) => {
    const p = latest.current;
    const dt = Math.min(dtSec, 0.1);

    // 카메라: 내 쪽에서 내려다보는 고정 시점
    const rig = cameraRig(p.mySeat, size.width / Math.max(1, size.height));
    const cam = state.camera as PerspectiveCamera;
    cam.position.set(rig.px, rig.py, rig.pz);
    cam.lookAt(rig.tx, rig.ty, rig.tz);
    if (cam.fov !== rig.fov) {
      cam.fov = rig.fov;
      cam.updateProjectionMatrix();
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

    // 판 돌리기: 표시 각이 최신 판 각에 다가간다
    const latestRot = latestRotation(rt.snap);
    rt.visRot = approachAngle(rt.visRot, latestRot, dt);
    rt.deltaDeg = rt.visRot - latestRot;
    stage.boardPivot.rotation.y = rt.visRot * DEG;
    if (worldGroup.current) worldGroup.current.rotation.y = rt.deltaDeg * DEG;

    // 책상 흔들림
    const nowServer = p.view.serverNowMs + (performance.now() - rt.viewPerfMs);
    let sx = 0;
    let sz = 0;
    let n = 0;
    for (const e of p.view.effects) {
      if (e.kind === 'desk_shake') {
        const span = Math.max(1, e.expiresAtMs - e.startsAtMs);
        const progress = (nowServer - e.startsAtMs) / span;
        [sx, sz] = deskShakeOffset(progress, nowServer / 1000, HAZARD_TUNING.deskShakeMaxDistance);
      } else if (e.kind === 'wall' || e.kind === 'sticky') {
        const x = e.params?.x;
        const y = e.params?.y;
        if (x === undefined || y === undefined) continue;
        let h = rt.hazards[n];
        if (!h) {
          h = { kind: 'wall', x: 0, y: 0, angle: 0 };
          rt.hazards[n] = h;
        }
        h.kind = e.kind;
        h.x = x;
        h.y = y;
        const deg = e.params?.angleDeg ?? (e.params?.orientation === 'vertical' ? 90 : 0);
        h.angle = deg * DEG;
        n++;
      }
    }
    if (tableRef.current) tableRef.current.position.set(sx, 0, sz);
    hazards.update(rt.hazards, n);

    // 알·조준
    let target: SampledStone | null = null;
    for (let i = 0; i < rt.sampleCount; i++) {
      const s = rt.samples[i];
      if (!s) continue;
      let c = rt.candidates[i];
      if (!c) {
        c = { id: 0, x: 0, y: 0, z: 0 };
        rt.candidates[i] = c;
      }
      // 선택 판정용 월드 좌표: 회전 그룹(deltaDeg)을 반영한다
      const r = rt.deltaDeg * DEG;
      const cs = Math.cos(r);
      const sn = Math.sin(r);
      c.id = s.id;
      c.x = s.x * cs + -s.y * sn;
      c.z = -s.x * sn + -s.y * cs;
      c.y = STONE_REST_Y + s.h;
      if (p.aim && s.id === p.aim.stoneId) target = s;
    }
    stones.update(rt.samples, rt.sampleCount, rt.falls, p.mySeat, p.aim?.stoneId ?? null);
    aimLayer.update(p.aim, target, p.placement, p.mySeat, rt.deltaDeg * DEG);
  });

  return (
    <>
      <color attach="background" args={['#1a110c']} />
      <hemisphereLight args={[0xffe2b8, 0x24160e, 0.55]} />
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
        shadow-camera-far={140}
      />
      <directionalLight position={[-60, 50, 30]} intensity={0.5} color={0xa9b8ff} />
      <primitive object={stage.room} />
      <group ref={tableRef}>
        <primitive object={stage.table} />
        <group ref={worldGroup}>
          <primitive object={stones.group} />
          <primitive object={hazards.group} />
          <primitive object={aimLayer.group} />
        </group>
      </group>
      <primitive object={characters.a.root} />
      <primitive object={characters.b.root} />
    </>
  );
}
