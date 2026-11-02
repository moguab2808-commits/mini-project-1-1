// 동물 캐릭터 6종과 몸짓 애니메이션. 모델은 단순한 코드 도형이고, 표정(눈·눈썹·입·눈물·깜빡임)과
// 몸짓(숙이기·일어서기, 양팔 2관절 IK, 머리 바라보기, 튕기기, 판 잡기, 방해요소 들기)이 핵심이다(시안 makeCharacter).
//
// 좌석 로컬 좌표(rig-math.ts): 루트 원점은 좌석 기준점 아래 판 윗면 높이, +Z가 판 쪽, 캐릭터 오른쪽은 −X.
// 팔·손·다리는 루트에 직접 붙여 좌석 로컬 좌표로 매 프레임 배치하고, 몸통·머리는 hips → torso → neck → head 계층이다.
import { SEAT_GEOMETRY, type HazardKind, type Seat } from '@alkkagi/shared';
import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import {
  RIG,
  aimHandTarget,
  clamp,
  copyV,
  createArmSolution,
  damp,
  dampV,
  distV,
  headCenter,
  hipPos,
  lookAngles,
  reachPose,
  seatToWorld,
  setV,
  shoulderPos,
  solveArm,
  v3,
  worldToSeat,
  type BodyState,
  type GestureName,
  type ReachResult,
  type V3,
} from './rig-math.ts';
import { TABLE_Y } from './stage.ts';

export type CharacterId = 'bear' | 'cat' | 'fox' | 'rabbit' | 'owl' | 'frog';

type Eyes = 'open' | 'happy' | 'shut';
type Mouth = 'smile' | 'frown' | 'flat' | 'open' | 'laugh' | 'tongue';

interface Palette {
  fur: number;
  belly: number;
  shirt: number;
  inner: number;
}

const PALETTES: Record<CharacterId, Palette> = {
  bear: { fur: 0x8a5a3a, belly: 0xe0c09a, shirt: 0x3f6fb5, inner: 0xc08a64 },
  cat: { fur: 0x9aa0a8, belly: 0xeeeae4, shirt: 0xc7506a, inner: 0xf0a3b0 },
  fox: { fur: 0xd9702a, belly: 0xf6efe4, shirt: 0x2f7f6a, inner: 0x2a1a12 },
  rabbit: { fur: 0xf2eeee, belly: 0xffffff, shirt: 0x8a62c4, inner: 0xf6b5c4 },
  owl: { fur: 0x8b6b4a, belly: 0xd9c19a, shirt: 0xd09a2f, inner: 0xe9a53a },
  frog: { fur: 0x6fbf4a, belly: 0xd8efb0, shirt: 0xd8503a, inner: 0xe27a86 },
};

/** 얼굴 부품 배치(머리 좌표계 cm). z를 생략하면 머리 구 표면에 붙인다 */
interface FaceLayout {
  eyeX: number;
  eyeY: number;
  eyeZ?: number;
  browY: number;
  browZ?: number;
  mouthY: number;
  mouthZ?: number;
  mouthScaleX: number;
}

const FACE: Record<CharacterId, FaceLayout> = {
  bear: { eyeX: 3, eyeY: 1.6, browY: 4.2, mouthY: -4.1, mouthZ: 9.6, mouthScaleX: 0.8 },
  cat: { eyeX: 3, eyeY: 1.4, browY: 4.1, mouthY: -2.9, mouthScaleX: 0.9 },
  fox: { eyeX: 3, eyeY: 1.8, browY: 4.4, mouthY: -4.6, mouthZ: 7.6, mouthScaleX: 0.9 },
  rabbit: { eyeX: 3, eyeY: 1.4, browY: 4.1, mouthY: -2.9, mouthScaleX: 0.9 },
  owl: { eyeX: 3.1, eyeY: 1.4, eyeZ: 9.1, browY: 4.8, mouthY: -4.4, mouthScaleX: 0.8 },
  frog: {
    eyeX: 3.9,
    eyeY: 6.6,
    eyeZ: 6.6,
    browY: 9.6,
    browZ: 4.9,
    mouthY: -2.2,
    mouthScaleX: 1.7,
  },
};

// ───────── 몸짓 정의 ─────────

interface HandSpec {
  p: [number, number, number];
  f: [number, number, number];
  curl: number;
  k: number;
}

interface Face {
  eyes: Eyes;
  mouth: Mouth;
  brow: number;
  browUp: number;
}

const FLICK_FACE: Face = { eyes: 'open', mouth: 'open', brow: 0.15, browUp: 0.2 };
const GRAB_FACE: Face = { eyes: 'open', mouth: 'flat', brow: 0.15, browUp: 0 };
const HOLD_FACE: Face = { eyes: 'open', mouth: 'smile', brow: 0.3, browUp: 0 };
const BLIND_FACE: Face = { eyes: 'shut', mouth: 'frown', brow: -0.3, browUp: 0 };
const BLIND_FACE_HARD: Face = { eyes: 'shut', mouth: 'open', brow: -0.3, browUp: 0 };

interface Gesture {
  eyes: Eyes;
  mouth: Mouth;
  brow: number;
  browUp: number;
  tear: boolean;
  lean: number;
  pitchAdd: number;
  /** 엉덩이 통통 튀기 높이(cm) */
  bounce: number;
  wobble: number;
  roll: number;
  /** 상대 얼굴을 본다 */
  focusOpponent: boolean;
  R: HandSpec | null;
  L: HandSpec | null;
}

const REST_R: HandSpec = { p: [-9, TABLE_Y + 1.6, 5.6], f: [0.15, 0, 1], curl: 0.55, k: 4 };
const REST_L: HandSpec = { p: [9, TABLE_Y + 1.6, 5.6], f: [-0.15, 0, 1], curl: 0.55, k: 4 };

const G = (g: Partial<Gesture>): Gesture => ({
  eyes: 'open',
  mouth: 'smile',
  brow: 0,
  browUp: 0,
  tear: false,
  lean: 0,
  pitchAdd: 0,
  bounce: 0,
  wobble: 0,
  roll: 0,
  focusOpponent: false,
  R: null,
  L: null,
  ...g,
});

export const GESTURES: Record<GestureName, Gesture> = {
  neutral: G({}),
  cheer: G({
    eyes: 'happy',
    mouth: 'laugh',
    browUp: 0.6,
    lean: -0.08,
    pitchAdd: -0.25,
    bounce: 1.8,
    focusOpponent: true,
    R: { p: [-10, 37, 4], f: [-0.2, 0.6, 1], curl: -0.2, k: 6 },
    L: { p: [10, 37, 4], f: [0.2, 0.6, 1], curl: -0.2, k: 6 },
  }),
  sad: G({
    eyes: 'shut',
    mouth: 'frown',
    brow: -0.35,
    tear: true,
    lean: 0.12,
    pitchAdd: 0.25,
    focusOpponent: true,
    R: { p: [-3.6, 19.5, 17.5], f: [0.3, 1, -0.2], curl: 1.1, k: 5 },
    L: { p: [3.6, 19.5, 17.5], f: [-0.3, 1, -0.2], curl: 1.1, k: 5 },
  }),
  shock: G({
    eyes: 'open',
    mouth: 'open',
    brow: -0.25,
    browUp: 0.7,
    lean: -0.15,
    focusOpponent: true,
    R: { p: [-11.5, 22, 4], f: [-0.5, 0.6, 1], curl: 0.3, k: 7 },
    L: { p: [11.5, 22, 4], f: [0.5, 0.6, 1], curl: 0.3, k: 7 },
  }),
  taunt: G({
    eyes: 'happy',
    mouth: 'tongue',
    brow: 0.15,
    bounce: 1.1,
    wobble: 0.12,
    focusOpponent: true,
    R: { p: [-5, 15, 20], f: [0, 0.05, 1], curl: -0.2, k: 6 },
    L: { p: [6, 0, 12.5], f: [-1, 0.2, 0.3], curl: 1.2, k: 5 },
  }),
  laugh: G({
    eyes: 'happy',
    mouth: 'laugh',
    brow: 0.1,
    bounce: 1.6,
    wobble: 0.08,
    pitchAdd: -0.2,
    lean: -0.05,
    focusOpponent: true,
    R: { p: [-5.5, -2, 12.5], f: [1, 0.2, 0.4], curl: 1.1, k: 5 },
    L: { p: [5.5, -2, 12.5], f: [-1, 0.2, 0.4], curl: 1.1, k: 5 },
  }),
  relief: G({
    eyes: 'open',
    mouth: 'smile',
    brow: -0.12,
    browUp: 0.3,
    lean: -0.1,
    pitchAdd: -0.1,
    focusOpponent: true,
    R: { p: [-4, 7, 13], f: [0.3, 0.2, 1], curl: 0.9, k: 5 },
  }),
  think: G({
    eyes: 'open',
    mouth: 'flat',
    brow: 0.2,
    lean: 0.1,
    roll: 0.12,
    L: { p: [2, 15.5, 13], f: [-0.3, 0.6, 0.6], curl: 1.0, k: 4 },
  }),
};

// ───────── 모델 ─────────

interface HandState {
  side: -1 | 1;
  pos: V3;
  fwd: V3;
  curl: number;
  tpos: V3;
  tfwd: V3;
  tcurl: number;
  k: number;
  fk: number;
  upper: Mesh;
  fore: Mesh;
  elbow: Mesh;
  shoulderBall: Mesh;
  hand: Group;
  finger: Group;
}

/** 이번 프레임 캐릭터 입력. 좌표는 모두 좌석 로컬 */
export interface CharacterFrame {
  dt: number;
  t: number;
  /** 조준·충전 중인 알과 방향(없으면 null) */
  aim: {
    stoneId: number;
    stone: V3;
    dir: V3;
    pull: number;
    reachable: boolean;
    strain: number;
  } | null;
  /** 판 돌리기 중이면 손으로 잡을 판 테두리 점 */
  grab: V3 | null;
  /** 손에 든 방해요소와 겨냥점 */
  hold: { kind: HazardKind; target: V3 } | null;
  /** 반응 몸짓 */
  gesture: GestureName;
  /** 상대 얼굴 위치 */
  opponentHead: V3;
  /** 움직이는 알 등 바라볼 곳(없으면 null) */
  watch: V3 | null;
  /** 후레쉬·물총에 가려진 정도 0~1(찡그림) */
  blind: number;
  /** 1인칭: 내 몸을 숨기고 카메라 근처 손도 숨긴다 */
  firstPerson: boolean;
  /** default 시점에서 쉬는 동안 내 팔을 숨긴다(몸 없이 팔만 떠 보이지 않게) */
  hideArms: boolean;
  /** 1인칭 카메라 위치(좌석 로컬) */
  camLocal: V3 | null;
  /** 몸통·머리 투명도(카메라를 가릴 때 낮춘다) */
  opacity: number;
}

const UP = new Vector3(0, 1, 0);
/** 머리 크기 배율(부품은 반지름 RIG.headRadius 기준) */
const HEAD_SCALE = 0.82;
const _a = new Vector3();
const _b = new Vector3();
const _m = new Matrix4();

function placeLimb(m: Mesh, a: V3, b: V3) {
  _a.set(b.x - a.x, b.y - a.y, b.z - a.z);
  const len = _a.length() || 1e-4;
  m.position.set((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  m.quaternion.setFromUnitVectors(UP, _a.divideScalar(len));
  m.scale.set(1, len, 1);
}

export class CharacterRig {
  readonly root = new Group();
  readonly seat: Seat;
  private readonly geos: BufferGeometry[] = [];
  private readonly mats: Material[] = [];
  /** 투명도 조절 대상(몸통·머리·다리) */
  private readonly fadeMats: MeshStandardMaterial[] = [];
  private readonly fadeBasic: MeshBasicMaterial[] = [];
  private readonly hips = new Group();
  private readonly torso = new Group();
  private readonly neck = new Group();
  private readonly head = new Group();
  private readonly legs = new Group();
  private readonly thighs: { m: Mesh; x: number }[] = [];
  private readonly eyes: Record<Eyes, Group> = {
    open: new Group(),
    happy: new Group(),
    shut: new Group(),
  };
  private readonly brows: { m: Mesh; s: number }[] = [];
  private readonly mouths = {} as Record<Mouth, Mesh>;
  private readonly tongue: Mesh;
  private readonly tear: Mesh;
  private readonly hands: [HandState, HandState];
  private readonly flashlight = new Group();
  private readonly waterGun = new Group();
  /** 빛·물이 나오는 곳 */
  readonly muzzle = new Object3D();
  private readonly layout: FaceLayout;

  // 몸 상태(현재값 st, 목표값 tg)
  private readonly st = {
    lean: 0,
    rise: 0,
    yaw: 0,
    pitchAdd: 0,
    bounce: 0,
    wobble: 0,
    roll: 0,
    brow: 0,
    browUp: 0,
    hy: 0,
    hp: 0,
  };
  private readonly body: BodyState = { lean: 0, yaw: 0, roll: 0, rise: 0, bob: 0 };
  private leanRate = 4;
  private blinkIn = 2 + Math.random() * 3;
  private blinkT = 0;
  private tearT = 0;
  private glanceIn = 4 + Math.random() * 4;
  private glanceT = 0;
  /** 튕기기 연출 경과(초). 음수면 없음 */
  private flickT = -1;
  private readonly flickStone = v3();
  private readonly flickDir = v3(0, 0, 1);
  private readonly lastAimStone = v3();
  private readonly lastAimDir = v3(0, 0, 1);
  private hasLastAim = false;
  private holdKind: HazardKind | null = null;

  // 임시값(할당 없이 재사용)
  private readonly reach: ReachResult = { p: 0, lean: 0, rise: 0, yaw: 0, ok: true };
  private readonly arm = createArmSolution();
  private readonly tS = v3();
  private readonly tW = v3();
  private readonly tH = v3();
  private readonly tL = v3();
  private readonly tP = v3();
  private readonly tF = v3();
  private readonly pole = v3();
  private readonly hipV = v3();
  private readonly lookV = v3();
  private readonly look = { yaw: 0, pitch: 0 };
  private readonly aimFace: Face = { eyes: 'open', mouth: 'flat', brow: 0.22, browUp: 0 };
  private lastAimId: number | null = null;

  constructor(id: CharacterId, seat: Seat) {
    this.seat = seat;
    this.layout = FACE[id];
    const pal = PALETTES[id];
    // 루트: 좌석 0은 +Z에서 −Z를 보고, 좌석 1은 −Z에서 +Z를 본다
    this.root.position.set(
      0,
      0,
      seat === 0 ? SEAT_GEOMETRY.anchorDistance : -SEAT_GEOMETRY.anchorDistance,
    );
    this.root.rotation.y = seat === 0 ? Math.PI : 0;

    const fur = this.fadeStd(pal.fur);
    const belly = this.fadeStd(pal.belly);
    const shirt = this.fadeStd(pal.shirt, 0.9);
    const inner = this.fadeStd(pal.inner);
    const pants = this.fadeStd(0x2b2f3a, 0.85);
    const shoe = this.fadeStd(0x1d1410, 0.5);
    const line = this.fadeBasicMat(0x1d120b);
    const white = this.fadeBasicMat(0xffffff);
    const armShirt = this.fadeStd(pal.shirt, 0.9);
    const armFur = this.std(pal.fur);
    // 손(발바닥)은 밝은 색으로 팔꿈치·팔과 구분한다
    const paw = this.std(pal.belly, 0.6);

    // 몸통 계층
    this.root.add(this.hips);
    this.hips.add(this.torso);
    this.torso.rotation.order = 'YXZ';
    const tilt = Math.atan2(RIG.shoulder.z, RIG.shoulder.y);
    const trunk = this.mesh(new CylinderGeometry(8, 9.5, 40, 16), shirt, this.torso);
    trunk.position.set(0, 21, 2.3);
    trunk.rotation.x = tilt;
    trunk.scale.z = 0.78;
    const dome = this.mesh(
      new SphereGeometry(8, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
      shirt,
      this.torso,
    );
    dome.position.set(0, 41, 4.6);
    dome.scale.set(1, 0.55, 0.78);
    const seatBall = this.mesh(new SphereGeometry(9.5, 16, 8), pants, this.torso);
    seatBall.position.set(0, 1, 0);
    seatBall.scale.set(1, 0.5, 0.82);
    const tummy = this.mesh(new SphereGeometry(6.5, 14, 10), belly, this.torso);
    tummy.position.set(0, 18, 7.4);
    tummy.scale.set(1, 1.15, 0.45);

    this.neck.position.set(RIG.neck.x, RIG.neck.y, RIG.neck.z);
    this.neck.rotation.order = 'YXZ';
    this.torso.add(this.neck);
    this.mesh(new CylinderGeometry(2.6, 3, 4, 10), fur, this.neck).position.y = 1.5;
    this.head.position.y = RIG.headUp;
    // 머리 부품은 반지름 RIG.headRadius 기준으로 만들고 전체를 줄여 판을 덜 가리게 한다
    this.head.scale.setScalar(HEAD_SCALE);
    this.neck.add(this.head);
    this.mesh(new SphereGeometry(RIG.headRadius, 28, 20), fur, this.head);
    this.buildSpecies(id, fur, belly, inner, line, white);
    this.buildFace(line, white);

    // 눈물·볼터치
    const tearMat = this.fadeBasicMat(0x8fd0ff);
    this.tear = this.mesh(new SphereGeometry(0.7, 10, 8), tearMat, this.head);
    this.tear.scale.y = 1.35;
    this.tear.visible = false;
    const blush = this.fadeBasicMat(0xf08a8a, 0.45);
    for (const sx of [-1, 1]) {
      const b = this.mesh(new CircleGeometry(1.3, 16), blush, this.head);
      const x = sx * 4.8;
      const y = this.layout.mouthY + 1.2;
      b.position.set(x, y, this.surfZ(x, y) + 0.05);
      b.rotation.y = Math.atan2(x, b.position.z);
    }

    // 다리(루트 좌표): 허벅지는 엉덩이와 무릎을 매 프레임 잇는다
    this.root.add(this.legs);
    for (const x of [-4.6, 4.6]) {
      const th = this.mesh(new CylinderGeometry(3.4, 3.2, 1, 10), pants, this.legs);
      this.thighs.push({ m: th, x });
      this.mesh(new SphereGeometry(3.3, 10, 8), pants, this.legs).position.set(x, -35, 13);
      const shin = this.mesh(new CylinderGeometry(3, 2.6, 44, 10), pants, this.legs);
      shin.position.set(x, -57, 14);
      const foot = this.mesh(new BoxGeometry(5, 3, 8), shoe, this.legs);
      foot.position.set(x, -81.5, 16);
    }

    // 팔과 손
    const mk = (side: -1 | 1, rest: HandSpec): HandState => {
      const shoulderBall = this.mesh(new SphereGeometry(3.1, 12, 10), shirt, this.torso);
      shoulderBall.position.set(RIG.shoulder.x * -side, RIG.shoulder.y, RIG.shoulder.z);
      const upper = this.mesh(new CylinderGeometry(2.6, 2.2, 1, 10), armShirt, this.root);
      const fore = this.mesh(new CylinderGeometry(2.2, 1.9, 1, 10), armFur, this.root);
      const elbow = this.mesh(new SphereGeometry(2.05, 10, 8), armFur, this.root);
      const hand = new Group();
      this.root.add(hand);
      const palm = this.mesh(new SphereGeometry(2.4, 14, 10), paw, hand);
      palm.scale.set(1, 0.72, 1.15);
      this.mesh(new SphereGeometry(0.95, 8, 6), armFur, hand).position.set(-side * 1.9, 0.3, 1.1);
      const finger = new Group();
      finger.position.set(0, 0.35, 2);
      hand.add(finger);
      const f = this.mesh(new CylinderGeometry(0.7, 0.62, 3, 8), armFur, finger);
      f.rotation.x = Math.PI / 2;
      f.position.z = 1.5;
      this.mesh(new SphereGeometry(0.66, 8, 6), armFur, finger).position.z = 3;
      const p = v3(...rest.p);
      const fw = v3(...rest.f);
      return {
        side,
        pos: { ...p },
        fwd: { ...fw },
        curl: rest.curl,
        tpos: p,
        tfwd: fw,
        tcurl: rest.curl,
        k: rest.k,
        fk: 10,
        upper,
        fore,
        elbow,
        shoulderBall,
        hand,
        finger,
      };
    };
    this.hands = [mk(-1, REST_R), mk(1, REST_L)];
    this.buildDevices(this.hands[0].hand);

    this.tongue = this.mouths.tongue;
    this.setFace('open', 'smile');
  }

  // ───── 생성 도우미 ─────

  private std(color: number, rough = 0.75): MeshStandardMaterial {
    const m = new MeshStandardMaterial({ color, roughness: rough });
    this.mats.push(m);
    return m;
  }

  private fadeStd(color: number, rough = 0.75): MeshStandardMaterial {
    const m = new MeshStandardMaterial({ color, roughness: rough, transparent: true });
    this.mats.push(m);
    this.fadeMats.push(m);
    return m;
  }

  private fadeBasicMat(color: number, opacity = 1): MeshBasicMaterial {
    const m = new MeshBasicMaterial({ color, transparent: true, opacity });
    m.userData.base = opacity;
    this.mats.push(m);
    this.fadeBasic.push(m);
    return m;
  }

  private mesh<T extends BufferGeometry>(geo: T, mat: Material, parent: Object3D): Mesh {
    this.geos.push(geo);
    const m = new Mesh(geo, mat);
    m.castShadow = !(mat instanceof MeshBasicMaterial);
    m.receiveShadow = !(mat instanceof MeshBasicMaterial);
    parent.add(m);
    return m;
  }

  /** 머리 구 표면의 z */
  private surfZ(x: number, y: number): number {
    const r = RIG.headRadius + 0.2;
    return Math.sqrt(Math.max(0.5, r * r - x * x - y * y));
  }

  /** 얼굴 부품을 표면 방향으로 살짝 돌려 붙인다 */
  private onFace(o: Object3D, x: number, y: number, z?: number) {
    const zz = z ?? this.surfZ(x, y);
    o.position.set(x, y, zz);
    o.rotation.set(-Math.atan2(y, zz) * 0.6, Math.atan2(x, zz) * 0.8, o.rotation.z);
    this.head.add(o);
  }

  private buildFace(line: Material, white: Material) {
    const L = this.layout;
    for (const sx of [-1, 1]) {
      const x = sx * L.eyeX;
      // 뜬 눈 + 하이라이트
      const eye = new Group();
      const e = this.mesh(new SphereGeometry(1.05, 14, 10), line, eye);
      e.scale.set(1, 1.3, 0.55);
      this.mesh(new SphereGeometry(0.34, 8, 6), white, eye).position.set(0.35, 0.45, 0.5);
      this.onFace(eye, x, L.eyeY, L.eyeZ);
      this.head.remove(eye);
      this.eyes.open.add(eye);
      // 웃는 눈(∩)
      const hp = this.mesh(new TorusGeometry(0.95, 0.28, 6, 14, Math.PI), line, this.eyes.happy);
      this.onFace(hp, x, L.eyeY - 0.4, L.eyeZ);
      this.head.remove(hp);
      this.eyes.happy.add(hp);
      // 감은 눈(찡그림)
      const sh = this.mesh(new BoxGeometry(2.1, 0.4, 0.3), line, this.eyes.shut);
      sh.rotation.z = sx < 0 ? 0.25 : -0.25;
      this.onFace(sh, x, L.eyeY, L.eyeZ);
      this.head.remove(sh);
      this.eyes.shut.add(sh);
      // 눈썹
      const b = this.mesh(new BoxGeometry(2.4, 0.5, 0.45), line, this.head);
      this.onFace(b, x, L.browY, L.browZ);
      this.brows.push({ m: b, s: sx });
    }
    this.head.add(this.eyes.open, this.eyes.happy, this.eyes.shut);

    const mouthMat = this.fadeBasicMat(0x3a1510);
    const my = L.mouthY;
    const mz = L.mouthZ;
    const smile = this.mesh(new TorusGeometry(1.5, 0.32, 6, 16, Math.PI), mouthMat, this.head);
    smile.rotation.z = Math.PI;
    this.onFace(smile, 0, my + 0.6, mz);
    const frown = this.mesh(new TorusGeometry(1.5, 0.32, 6, 16, Math.PI), mouthMat, this.head);
    this.onFace(frown, 0, my - 1.1, mz);
    const flat = this.mesh(new BoxGeometry(2.2, 0.38, 0.3), mouthMat, this.head);
    this.onFace(flat, 0, my - 0.4, mz);
    const open = this.mesh(new CircleGeometry(1.15, 18), mouthMat, this.head);
    open.scale.y = 1.35;
    this.onFace(open, 0, my - 0.6, mz === undefined ? undefined : mz + 0.1);
    const laugh = this.mesh(new CircleGeometry(2.1, 20, Math.PI, Math.PI), mouthMat, this.head);
    this.onFace(laugh, 0, my + 0.6, mz === undefined ? undefined : mz + 0.1);
    const tongueMat = this.fadeBasicMat(0xe0607a);
    const tongue = this.mesh(new SphereGeometry(0.95, 12, 8), tongueMat, this.head);
    tongue.scale.set(1.2, 0.6, 0.9);
    this.onFace(tongue, 0, my - 1.5, mz === undefined ? undefined : mz - 0.2);
    for (const m of [smile, frown, flat, open, laugh, tongue]) m.scale.x *= L.mouthScaleX;
    Object.assign(this.mouths, { smile, frown, flat, open, laugh, tongue });
  }

  private buildSpecies(
    id: CharacterId,
    fur: Material,
    belly: Material,
    inner: Material,
    line: Material,
    white: Material,
  ) {
    const h = this.head;
    const sphere = (r: number, m: Material, x: number, y: number, z: number) => {
      const o = this.mesh(new SphereGeometry(r, 12, 10), m, h);
      o.position.set(x, y, z);
      return o;
    };
    const cone = (r: number, len: number, m: Material, x: number, y: number, z: number, rz = 0) => {
      const c = this.mesh(new ConeGeometry(r, len, 10), m, h);
      c.position.set(x, y, z);
      c.rotation.z = rz;
      return c;
    };
    const nose = (m: Material, x: number, y: number, z: number, r = 0.85) => sphere(r, m, x, y, z);
    switch (id) {
      case 'bear': {
        for (const sx of [-1, 1]) {
          sphere(2.9, fur, sx * 6, 6.3, -1.4);
          sphere(1.7, inner, sx * 6, 6.3, 0.2).scale.z = 0.5;
        }
        sphere(3.4, belly, 0, -2.6, 6.6).scale.set(1.1, 0.85, 0.8);
        nose(line, 0, -1.3, 9.3, 1);
        break;
      }
      case 'cat': {
        for (const sx of [-1, 1]) {
          cone(2.9, 5.6, fur, sx * 5.2, 7.6, -0.6, -sx * 0.3);
          cone(1.7, 3.6, inner, sx * 5.2, 7.4, 0.5, -sx * 0.3);
          for (const dy of [-0.7, 0.7]) {
            const w = this.mesh(new BoxGeometry(5.5, 0.16, 0.16), line, h);
            w.position.set(sx * 7.6, -2 + dy, 6.2);
            w.rotation.z = sx * dy * 0.15;
          }
        }
        nose(inner, 0, -1.3, 8.55, 0.8);
        break;
      }
      case 'fox': {
        for (const sx of [-1, 1]) {
          cone(3, 7.5, fur, sx * 5, 8.5, -1, -sx * 0.22);
          cone(1.7, 4.6, line, sx * 5, 8.3, 0, -sx * 0.22);
          sphere(2.6, belly, sx * 3.8, -2.6, 6.4).scale.z = 0.6;
        }
        const snout = this.mesh(new ConeGeometry(3, 6, 10), belly, h);
        snout.rotation.x = Math.PI / 2;
        snout.position.set(0, -2.2, 9.6);
        nose(line, 0, -2.2, 12.6, 0.9);
        break;
      }
      case 'rabbit': {
        for (const sx of [-1, 1]) {
          const ear = this.mesh(new CylinderGeometry(1.9, 2.3, 13, 10), fur, h);
          ear.position.set(sx * 3.4, 13.5, -1);
          ear.rotation.z = -sx * 0.12;
          const ein = this.mesh(new CylinderGeometry(1, 1.3, 10, 8), inner, h);
          ein.position.set(sx * 3.5, 13.5, 0.4);
          ein.rotation.z = -sx * 0.12;
        }
        nose(inner, 0, -1, 8.6, 0.8);
        const teeth = this.mesh(new BoxGeometry(1.6, 1.4, 0.4), white, h);
        teeth.position.set(0, -4.8, 7.4);
        break;
      }
      case 'owl': {
        for (const sx of [-1, 1]) {
          cone(1.8, 4.6, fur, sx * 5.4, 8, -1, -sx * 0.35);
          const disc = sphere(3, belly, sx * 3.1, 1.4, 7.4);
          disc.scale.z = 0.4;
        }
        const beak = this.mesh(new ConeGeometry(1.3, 3.4, 6), inner, h);
        beak.rotation.x = Math.PI / 2;
        beak.position.set(0, -1.4, 9.4);
        break;
      }
      case 'frog': {
        for (const sx of [-1, 1]) sphere(3.1, fur, sx * 3.9, 6, 3.6);
        sphere(1.2, inner, -5.6, -0.6, 6.2).scale.z = 0.4;
        sphere(1.2, inner, 5.6, -0.6, 6.2).scale.z = 0.4;
        break;
      }
    }
  }

  private buildDevices(hand: Group) {
    const dark = this.std(0x26262c, 0.4);
    const metal = new MeshStandardMaterial({ color: 0xc9c9cf, roughness: 0.25, metalness: 0.7 });
    this.mats.push(metal);
    const lens = new MeshBasicMaterial({ color: 0xfff3b0 });
    this.mats.push(lens);
    // 후레쉬: 원통 몸체 + 넓은 머리 + 빛나는 렌즈. 손 +Z 방향을 비춘다
    const fb = this.mesh(new CylinderGeometry(1.05, 1.05, 8, 12), dark, this.flashlight);
    fb.rotation.x = Math.PI / 2;
    fb.position.set(0, 1.9, 1.6);
    const fh = this.mesh(new CylinderGeometry(1.7, 1.15, 2.4, 14), metal, this.flashlight);
    fh.rotation.x = Math.PI / 2;
    fh.position.set(0, 1.9, 6.6);
    const fl = this.mesh(new CircleGeometry(1.5, 16), lens, this.flashlight);
    fl.position.set(0, 1.9, 7.85);
    // 물총: 몸체·총열·손잡이·물통
    const body = this.std(0x2f8be0, 0.35);
    const tank = new MeshStandardMaterial({
      color: 0x8fd6ff,
      roughness: 0.1,
      transparent: true,
      opacity: 0.7,
    });
    this.mats.push(tank);
    this.mesh(new BoxGeometry(1.8, 2.6, 6), body, this.waterGun).position.set(0, 2.4, 1.6);
    const barrel = this.mesh(
      new CylinderGeometry(0.55, 0.55, 4, 10),
      this.std(0xffc93a, 0.4),
      this.waterGun,
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 2.9, 6.4);
    const grip = this.mesh(new BoxGeometry(1.4, 3.4, 1.6), body, this.waterGun);
    grip.position.set(0, 0.2, -0.6);
    grip.rotation.x = -0.35;
    this.mesh(new SphereGeometry(1.9, 12, 10), tank, this.waterGun).position.set(0, 5, 0.6);
    hand.add(this.flashlight, this.waterGun, this.muzzle);
    this.muzzle.position.set(0, 2.2, 8.4);
    this.flashlight.visible = false;
    this.waterGun.visible = false;
  }

  // ───── 상태 ─────

  private setFace(eyes: Eyes, mouth: Mouth) {
    this.eyes.open.visible = eyes === 'open';
    this.eyes.happy.visible = eyes === 'happy';
    this.eyes.shut.visible = eyes === 'shut';
    for (const k of Object.keys(this.mouths) as Mouth[]) {
      const m = this.mouths[k];
      m.visible = k === mouth || (mouth === 'tongue' && k === 'laugh');
    }
  }

  private setHand(h: HandState, p: V3, f: V3, curl: number, k: number, fk = 10) {
    copyV(h.tpos, p);
    const l = Math.hypot(f.x, f.y, f.z) || 1;
    setV(h.tfwd, f.x / l, f.y / l, f.z / l);
    h.tcurl = curl;
    h.k = k;
    h.fk = fk;
  }

  private setHandSpec(h: HandState, s: HandSpec) {
    setV(this.tP, s.p[0], s.p[1], s.p[2]);
    setV(this.tF, s.f[0], s.f[1], s.f[2]);
    this.setHand(h, this.tP, this.tF, s.curl, s.k);
  }

  /**
   * 튕기기 연출 시작. 그 알을 마지막으로 조준했으면 조준 때의 위치·방향을 쓰고,
   * 아니면 넘겨준 현재 위치·이동 방향을 쓴다(좌석 로컬).
   */
  startFlick(stoneId: number, stone: V3, dir: V3) {
    if (this.hasLastAim && this.lastAimId === stoneId) {
      copyV(this.flickStone, this.lastAimStone);
      copyV(this.flickDir, this.lastAimDir);
    } else {
      copyV(this.flickStone, stone);
      copyV(this.flickDir, dir);
    }
    this.hasLastAim = false;
    this.flickT = 0;
  }

  /** 머리 중심(좌석 로컬)의 월드 위치 */
  headWorld(out: Vector3): Vector3 {
    return this.head.getWorldPosition(out);
  }

  get holding(): HazardKind | null {
    return this.holdKind;
  }

  update(f: CharacterFrame) {
    const { dt, t } = f;
    const g = GESTURES[f.gesture];
    const st = this.st;
    const [R, L] = this.hands;
    let tgLean = g.lean;
    let tgRise = 0;
    let tgYaw = 0;
    let look: V3 | null = null;
    this.leanRate = 4;
    let face: Face = g;
    let jitter = 0;

    // ── 오른손: 튕기기 > 조준 > 판 잡기 > 방해요소 > 몸짓 > 쉬기
    let rightBusy = true;
    let leftBrace = false;
    if (this.flickT >= 0) {
      this.flickT += dt;
      const ft = this.flickT;
      const s = this.flickStone;
      const d = this.flickDir;
      if (ft < 0.08) {
        aimHandTarget(s, d, 0.9, true, this.tP);
        this.setHand(R, this.tP, d, 1.8, 30, 40);
      } else if (ft < 0.22) {
        setV(this.tP, s.x - d.x * 1.2, 1.6, s.z - d.z * 1.2);
        this.setHand(R, this.tP, d, -0.35, 45, 70);
      } else if (ft > 0.55) {
        this.flickT = -1;
      }
      look = s;
      tgLean = st.lean;
      tgRise = st.rise;
      tgYaw = st.yaw;
      face = FLICK_FACE;
    } else if (f.aim) {
      const a = f.aim;
      aimHandTarget(a.stone, a.dir, a.pull, a.reachable, this.tP);
      this.setHand(R, this.tP, a.dir, 0.9 + a.pull * 0.9, 5, 8);
      reachPose(this.tP, a.dir, this.reach);
      tgLean = this.reach.lean;
      tgRise = this.reach.rise;
      tgYaw = this.reach.yaw;
      this.leanRate = f.firstPerson ? 2.4 : 3.5;
      leftBrace = this.reach.p > 0.3;
      look = a.stone;
      copyV(this.lastAimStone, a.stone);
      copyV(this.lastAimDir, a.dir);
      this.lastAimId = a.stoneId;
      this.hasLastAim = true;
      jitter = a.strain;
      face = this.aimFace;
      this.aimFace.mouth = a.strain > 0.5 || !a.reachable ? 'open' : 'flat';
      this.aimFace.brow = 0.22 + a.strain * 0.15;
    } else if (f.grab) {
      setV(this.tF, -f.grab.x * 0.3, -0.2, 1);
      this.setHand(R, f.grab, this.tF, 1.2, 9, 8);
      reachPose(f.grab, this.tF, this.reach);
      tgLean = this.reach.lean;
      tgRise = this.reach.rise;
      tgYaw = this.reach.yaw;
      setV(this.lookV, 0, 0, SEAT_GEOMETRY.anchorDistance);
      look = this.lookV;
      face = GRAB_FACE;
    } else if (f.hold) {
      setV(this.tP, -1.5, SEAT_GEOMETRY.handHeight, SEAT_GEOMETRY.handForward);
      setV(
        this.tF,
        f.hold.target.x - this.tP.x,
        f.hold.target.y - this.tP.y,
        f.hold.target.z - this.tP.z,
      );
      this.setHand(R, this.tP, this.tF, 1.3, 7, 10);
      look = f.hold.target;
      tgLean = 0;
      face = HOLD_FACE;
    } else if (g.R) {
      this.setHandSpec(R, g.R);
      rightBusy = false;
    } else {
      this.setHandSpec(R, REST_R);
      rightBusy = false;
    }

    // ── 왼손
    if (f.blind > 0.5) {
      // 눈부심: 왼손을 눈앞에 들어 가린다
      setV(this.tP, 2.5, 25, 12.5);
      setV(this.tF, 0.1, 0.8, 0.6);
      this.setHand(L, this.tP, this.tF, -0.2, 7);
    } else if (leftBrace) {
      setV(this.tP, 9.5, 1.3, 8.5);
      setV(this.tF, -0.2, -0.1, 1);
      this.setHand(L, this.tP, this.tF, 1, 4);
    } else if (g.L && !rightBusy) this.setHandSpec(L, g.L);
    else this.setHandSpec(L, REST_L);

    // ── 얼굴: 가림 찡그림 > 위 결정
    let tear = g.tear && !f.aim;
    if (f.blind > 0.3) {
      face = f.blind > 0.6 ? BLIND_FACE_HARD : BLIND_FACE;
      tear = false;
    }
    this.setFace(face.eyes, face.mouth);

    // ── 몸
    const rate = (r: number) => 1 - Math.exp(-dt * r);
    const kl = rate(this.leanRate);
    const k = rate(7);
    st.lean += (tgLean - st.lean) * kl;
    st.rise += (tgRise - st.rise) * kl;
    st.yaw += (tgYaw - st.yaw) * kl;
    const busy = !!f.aim || this.flickT >= 0 || !!f.grab;
    st.pitchAdd += ((busy ? 0 : g.pitchAdd) - st.pitchAdd) * k;
    st.bounce += ((busy ? 0 : g.bounce) - st.bounce) * k;
    st.wobble += ((busy ? 0 : g.wobble) - st.wobble) * k;
    st.roll += ((busy ? 0 : g.roll) - st.roll) * k;
    st.brow += (face.brow - st.brow) * k;
    st.browUp += (face.browUp - st.browUp) * k;

    this.body.lean = st.lean;
    this.body.rise = st.rise;
    this.body.yaw = st.yaw;
    this.body.roll = 0;
    this.body.bob =
      Math.abs(Math.sin(t * 9)) * st.bounce + Math.sin(t * 1.6 + this.seat * 2) * 0.22;
    hipPos(this.body, this.hipV);
    this.hips.position.set(this.hipV.x, this.hipV.y, this.hipV.z);
    this.torso.rotation.set(st.lean, st.yaw, 0, 'YXZ');

    // ── 머리 바라보기
    if (!look) {
      if (g.focusOpponent) look = f.opponentHead;
      else if (f.watch) look = f.watch;
      else {
        this.glanceIn -= dt;
        if (this.glanceIn <= 0) {
          this.glanceT = 1.4;
          this.glanceIn = 5 + Math.random() * 5;
        }
        if (this.glanceT > 0) {
          this.glanceT -= dt;
          look = f.opponentHead;
        } else {
          // 평소에는 판 너머(상대 쪽)를 보아 얼굴이 상대 화면에 보이게 한다
          setV(this.lookV, 0, 6, SEAT_GEOMETRY.anchorDistance + 18);
          look = this.lookV;
        }
      }
    }
    headCenter(this.body, this.tH);
    const la = lookAngles(this.tH, look, this.look);
    const yawL = clamp(la.yaw - st.yaw, -1.0, 1.0);
    const pitchL = clamp(la.pitch - st.lean + st.pitchAdd, -0.6, 0.9);
    st.hy += (yawL - st.hy) * k;
    st.hp += (pitchL - st.hp) * k;
    this.neck.rotation.set(st.hp, st.hy, st.roll + Math.sin(t * 11) * st.wobble, 'YXZ');
    for (const b of this.brows) {
      b.m.rotation.z = b.s > 0 ? st.brow : -st.brow;
      b.m.position.y = this.layout.browY + st.browUp;
    }

    // ── 깜빡임·눈물
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkT = 0.12;
      this.blinkIn = 2.5 + Math.random() * 3;
    }
    if (this.blinkT > 0) this.blinkT -= dt;
    this.eyes.open.scale.y = this.blinkT > 0 ? 0.12 : 1;
    this.eyes.open.position.y = this.blinkT > 0 ? this.layout.eyeY * 0.88 : 0;
    this.tear.visible = tear;
    if (tear) {
      this.tearT = (this.tearT + dt) % 0.9;
      const x = this.layout.eyeX + 0.4;
      const y = this.layout.eyeY - 1.2 - this.tearT * 6;
      this.tear.position.set(x, y, this.surfZ(x, y) + 0.3);
    }

    // ── 다리(허벅지는 엉덩이 → 무릎)
    for (const th of this.thighs) {
      setV(this.tS, th.x, this.hipV.y + 0.5, this.hipV.z + 2);
      setV(this.tW, th.x, -35, 13);
      placeLimb(th.m, this.tS, this.tW);
    }

    // ── 방해요소 장비
    this.holdKind = f.hold?.kind ?? null;
    this.flashlight.visible = this.holdKind === 'flashlight';
    this.waterGun.visible = this.holdKind === 'water_gun';

    // ── 팔
    for (const h of this.hands) this.updateArm(h, dt, t, jitter, f);

    // ── 1인칭·투명도
    const hide = f.firstPerson;
    this.hips.visible = !hide;
    this.legs.visible = !hide;
    for (const h of this.hands) {
      h.upper.visible = !hide;
      h.elbow.visible = !hide;
      const near = hide && f.camLocal !== null && distV(h.pos, f.camLocal) < 7;
      h.fore.visible = !near && !f.hideArms;
      h.hand.visible = !near && !f.hideArms;
    }
    const op = clamp(f.opacity, 0, 1);
    for (const m of this.fadeMats) {
      m.opacity = op;
      m.depthWrite = op > 0.99;
    }
    // 얼굴 부품은 반투명일 때 머리 뒤로 비쳐 보이지 않게 함께 숨긴다
    for (const m of this.fadeBasic) {
      m.opacity = op > 0.95 ? (m.userData.base as number) : 0;
      m.visible = op > 0.95;
      m.depthWrite = op > 0.99 && m.userData.base === 1;
    }
    this.root.updateMatrixWorld(true);
  }

  private updateArm(h: HandState, dt: number, t: number, strain: number, f: CharacterFrame) {
    dampV(h.pos, h.tpos, h.k, dt);
    dampV(h.fwd, h.tfwd, h.k, dt);
    const fl = Math.hypot(h.fwd.x, h.fwd.y, h.fwd.z) || 1;
    h.fwd.x /= fl;
    h.fwd.y /= fl;
    h.fwd.z /= fl;
    h.curl = damp(h.curl, h.tcurl, h.fk, dt);

    // 손은 직선이 아니라 살짝 들어 올렸다 내려놓는다. 먼 거리·숙임이면 떨린다(오른손)
    const lift = clamp(distV(h.pos, h.tpos) * 0.25, 0, 3.5);
    let jit = h.side < 0 ? strain * 0.55 + Math.max(0, this.st.lean - 0.3) * 1.6 : 0;
    if (f.blind > 0.5 && h.side > 0) jit = 0.15;
    setV(
      this.tH,
      h.pos.x + (jit ? Math.sin(t * 37 + h.side) * jit : 0),
      h.pos.y + lift + (jit ? Math.sin(t * 29) * jit * 0.5 : 0),
      h.pos.z + (jit ? Math.sin(t * 41) * jit : 0),
    );

    shoulderPos(this.body, h.side, this.tS);
    setV(
      this.tW,
      this.tH.x - h.fwd.x * RIG.wristBack,
      this.tH.y - h.fwd.y * RIG.wristBack,
      this.tH.z - h.fwd.z * RIG.wristBack,
    );
    setV(this.pole, h.side * 0.8, -1, -0.5);
    solveArm(this.tS, this.tW, RIG.upperArm, RIG.foreArm, this.pole, this.arm);
    if (this.arm.clamped) {
      // 팔은 늘어나지 않는다: 쭉 뻗은 데서 멈춘 손목 앞에 손을 둔다
      setV(
        this.tH,
        this.arm.wrist.x + h.fwd.x * RIG.wristBack,
        this.arm.wrist.y + h.fwd.y * RIG.wristBack,
        this.arm.wrist.z + h.fwd.z * RIG.wristBack,
      );
    }
    h.hand.position.set(this.tH.x, this.tH.y, this.tH.z);
    _a.set(this.tH.x + h.fwd.x, this.tH.y + h.fwd.y, this.tH.z + h.fwd.z);
    _b.set(this.tH.x, this.tH.y, this.tH.z);
    _m.lookAt(_a, _b, UP);
    h.hand.quaternion.setFromRotationMatrix(_m);
    h.finger.rotation.x = h.curl;
    placeLimb(h.upper, this.tS, this.arm.elbow);
    placeLimb(h.fore, this.arm.elbow, this.arm.wrist);
    h.elbow.position.set(this.arm.elbow.x, this.arm.elbow.y, this.arm.elbow.z);
  }

  /** 총구·렌즈의 월드 위치 */
  muzzleWorld(out: Vector3): Vector3 {
    return this.muzzle.getWorldPosition(out);
  }

  /** 좌석 로컬 점 → 월드 */
  toWorld(l: V3, out: V3): V3 {
    return seatToWorld(this.seat, l, out);
  }

  toLocal(w: V3, out: V3): V3 {
    return worldToSeat(this.seat, w, out);
  }

  dispose() {
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }
}
