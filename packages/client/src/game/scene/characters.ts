// 사람 아바타 상반신과 몸짓 애니메이션. 몸은 단순한 코드 도형, 머리는 AvatarHead(코드 도형 + 이목구비 캔버스 텍스처)이고, 표정(눈·눈썹·입·눈물·깜빡임)과
// 몸짓(숙이기·일어서기, 양팔 2관절 IK, 머리 바라보기, 튕기기, 판 잡기, 방해요소 들기)이 핵심이다(시안 makeCharacter).
//
// 좌석 로컬 좌표(rig-math.ts): 루트 원점은 좌석 기준점 아래 판 윗면 높이, +Z가 판 쪽, 캐릭터 오른쪽은 −X.
// 팔·손·다리는 루트에 직접 붙여 좌석 로컬 좌표로 매 프레임 배치하고, 몸통·머리는 hips → torso → neck → head 계층이다.
import {
  SEAT_GEOMETRY,
  type Appearance,
  type EmoteId,
  type HazardKind,
  type Seat,
} from '@alkkagi/shared';
import {
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Shape,
  ExtrudeGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Camera,
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
import { AvatarHand } from '../../avatar/avatar-hand.ts';
import { AvatarHead } from '../../avatar/avatar-head.ts';
import { addOutfitDetails } from '../../avatar/avatar-outfit.ts';
import type { FaceEyes, FaceMouth } from '../../avatar/face-paint.ts';
import { EmoteBubble } from './emote-bubble.ts';
import { emoteMotion } from './emote-motion.ts';
import { TABLE_Y } from './stage.ts';

type Eyes = FaceEyes;
type Mouth = FaceMouth;

/** 기본 티(옷 항목 0번)의 좌석별 몸통 색. 두 사람을 구분하기 쉽게 좌석으로 정한다. 다른 옷은 부품 정의의 색(DEC-078) */
const SHIRT: Record<Seat, number> = { 0: 0x3f6fb5, 1: 0xc7506a };
/** 얼굴 좌표(머리 반지름 50) → 머리 좌표(cm) */
const FACE_UNIT = RIG.headRadius / 50;

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

const FLICK_FACE: Face = {
  eyes: 'open',
  mouth: 'open',
  brow: 0.15,
  browUp: 0.2,
};
const GRAB_FACE: Face = { eyes: 'open', mouth: 'flat', brow: 0.15, browUp: 0 };
const HOLD_FACE: Face = { eyes: 'open', mouth: 'smile', brow: 0.3, browUp: 0 };
const BLIND_FACE: Face = {
  eyes: 'shut',
  mouth: 'frown',
  brow: -0.3,
  browUp: 0,
};
const BLIND_FACE_HARD: Face = {
  eyes: 'shut',
  mouth: 'open',
  brow: -0.3,
  browUp: 0,
};

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

const REST_R: HandSpec = {
  p: [-9, TABLE_Y + 1.6, 5.6],
  f: [0.15, 0, 1],
  curl: 0.55,
  k: 4,
};
const REST_L: HandSpec = {
  p: [9, TABLE_Y + 1.6, 5.6],
  f: [-0.15, 0, 1],
  curl: 0.55,
  k: 4,
};

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

const EMOTE_GESTURES = {
  yawn: G({
    eyes: 'shut',
    mouth: 'open',
    focusOpponent: true,
    R: { p: [-1, 24, 10], f: [0, 0.8, 0.3], curl: 0.4, k: 9 },
  }),
  taunt: G({
    eyes: 'open',
    mouth: 'smile',
    brow: 0.25,
    browUp: 0.3,
    focusOpponent: true,
    R: { p: [-5, 21, 18], f: [0, 0.2, 1], curl: -0.3, k: 9 },
  }),
  doze: G({ eyes: 'shut', mouth: 'flat' }),
  gg: G({
    eyes: 'happy',
    mouth: 'smile',
    focusOpponent: true,
    R: { p: [-10, 30, 8], f: [0, 1, 0.3], curl: -0.2, k: 10 },
  }),
  surprise: G({
    eyes: 'wide',
    mouth: 'open',
    browUp: 0.7,
    lean: -0.18,
    focusOpponent: true,
    R: { p: [-12, 29, 8], f: [0, 0.7, 1], curl: -0.2, k: 12 },
    L: { p: [12, 29, 8], f: [0, 0.7, 1], curl: -0.2, k: 12 },
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
  model: AvatarHand;
  /** 튕길 손 모양(중지를 엄지에 건다) 0~1, 손등을 오른쪽으로 세우는 정도 0~1, 튕겨 편 정도 0~1 */
  flick: number;
  tflick: number;
  roll: number;
  troll: number;
  snap: number;
  tsnap: number;
}

/** 이번 프레임 캐릭터 입력. 좌표는 모두 좌석 로컬 */
export interface CharacterFrame {
  lookYaw?: number;
  lookPitch?: number;
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
  /** 기절 중이면 머리 위에 별이 돈다 */
  stunned?: boolean;
  emote?: { kind: EmoteId; ageMs: number } | null;
}

const UP = new Vector3(0, 1, 0);
/** 머리 크기 배율(부품은 반지름 RIG.headRadius 기준). 큰 머리 화풍(IMPL-018 화풍 확인) */
const HEAD_SCALE = 1.1;
/**
 * 쉬는 자세에서 바라보는 점(좌석 로컬): 판 중심 너머 `ahead`cm, 판 윗면 위 `height`cm.
 * 상대 얼굴(높이 24, 판 중심 너머 30) 쪽을 거의 정면으로 본다(머리 중심 기준 약 2° 아래, DEC-071 ③)
 */
export const IDLE_LOOK = { height: 22, ahead: 30 } as const;
const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
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
  /** 투명도 조절 대상(몸통·머리) */
  private readonly fadeMats: MeshStandardMaterial[] = [];
  private readonly fadeBasic: MeshBasicMaterial[] = [];
  private readonly hips = new Group();
  private readonly torso = new Group();
  private readonly neck = new Group();
  private readonly head = new Group();
  private readonly avatar: AvatarHead;
  private faceEyes: Eyes = 'open';
  private faceMouth: Mouth = 'smile';
  private readonly tear: Mesh;
  private readonly hands: [HandState, HandState];
  private readonly flashlight = new Group();
  private readonly waterGun = new Group();
  /** 감정표현: 카메라를 향하는 머리 위 말풍선 */
  private readonly emoteBubble = new EmoteBubble();
  private readonly bubblePoint = new Vector3();
  /** 기절 표시: 머리 위를 도는 별 */
  private readonly stunStars = new Group();
  private readonly stunStarMeshes: Mesh[] = [];
  /** 빛·물이 나오는 곳 */
  readonly muzzle = new Object3D();

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
  private readonly body: BodyState = {
    lean: 0,
    yaw: 0,
    roll: 0,
    rise: 0,
    bob: 0,
  };
  private leanRate = 4;
  private blinkIn = 2 + Math.random() * 3;
  private blinkT = 0;
  private tearT = 0;
  /** 튕기기 연출 경과(초). 음수면 없음 */
  private flickT = -1;
  private readonly flickStone = v3();
  private readonly flickDir = v3(0, 0, 1);
  private readonly lastAimStone = v3();
  private readonly lastAimDir = v3(0, 0, 1);
  private hasLastAim = false;
  private holdKind: HazardKind | null = null;

  // 임시값(할당 없이 재사용)
  private readonly reach: ReachResult = {
    p: 0,
    lean: 0,
    rise: 0,
    yaw: 0,
    ok: true,
  };
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
  private readonly aimFace: Face = {
    eyes: 'open',
    mouth: 'flat',
    brow: 0.22,
    browUp: 0,
  };
  private lastAimId: number | null = null;

  constructor(appearance: Appearance, seat: Seat) {
    this.seat = seat;
    // 루트: 좌석 0은 +Z에서 −Z를 보고, 좌석 1은 −Z에서 +Z를 본다
    this.root.position.set(
      0,
      0,
      seat === 0 ? SEAT_GEOMETRY.anchorDistance : -SEAT_GEOMETRY.anchorDistance,
    );
    this.root.rotation.y = seat === 0 ? Math.PI : 0;

    this.avatar = new AvatarHead(appearance, RIG.headRadius);
    const skinColor = this.avatar.parts.skinTone.base;
    const skin = this.fadeStd(skinColor, 0.7);
    const outfit = this.avatar.parts.outfit;
    const shirtColor = outfit.color ?? SHIRT[seat];
    const shirt = this.fadeStd(shirtColor, 0.9);
    const pants = this.fadeStd(0x2b2f3a, 0.85);
    const armShirt = this.fadeStd(shirtColor, 0.9);
    // 팔뚝·손은 투명도와 무관하게 늘 보인다(1인칭에서 내 손)
    const armSkin = this.std(skinColor, 0.7);

    // 몸통 계층(상반신, DEC-059)
    this.root.add(this.hips);
    this.hips.add(this.torso);
    this.torso.rotation.order = 'YXZ';
    const tilt = Math.atan2(RIG.shoulder.z, RIG.shoulder.y);
    const trunk = this.mesh(new CylinderGeometry(8, 9.5, 40, 16), shirt, this.torso);
    trunk.position.set(0, 21, 2.3);
    trunk.rotation.x = tilt;
    trunk.scale.z = 0.78;
    // 옷 장식(DEC-078): 몸통과 같은 위치·기울기·납작함의 그룹 안에 붙인다
    const outfitFrame = new Group();
    outfitFrame.position.copy(trunk.position);
    outfitFrame.rotation.x = tilt;
    outfitFrame.scale.z = trunk.scale.z;
    this.torso.add(outfitFrame);
    addOutfitDetails(outfit, {
      frame: outfitFrame,
      trunk: { height: 40, rTop: 8, rBottom: 9.5 },
      material: (c) => this.fadeStd(c, 0.85),
      mesh: (geo, mat, parent) => this.mesh(geo, mat, parent),
    });
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
    // 옷깃
    const collar = this.mesh(new CylinderGeometry(3.6, 4.4, 1.6, 14), shirt, this.torso);
    collar.position.set(RIG.neck.x, RIG.neck.y - 1.2, RIG.neck.z);

    this.neck.position.set(RIG.neck.x, RIG.neck.y, RIG.neck.z);
    this.neck.rotation.order = 'YXZ';
    this.torso.add(this.neck);
    this.mesh(new CylinderGeometry(2.6, 3, 5, 12), skin, this.neck).position.y = 1.5;
    this.head.position.y = RIG.headUp;
    this.head.scale.setScalar(HEAD_SCALE);
    this.neck.add(this.head);
    this.head.add(this.avatar.group);
    for (const m of this.avatar.materials)
      if (m !== this.avatar.faceMaterial) this.fadeMats.push(m);

    // 눈물
    const tearMat = this.fadeBasicMat(0x8fd0ff);
    this.tear = this.mesh(new SphereGeometry(0.7, 10, 8), tearMat, this.head);
    this.tear.scale.y = 1.35;
    this.tear.visible = false;

    // 팔과 손
    const mk = (side: -1 | 1, rest: HandSpec): HandState => {
      const shoulderBall = this.mesh(new SphereGeometry(3.1, 12, 10), shirt, this.torso);
      shoulderBall.position.set(RIG.shoulder.x * -side, RIG.shoulder.y, RIG.shoulder.z);
      const upper = this.mesh(new CylinderGeometry(2.6, 2.2, 1, 10), armShirt, this.root);
      const fore = this.mesh(new CylinderGeometry(2.0, 1.7, 1, 10), armSkin, this.root);
      const elbow = this.mesh(new SphereGeometry(1.95, 10, 8), armSkin, this.root);
      const hand = new Group();
      this.root.add(hand);
      // 손가락 다섯 개(IMPL-019). 손목이 손바닥 뒤 wristBack에 오도록 손바닥 중심을 원점에 둔다
      const model = new AvatarHand(side, armSkin, this.geos);
      model.pose(rest.curl);
      hand.add(model.group);
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
        model,
        flick: 0,
        tflick: 0,
        roll: 0,
        troll: 0,
        snap: 0,
        tsnap: 0,
      };
    };
    this.hands = [mk(-1, REST_R), mk(1, REST_L)];
    this.buildDevices(this.hands[0].hand);

    this.buildStunStars();
    this.emoteBubble.sprite.position.y = RIG.headUp + RIG.headRadius * HEAD_SCALE + 10;
    this.root.add(this.emoteBubble.sprite);
  }

  /** 머리 위 기절 별 5개(목에 붙여 머리를 따라간다) */
  private buildStunStars() {
    const shape = new Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? 2.2 : 0.95;
      const a = Math.PI / 2 + (i * Math.PI) / 5;
      if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    shape.closePath();
    // 도톰한 금빛 별(DEC-081): 모서리를 둥글린 입체 별에 광택과 약한 자체 발광
    const geo = new ExtrudeGeometry(shape, {
      depth: 0.5,
      bevelEnabled: true,
      bevelThickness: 0.3,
      bevelSize: 0.25,
      bevelSegments: 2,
    });
    geo.center();
    this.geos.push(geo);
    const mat = new MeshStandardMaterial({
      color: 0xffc21a,
      emissive: 0xb06a00,
      emissiveIntensity: 0.5,
      roughness: 0.2,
      metalness: 0.35,
    });
    this.mats.push(mat);
    for (let i = 0; i < 5; i++) {
      const m = new Mesh(geo, mat);
      this.stunStars.add(m);
      this.stunStarMeshes.push(m);
    }
    this.stunStars.position.y = RIG.headUp + RIG.headRadius * HEAD_SCALE + 5;
    this.stunStars.visible = false;
    this.neck.add(this.stunStars);
  }

  private updateStunStars(on: boolean, t: number) {
    this.stunStars.visible = on;
    if (!on) return;
    const n = this.stunStarMeshes.length;
    const spin = t * 3.2;
    this.stunStarMeshes.forEach((m, i) => {
      const a = spin + (i * Math.PI * 2) / n;
      m.position.set(Math.cos(a) * 8, Math.sin(t * 6 + i) * 0.8, Math.sin(a) * 8);
      m.rotation.set(0, -a + t * 4, 0);
      m.scale.setScalar(0.85 + 0.2 * Math.sin(t * 8 + i * 1.3));
    });
  }

  // ───── 생성 도우미 ─────

  private std(color: number | string, rough = 0.75): MeshStandardMaterial {
    const m = new MeshStandardMaterial({ color, roughness: rough });
    this.mats.push(m);
    return m;
  }

  private fadeStd(color: number | string, rough = 0.75): MeshStandardMaterial {
    const m = new MeshStandardMaterial({
      color,
      roughness: rough,
      transparent: true,
    });
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

  private buildDevices(hand: Group) {
    const metal = new MeshStandardMaterial({
      color: 0xc9c9cf,
      roughness: 0.25,
      metalness: 0.7,
    });
    this.mats.push(metal);
    const lens = new MeshBasicMaterial({ color: 0xfff0a0 });
    this.mats.push(lens);
    // 후레쉬(DEC-081): 장난감 손전등. 빨간 몸체·금빛 띠·노란 머리·빛나는 렌즈
    const torchBody = this.std(0xe2302a, 0.18);
    const torchHead = this.std(0xffb81a, 0.2);
    const fb = this.mesh(new CylinderGeometry(1.05, 1.05, 8, 14), torchBody, this.flashlight);
    fb.rotation.x = Math.PI / 2;
    fb.position.set(0, 1.9, 1.6);
    for (const z of [-1.2, 3.6]) {
      const band = this.mesh(new TorusGeometry(1.08, 0.18, 6, 16), metal, this.flashlight);
      band.position.set(0, 1.9, z);
    }
    const fh = this.mesh(new CylinderGeometry(1.8, 1.15, 2.4, 16), torchHead, this.flashlight);
    fh.rotation.x = Math.PI / 2;
    fh.position.set(0, 1.9, 6.6);
    const fl = this.mesh(new CircleGeometry(1.55, 18), lens, this.flashlight);
    fl.position.set(0, 1.9, 7.85);
    const btn = this.mesh(new SphereGeometry(0.45, 8, 6), torchHead, this.flashlight);
    btn.position.set(0, 3, 1.2);
    // 물총(DEC-080): 장난감 물총. 둥근 파란 몸체·노란 총구·주황 펌프·손잡이, 위에 빛나는 물통
    const body = this.std(0x1a78e8, 0.15);
    const accent = this.std(0xffb81a, 0.18);
    const pump = this.std(0xf06a10, 0.18);
    const tank = new MeshStandardMaterial({
      color: 0x8fd8ff,
      roughness: 0.05,
      transparent: true,
      opacity: 0.75,
      emissive: 0x2a7ad0,
      emissiveIntensity: 0.6,
    });
    this.mats.push(tank);
    const shell = this.mesh(new CapsuleGeometry(1.15, 4.4, 6, 12), body, this.waterGun);
    shell.rotation.x = Math.PI / 2;
    shell.position.set(0, 2.4, 2.2);
    const barrel = this.mesh(new CylinderGeometry(0.5, 0.65, 3.2, 12), accent, this.waterGun);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 2.3, 6.8);
    const tip = this.mesh(new TorusGeometry(0.55, 0.2, 8, 16), accent, this.waterGun);
    tip.position.set(0, 2.3, 8.3);
    const slide = this.mesh(new CylinderGeometry(0.7, 0.7, 2.6, 12), pump, this.waterGun);
    slide.rotation.x = Math.PI / 2;
    slide.position.set(0, 1.1, 4.6);
    const grip = this.mesh(new BoxGeometry(1.3, 3.4, 1.6), body, this.waterGun);
    grip.position.set(0, 0.2, -0.6);
    grip.rotation.x = -0.35;
    const trigger = this.mesh(new TorusGeometry(0.6, 0.18, 6, 12, Math.PI), accent, this.waterGun);
    trigger.rotation.set(0, Math.PI / 2, Math.PI);
    trigger.position.set(0, 1.1, 0.6);
    this.mesh(new SphereGeometry(1.9, 14, 12), tank, this.waterGun).position.set(0, 4.9, 1.2);
    const tankCap = this.mesh(new CylinderGeometry(0.6, 0.6, 0.6, 10), pump, this.waterGun);
    tankCap.position.set(0, 6.9, 1.2);
    hand.add(this.flashlight, this.waterGun, this.muzzle);
    this.muzzle.position.set(0, 2.2, 8.4);
    this.flashlight.visible = false;
    this.waterGun.visible = false;
  }

  // ───── 상태 ─────

  private emoteGesture(kind: EmoteId): Gesture {
    switch (kind) {
      case 'yawn':
        return EMOTE_GESTURES.yawn;
      case 'taunt':
        return EMOTE_GESTURES.taunt;
      case 'doze':
        return EMOTE_GESTURES.doze;
      case 'gg':
        return EMOTE_GESTURES.gg;
      case 'laugh':
        return GESTURES.laugh;
      case 'surprise':
        return EMOTE_GESTURES.surprise;
    }
  }

  private setFace(eyes: Eyes, mouth: Mouth) {
    this.faceEyes = eyes;
    this.faceMouth = mouth;
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
    const emote = f.emote;
    const motion = emote ? emoteMotion(emote.kind, emote.ageMs) : null;
    const g = emote ? this.emoteGesture(emote.kind) : GESTURES[f.gesture];
    this.emoteBubble.update(f.firstPerson ? null : (emote?.kind ?? null));
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
    // 조준·튕기기 중 오른손은 손등을 오른쪽으로 세우고 중지를 엄지에 걸었다가 튕긴다
    let flickHand = 0;
    let snap = 0;
    if (this.flickT >= 0) {
      this.flickT += dt;
      const ft = this.flickT;
      flickHand = 1;
      snap = ft >= 0.08 ? 1 : 0;
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
      flickHand = 1;
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

    R.tflick = flickHand;
    R.troll = flickHand;
    R.tsnap = snap;

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

    // 조준·발사·판 잡기·장비를 쥔 팔은 유지하고 감정표현은 얼굴·고개만 더한다.
    if (emote && motion && !f.aim && this.flickT < 0 && !f.grab && !f.hold) {
      if (emote.kind === 'gg') {
        R.tpos.x += motion.wave;
        R.tfwd.x += motion.wave * 0.2;
      }
      if (emote.kind === 'taunt') R.tcurl = motion.beckon;
    }
    // ── 얼굴: 가림 찡그림 > 위 결정
    let tear = g.tear && !f.aim;
    if (f.blind > 0.3) {
      face = f.blind > 0.6 ? BLIND_FACE_HARD : BLIND_FACE;
      tear = false;
    }
    if (emote) face = g;
    this.setFace(face.eyes, face.mouth);

    // ── 몸
    const rate = (r: number) => 1 - Math.exp(-dt * r);
    const kl = rate(this.leanRate);
    const k = rate(7);
    st.lean += (tgLean - st.lean) * kl;
    st.rise += (tgRise - st.rise) * kl;
    st.yaw += (tgYaw - st.yaw) * kl;
    const busy = !!f.aim || this.flickT >= 0 || !!f.grab;
    st.pitchAdd += ((busy && !emote ? 0 : g.pitchAdd + (motion?.pitch ?? 0)) - st.pitchAdd) * k;
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
    this.torso.rotation.set(st.lean, st.yaw, (motion?.bounce ?? 0) * 0.04, 'YXZ');

    // ── 머리 바라보기
    if (!look) {
      if (g.focusOpponent) look = f.opponentHead;
      else if (f.watch) look = f.watch;
      else {
        setV(this.lookV, 0, IDLE_LOOK.height, SEAT_GEOMETRY.anchorDistance + IDLE_LOOK.ahead);
        look = this.lookV;
      }
    }
    headCenter(this.body, this.tH);
    const la = lookAngles(this.tH, look, this.look);
    const yawL = clamp(f.lookYaw ?? la.yaw - st.yaw, -1.0, 1.0);
    const pitchL = clamp(
      (f.lookPitch !== undefined ? f.lookPitch : la.pitch - st.lean) + st.pitchAdd,
      -0.6,
      0.9,
    );
    st.hy += (yawL - st.hy) * k;
    st.hp += (pitchL - st.hp) * k;
    this.neck.rotation.set(st.hp, st.hy, st.roll + Math.sin(t * 11) * st.wobble, 'YXZ');

    // ── 깜빡임·눈물
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkT = 0.12;
      this.blinkIn = 2.5 + Math.random() * 3;
    }
    if (this.blinkT > 0) this.blinkT -= dt;
    // 얼굴 표정은 캔버스 텍스처로 그린다(같은 표정이면 다시 그리지 않는다). browUp은 cm → 얼굴 좌표
    this.avatar.setExpression({
      eyes: this.faceEyes,
      mouth: this.faceMouth,
      blink: this.blinkT > 0,
      brow: st.brow,
      browUp: st.browUp / FACE_UNIT,
      browAsym: emote?.kind === 'taunt' ? 4 : 0,
    });
    this.tear.visible = tear;
    if (tear) {
      this.tearT = (this.tearT + dt) % 0.9;
      const E = this.avatar.parts.eyes;
      const x = (E.x + E.rx * 0.4) * FACE_UNIT;
      const y = -(E.y + E.ry) * FACE_UNIT - this.tearT * 6;
      const r = RIG.headRadius + 0.5;
      this.tear.position.set(x, y, Math.sqrt(Math.max(0.5, r * r - x * x - y * y)));
    }

    // ── 방해요소 장비
    this.holdKind = f.hold?.kind ?? null;
    this.flashlight.visible = this.holdKind === 'flashlight';
    this.waterGun.visible = this.holdKind === 'water_gun';

    // ── 팔
    for (const h of this.hands) this.updateArm(h, dt, t, jitter, f);

    this.updateStunStars(!!f.stunned, t);

    // ── 1인칭·투명도
    const hide = f.firstPerson;
    this.hips.visible = !hide;
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
    this.avatar.faceMaterial.visible = op > 0.95;
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
    h.flick = damp(h.flick, h.tflick, 8, dt);
    h.roll = damp(h.roll, h.troll, 8, dt);
    // 튕기는 순간은 아주 빠르게 펴고, 다시 걸 때는 천천히 돌아온다
    h.snap = damp(h.snap, h.tsnap, h.tsnap > h.snap ? 60 : 6, dt);

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
    // 손등 방향: 위(UP)에서 roll만큼 캐릭터 오른쪽(fwd × UP)으로 세운다
    _c.set(h.fwd.x, h.fwd.y, h.fwd.z).cross(UP);
    if (_c.lengthSq() > 1e-6) _c.normalize();
    _c.multiplyScalar(h.roll).addScaledVector(UP, 1 - h.roll);
    if (_c.lengthSq() < 1e-6) _c.copy(UP);
    _m.lookAt(_a, _b, _c.normalize());
    h.hand.quaternion.setFromRotationMatrix(_m);
    h.model.pose(h.curl, h.flick, h.snap);
    placeLimb(h.upper, this.tS, this.arm.elbow);
    placeLimb(h.fore, this.arm.elbow, this.arm.wrist);
    h.elbow.position.set(this.arm.elbow.x, this.arm.elbow.y, this.arm.elbow.z);
  }

  /** 기본 시점 위쪽에 가까운 머리도 말풍선이 창 밖으로 잘리지 않게 한다. */
  layoutBubble(camera: Camera) {
    if (!this.emoteBubble.sprite.visible) return;
    const point = this.headWorld(this.bubblePoint);
    point.y += RIG.headRadius * HEAD_SCALE + 8;
    point.project(camera);
    // 위쪽 여백이 없으면 얼굴을 덮지 않도록 말풍선을 머리 옆으로 옮긴다.
    if (point.y > 0.78) point.x += point.x > 0.2 ? -0.48 : 0.48;
    point.x = clamp(point.x, -0.65, 0.65);
    point.y = clamp(point.y, -0.78, 0.78);
    point.unproject(camera);
    this.root.worldToLocal(point);
    this.emoteBubble.sprite.position.copy(point);
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
    this.avatar.dispose();
    this.emoteBubble.dispose();
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }
}
