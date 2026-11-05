// 장난감 왕국 테마 공통 도구(DEC-079·DEC-083): 원색 팔레트, 도형별 인스턴스 묶음(Batch), 곰 인형·장난감 성,
// 캔버스 반짝임, 떠다니는 마법 반짝이, 삼각 깃발 줄. 테마 파일(themes/*.ts)이 함께 쓴다.
import {
  AdditiveBlending,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Points,
  PointsMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type Group,
  type Material,
  type Texture,
} from 'three';
import { canvasTexture, festoon, type Kit } from '../stage-kit.ts';

/** 장난감 색: 로그인 일러스트·UI의 주황·보라·파랑에 맞춘 원색 */
export const TOY = [0xf07a1a, 0xffc94a, 0x3a86e8, 0x8a4ae0, 0xe2504a, 0x5bbf6a, 0xff8fb0, 0x48c6c0];
export const BEAR = [0xc98a4e, 0xe8c08a, 0xf2e6d2, 0xb06a3a];

/** 네 꼭지 반짝임(✦) */
export function sparkle(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  g.beginPath();
  g.moveTo(cx, cy - r);
  g.quadraticCurveTo(cx, cy, cx + r, cy);
  g.quadraticCurveTo(cx, cy, cx, cy + r);
  g.quadraticCurveTo(cx, cy, cx - r, cy);
  g.quadraticCurveTo(cx, cy, cx, cy - r);
  g.fill();
}

/** 반짝이 점 하나(가운데 밝은 원형 번짐) */
export function createGlintTexture(): Texture {
  return canvasTexture(64, (g, s) => {
    const c = s / 2;
    const gr = g.createRadialGradient(c, c, 0, c, c, c);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.7)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(255,255,255,0.9)';
    sparkle(g, c, c, c * 0.95);
  });
}

// ───────────────────────── 인스턴스 묶음 ─────────────────────────

/** 위치·방향을 가진 놓을 자리. 지역 좌표(앞이 +z)를 월드로 옮긴다 */
export interface Spot {
  x: number;
  y: number;
  z: number;
  yaw: number;
}

const tmpQ = new Quaternion();
const tmpE = new Euler();
const tmpM = new Matrix4();
const tmpP = new Vector3();
const tmpS = new Vector3();

/**
 * 같은 단위 도형(상자·구·원기둥·원뿔·이십면체)을 색만 달리해 여럿 놓는 묶음.
 * `flush`가 도형마다 InstancedMesh 하나를 만든다.
 */
export class Batch {
  private readonly items = new Map<string, { m: Matrix4; c: Color }[]>();

  add(
    kind: 'box' | 'sphere' | 'cyl' | 'cone' | 'ico',
    at: Spot,
    lx: number,
    ly: number,
    lz: number,
    sx: number,
    sy: number,
    sz: number,
    color: number,
    rot: [number, number, number] = [0, 0, 0],
  ) {
    const cs = Math.cos(at.yaw);
    const sn = Math.sin(at.yaw);
    tmpP.set(at.x + lx * cs + lz * sn, at.y + ly, at.z - lx * sn + lz * cs);
    tmpE.set(rot[0], at.yaw + rot[1], rot[2], 'YXZ');
    tmpQ.setFromEuler(tmpE);
    tmpS.set(sx, sy, sz);
    const list = this.items.get(kind) ?? [];
    list.push({ m: new Matrix4().compose(tmpP, tmpQ, tmpS), c: new Color(color) });
    this.items.set(kind, list);
  }

  flush(k: Kit, parent: Group) {
    const geos = {
      box: new BoxGeometry(1, 1, 1),
      sphere: new SphereGeometry(1, 16, 12),
      cyl: new CylinderGeometry(1, 1, 1, 16),
      cone: new ConeGeometry(1, 1, 12),
      ico: new IcosahedronGeometry(1, 0),
    };
    const plain = new MeshStandardMaterial({ roughness: 0.6 });
    const leaf = new MeshStandardMaterial({ roughness: 0.7, flatShading: true });
    k.mats.push(plain, leaf);
    for (const [kind, geo] of Object.entries(geos)) {
      k.geos.push(geo);
      const list = this.items.get(kind);
      if (!list?.length) continue;
      const mesh = new InstancedMesh(geo, kind === 'ico' ? leaf : plain, list.length);
      list.forEach((it, i) => {
        mesh.setMatrixAt(i, it.m);
        mesh.setColorAt(i, it.c);
      });
      parent.add(mesh);
    }
  }
}

/** 곰 인형(앉은 자세). 크기 sc=1이 높이 약 16cm */
export function teddy(
  b: Batch,
  at: Spot,
  lx: number,
  ly: number,
  lz: number,
  sc: number,
  fur: number,
) {
  const light = new Color(fur).lerp(new Color(0xfff2dc), 0.5).getHex();
  const S = (x: number, y: number, z: number, r: number, c: number, sy = r) =>
    b.add('sphere', at, lx + x * sc, ly + y * sc, lz + z * sc, r * sc, sy * sc, r * sc, c);
  S(0, 5, 0, 4.4, fur, 4.8); // 몸
  S(0, 5, 2.6, 2.8, light, 3); // 배
  S(0, 12.2, 0.4, 3.6, fur); // 머리
  S(-2.7, 15, 0, 1.4, fur);
  S(2.7, 15, 0, 1.4, fur);
  S(0, 11.4, 3.4, 1.5, light, 1.2); // 주둥이
  S(0, 12, 4.6, 0.5, 0x2a1408);
  S(-1.3, 13.2, 3.1, 0.45, 0x1a0e06);
  S(1.3, 13.2, 3.1, 0.45, 0x1a0e06);
  S(-4.2, 6.5, 1.4, 1.6, fur, 2.4); // 팔
  S(4.2, 6.5, 1.4, 1.6, fur, 2.4);
  S(-2.4, 1.6, 3.4, 1.9, fur); // 발
  S(2.4, 1.6, 3.4, 1.9, fur);
}

/** 장난감 성: 몸체·탑·고깔 지붕·깃발. 크기 sc=1이 폭 약 30cm */
export function castle(b: Batch, at: Spot, lx: number, ly: number, lz: number, sc: number) {
  const wall = 0xf3e2c0;
  const roof = [0x8a4ae0, 0x3a86e8, 0xe2504a];
  const B = (x: number, y: number, z: number, w: number, h: number, d: number, c: number) =>
    b.add('box', at, lx + x * sc, ly + y * sc, lz + z * sc, w * sc, h * sc, d * sc, c);
  B(0, 5, 0, 18, 10, 8, wall);
  B(0, 3.5, 4.05, 5, 7, 0.4, 0x6a3414); // 문
  for (let i = -2; i <= 2; i++) B(i * 4, 10.8, 0, 2, 1.6, 8, wall); // 성가퀴
  [-11, 11, 0].forEach((tx, i) => {
    const th = i === 2 ? 20 : 15;
    const tz = i === 2 ? -2 : 0;
    b.add(
      'cyl',
      at,
      lx + tx * sc,
      ly + (th / 2) * sc,
      lz + tz * sc,
      3.6 * sc,
      th * sc,
      3.6 * sc,
      wall,
    );
    b.add(
      'cone',
      at,
      lx + tx * sc,
      ly + (th + 4) * sc,
      lz + tz * sc,
      4.4 * sc,
      8 * sc,
      4.4 * sc,
      roof[i] ?? 0x8a4ae0,
    );
    b.add(
      'cyl',
      at,
      lx + tx * sc,
      ly + (th + 10) * sc,
      lz + tz * sc,
      0.2 * sc,
      4 * sc,
      0.2 * sc,
      0x5a2a10,
    );
    B(tx + 1.4, th + 11, tz, 2.6, 1.6, 0.2, 0xffc94a);
    B(tx, th / 2 + 2, 3.7 + (tz === 0 ? 0 : 0), 1.4, 2.4, 0.3, 0x3a2068); // 창
  });
}

/** 떠다니는 마법 반짝이(점 스프라이트 한 묶음). 판 위 공간을 비우도록 반경 rMin 밖에만 둔다 */
export function addSparkles(
  k: Kit,
  parent: Group,
  rnd: () => number,
  o: {
    count: number;
    rMin: number;
    rMax: number;
    yMin: number;
    yMax: number;
    size?: number;
    colors?: readonly number[];
  },
): void {
  const glint = createGlintTexture();
  k.texs.push(glint);
  const pos = new Float32Array(o.count * 3);
  const col = new Float32Array(o.count * 3);
  const palette = (o.colors ?? [0xffd36b, 0xc8a0ff, 0x9ad0ff, 0xffffff]).map((c) => new Color(c));
  for (let i = 0; i < o.count; i++) {
    const a = rnd() * Math.PI * 2;
    const r = o.rMin + rnd() * (o.rMax - o.rMin);
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = o.yMin + rnd() * (o.yMax - o.yMin);
    pos[i * 3 + 2] = Math.sin(a) * r;
    const c = palette[i % palette.length] ?? new Color(0xffffff);
    col.set([c.r, c.g, c.b], i * 3);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  k.geos.push(geo);
  const mat = new PointsMaterial({
    size: o.size ?? 5,
    map: glint,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  k.mats.push(mat);
  parent.add(new Points(geo, mat));
}

/**
 * 처지는 줄에 매단 삼각 깃발. 줄마다 [시작, 끝, 깃발 면이 향할 yaw]. 깃발 색은 `colors`를 돌려 쓴다.
 * 줄 하나가 튜브 하나, 깃발 전체가 인스턴스 하나다.
 */
export function addBunting(
  k: Kit,
  parent: Group,
  wireMat: Material,
  lines: readonly [Vector3, Vector3, number][],
  colors: readonly number[] = TOY,
  spans = 3,
  sag = 16,
  perSpan = 5,
): void {
  const flagGeo = new BufferGeometry();
  flagGeo.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([-3.4, 0, 0, 3.4, 0, 0, 0, -8, 0]), 3),
  );
  flagGeo.computeVertexNormals();
  k.geos.push(flagGeo);
  const flagMat = new MeshStandardMaterial({ roughness: 0.8, side: DoubleSide });
  k.mats.push(flagMat);
  const flags: { p: Vector3; yaw: number }[] = [];
  for (const [a, b, yaw] of lines) {
    const pts: Vector3[] = [];
    parent.add(k.mesh(festoon(a, b, spans, sag, perSpan, pts), wireMat, false, false));
    for (const p of pts) flags.push({ p: p.setY(p.y + 2.4), yaw });
  }
  const mesh = new InstancedMesh(flagGeo, flagMat, flags.length);
  flags.forEach((f, i) => {
    tmpQ.setFromEuler(tmpE.set(0, f.yaw, 0));
    mesh.setMatrixAt(i, tmpM.compose(f.p, tmpQ, tmpS.set(1, 1, 1)));
    mesh.setColorAt(i, new Color(colors[i % colors.length] ?? 0xf07a1a));
  });
  parent.add(mesh);
}
