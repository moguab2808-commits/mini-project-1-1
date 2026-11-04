// 사람 아바타 전신(서 있는 자세). 방 생성 창 왼쪽 전신에 쓴다(IMPL-019, DEC-074). 꾸미기 창 미리보기도 이 부품으로 바꿀 수 있다.
// 큰 머리·짧은 몸·공 모양 손·통짜 다리의 단순한 코드 도형이다. 머리는 게임과 같은 AvatarHead다.
// 발바닥이 원점(y = 0)이고 +Z가 얼굴 앞, +Y가 위다. 단위는 게임 리그와 같은 cm 기준값이다.
import type { Appearance } from '@alkkagi/shared';
import {
  CircleGeometry,
  CylinderGeometry,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { AvatarHand } from './avatar-hand.ts';
import { AvatarHead } from './avatar-head.ts';
import { NEUTRAL_FACE } from './face-paint.ts';

/** 옷 색(외형 항목이 아니다) */
const SHIRT = 0xe2452c;
const PANTS = 0x3b3f4a;
const SHOES = 0x2a2c33;

const HEAD_R = 8.5;
const HEAD_SCALE = 1.25;
const SHOULDER_Y = 30.5;
const SHOULDER_X = 5.3;
const ARM_LEN = 13.5;
const HIP_X = 2.9;
const LEG_TOP = 16.5;

const _m = new Matrix4();
const _x = new Vector3();
const _y = new Vector3();
const _z = new Vector3();

/** 전신 높이(정수리 근처). 카메라 맞춤에 쓴다 */
export const FIGURE_HEIGHT = 56;

export class AvatarFigure {
  readonly root = new Group();
  private readonly body = new Group();
  private readonly torso = new Group();
  private readonly headPivot = new Group();
  private readonly arms: [Group, Group] = [new Group(), new Group()];
  private readonly head: AvatarHead;
  private readonly geos: BufferGeometry[] = [];
  private readonly mats: Material[] = [];
  private blinkIn = 1.5 + Math.random() * 2;
  private blinkT = 0;

  constructor(appearance: Appearance) {
    this.head = new AvatarHead(appearance, HEAD_R);
    const skin = this.std(this.head.parts.skinTone.base, 0.7);
    const shirt = this.std(SHIRT, 0.85);
    const pants = this.std(PANTS, 0.8);
    const shoes = this.std(SHOES, 0.6);

    // 바닥 그림자
    const shadowMat = new MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
    });
    this.mats.push(shadowMat);
    const shadow = this.mesh(new CircleGeometry(9, 32), shadowMat, this.root);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.05;
    shadow.scale.set(1, 0.75, 1);

    this.root.add(this.body);

    // 다리·신발
    for (const sx of [-1, 1]) {
      const leg = this.mesh(new CylinderGeometry(2.45, 2.25, LEG_TOP - 1.2, 16), pants, this.body);
      leg.position.set(sx * HIP_X, 1.2 + (LEG_TOP - 1.2) / 2, 0);
      const shoe = this.mesh(new SphereGeometry(2.6, 16, 10), shoes, this.body);
      shoe.position.set(sx * HIP_X, 1.3, 0.9);
      shoe.scale.set(1, 0.55, 1.45);
    }

    // 몸통(엉덩이부터 어깨까지, 숨쉬기로 함께 움직인다)
    this.torso.position.y = LEG_TOP - 1;
    this.body.add(this.torso);
    const hips = this.mesh(new SphereGeometry(5.9, 20, 12), pants, this.torso);
    hips.position.y = 1.4;
    hips.scale.set(1, 0.55, 0.78);
    const trunk = this.mesh(new CylinderGeometry(4.7, 6.1, 14, 20), shirt, this.torso);
    trunk.position.y = 7.6;
    trunk.scale.z = 0.78;
    const chest = this.mesh(
      new SphereGeometry(4.7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
      shirt,
      this.torso,
    );
    chest.position.y = 14.6;
    chest.scale.set(1.12, 0.55, 0.8);

    // 팔: 어깨에서 늘어진 소매와 공 모양 손
    const shoulderY = SHOULDER_Y - this.torso.position.y;
    this.arms.forEach((arm, i) => {
      const sx = i === 0 ? -1 : 1;
      arm.position.set(sx * SHOULDER_X, shoulderY, 0);
      this.torso.add(arm);
      this.mesh(new SphereGeometry(2.15, 12, 10), shirt, arm);
      const sleeve = this.mesh(new CylinderGeometry(2.05, 1.8, ARM_LEN, 12), shirt, arm);
      sleeve.position.y = -ARM_LEN / 2;
      // 손가락 다섯 개 손: 손가락이 아래, 손등이 바깥, 엄지가 앞을 향해 허벅지 옆에 늘어진다
      const hand = new AvatarHand(sx === -1 ? -1 : 1, skin, this.geos, 0.95);
      hand.pose(0.35);
      hand.group.position.y = -ARM_LEN - 0.6;
      _m.makeBasis(_x.set(0, 0, -sx), _y.set(sx, 0, 0), _z.set(0, -1, 0));
      hand.group.quaternion.setFromRotationMatrix(_m);
      arm.add(hand.group);
    });

    // 목·머리
    const neck = this.mesh(new CylinderGeometry(2.3, 2.6, 3, 12), skin, this.torso);
    neck.position.y = shoulderY + 1.2;
    this.headPivot.position.y = shoulderY + 2.2;
    this.torso.add(this.headPivot);
    const h = this.head.group;
    h.scale.setScalar(HEAD_SCALE);
    h.position.y = HEAD_R * HEAD_SCALE * 0.88;
    this.headPivot.add(h);
  }

  /** 쉬는 동작(숨쉬기·팔 흔들기·고개 기울이기·눈 깜빡임). t는 초 */
  update(t: number, dt: number) {
    const breath = Math.sin(t * 2.1);
    this.torso.scale.set(1 + breath * 0.008, 1 + breath * 0.012, 1);
    this.arms.forEach((arm, i) => {
      const sx = i === 0 ? -1 : 1;
      arm.rotation.z = sx * (0.2 + Math.sin(t * 1.3 + i * 1.7) * 0.035);
      arm.rotation.x = Math.sin(t * 1.1 + i) * 0.05;
    });
    this.headPivot.rotation.z = Math.sin(t * 0.7) * 0.06;
    this.headPivot.rotation.x = Math.sin(t * 0.5 + 1) * 0.03;
    this.body.position.y = Math.max(0, breath) * 0.12;

    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkT = 0.12;
      this.blinkIn = 2 + Math.random() * 3;
    }
    this.blinkT = Math.max(0, this.blinkT - dt);
    this.head.setExpression({ ...NEUTRAL_FACE, blink: this.blinkT > 0 });
  }

  dispose() {
    this.head.dispose();
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }

  private std(color: number | string, roughness: number): MeshStandardMaterial {
    const m = new MeshStandardMaterial({ color, roughness });
    this.mats.push(m);
    return m;
  }

  private mesh(geo: BufferGeometry, mat: Material, parent: Group): Mesh {
    this.geos.push(geo);
    const m = new Mesh(geo, mat);
    parent.add(m);
    return m;
  }
}
