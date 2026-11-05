// 추가 방해요소 10종의 판 위 표시(자석·중력 구역·미끄럼 장판·방향 반전·폭탄·구멍·이동 장애물 경로·분신술 허상).
// 모두 장난감 왕국 화풍(DEC-080·DEC-081)이다. 파일 에셋 없이 코드 도형과 canvas 텍스처만 쓴다. 객체는 종류별로 한 번 만들어 재사용하고 프레임마다 값만 바꾼다.
// 회전 그룹 안에 들어가므로 위치는 서버 좌표(X=x, Z=-y)이고 rotation.y는 서버 좌표계 각(반시계)이다.
// 이동 장애물 본체는 `HazardLayer`의 벽으로 그린다(GameScene이 `movingWallAt`으로 위치를 계산).
import { HAZARD_TUNING, PHYSICS } from '@alkkagi/shared';
import {
  AdditiveBlending,
  CanvasTexture,
  CatmullRomCurve3,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  SRGBColorSpace,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import { flatArrowGeometry } from './arrow-geometry.ts';
import { STONE_REST_Y } from './layers.ts';

export type ZoneKind =
  | 'magnet'
  | 'gravity_zone'
  | 'ice_floor'
  | 'reverse_zone'
  | 'mine'
  | 'pit'
  | 'moving_track'
  | 'decoy';

export interface ZoneDraw {
  kind: ZoneKind;
  x: number;
  y: number;
  /** 중력 구역: 정사각형 각, 이동 장애물 경로: 벽 각(라디안) */
  angle: number;
  /** 중력 구역 방향(라디안) */
  dir: number;
  /** 설치 후 경과(초) */
  age: number;
}

const T = HAZARD_TUNING;
const R = PHYSICS.stoneRadius;
/** 판 윗면 바로 위(끈끈이 원판 0.25 아래) */
const FLOOR_Y = 0.06;

interface Pool {
  make: () => Group;
  items: Group[];
  used: number;
}

/** 0→1 등장 */
function grow(age: number, sec = 0.35): number {
  return Math.min(1, Math.max(0.01, age / sec));
}

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Texture {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (g) draw(g);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** 결정적 난수(무늬를 실행마다 같게) */
function rng(seed: number) {
  let v = seed >>> 0;
  return () => {
    v = (Math.imul(v, 1664525) + 1013904223) >>> 0;
    return v / 4294967296;
  };
}

/** 자석 블랙홀 원판: 가장자리 투명 → 보라 → 짙은 남색 → 검은 중심 */
function vortexBaseTexture(): Texture {
  return canvasTex(256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(0,0,0,1)');
    gr.addColorStop(0.16, 'rgba(10,4,30,1)');
    gr.addColorStop(0.4, 'rgba(40,8,120,1)');
    gr.addColorStop(0.75, 'rgba(110,30,220,0.85)');
    gr.addColorStop(0.92, 'rgba(140,50,240,0.5)');
    gr.addColorStop(1, 'rgba(140,50,240,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
  });
}

/** 소용돌이 팔(더해지는 빛): 중심으로 감겨 드는 나선 다섯 줄과 점 */
function vortexArmsTexture(): Texture {
  return canvasTex(256, 256, (g) => {
    const rnd = rng(17);
    for (let arm = 0; arm < 5; arm++) {
      const a0 = (arm / 5) * Math.PI * 2;
      for (let i = 0; i < 70; i++) {
        const t = i / 70;
        const r = 120 * (1 - t) + 14;
        const a = a0 + t * Math.PI * 2.4;
        const w = 9 * (1 - t) + 2;
        g.fillStyle = `rgba(${arm % 2 ? '60,140,255' : '190,80,255'},${0.16 + t * 0.4})`;
        g.beginPath();
        g.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, w, 0, Math.PI * 2);
        g.fill();
      }
    }
    for (let i = 0; i < 60; i++) {
      const a = rnd() * Math.PI * 2;
      const r = 20 + rnd() * 100;
      g.fillStyle = `rgba(255,255,255,${0.4 + rnd() * 0.6})`;
      g.beginPath();
      g.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 0.8 + rnd() * 1.6, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** 폭탄 몸체: 반짝이는 검은 공의 양옆(정면·뒷면)에 흰 해골 */
function bombTexture(): Texture {
  return canvasTex(256, 128, (g) => {
    g.fillStyle = '#17151c';
    g.fillRect(0, 0, 256, 128);
    for (const cx of [64, 192]) {
      const cy = 62;
      g.fillStyle = '#f4f0e6';
      g.beginPath();
      g.arc(cx, cy - 6, 17, 0, Math.PI * 2);
      g.fill();
      g.fillRect(cx - 10, cy + 4, 20, 14);
      g.fillStyle = '#17151c';
      g.beginPath();
      g.arc(cx - 7, cy - 6, 5.5, 0, Math.PI * 2);
      g.arc(cx + 7, cy - 6, 5.5, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(cx, cy + 0);
      g.lineTo(cx - 3, cy + 5);
      g.lineTo(cx + 3, cy + 5);
      g.fill();
      g.fillRect(cx - 4.5, cy + 10, 2, 8);
      g.fillRect(cx + 2.5, cy + 10, 2, 8);
    }
  });
}

/** 구멍 속: 별이 박힌 깊은 밤하늘 우물(가장자리로 갈수록 보랏빛) */
function voidTexture(): Texture {
  return canvasTex(256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, '#000000');
    gr.addColorStop(0.45, '#0a0828');
    gr.addColorStop(0.85, '#2a1080');
    gr.addColorStop(1, '#5a24c0');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    const rnd = rng(29);
    for (let i = 0; i < 90; i++) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * 118;
      g.fillStyle = `rgba(${rnd() < 0.5 ? '255,240,200' : '190,210,255'},${0.3 + rnd() * 0.7})`;
      g.beginPath();
      g.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 0.6 + rnd() * 1.4, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** 판이 깨진 듯한 들쭉날쭉한 나무 테(안쪽은 구멍 반지름의 원) */
function jaggedRimGeometry(inner: number, outer: number, seed: number): ShapeGeometry {
  const rnd = rng(seed);
  const shape = new Shape();
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = i % 2 === 0 ? outer * (0.92 + rnd() * 0.12) : outer * (0.78 + rnd() * 0.1);
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  const hole = new Shape();
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  return new ShapeGeometry(shape, 24);
}

/** 중력 구역 바닥: 짙은 파랑 바탕, 빛나는 이중 테두리, 금빛 모서리 마름모, 옅은 화살 무늬 */
function gravityTexture(): Texture {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = 'rgba(20,70,210,0.42)';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(120,210,255,0.95)';
    g.lineWidth = 7;
    g.strokeRect(10, 10, 236, 236);
    g.strokeStyle = 'rgba(120,210,255,0.5)';
    g.lineWidth = 3;
    g.strokeRect(24, 24, 208, 208);
    g.fillStyle = '#ffcf3a';
    for (const [x, y] of [
      [14, 14],
      [242, 14],
      [14, 242],
      [242, 242],
    ] as const) {
      g.beginPath();
      g.moveTo(x, y - 12);
      g.lineTo(x + 12, y);
      g.lineTo(x, y + 12);
      g.lineTo(x - 12, y);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = 'rgba(170,230,255,0.22)';
    g.lineWidth = 6;
    for (let y = 56; y < 220; y += 48) {
      for (let x = 50; x < 220; x += 52) {
        g.beginPath();
        g.moveTo(x, y - 12);
        g.lineTo(x + 14, y);
        g.lineTo(x, y + 12);
        g.stroke();
      }
    }
  });
}

/** 미끄럼 장판: 가운데 밝고 가장자리 짙은 얼음, 금 간 결, 가운데 눈송이 */
function iceTexture(): Texture {
  return canvasTex(256, 256, (g) => {
    const gr = g.createRadialGradient(110, 100, 10, 128, 128, 128);
    gr.addColorStop(0, 'rgba(210,245,255,1)');
    gr.addColorStop(0.5, 'rgba(70,180,250,1)');
    gr.addColorStop(1, 'rgba(20,100,220,1)');
    g.fillStyle = gr;
    g.beginPath();
    g.arc(128, 128, 128, 0, Math.PI * 2);
    g.fill();
    const rnd = rng(41);
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      let x = 128 + (rnd() - 0.5) * 200;
      let y = 128 + (rnd() - 0.5) * 200;
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 4; k++) {
        x += (rnd() - 0.5) * 50;
        y += (rnd() - 0.5) * 50;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 5;
    g.lineCap = 'round';
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      const ex = 128 + Math.cos(a) * 34;
      const ey = 128 + Math.sin(a) * 34;
      g.beginPath();
      g.moveTo(128, 128);
      g.lineTo(ex, ey);
      for (const sgn of [1, -1]) {
        const mx = 128 + Math.cos(a) * 22;
        const my = 128 + Math.sin(a) * 22;
        g.moveTo(mx, my);
        g.lineTo(mx + Math.cos(a + sgn * 0.8) * 10, my + Math.sin(a + sgn * 0.8) * 10);
      }
      g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(128, 128, 122, 0, Math.PI * 2);
    g.stroke();
  });
}

/** 방향 반전 마법진: 분홍·보라 원 두 겹, 글자 고리, 서로 반대로 도는 굽은 화살 둘 */
function reverseTexture(): Texture {
  return canvasTex(256, 256, (g) => {
    const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    gr.addColorStop(0, 'rgba(230,50,170,0.45)');
    gr.addColorStop(0.8, 'rgba(130,30,200,0.6)');
    gr.addColorStop(0.97, 'rgba(130,30,200,0.5)');
    gr.addColorStop(1, 'rgba(130,30,200,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(240,60,190,1)';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(128, 128, 118, 0, Math.PI * 2);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.arc(128, 128, 96, 0, Math.PI * 2);
    g.stroke();
    // 글자 고리: 짧은 획과 점
    g.fillStyle = 'rgba(255,200,245,1)';
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      g.save();
      g.translate(128 + Math.cos(a) * 107, 128 + Math.sin(a) * 107);
      g.rotate(a);
      if (k % 3 === 0) g.fillRect(-1.5, -6, 3, 12);
      else g.fillRect(-4, -1.5, 8, 3);
      g.restore();
    }
    // 굽은 화살 둘(시계·반시계)
    g.strokeStyle = '#ffffff';
    g.fillStyle = '#ffffff';
    g.lineWidth = 9;
    g.lineCap = 'round';
    for (const [a0, dir] of [
      [-0.3, 1],
      [Math.PI - 0.3, 1],
    ] as const) {
      const r = 60;
      const a1 = a0 + dir * 1.9;
      g.beginPath();
      g.arc(128, 128, r, a0, a1);
      g.stroke();
      const hx = 128 + Math.cos(a1) * r;
      const hy = 128 + Math.sin(a1) * r;
      const tx = -Math.sin(a1);
      const ty = Math.cos(a1);
      g.beginPath();
      g.moveTo(hx + tx * 16, hy + ty * 16);
      g.lineTo(hx + Math.cos(a1) * 13, hy + Math.sin(a1) * 13);
      g.lineTo(hx - Math.cos(a1) * 13, hy - Math.sin(a1) * 13);
      g.closePath();
      g.fill();
    }
  });
}

/** 이동 장애물 경로: 양옆 금빛 레일과 왕복을 뜻하는 주황 줄무늬 */
function trackTexture(): Texture {
  return canvasTex(256, 128, (g) => {
    g.fillStyle = 'rgba(240,110,30,0.22)';
    g.fillRect(0, 0, 256, 128);
    g.fillStyle = 'rgba(255,140,40,0.55)';
    for (let x = -64; x < 300; x += 32) {
      g.beginPath();
      g.moveTo(x, 18);
      g.lineTo(x + 14, 18);
      g.lineTo(x + 30, 110);
      g.lineTo(x + 16, 110);
      g.closePath();
      g.fill();
    }
    g.fillStyle = 'rgba(255,205,70,0.95)';
    g.fillRect(0, 4, 256, 10);
    g.fillRect(0, 114, 256, 10);
  });
}

/** 자석 소용돌이로 빨려 드는 빛 알갱이 수 */
const MOTES = 16;

export class ZoneLayer {
  readonly group = new Group();
  private readonly geos: BufferGeometry[] = [];
  private readonly mats: Material[] = [];
  private readonly texs: Texture[] = [];
  private readonly pools = new Map<ZoneKind, Pool>();

  constructor() {
    const g = <G extends BufferGeometry>(geo: G): G => {
      this.geos.push(geo);
      return geo;
    };
    const m = <M extends Material>(mat: M): M => {
      this.mats.push(mat);
      return mat;
    };
    const flat = (geo: BufferGeometry) => {
      geo.rotateX(-Math.PI / 2);
      return geo;
    };
    /** 밝은 판 위에서 하얗게 바래지 않도록 더하지 않고 덮는 반투명 */
    const tint = (color: number, opacity: number, map?: Texture) =>
      m(
        new MeshBasicMaterial({
          color,
          map: map ?? null,
          transparent: true,
          opacity,
          depthWrite: false,
        }),
      );
    const tx = (t: Texture) => {
      this.texs.push(t);
      return t;
    };
    const glow = (color: number, opacity: number, map?: Texture) =>
      m(
        new MeshBasicMaterial({
          color,
          map: map ?? null,
          transparent: true,
          opacity,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      );

    // 자석(DEC-068 블랙홀): 보라 소용돌이 원판 + 감겨 도는 빛 팔 + 검은 핵과 빛 고리 + 빨려 드는 빛 알갱이
    const mr = T.magnetRadius;
    const vortexDisc = g(flat(new CircleGeometry(mr, 48)));
    const vortexMat = m(
      new MeshBasicMaterial({ map: tx(vortexBaseTexture()), transparent: true, depthWrite: false }),
    );
    const armsMat = glow(0xffffff, 0.75, tx(vortexArmsTexture()));
    const magnetRing = g(flat(new RingGeometry(mr - 0.3, mr, 48)));
    const magnetRingMat = glow(0x9a6aff, 0.6);
    const coreGeo = g(new SphereGeometry(1.3, 20, 12));
    const coreMat = m(new MeshBasicMaterial({ color: 0x050208 }));
    const haloGeo = g(new TorusGeometry(1.6, 0.28, 8, 40));
    const haloMat = glow(0xb070ff, 1);
    const moteGeo = g(new SphereGeometry(0.22, 6, 4));
    const moteMats = [glow(0xe0c8ff, 1), glow(0x9ad0ff, 1), glow(0xffffff, 1)];
    this.pool('magnet', () => {
      const grp = new Group();
      const disc = new Mesh(vortexDisc, vortexMat);
      disc.position.y = FLOOR_Y;
      disc.name = 'swirl';
      const arms = new Mesh(vortexDisc, armsMat);
      arms.position.y = FLOOR_Y + 0.02;
      arms.name = 'arms';
      const ring = new Mesh(magnetRing, magnetRingMat);
      ring.position.y = FLOOR_Y + 0.03;
      ring.name = 'pulse';
      const core = new Mesh(coreGeo, coreMat);
      core.position.y = 0.25;
      core.scale.y = 0.35;
      const halo = new Mesh(haloGeo, haloMat);
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.35;
      halo.name = 'halo';
      const motes = new Group();
      motes.name = 'motes';
      for (let k = 0; k < MOTES; k++) {
        const mo = new Mesh(moteGeo, moteMats[k % moteMats.length] ?? haloMat);
        mo.userData.phase = k / MOTES + ((k * 7) % 5) * 0.037;
        mo.userData.a0 = k * 2.4;
        motes.add(mo);
      }
      grp.add(disc, arms, ring, core, halo, motes);
      return grp;
    });

    // 중력 구역(DEC-081): 짙은 파랑 마법 바닥(이중 빛 테·금빛 모서리) + 판 평면에 눕힌 빛나는 큰 화살표와 흐르는 작은 화살표 2개(DEC-071 ①)
    const half = T.gravityZoneSize / 2;
    const zoneGeo = g(flat(new PlaneGeometry(T.gravityZoneSize, T.gravityZoneSize)));
    const zoneEdge = g(flat(new RingGeometry(half * 1.38, half * 1.414, 4, 1, Math.PI / 4)));
    const bigArrow = g(flatArrowGeometry(T.gravityZoneSize * 0.62, T.gravityZoneSize * 0.36));
    const smallArrow = g(flatArrowGeometry(2.6, 1.6));
    const zoneMat = m(
      new MeshBasicMaterial({ map: tx(gravityTexture()), transparent: true, depthWrite: false }),
    );
    const zoneEdgeMat = glow(0x5ac8ff, 0.7);
    const bigArrowMat = glow(0x8adcff, 0.9);
    const smallArrowMat = glow(0xffffff, 0.7);
    this.pool('gravity_zone', () => {
      const grp = new Group();
      const plane = new Mesh(zoneGeo, zoneMat);
      plane.position.y = FLOOR_Y;
      const edge = new Mesh(zoneEdge, zoneEdgeMat);
      edge.position.y = FLOOR_Y + 0.01;
      edge.name = 'square';
      plane.name = 'squarePlane';
      const dir = new Group();
      dir.name = 'dir';
      const big = new Mesh(bigArrow, bigArrowMat);
      big.position.y = FLOOR_Y + 0.02;
      big.name = 'big';
      const flow = new Group();
      flow.name = 'flow';
      for (const side of [1, -1]) {
        const c = new Mesh(smallArrow, smallArrowMat);
        c.position.set(0, FLOOR_Y + 0.03, side * half * 0.62);
        flow.add(c);
      }
      dir.add(big, flow);
      grp.add(plane, edge, dir);
      return grp;
    });

    // 미끄럼 장판(DEC-081): 반질반질한 얼음판(눈송이·금 간 결, 광택) + 빛나는 테 + 반짝이는 줄(DEC-071 ②, 끈끈이 지름의 2배)
    const iceR = T.iceFloorDiameter / 2;
    const iceDisc = g(flat(new CircleGeometry(iceR, 64)));
    const iceRing = g(flat(new RingGeometry(iceR - 0.4, iceR, 64)));
    const iceGlint = g(flat(new PlaneGeometry(iceR * 1.1, 0.35)));
    const iceTex = tx(iceTexture());
    const iceMat = m(
      new MeshPhysicalMaterial({
        map: iceTex,
        emissive: 0xffffff,
        emissiveMap: iceTex,
        emissiveIntensity: 0.45,
        transparent: true,
        opacity: 0.85,
        roughness: 0.05,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        depthWrite: false,
      }),
    );
    const iceRingMat = tint(0xe8faff, 0.95);
    const iceGlintMat = glow(0xffffff, 0.6);
    this.pool('ice_floor', () => {
      const grp = new Group();
      const disc = new Mesh(iceDisc, iceMat);
      disc.position.y = FLOOR_Y - 0.02;
      disc.name = 'disc';
      disc.receiveShadow = true;
      const ring = new Mesh(iceRing, iceRingMat);
      ring.position.y = FLOOR_Y - 0.01;
      const glints = new Group();
      glints.name = 'glints';
      for (const [gx, gz, rot] of [
        [-iceR * 0.2, -iceR * 0.35, 0.6],
        [iceR * 0.25, iceR * 0.2, 0.6],
        [-iceR * 0.05, iceR * 0.5, 0.6],
      ] as const) {
        const gl = new Mesh(iceGlint, iceGlintMat);
        gl.position.set(gx, FLOOR_Y, gz);
        gl.rotation.y = rot;
        gl.scale.x = 0.5 + Math.abs(gx / iceR);
        glints.add(gl);
      }
      grp.add(disc, ring, glints);
      return grp;
    });

    // 방향 반전(DEC-081): 분홍·보라 마법진(글자 고리·서로 반대로 도는 굽은 화살)이 돌고, 바깥 빛 고리가 숨쉰다
    const revR = T.reverseZoneDiameter / 2;
    const revDisc = g(flat(new CircleGeometry(revR, 48)));
    const revRing = g(flat(new RingGeometry(revR - 0.3, revR, 48)));
    const revMat = tint(0xffffff, 1, tx(reverseTexture()));
    const revRingMat = tint(0xe03aaa, 0.85);
    this.pool('reverse_zone', () => {
      const grp = new Group();
      const spin = new Mesh(revDisc, revMat);
      spin.position.y = FLOOR_Y;
      spin.name = 'spin';
      const ring = new Mesh(revRing, revRingMat);
      ring.position.y = FLOOR_Y + 0.01;
      ring.name = 'ring';
      grp.add(spin, ring);
      return grp;
    });

    // 폭탄: 해골이 그려진 반짝이는 검은 공 + 쇠 마개 + 휘어진 심지 + 타닥거리는 불꽃
    const mR = T.mineRadius;
    const mineBody = g(new SphereGeometry(mR, 24, 16));
    const mineBodyMat = m(
      new MeshPhysicalMaterial({
        map: tx(bombTexture()),
        roughness: 0.25,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
      }),
    );
    const mineCap = g(new CylinderGeometry(mR * 0.38, mR * 0.42, mR * 0.36, 14));
    const mineCapMat = m(
      new MeshStandardMaterial({ color: 0xe0a530, roughness: 0.2, metalness: 0.8 }),
    );
    const fuseCurve = new CatmullRomCurve3([
      new Vector3(0, 0, 0),
      new Vector3(0.05, mR * 0.35, 0),
      new Vector3(mR * 0.3, mR * 0.65, 0),
      new Vector3(mR * 0.6, mR * 0.7, 0),
    ]);
    const fuse = g(new TubeGeometry(fuseCurve, 12, 0.09, 6));
    const fuseMat = m(new MeshStandardMaterial({ color: 0xd8b07a, roughness: 0.9 }));
    const sparkGeo = g(new SphereGeometry(0.28, 8, 6));
    const sparkMat = glow(0xffb020, 1);
    const sparkHaloMat = glow(0xff7a20, 0.5);
    const sparkBit = g(new SphereGeometry(0.07, 4, 3));
    const sparkBitMat = glow(0xfff0a0, 1);
    this.pool('mine', () => {
      const grp = new Group();
      const body = new Mesh(mineBody, mineBodyMat);
      body.position.y = mR;
      body.castShadow = true;
      const cap = new Mesh(mineCap, mineCapMat);
      cap.position.y = mR * 2 - 0.05;
      const f = new Mesh(fuse, fuseMat);
      f.position.y = mR * 2 + mR * 0.12;
      const spark = new Group();
      spark.name = 'spark';
      spark.position.set(mR * 0.6, mR * 2 + mR * 0.12 + mR * 0.7, 0);
      const sc = new Mesh(sparkGeo, sparkMat);
      const sh = new Mesh(sparkGeo, sparkHaloMat);
      sh.scale.setScalar(2.2);
      sh.name = 'halo';
      spark.add(sc, sh);
      for (let k = 0; k < 6; k++) {
        const b = new Mesh(sparkBit, sparkBitMat);
        b.userData.a = (k / 6) * Math.PI * 2;
        spark.add(b);
      }
      grp.add(body, cap, f, spark);
      return grp;
    });

    // 구멍: 판이 깨져 열린 별빛 우물. 들쭉날쭉한 나무 테 + 천천히 도는 밤하늘 + 가장자리 마법 빛
    const pitR = T.pitDiameter / 2;
    const pitHole = g(flat(new CircleGeometry(pitR, 48)));
    const pitMat = m(new MeshBasicMaterial({ map: tx(voidTexture()) }));
    const pitRim = g(flat(jaggedRimGeometry(pitR, pitR + 1.1, 5)));
    const pitRimMat = m(
      new MeshPhysicalMaterial({ color: 0x8a3a10, roughness: 0.45, clearcoat: 0.6 }),
    );
    const pitLip = g(flat(new RingGeometry(pitR - 0.05, pitR + 0.35, 48)));
    const pitLipMat = m(new MeshStandardMaterial({ color: 0x3a1a08, roughness: 0.9 }));
    const pitGlow = g(flat(new RingGeometry(pitR - 0.9, pitR - 0.05, 48)));
    const pitGlowMat = glow(0x7a3aff, 0.55);
    this.pool('pit', () => {
      const grp = new Group();
      const hole = new Mesh(pitHole, pitMat);
      hole.position.y = FLOOR_Y + 0.015;
      hole.name = 'void';
      const rim = new Mesh(pitRim, pitRimMat);
      rim.position.y = FLOOR_Y + 0.01;
      rim.receiveShadow = true;
      const lip = new Mesh(pitLip, pitLipMat);
      lip.position.y = FLOOR_Y + 0.02;
      const gl = new Mesh(pitGlow, pitGlowMat);
      gl.position.y = FLOOR_Y + 0.025;
      gl.name = 'glow';
      grp.add(rim, lip, hole, gl);
      return grp;
    });

    // 이동 장애물 경로(DEC-081): 벽이 쓸고 지나가는 직사각형에 금빛 레일과 주황 줄무늬
    const track = g(
      flat(new PlaneGeometry(2 * T.movingWallAmplitude + T.wallThickness, T.wallLength)),
    );
    const trackMat = m(
      new MeshBasicMaterial({ map: tx(trackTexture()), transparent: true, depthWrite: false }),
    );
    this.pool('moving_track', () => {
      const grp = new Group();
      const plane = new Mesh(track, trackMat);
      plane.position.y = FLOOR_Y;
      grp.add(plane);
      return grp;
    });

    // 분신술 허상(시전자 화면, DEC-081): 보랏빛으로 비치는 유령 알 + 바닥 빛 고리 + 떠도는 반짝이. 상대 화면에서는 일반 알로 그려진다
    const ghost = g(new CylinderGeometry(R, R, R * 0.9, 24));
    const ghostMat = m(
      new MeshStandardMaterial({
        color: 0xe8dcff,
        emissive: 0x7a3ae0,
        emissiveIntensity: 0.6,
        roughness: 0.15,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    const ghostRing = g(flat(new RingGeometry(R * 1.1, R * 1.5, 32)));
    const ghostRingMat = tint(0x8a3ae0, 0.75);
    const ghostMote = g(new SphereGeometry(0.16, 6, 4));
    const ghostMoteMat = glow(0xf0e0ff, 1);
    this.pool('decoy', () => {
      const grp = new Group();
      const body = new Mesh(ghost, ghostMat);
      body.position.y = STONE_REST_Y;
      const ring = new Mesh(ghostRing, ghostRingMat);
      ring.position.y = FLOOR_Y + 0.02;
      ring.name = 'ring';
      const motes = new Group();
      motes.name = 'motes';
      for (let k = 0; k < 4; k++) {
        const mo = new Mesh(ghostMote, ghostMoteMat);
        mo.userData.a0 = (k / 4) * Math.PI * 2;
        motes.add(mo);
      }
      grp.add(body, ring, motes);
      return grp;
    });
  }

  private pool(kind: ZoneKind, make: () => Group): void {
    this.pools.set(kind, { make, items: [], used: 0 });
  }

  private take(kind: ZoneKind): Group {
    const p = this.pools.get(kind)!;
    let grp = p.items[p.used];
    if (!grp) {
      grp = p.make();
      p.items.push(grp);
      this.group.add(grp);
    }
    p.used++;
    grp.visible = true;
    return grp;
  }

  /**
   * @param timeSec 화면 시각(초). 깜빡임·흐름 애니메이션에 쓴다
   */
  update(items: readonly ZoneDraw[], count: number, timeSec: number) {
    for (const p of this.pools.values()) p.used = 0;
    for (let i = 0; i < count; i++) {
      const it = items[i];
      if (!it) continue;
      const grp = this.take(it.kind);
      grp.position.set(it.x, 0, -it.y);
      const s = grow(it.age);
      switch (it.kind) {
        case 'magnet': {
          grp.scale.set(s, 1, s);
          const swirl = grp.getObjectByName('swirl');
          if (swirl) swirl.rotation.y = timeSec * 0.6;
          const arms = grp.getObjectByName('arms');
          if (arms) arms.rotation.y = timeSec * 1.8;
          const halo = grp.getObjectByName('halo');
          if (halo) halo.scale.setScalar(1 + Math.sin(timeSec * 4) * 0.12);
          const pulse = grp.getObjectByName('pulse');
          if (pulse) {
            const q = 1 - ((timeSec * 0.8) % 1) * 0.5;
            pulse.scale.set(q, 1, q);
          }
          const motes = grp.getObjectByName('motes');
          if (motes) {
            // 가장자리에서 태어나 감겨 돌며 중심으로 빨려 든다
            const mr = T.magnetRadius * 0.95;
            for (const mo of motes.children) {
              const u = (timeSec * 0.4 + (mo.userData.phase as number)) % 1;
              const r = mr * (1 - u) + 0.6;
              const a = (mo.userData.a0 as number) + u * Math.PI * 3;
              mo.position.set(Math.cos(a) * r, FLOOR_Y + 0.3 + (1 - u) * 0.6, Math.sin(a) * r);
              mo.scale.setScalar(u < 0.1 ? u * 10 : 1 - u * 0.6);
            }
          }
          break;
        }
        case 'gravity_zone': {
          grp.scale.set(s, 1, s);
          for (const name of ['square', 'squarePlane']) {
            const o = grp.getObjectByName(name);
            if (o) o.rotation.y = it.angle;
          }
          const dir = grp.getObjectByName('dir');
          if (dir) dir.rotation.y = it.dir;
          const big = grp.getObjectByName('big');
          if (big) big.scale.setScalar(1 + Math.sin(timeSec * 3) * 0.04);
          const flow = grp.getObjectByName('flow');
          if (flow) {
            // 작은 화살표가 방향을 따라 흐른다(구역 안에서 되풀이)
            const half = T.gravityZoneSize / 2 - 1.6;
            flow.position.x = (((timeSec * 0.6) % 1) * 2 - 1) * half;
          }
          break;
        }
        case 'ice_floor': {
          grp.scale.set(s, 1, s);
          const disc = grp.getObjectByName('disc') as Mesh | undefined;
          const mat = disc?.material as Material | undefined;
          if (mat) mat.opacity = 0.8 + Math.sin(timeSec * 2) * 0.04;
          const glints = grp.getObjectByName('glints');
          if (glints) glints.rotation.y = Math.sin(timeSec * 0.5) * 0.08;
          break;
        }
        case 'reverse_zone': {
          grp.scale.set(s, 1, s);
          const spin = grp.getObjectByName('spin');
          if (spin) spin.rotation.y = timeSec * 1.6;
          const ring = grp.getObjectByName('ring');
          if (ring) {
            const q = 1 + Math.sin(timeSec * 3) * 0.04;
            ring.scale.set(q, 1, q);
          }
          break;
        }
        case 'mine': {
          grp.scale.setScalar(s);
          const spark = grp.getObjectByName('spark');
          if (spark) {
            const ph = timeSec * 23 + it.x;
            const flick = 0.75 + Math.sin(ph) * 0.15 + Math.sin(ph * 2.7) * 0.1;
            spark.children.forEach((c, k) => {
              if (k === 0) c.scale.setScalar(flick);
              else if (c.name === 'halo') c.scale.setScalar(2.2 * flick);
              else {
                const u = (timeSec * 3 + k * 0.37) % 1;
                const a = (c.userData.a as number) + timeSec * 2;
                c.position.set(Math.cos(a) * u * 0.9, u * 0.6, Math.sin(a) * u * 0.9);
                c.scale.setScalar(1 - u);
              }
            });
          }
          break;
        }
        case 'pit': {
          grp.scale.set(s, 1, s);
          const v = grp.getObjectByName('void');
          if (v) v.rotation.y = timeSec * 0.25;
          const gl = grp.getObjectByName('glow') as Mesh | undefined;
          const gm = gl?.material as MeshBasicMaterial | undefined;
          if (gm) gm.opacity = 0.35 + Math.sin(timeSec * 2.2) * 0.12;
          break;
        }
        case 'moving_track':
          // 경로 직사각형의 긴 변이 왕복 축(벽에 수직)이다
          grp.rotation.y = it.angle + Math.PI / 2;
          break;
        case 'decoy': {
          const ring = grp.getObjectByName('ring');
          if (ring) {
            const q = 1 + ((timeSec * 0.7) % 1) * 0.5;
            ring.scale.set(q, 1, q);
          }
          const motes = grp.getObjectByName('motes');
          if (motes) {
            motes.children.forEach((mo) => {
              const a = (mo.userData.a0 as number) + timeSec * 1.5;
              mo.position.set(
                Math.cos(a) * R * 1.4,
                STONE_REST_Y + 0.5 + Math.sin(a * 2) * 0.4,
                Math.sin(a) * R * 1.4,
              );
            });
          }
          break;
        }
      }
    }
    for (const p of this.pools.values()) {
      for (let i = p.used; i < p.items.length; i++) {
        const grp = p.items[i];
        if (grp) grp.visible = false;
      }
    }
  }

  dispose() {
    for (const geo of this.geos) geo.dispose();
    for (const mat of this.mats) mat.dispose();
    for (const t of this.texs) t.dispose();
  }
}
