// 사람 아바타 손: 손바닥 + 손가락 다섯 개(모두 2마디). 지금은 전신(avatar-figure.ts)이 쓴다. 게임 리그(characters.ts)로 옮기는 것은 별도 작업이다.
// 손 로컬 좌표: +Z가 손가락 끝 방향, +Y가 손등, −Y가 손바닥이다. 오른손(side −1)은 엄지가 +X, 왼손은 −X에 있다.
// 손가락은 마디마다 X축으로 굽히며 양수가 손바닥 쪽이다.
import {
  CylinderGeometry,
  Group,
  Mesh,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';

interface Finger {
  base: Group;
  mid: Group;
}

/** 검지·중지·약지·새끼의 [밑 위치 x(엄지 쪽 +), 첫 마디, 둘째 마디, 굵기] */
const FINGERS: [number, number, number, number][] = [
  [1.3, 1.45, 1.15, 0.5],
  [0.45, 1.6, 1.3, 0.52],
  [-0.45, 1.45, 1.15, 0.48],
  [-1.25, 1.1, 0.95, 0.42],
];
const FINGER_Y = 0.15;
const baseZ = (x: number) => 1.75 - Math.abs(x) * 0.25;

/** 튕길 준비 자세의 마디 각도 [첫 마디, 둘째 마디]: 검지는 느슨히 펴고 중지는 엄지에 걸고 약지·새끼는 만다 */
const HOOK: [number, number][] = [
  [0.35, 0.4],
  [0.9, 1.3],
  [1.0, 1.2],
  [1.1, 1.3],
];
/** 튕긴 뒤 중지(앞으로 쭉 편다) */
const SNAP: [number, number] = [-0.15, 0];

const THUMB_BASE = new Vector3(1.75, -0.35, 0.2);
const THUMB_FLICK_BASE = new Vector3(1.6, -0.45, 0.6);
const THUMB_LEN = 1.35 + 1.15;

const Z = new Vector3(0, 0, 1);
const _d = new Vector3();
const _t = new Vector3();
const _q = new Quaternion();

export class AvatarHand {
  readonly group = new Group();
  private readonly fingers: Finger[] = [];
  private readonly thumb: Finger;
  /** 엄지 쪽 부호(손 로컬 X) */
  private readonly ts: number;
  private readonly restThumb: Vector3;
  private readonly curlThumb: Vector3;
  /** 튕길 준비 때 엄지 밑 위치와 방향(굽힌 중지 손톱을 누른다) */
  private readonly flickBase: Vector3;
  private readonly flickThumb: Vector3;
  private readonly thumbBase: Vector3;

  /**
   * side: 오른손 −1, 왼손 +1(게임 리그와 같다). geos는 만든 도형을 모아 호출한 쪽이 지운다.
   */
  constructor(side: -1 | 1, mat: Material, geos: BufferGeometry[], scale = 1) {
    const ts = -side;
    this.ts = ts;
    this.group.scale.setScalar(scale);
    const mesh = (geo: BufferGeometry, parent: Group) => {
      geos.push(geo);
      const m = new Mesh(geo, mat);
      parent.add(m);
      return m;
    };
    const palm = mesh(new SphereGeometry(2.2, 16, 12), this.group);
    palm.scale.set(1, 0.6, 1.05);

    const segment = (parent: Group, len: number, r: number, tip: boolean) => {
      const s = mesh(new CylinderGeometry(r * 0.95, r, len, 8), parent);
      s.rotation.x = Math.PI / 2;
      s.position.z = len / 2;
      mesh(new SphereGeometry(r * (tip ? 0.98 : 1.02), 8, 6), parent).position.z = tip ? len : 0;
    };
    const finger = (x: number, y: number, z: number, l1: number, l2: number, r: number) => {
      const base = new Group();
      base.position.set(x, y, z);
      this.group.add(base);
      segment(base, l1, r, false);
      const mid = new Group();
      mid.position.z = l1;
      base.add(mid);
      segment(mid, l2, r * 0.95, true);
      return { base, mid };
    };
    for (const [x, l1, l2, r] of FINGERS) {
      this.fingers.push(finger(ts * x, FINGER_Y, baseZ(x), l1, l2, r));
    }
    this.thumbBase = new Vector3(ts * THUMB_BASE.x, THUMB_BASE.y, THUMB_BASE.z);
    this.thumb = finger(this.thumbBase.x, this.thumbBase.y, this.thumbBase.z, 1.35, 1.15, 0.58);
    this.restThumb = new Vector3(ts * 0.55, -0.3, 0.78).normalize();
    this.curlThumb = new Vector3(-ts * 0.35, -0.75, 0.55).normalize();

    // 걸어 둔 중지 끝마디의 손톱 위(손톱 바깥쪽으로 손가락 굵기만큼)를 엄지 끝이 누른다
    const [mx, l1, l2, r] = FINGERS[1]!;
    const [a1, a2] = HOOK[1]!;
    const th = a1 + a2;
    const joint = new Vector3(ts * mx, FINGER_Y - l1 * Math.sin(a1), baseZ(mx) + l1 * Math.cos(a1));
    const nail = new Vector3(0, Math.cos(th), Math.sin(th));
    const press = joint
      .clone()
      .add(new Vector3(0, -Math.sin(th), Math.cos(th)).multiplyScalar(l2 * 0.6))
      .addScaledVector(nail, r + 0.5);
    this.flickBase = new Vector3(ts * THUMB_FLICK_BASE.x, THUMB_FLICK_BASE.y, THUMB_FLICK_BASE.z);
    // 엄지 길이만큼 떨어진 곳에서 끝이 손톱에 닿도록 밑동을 맞춘다
    this.flickThumb = press.clone().sub(this.flickBase).normalize();
    this.flickBase.copy(press).addScaledVector(this.flickThumb, -(THUMB_LEN + 0.55));
  }

  /**
   * 손 모양. curl은 네 손가락을 함께 굽히는 정도(음수면 젖힘, 기존 한 손가락 값과 같은 범위),
   * flick 0~1은 중지를 엄지에 걸어 튕길 준비, snap 0~1은 걸었던 중지를 앞으로 튕겨 편 정도다.
   */
  pose(curl: number, flick = 0, snap = 0) {
    const c = Math.max(-0.4, Math.min(1.9, curl));
    this.fingers.forEach((f, i) => {
      let a = c * 0.85;
      let b = c * 1.1;
      const [h1, h2] = HOOK[i]!;
      a += (h1 - a) * flick;
      b += (h2 - b) * flick;
      if (i === 1) {
        a += (SNAP[0] - a) * snap;
        b += (SNAP[1] - b) * snap;
      }
      f.base.rotation.x = a;
      f.mid.rotation.x = b;
    });
    // 엄지: 쉬기(앞·바깥) → 쥐기(손바닥 아래) → 튕길 준비(중지 손톱을 누른 채 튕겨도 그 자리)
    const k = Math.max(0, Math.min(1, c / 1.6));
    _d.copy(this.restThumb).lerp(this.curlThumb, k);
    _d.lerp(this.flickThumb, flick).normalize();
    _q.setFromUnitVectors(Z, _d);
    this.thumb.base.quaternion.copy(_q);
    _t.copy(this.thumbBase).lerp(this.flickBase, flick);
    this.thumb.base.position.copy(_t);
    this.thumb.mid.rotation.x = (0.25 + k * 0.4) * (1 - flick);
  }
}
