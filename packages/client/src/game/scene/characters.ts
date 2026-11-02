// 동물 캐릭터 6종: 로우폴리 코드 도형. 로컬 좌표는 원점이 책상 윗면 높이의 의자 중심이고 얼굴은 +Z를 본다.
import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';

export type CharacterId = 'bear' | 'cat' | 'fox' | 'rabbit' | 'owl' | 'frog';

interface Palette {
  fur: number;
  belly: number;
  shirt: number;
  inner: number;
}

const PALETTES: Record<CharacterId, Palette> = {
  bear: { fur: 0x8a5a3a, belly: 0xd9b38c, shirt: 0x3f6fb5, inner: 0xc08a64 },
  cat: { fur: 0x9aa0a8, belly: 0xe6e2dc, shirt: 0xc7506a, inner: 0xf0a3b0 },
  fox: { fur: 0xd9702a, belly: 0xf6efe4, shirt: 0x2f7f6a, inner: 0x2a1a12 },
  rabbit: { fur: 0xf2eeee, belly: 0xffffff, shirt: 0x8a62c4, inner: 0xf6b5c4 },
  owl: { fur: 0x8b6b4a, belly: 0xd9c19a, shirt: 0xd09a2f, inner: 0xe9a53a },
  frog: { fur: 0x6fbf4a, belly: 0xd8efb0, shirt: 0xd8503a, inner: 0xe27a86 },
};

const UP = new Vector3(0, 1, 0);

/** 캐릭터가 의자에 앉는 높이(책상 윗면 기준 cm) */
export const SEAT_Y = -26;

export interface CharacterBuild {
  root: Group;
  dispose: () => void;
}

export function buildCharacter(id: CharacterId): CharacterBuild {
  const pal = PALETTES[id];
  const geos: BufferGeometry[] = [];
  const mats: Material[] = [];
  const mat = (color: number, rough = 0.8) => {
    const m = new MeshStandardMaterial({ color, roughness: rough, flatShading: true });
    mats.push(m);
    return m;
  };
  const mesh = <G extends BufferGeometry>(geo: G, m: Material, parent: Object3D) => {
    geos.push(geo);
    const o = new Mesh(geo, m);
    o.castShadow = true;
    o.receiveShadow = true;
    parent.add(o);
    return o;
  };

  const fur = mat(pal.fur);
  const belly = mat(pal.belly);
  const shirt = mat(pal.shirt, 0.9);
  const inner = mat(pal.inner);
  const dark = mat(0x16100c, 0.4);
  const white = mat(0xffffff, 0.4);

  const root = new Group();

  // 의자
  const stoolM = mat(0x3b3b44, 0.5);
  mesh(new CylinderGeometry(9, 9, 2.4, 20), stoolM, root).position.set(0, SEAT_Y - 1.2, 0);
  mesh(new CylinderGeometry(1.4, 1.6, 22, 8), stoolM, root).position.set(0, SEAT_Y - 13, 0);
  mesh(new CylinderGeometry(8, 8, 1.2, 16), stoolM, root).position.set(0, -75.4, 0);

  // 몸통: 앞으로 살짝 숙인다
  const torso = new Group();
  torso.position.set(0, SEAT_Y, 0);
  torso.rotation.x = 0.22;
  root.add(torso);
  mesh(new CylinderGeometry(9.5, 11.5, 30, 12), shirt, torso).position.set(0, 15, 0);
  mesh(new SphereGeometry(8.2, 10, 8), belly, torso).position.set(0, 14, 5.2);

  // 머리
  const head = new Group();
  head.position.set(0, 38, 3);
  torso.add(head);
  const skull = mesh(new IcosahedronGeometry(10, 1), fur, head);
  skull.scale.set(1.05, 0.95, 1);
  const eyeBall = (x: number, y: number, z: number, r = 1.5, m: Material = dark) => {
    mesh(new SphereGeometry(r, 8, 6), m, head).position.set(x, y, z);
  };
  const cone = (r: number, h: number, m: Material, x: number, y: number, z: number, rz = 0) => {
    const c = mesh(new ConeGeometry(r, h, 6), m, head);
    c.position.set(x, y, z);
    c.rotation.z = rz;
    return c;
  };

  switch (id) {
    case 'bear':
      for (const sx of [-1, 1]) {
        mesh(new SphereGeometry(3.6, 8, 6), fur, head).position.set(sx * 7.6, 8.4, -1);
        mesh(new SphereGeometry(2.1, 8, 6), inner, head).position.set(sx * 7.6, 8.4, 0.6);
        eyeBall(sx * 3.8, 2, 9);
      }
      mesh(new SphereGeometry(4.4, 10, 8), belly, head).position.set(0, -2.6, 8.4);
      eyeBall(0, -0.6, 12.2, 1.5);
      break;
    case 'cat':
      for (const sx of [-1, 1]) {
        cone(3.6, 7, fur, sx * 6.2, 10, 0, -sx * 0.25);
        cone(2, 4.6, inner, sx * 6.2, 9.4, 1.4, -sx * 0.25);
        eyeBall(sx * 3.8, 2, 9, 1.4);
        for (const dy of [-0.9, 0.9]) {
          const w = mesh(new BoxGeometry(7, 0.18, 0.18), white, head);
          w.position.set(sx * 10.5, -3 + dy, 8);
          w.rotation.z = sx * dy * 0.12;
        }
      }
      eyeBall(0, -1.2, 10.2, 1.2, inner);
      break;
    case 'fox':
      for (const sx of [-1, 1]) {
        cone(3.8, 9, fur, sx * 6, 11, -0.5, -sx * 0.2);
        cone(2, 5, dark, sx * 6, 10.6, 0.8, -sx * 0.2);
        eyeBall(sx * 3.8, 2.4, 8.8, 1.3);
      }
      {
        const snout = mesh(new ConeGeometry(4.6, 9, 6), belly, head);
        snout.rotation.x = Math.PI / 2;
        snout.position.set(0, -2.2, 11);
        eyeBall(0, -1.4, 15.4, 1.3);
      }
      break;
    case 'rabbit':
      for (const sx of [-1, 1]) {
        const ear = mesh(new CylinderGeometry(2.4, 2.8, 15, 8), fur, head);
        ear.position.set(sx * 4.2, 17, -1);
        ear.rotation.z = -sx * 0.12;
        const ein = mesh(new CylinderGeometry(1.3, 1.7, 12, 8), inner, head);
        ein.position.set(sx * 4.2, 17, 0.6);
        ein.rotation.z = -sx * 0.12;
        eyeBall(sx * 3.8, 2, 9, 1.5);
      }
      eyeBall(0, -1.2, 10.4, 1.2, inner);
      mesh(new BoxGeometry(2.2, 2.6, 0.8), white, head).position.set(0, -4.2, 9.8);
      break;
    case 'owl':
      for (const sx of [-1, 1]) {
        cone(2.2, 5, fur, sx * 6.4, 10, -1, -sx * 0.3);
        mesh(new SphereGeometry(3.7, 10, 8), white, head).position.set(sx * 4.2, 2.2, 7.6);
        eyeBall(sx * 4.2, 2.2, 10.9, 2);
      }
      {
        const beak = mesh(new ConeGeometry(1.8, 4, 4), inner, head);
        beak.rotation.x = Math.PI / 2;
        beak.position.set(0, -1.6, 11.5);
      }
      break;
    case 'frog':
      for (const sx of [-1, 1]) {
        mesh(new SphereGeometry(3.8, 10, 8), fur, head).position.set(sx * 5.6, 8.6, 3);
        eyeBall(sx * 5.6, 9, 6.3, 2.4, white);
        eyeBall(sx * 5.6, 9, 8.3, 1.4);
      }
      mesh(new BoxGeometry(12, 0.5, 0.5), dark, head).position.set(0, -3.2, 9.2);
      mesh(new SphereGeometry(1.1, 6, 4), dark, head).position.set(0, 0.5, 9.8);
      break;
  }

  // 팔: 어깨에서 책상 위 손까지. 손은 판 가장자리 쪽 책상 위에 놓인다.
  const placeLimb = (m: Mesh, a: Vector3, b: Vector3) => {
    const v = b.clone().sub(a);
    const len = v.length();
    m.position.copy(a).addScaledVector(v, 0.5);
    m.quaternion.copy(new Quaternion().setFromUnitVectors(UP, v.divideScalar(len || 1)));
    m.scale.set(1, len, 1);
  };
  for (const sx of [-1, 1]) {
    const shoulder = new Vector3(sx * 11.5, 5, 6);
    const hand = new Vector3(sx * 9, 1.5, 29);
    const upper = mesh(new CylinderGeometry(3.2, 2.8, 1, 8), shirt, root);
    placeLimb(upper, shoulder, new Vector3(sx * 10.5, 0, 17));
    const fore = mesh(new CylinderGeometry(2.7, 2.4, 1, 8), fur, root);
    placeLimb(fore, new Vector3(sx * 10.5, 0, 17), hand);
    mesh(new SphereGeometry(3.1, 8, 6), fur, root).position.copy(hand);
  }
  // 몸통 기준으로 어깨를 맞추기 위해 팔은 root에 직접 붙였으므로 Y 보정은 좌표에 포함되어 있다.

  return {
    root,
    dispose: () => {
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
    },
  };
}
