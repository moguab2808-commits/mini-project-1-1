// 옥상 테마(DEC-053·DEC-079·DEC-083): "장난감 성의 별빛 옥상". 보랏빛 밤하늘·큰 초승달·반짝이는 별,
// 멀리 블록 장난감 성과 불 켜진 장난감 마을, 보라·남색 체크 타일 바닥, 금테 성가퀴 난간과 깃발 꽂은 모서리 탑,
// 놋쇠 장난감 망원경, 별 풍선, 곰 인형·블록·선물 상자, 꼬마전구 줄과 삼각 깃발, 떠다니는 반짝이,
// 남색 칠 원목 책상(금테)과 은빛 라벤더 판. 반복 소품은 toy-kit.ts의 Batch 인스턴스 묶음으로 그린다.
import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Euler,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Quaternion,
  RepeatWrapping,
  Shape,
  SphereGeometry,
  SpotLight,
  TorusGeometry,
  Vector3,
  type Texture,
} from 'three';
import {
  FLOOR_Y,
  TABLE_HALF_X,
  TABLE_HALF_Z,
  TABLE_TOP_T,
  TABLE_Y,
  addBulbs,
  canvasTexture,
  canvasTextureWH,
  festoon,
  lcg,
  type Kit,
  type ThemeBuilder,
} from '../stage-kit.ts';
import { Batch, TOY, addBunting, addSparkles, sparkle, teddy, type Spot } from './toy-kit.ts';

/** 옥상 바닥 안쪽 반폭. 성가퀴 난간이 이 선에 선다 */
const ROOF_HALF = 200;
/** 난간 몸체 높이와 성가퀴(톱니) 높이 */
const PARAPET_H = 40;
const MERLON_H = 22;
/** 모서리 탑 높이 */
const TOWER_H = 150;
/** 멀리 장난감 마을 땅 높이 */
const VILLAGE_Y = -130;
/** 카메라 far(900)보다 충분히 안쪽에 둬야 하늘이 잘리지 않는다 */
const SKY_R = 700;
const BAND_R = 610;

// ───────────────────────── 절차 텍스처 ─────────────────────────

/** 보라·남색 체크 타일: 타일마다 볼록한 빛 테두리, 몇 칸에 작은 별 */
function createFloorTexture(): Texture {
  const tex = canvasTexture(512, (g, s) => {
    const rnd = lcg(23);
    const n = 4;
    const t = s / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const dark = (i + j) % 2 === 0;
        const x = i * t;
        const y = j * t;
        const gr = g.createLinearGradient(x, y, x + t, y + t);
        gr.addColorStop(0, dark ? '#3a3192' : '#7a62d8');
        gr.addColorStop(1, dark ? '#2a2478' : '#6650c4');
        g.fillStyle = gr;
        g.fillRect(x, y, t, t);
        g.fillStyle = 'rgba(255,255,255,0.16)';
        g.fillRect(x + 3, y + 3, t - 6, 4);
        g.fillRect(x + 3, y + 3, 4, t - 6);
        g.fillStyle = 'rgba(10,6,40,0.3)';
        g.fillRect(x + 3, y + t - 7, t - 6, 4);
        g.fillRect(x + t - 7, y + 3, 4, t - 6);
        if (!dark && rnd() < 0.5) {
          g.fillStyle = 'rgba(255,224,140,0.55)';
          sparkle(g, x + t / 2, y + t / 2, 14);
        }
      }
    }
    g.fillStyle = 'rgba(18,10,50,0.8)';
    for (let i = 0; i <= n; i++) {
      g.fillRect(i * t - 1.5, 0, 3, s);
      g.fillRect(0, i * t - 1.5, s, 3);
    }
  });
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

/** 하늘 구(등장방형): 위는 짙은 남보라, 지평선 쪽은 분홍빛 라벤더, 별과 반짝임, 솜사탕 구름 */
function createSkyTexture(): Texture {
  return canvasTextureWH(2048, 1024, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#120a3a');
    grad.addColorStop(0.22, '#24166a');
    grad.addColorStop(0.38, '#4a2d9e');
    grad.addColorStop(0.47, '#9a5cc8');
    grad.addColorStop(0.52, '#e391c8');
    grad.addColorStop(0.56, '#5a3a9a');
    grad.addColorStop(1, '#1a1240');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    const rnd = lcg(5);
    for (let i = 0; i < 900; i++) {
      const y = Math.pow(rnd(), 1.4) * h * 0.5;
      g.fillStyle = `rgba(255,${235 + rnd() * 20},${200 + rnd() * 55},${0.4 + rnd() * 0.6})`;
      const r = rnd() < 0.06 ? 2.4 : 0.8 + rnd() * 1.1;
      g.beginPath();
      g.arc(rnd() * w, y, r, 0, Math.PI * 2);
      g.fill();
    }
    // 큰 반짝임 별(노랑·하늘·분홍)
    const tints = ['rgba(255,226,140,0.95)', 'rgba(190,220,255,0.95)', 'rgba(255,190,230,0.9)'];
    for (let i = 0; i < 70; i++) {
      g.fillStyle = tints[i % tints.length] ?? '#fff';
      sparkle(g, rnd() * w, Math.pow(rnd(), 1.2) * h * 0.46, 5 + rnd() * 9);
    }
    // 지평선 위 솜사탕 구름
    for (let i = 0; i < 26; i++) {
      const cx = rnd() * w;
      const cy = h * (0.4 + rnd() * 0.08);
      for (let j = 0; j < 5; j++) {
        const r = 14 + rnd() * 26;
        const x = cx + (j - 2) * 22 + rnd() * 10;
        const y = cy - Math.sin((j / 4) * Math.PI) * 12;
        // 구 이음매(u=0/1)에서 끊기지 않게 좌우로 한 번씩 더 그린다
        for (const ox of [x - w, x, x + w]) {
          const gr = g.createRadialGradient(ox, y - r * 0.3, 0, ox, y, r);
          gr.addColorStop(0, 'rgba(255,200,240,0.32)');
          gr.addColorStop(1, 'rgba(180,140,240,0)');
          g.fillStyle = gr;
          g.beginPath();
          g.arc(ox, y, r, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
  });
}

/** 큰 초승달: 금빛 크림 초승달과 부드러운 빛무리, 달 위 작은 반짝임 */
function createMoonTexture(): Texture {
  return canvasTexture(512, (g, s) => {
    const c = s / 2;
    const halo = g.createRadialGradient(c, c, s * 0.18, c, c, c);
    halo.addColorStop(0, 'rgba(255,230,170,0.5)');
    halo.addColorStop(0.5, 'rgba(220,170,255,0.18)');
    halo.addColorStop(1, 'rgba(160,120,255,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, s, s);
    // 초승달: 원에서 비낀 원을 덜어 낸다(별도 캔버스에서 잘라 붙인다)
    const m = document.createElement('canvas');
    m.width = s;
    m.height = s;
    const mg = m.getContext('2d');
    if (mg) {
      const body = mg.createRadialGradient(c - 40, c - 30, 10, c, c, s * 0.3);
      body.addColorStop(0, '#fff7d6');
      body.addColorStop(1, '#ffd36b');
      mg.fillStyle = body;
      mg.beginPath();
      mg.arc(c, c, s * 0.3, 0, Math.PI * 2);
      mg.fill();
      mg.globalCompositeOperation = 'destination-out';
      mg.beginPath();
      mg.arc(c + s * 0.14, c - s * 0.08, s * 0.26, 0, Math.PI * 2);
      mg.fill();
      g.drawImage(m, 0, 0);
    }
    g.fillStyle = 'rgba(255,248,220,0.95)';
    sparkle(g, c + s * 0.2, c + s * 0.2, 16);
    sparkle(g, c + s * 0.3, c - s * 0.28, 10);
  });
}

/** 먼 언덕 띠: 겹친 둥근 언덕, 작은 집 불빛과 나무, 위쪽은 투명 */
function createHillsTexture(): Texture {
  const tex = canvasTextureWH(4096, 512, (g, w, h) => {
    const rnd = lcg(61);
    const layers = [
      { col: '#4a3a98', top: 0.2, amp: 0.18, lights: 0.0 },
      { col: '#33287a', top: 0.42, amp: 0.16, lights: 1 },
    ];
    for (const L of layers) {
      g.fillStyle = L.col;
      g.beginPath();
      g.moveTo(0, h);
      const bumps: [number, number][] = [];
      for (let x = 0; x <= w; x += 8) {
        const y =
          h * L.top +
          h * L.amp * (0.5 + 0.5 * Math.sin(x * 0.004 + L.top * 9)) * Math.cos(x * 0.0017);
        g.lineTo(x, y);
        if (x % 96 === 0) bumps.push([x, y]);
      }
      g.lineTo(w, h);
      g.closePath();
      g.fill();
      if (!L.lights) continue;
      // 언덕 위 작은 집(지붕+불빛 창)과 동그란 나무
      for (const [x, y] of bumps) {
        if (rnd() < 0.35) {
          g.fillStyle = '#2a8a7a';
          g.beginPath();
          g.arc(x + 30, y + 4, 12, 0, Math.PI * 2);
          g.fill();
          continue;
        }
        const hw = 14 + rnd() * 10;
        const hh = 16 + rnd() * 14;
        g.fillStyle = '#5a48b0';
        g.fillRect(x - hw, y - hh + 6, hw * 2, hh + 20);
        g.fillStyle =
          ['#e2504a', '#8a4ae0', '#3a86e8', '#f07a1a'][Math.floor(rnd() * 4)] ?? '#e2504a';
        g.beginPath();
        g.moveTo(x - hw - 4, y - hh + 7);
        g.lineTo(x, y - hh - 14);
        g.lineTo(x + hw + 4, y - hh + 7);
        g.fill();
        g.fillStyle = 'rgba(255,214,120,0.95)';
        g.fillRect(x - 5, y - hh + 14, 10, 9);
      }
    }
    // 아래 마을의 번지는 불빛
    for (let i = 0; i < 120; i++) {
      const x = rnd() * w;
      const y = h * (0.62 + rnd() * 0.35);
      const r = 4 + rnd() * 10;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,214,140,0.85)');
      gr.addColorStop(1, 'rgba(255,170,90,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  });
  tex.wrapS = RepeatWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

// ───────────────────────── 장난감 도형 ─────────────────────────

/** 별 모양(바깥 반지름 r) */
function starShape(r: number, inner = 0.48): Shape {
  const sh = new Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * inner;
    if (i === 0) sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
    else sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  sh.closePath();
  return sh;
}

/** Batch를 빛나는(조명 무관) 재질로 내보낸다. 창 불빛·별 장식용 */
function flushGlow(b: Batch, k: Kit, parent: Group) {
  const g = new Group();
  b.flush(k, g);
  const mat = new MeshBasicMaterial({ color: 0xffffff, fog: false });
  k.mats.push(mat);
  for (const child of g.children) (child as Mesh).material = mat;
  parent.add(...g.children);
}

/** 블록 장난감 성: 성벽·성가퀴·둥근 탑·고깔 지붕·깃발·불 켜진 창. sc=1이 폭 약 200cm, 앞이 지역 +z */
function bigCastle(b: Batch, glow: Batch, at: Spot, sc: number, rnd: () => number) {
  const wall = 0xd8c8ff;
  const wall2 = 0xb8a4f4;
  const roofs = [0xe2504a, 0x3a86e8, 0xff8fb0, 0x8a4ae0, 0xffc94a];
  const B = (x: number, y: number, z: number, w: number, h: number, d: number, c: number) =>
    b.add('box', at, x * sc, y * sc, z * sc, w * sc, h * sc, d * sc, c);
  // 앞 성벽과 성가퀴
  B(0, 45, 0, 170, 90, 40, wall);
  for (let i = -8; i <= 8; i++) B(i * 10, 95, 18, 6, 10, 6, i % 2 === 0 ? wall : wall2);
  B(0, 90.5, 20.5, 172, 3, 1.5, 0xffc94a);
  // 성문(아치 느낌의 둥근 머리)과 문 위 문장
  B(0, 20, 20.3, 34, 40, 1, 0x5a2a10);
  b.add('cyl', at, 0, 40 * sc, 20.3 * sc, 17 * sc, 1 * sc, 17 * sc, 0x5a2a10, [Math.PI / 2, 0, 0]);
  b.add('cyl', at, 0, 66 * sc, 20.6 * sc, 9 * sc, 1 * sc, 9 * sc, 0xffc94a, [Math.PI / 2, 0, 0]);
  // 뒤 본성(높은 블록)
  B(0, 100, -30, 80, 200, 40, wall2);
  for (let i = -3; i <= 3; i++) B(i * 11, 205, -12, 7, 10, 6, wall);
  // 탑들: [x, z, 반지름, 높이]
  const towers: [number, number, number, number][] = [
    [-92, 6, 20, 150],
    [92, 6, 20, 150],
    [-48, -26, 16, 230],
    [48, -26, 16, 230],
    [0, -40, 22, 290],
  ];
  towers.forEach(([tx, tz, r, th], i) => {
    b.add(
      'cyl',
      at,
      tx * sc,
      (th / 2) * sc,
      tz * sc,
      r * sc,
      th * sc,
      r * sc,
      i % 2 ? wall2 : wall,
    );
    b.add('cyl', at, tx * sc, (th + 2) * sc, tz * sc, (r + 3) * sc, 4 * sc, (r + 3) * sc, 0xffc94a);
    b.add(
      'cone',
      at,
      tx * sc,
      (th + 4 + r * 1.3) * sc,
      tz * sc,
      (r + 5) * sc,
      r * 2.6 * sc,
      (r + 5) * sc,
      roofs[i % roofs.length] ?? 0xe2504a,
    );
    const top = th + 4 + r * 2.6;
    b.add('cyl', at, tx * sc, (top + 10) * sc, tz * sc, 0.8 * sc, 20 * sc, 0.8 * sc, 0x5a2a10);
    B(tx + 6, top + 16, tz, 12, 8, 0.8, TOY[(i + 2) % TOY.length] ?? 0xffc94a);
    b.add('sphere', at, tx * sc, (top + 1) * sc, tz * sc, 2.4 * sc, 2.4 * sc, 2.4 * sc, 0xffc94a);
    // 탑 창(위아래 두 개)
    for (const wy of [th * 0.5, th * 0.78]) {
      glow.add('box', at, tx * sc, wy * sc, (tz + r - 0.6) * sc, 6 * sc, 10 * sc, 2 * sc, 0xffd27a);
    }
  });
  // 성벽·본성 창
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    glow.add('box', at, i * 20 * sc, 62 * sc, 20.2 * sc, 7 * sc, 10 * sc, 1 * sc, 0xffd27a);
  }
  for (let r = 0; r < 3; r++) {
    for (const x of [-22, 0, 22]) {
      if (rnd() < 0.2) continue;
      glow.add(
        'box',
        at,
        x * sc,
        (120 + r * 26) * sc,
        -9.8 * sc,
        7 * sc,
        11 * sc,
        1 * sc,
        rnd() < 0.8 ? 0xffd27a : 0xc8e6ff,
      );
    }
  }
}

/** 장난감 마을 집 한 채: 블록 몸체·고깔 또는 지붕 블록·불 켜진 창 */
function house(b: Batch, glow: Batch, at: Spot, rnd: () => number) {
  const w = 26 + rnd() * 26;
  const h = 34 + rnd() * 60;
  const d = 26 + rnd() * 12;
  const body = [0xf3e2c0, 0xffd1e0, 0xc8e0ff, 0xd8c8ff, 0xffe39a, 0xbfeedc][Math.floor(rnd() * 6)];
  const roof = TOY[Math.floor(rnd() * TOY.length)] ?? 0xe2504a;
  b.add('box', at, 0, h / 2, 0, w, h, d, body ?? 0xf3e2c0);
  if (rnd() < 0.55) {
    // 원뿔 대신 네모 지붕: 4각 원뿔처럼 보이게 납작한 상자 두 개
    b.add('box', at, 0, h + 4, 0, w + 4, 8, d + 4, roof);
    b.add('box', at, 0, h + 11, 0, w * 0.6, 6, d * 0.6, roof);
  } else {
    const r = Math.min(w, d) * 0.62;
    b.add('cone', at, 0, h + r * 0.9, 0, r, r * 1.8, r, roof);
  }
  const floors = Math.max(1, Math.floor(h / 24));
  for (let f = 0; f < floors; f++) {
    for (const x of w > 40 ? [-w / 4, w / 4] : [0]) {
      if (rnd() < 0.25) continue;
      glow.add('box', at, x, 14 + f * 24, d / 2 + 0.2, 6, 8, 1, rnd() < 0.8 ? 0xffd27a : 0xffa8d8);
    }
  }
}

/** 놋쇠 장난감 망원경: 나무 세발대 위에서 달을 향한다 */
function telescope(k: Kit, room: Group, b: Batch, at: Spot, aim: Vector3) {
  const brass = k.std(0xe0a83a, 0.28, 0.65);
  const gold = k.std(0xffd36b, 0.25, 0.8);
  const navy = k.std(0x2a2a7a, 0.4, 0.2);
  // 세발대(Batch): 다리 셋과 가운데 받침
  const H = 92;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.3;
    b.add('cyl', at, Math.cos(a) * 14, H / 2, Math.sin(a) * 14, 1.4, H + 4, 1.4, 0x8a4a22, [
      Math.sin(a) * 0.16,
      0,
      -Math.cos(a) * 0.16,
    ]);
  }
  b.add('cyl', at, 0, H, 0, 4, 4, 4, 0x6a3414);
  const head = new Group();
  head.position.set(at.x, FLOOR_Y + H + 4, at.z);
  room.add(head);
  head.lookAt(aim);
  // 경통: 가늘어지는 놋쇠 원통 세 마디 + 금 고리 + 남색 띠, 앞쪽(지역 +z)이 달을 본다
  const parts: [number, number, number, number, MeshStandardMaterial][] = [
    [7.5, 6.5, 30, 16, brass],
    [6.2, 5.2, 24, -10, brass],
    [4.6, 4, 16, -28, navy],
  ];
  for (const [r1, r2, len, z, m] of parts) {
    const tube = k.mesh(new CylinderGeometry(r1, r2, len, 20), m);
    tube.rotation.x = Math.PI / 2;
    tube.position.z = z;
    head.add(tube);
  }
  for (const [r, z] of [
    [8.6, 31],
    [8, 2],
    [6.8, -21],
    [5, -35],
  ] as const) {
    const ring = k.mesh(new TorusGeometry(r, 1, 8, 24), gold);
    ring.position.z = z;
    head.add(ring);
  }
  const lensMat = new MeshBasicMaterial({ color: 0x9ad0ff });
  k.mats.push(lensMat);
  const lens = k.mesh(new CylinderGeometry(6.8, 6.8, 0.6, 20), lensMat, false, false);
  lens.rotation.x = Math.PI / 2;
  lens.position.z = 31.2;
  head.add(lens);
}

// ───────────────────────── 테마 ─────────────────────────

export const buildRooftopTheme: ThemeBuilder = (k) => {
  const room = new Group();
  const batch = new Batch();
  const glow = new Batch();
  const rnd = lcg(53);
  const origin: Spot = { x: 0, y: 0, z: 0, yaw: 0 };

  // 하늘·초승달·고리 행성
  const skyTex = createSkyTexture();
  k.texs.push(skyTex);
  const skyMat = new MeshBasicMaterial({ map: skyTex, side: BackSide, fog: false });
  k.mats.push(skyMat);
  room.add(k.mesh(new SphereGeometry(SKY_R, 48, 24), skyMat, false, false));

  const moonDir = new Vector3(-0.42, 0.2, -0.88).normalize();
  const moonTex = createMoonTexture();
  k.texs.push(moonTex);
  const moonMat = new MeshBasicMaterial({
    map: moonTex,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
  k.mats.push(moonMat);
  const moon = k.mesh(new PlaneGeometry(250, 250), moonMat, false, false);
  moon.position.copy(moonDir).multiplyScalar(SKY_R - 60);
  moon.lookAt(0, 0, 0);
  room.add(moon);

  // 반대편(두 번째 좌석이 보는 쪽) 하늘의 장난감 고리 행성
  const planetDir = new Vector3(0.5, 0.3, 0.81).normalize();
  const planetPos = planetDir.clone().multiplyScalar(SKY_R - 100);
  const planetMat = new MeshBasicMaterial({ color: 0xff9ad0, fog: false });
  const ringMat = new MeshBasicMaterial({ color: 0xffd36b, fog: false, side: DoubleSide });
  k.mats.push(planetMat, ringMat);
  const planet = k.mesh(new SphereGeometry(34, 32, 16), planetMat, false, false);
  planet.position.copy(planetPos);
  room.add(planet);
  const pring = k.mesh(new TorusGeometry(56, 4, 6, 48), ringMat, false, false);
  pring.position.copy(planetPos);
  pring.rotation.set(Math.PI / 2 - 0.35, 0.3, 0);
  room.add(pring);

  // 먼 언덕 띠와 마을 땅
  const hillTex = createHillsTexture();
  k.texs.push(hillTex);
  const hillMat = new MeshBasicMaterial({
    map: hillTex,
    side: BackSide,
    alphaTest: 0.5,
    fog: false,
  });
  k.mats.push(hillMat);
  const bandTop = 60;
  const band = k.mesh(
    new CylinderGeometry(BAND_R, BAND_R, bandTop - VILLAGE_Y, 64, 1, true),
    hillMat,
    false,
    false,
  );
  band.position.y = (bandTop + VILLAGE_Y) / 2;
  room.add(band);
  const groundMat = k.std(0x3a2f86, 0.95);
  const ground = k.mesh(new CylinderGeometry(SKY_R, SKY_R, 2, 48), groundMat, false, false);
  ground.position.y = VILLAGE_Y - 1;
  room.add(ground);

  // 장난감 성 두 채(양 좌석의 정면 멀리)와 둘레의 장난감 마을
  bigCastle(batch, glow, { x: 70, y: VILLAGE_Y, z: -450, yaw: 0 }, 1.05, rnd);
  bigCastle(batch, glow, { x: -70, y: VILLAGE_Y, z: 450, yaw: Math.PI }, 1.05, rnd);
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2 + rnd() * 0.05;
    const r = 310 + rnd() * 230;
    const x = Math.sin(a) * r;
    const z = Math.cos(a) * r;
    // 성 앞자리는 비운다
    if (Math.abs(x - (z < 0 ? 70 : -70)) < 170 && Math.abs(z) > 330) continue;
    const at: Spot = { x, y: VILLAGE_Y, z, yaw: Math.atan2(-x, -z) + (rnd() - 0.5) * 0.5 };
    if (rnd() < 0.22) {
      // 동그란 장난감 나무
      const s = 16 + rnd() * 12;
      batch.add('cyl', at, 0, s * 0.6, 0, 3, s * 1.2, 3, 0x8a4a22);
      batch.add('sphere', at, 0, s * 1.6, 0, s, s * 1.1, s, rnd() < 0.5 ? 0x3aa88a : 0x5bbf6a);
    } else {
      house(batch, glow, at, rnd);
    }
  }

  // 바닥: 보라·남색 체크 타일
  const floorTex = createFloorTexture();
  k.texs.push(floorTex);
  const floorMat = new MeshStandardMaterial({ map: floorTex, roughness: 0.55 });
  k.mats.push(floorMat);
  const floor = k.mesh(
    new PlaneGeometry(ROOF_HALF * 2 + 24, ROOF_HALF * 2 + 24),
    floorMat,
    false,
    true,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  room.add(floor);
  // 옥상 바닥 아래(성 몸체): 바깥에서 비칠 때 빈틈이 없게 한 겹
  const keep = k.mesh(
    new BoxGeometry(ROOF_HALF * 2 + 24, FLOOR_Y - VILLAGE_Y, ROOF_HALF * 2 + 24),
    k.std(0x6a58c0, 0.9),
    false,
    false,
  );
  keep.position.y = (FLOOR_Y + VILLAGE_Y) / 2 - 0.5;
  room.add(keep);

  // 성가퀴 난간: 두 줄로 쌓은 블록 몸체, 금빛 띠, 금 모자를 쓴 톱니
  const stone = [0x6c5cc4, 0x8270dc];
  const edge = ROOF_HALF + 6;
  for (let side = 0; side < 4; side++) {
    const yaw = (side * Math.PI) / 2;
    // 지역 +z가 옥상 안쪽을 보게, 벽은 지역 z=0에 선다
    const at: Spot = { x: -Math.sin(yaw) * edge, y: FLOOR_Y, z: -Math.cos(yaw) * edge, yaw };
    const L = edge * 2;
    const n = 10;
    const bw = L / n;
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < n + 1; i++) {
        const x = -L / 2 + (i - (row % 2) * 0.5) * bw;
        const x0 = Math.max(-L / 2, x);
        const x1 = Math.min(L / 2, x + bw);
        if (x1 - x0 < 1) continue;
        batch.add(
          'box',
          at,
          (x0 + x1) / 2,
          (row + 0.5) * (PARAPET_H / 2),
          0,
          x1 - x0 - 0.6,
          PARAPET_H / 2 - 0.6,
          12,
          stone[(i + row) % 2] ?? 0x6c5cc4,
        );
      }
    }
    batch.add('box', at, 0, PARAPET_H + 1.5, 0, L + 4, 3, 15, 0xffc94a);
    for (let i = 0; i < n; i++) {
      const x = -L / 2 + (i + 0.5) * bw;
      if (Math.abs(x) > L / 2 - 26) continue; // 모서리 탑 자리
      batch.add('box', at, x, PARAPET_H + 3 + MERLON_H / 2, 0, 24, MERLON_H, 12, stone[i % 2] ?? 0);
      batch.add('box', at, x, PARAPET_H + 3 + MERLON_H + 1, 0, 26, 1.6, 14, 0xffd36b);
    }
  }

  // 모서리 탑: 원기둥 몸체, 금 띠, 톱니 고리, 고깔 지붕, 깃발
  const towerRoof = [0xe2504a, 0x3a86e8, 0xff8fb0, 0xffc94a];
  const towerTops: Vector3[] = [];
  [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ].forEach(([sx = 1, sz = 1], i) => {
    const at: Spot = { x: sx * edge, y: FLOOR_Y, z: sz * edge, yaw: Math.atan2(-sx, -sz) };
    const R = 24;
    batch.add('cyl', at, 0, TOWER_H / 2, 0, R, TOWER_H, R, i % 2 ? 0x7a68d4 : 0x8a78e4);
    for (const y of [36, 92]) batch.add('cyl', at, 0, y, 0, R + 1, 4, R + 1, 0xffc94a);
    batch.add('cyl', at, 0, TOWER_H + 3, 0, R + 4, 6, R + 4, 0x6c5cc4);
    for (let m = 0; m < 10; m++) {
      const a = (m / 10) * Math.PI * 2;
      batch.add(
        'box',
        at,
        Math.cos(a) * (R + 2),
        TOWER_H + 11,
        Math.sin(a) * (R + 2),
        8,
        10,
        5,
        0x8270dc,
        [0, -a + Math.PI / 2, 0],
      );
    }
    batch.add('cone', at, 0, TOWER_H + 36, 0, R + 2, 50, R + 2, towerRoof[i] ?? 0xe2504a);
    batch.add('sphere', at, 0, TOWER_H + 62, 0, 3, 3, 3, 0xffd36b);
    batch.add('cyl', at, 0, TOWER_H + 76, 0, 0.9, 28, 0.9, 0x5a2a10);
    batch.add('box', at, 9, TOWER_H + 84, 0, 18, 11, 1, TOY[(i + 3) % TOY.length] ?? 0xffc94a);
    // 안쪽을 보는 창(불빛)과 문
    glow.add('box', at, 0, 112, R - 0.4, 9, 16, 2, 0xffd27a);
    glow.add('box', at, -10, 64, R - 2.6, 6, 10, 2, 0xffd27a, [0, -0.45, 0]);
    batch.add('box', at, 0, 15, R - 1, 16, 30, 4, 0x5a2a10);
    batch.add('cyl', at, 0, 30, R - 1, 8, 4, 8, 0x5a2a10, [Math.PI / 2, 0, 0]);
    towerTops.push(new Vector3(sx * (edge - R + 4), FLOOR_Y + 124, sz * (edge - R + 4)));
  });

  // 망원경(왼쪽 앞, 달을 향해)
  const scopeAt: Spot = { x: -158, y: FLOOR_Y, z: -118, yaw: 0 };
  telescope(k, room, batch, scopeAt, moon.position);
  teddy(batch, { x: -130, y: FLOOR_Y, z: -96, yaw: 0.9 }, 0, 0, 0, 2.2, 0xe8c08a);

  // 곰 인형·블록·선물 상자
  teddy(batch, { x: 150, y: FLOOR_Y, z: -150, yaw: -Math.PI * 0.25 }, 0, 0, 0, 3, 0xc98a4e);
  teddy(batch, { x: -150, y: FLOOR_Y, z: 150, yaw: Math.PI * 0.75 }, 0, 0, 0, 3, 0xf2e6d2);
  const gifts: [number, number, number][] = [
    [165, 70, 0.4],
    [-168, 70, -0.3],
    [120, 168, 0.2],
    [-60, -172, 0.1],
    [60, 172, -0.2],
    [172, -60, 0.6],
  ];
  gifts.forEach(([gx, gz, yaw], i) => {
    const at: Spot = { x: gx, y: FLOOR_Y, z: gz, yaw };
    const s = 18 + (i % 3) * 4;
    const c = TOY[(i * 3) % TOY.length] ?? 0xe2504a;
    const ribbon = i % 2 ? 0xffd36b : 0xffffff;
    batch.add('box', at, 0, s / 2, 0, s, s, s, c);
    batch.add('box', at, 0, s / 2, 0, s + 0.4, s + 0.4, 3, ribbon);
    batch.add('box', at, 0, s / 2, 0, 3, s + 0.4, s + 0.4, ribbon);
    batch.add('sphere', at, -2.5, s + 2, 0, 3, 2, 2, ribbon, [0, 0, 0.5]);
    batch.add('sphere', at, 2.5, s + 2, 0, 3, 2, 2, ribbon, [0, 0, -0.5]);
    // 옆에 블록 쌓기
    const bs = 7;
    batch.add('box', at, s, bs / 2, 4, bs, bs, bs, TOY[(i + 1) % TOY.length] ?? 0, [0, 0.3, 0]);
    batch.add(
      'box',
      at,
      s + 2,
      bs * 1.5,
      3,
      bs,
      bs,
      bs,
      TOY[(i + 5) % TOY.length] ?? 0,
      [0, -0.4, 0],
    );
  });
  // 별 무늬 쿠션
  for (const [px, pz, c] of [
    [-90, 160, 0xff8fb0],
    [92, -160, 0x48c6c0],
  ] as const) {
    batch.add('sphere', origin, px, FLOOR_Y + 8, pz, 16, 9, 16, c);
    batch.add('cyl', origin, px, FLOOR_Y + 15.5, pz, 6, 1.2, 6, 0xffd36b);
  }

  // 별 풍선: 바닥 블록에 끈으로 묶인 별 무리(인스턴스 하나)
  const starGeo = new ExtrudeGeometry(starShape(9), {
    depth: 3,
    bevelEnabled: true,
    bevelThickness: 1.6,
    bevelSize: 1.4,
    bevelSegments: 3,
  });
  starGeo.center();
  k.geos.push(starGeo);
  const starMat = new MeshStandardMaterial({
    roughness: 0.25,
    metalness: 0.15,
    emissive: 0x1a1030,
  });
  k.mats.push(starMat);
  const balloons: { p: Vector3; yaw: number; tilt: number; c: number }[] = [];
  const balloonColors = [0xffc232, 0xff5fa0, 0x4ab8ff, 0xb070ff, 0xff8a3a];
  for (const [bx, bz] of [
    [-172, 110],
    [170, 20],
    [-100, -175],
    [110, -176],
    [0, 178],
  ] as const) {
    const at: Spot = { x: bx, y: FLOOR_Y, z: bz, yaw: Math.atan2(-bx, -bz) };
    batch.add('box', at, 0, 4, 0, 8, 8, 8, 0xffc94a, [0, 0.3, 0]);
    const count = 3;
    for (let j = 0; j < count; j++) {
      const ox = (j - 1) * 14 + (rnd() - 0.5) * 4;
      const oz = (rnd() - 0.5) * 8;
      const top = 96 + j * 14 + rnd() * 16;
      const len = Math.hypot(ox, top - 8);
      batch.add('cyl', at, ox / 2, 8 + (top - 8) / 2, oz / 2, 0.25, len, 0.25, 0xf6f0ff, [
        0,
        0,
        -Math.atan2(ox, top - 8),
      ]);
      const cs = Math.cos(at.yaw);
      const sn = Math.sin(at.yaw);
      balloons.push({
        p: new Vector3(bx + ox * cs + oz * sn, FLOOR_Y + top + 9, bz - ox * sn + oz * cs),
        yaw: at.yaw + (rnd() - 0.5) * 0.6,
        tilt: (rnd() - 0.5) * 0.5,
        c: balloonColors[(j + Math.floor(bx)) % balloonColors.length] ?? 0xffd36b,
      });
    }
  }
  const balloonMesh = new InstancedMesh(starGeo, starMat, balloons.length);
  const m4 = new Matrix4();
  const q = new Quaternion();
  const one = new Vector3(1, 1, 1);
  balloons.forEach((bl, i) => {
    q.setFromEuler(new Euler(0, bl.yaw, bl.tilt, 'YXZ'));
    balloonMesh.setMatrixAt(i, m4.compose(bl.p, q, one));
    balloonMesh.setColorAt(i, new Color(bl.c));
  });
  balloonMesh.castShadow = false;
  room.add(balloonMesh);

  batch.flush(k, room);
  flushGlow(glow, k, room);

  // 꼬마전구 줄: 탑 사이 성가퀴 위로 처지는 줄(배경)과 탑에서 판 위 고리로 모이는 줄(lamp)
  const wireMat = new MeshBasicMaterial({ color: 0x2a1a40 });
  k.mats.push(wireMat);
  const railBulbs: Vector3[] = [];
  const RAIL_Y = FLOOR_Y + 112;
  const rail = towerTops.map((p) => p.clone().setY(RAIL_Y));
  rail.forEach((a, i) => {
    const b = rail[(i + 1) % rail.length] ?? a;
    room.add(k.mesh(festoon(a, b, 5, 18, 4, railBulbs), wireMat, false, false));
  });
  addBulbs(k, room, railBulbs, 1.9, [0xffd37a, 0xff9ad0, 0xffe7a8, 0xc8a0ff, 0x9ad0ff]);

  addBunting(
    k,
    room,
    wireMat,
    [
      [
        new Vector3(-edge + 26, FLOOR_Y + 84, -edge + 8),
        new Vector3(edge - 26, FLOOR_Y + 84, -edge + 8),
        0,
      ],
      [
        new Vector3(-edge + 26, FLOOR_Y + 84, edge - 8),
        new Vector3(edge - 26, FLOOR_Y + 84, edge - 8),
        Math.PI,
      ],
      [
        new Vector3(-edge + 8, FLOOR_Y + 84, -edge + 26),
        new Vector3(-edge + 8, FLOOR_Y + 84, edge - 26),
        Math.PI / 2,
      ],
      [
        new Vector3(edge - 8, FLOOR_Y + 84, -edge + 26),
        new Vector3(edge - 8, FLOOR_Y + 84, edge - 26),
        -Math.PI / 2,
      ],
    ],
    [0xffc94a, 0x8a4ae0, 0xff8fb0, 0x48c6c0, 0x3a86e8, 0xffffff],
  );

  // 떠다니는 마법 반짝이(판 위 공간은 비운다)
  addSparkles(k, room, rnd, {
    count: 180,
    rMin: 75,
    rMax: 195,
    yMin: -40,
    yMax: 160,
    colors: [0xffd36b, 0xc8a0ff, 0x9ad0ff, 0xffffff, 0xff9ad0],
  });

  // 판 위: 탑에서 모이는 전구 줄과 가운데 빛나는 금별 장식(lamp, 카메라가 오르면 숨긴다)
  const lamp = new Group();
  room.add(lamp);
  const hub = new Vector3(0, 132, 0);
  const hubBulbs: Vector3[] = [];
  for (const t of towerTops) {
    lamp.add(k.mesh(festoon(t, hub, 1, 16, 9, hubBulbs), wireMat, false, false));
  }
  addBulbs(k, lamp, hubBulbs, 1.8, [0xffd37a, 0xffe7a8, 0xff9ad0, 0xc8a0ff]);
  const hubStarMat = new MeshStandardMaterial({
    color: 0xffd36b,
    emissive: 0xffb83a,
    emissiveIntensity: 0.9,
    roughness: 0.3,
    metalness: 0.4,
  });
  k.mats.push(hubStarMat);
  const hubStar = new Mesh(starGeo, hubStarMat);
  hubStar.position.set(0, 120, 0);
  hubStar.scale.setScalar(0.9);
  lamp.add(hubStar);
  const hubCord = k.mesh(new CylinderGeometry(0.3, 0.3, 10, 6), wireMat, false, false);
  hubCord.position.set(0, 128, 0);
  lamp.add(hubCord);

  // 조명: 보랏빛 달빛·하늘빛 + 판 위 따뜻한 스포트라이트(그림자) + 전구 줄의 따뜻한 번짐
  const lights = new Group();
  lights.add(new AmbientLight(0xc8b8ff, 0.3));
  lights.add(new HemisphereLight(0x9a88ff, 0x3a2a6a, 0.95));
  const moonLight = new DirectionalLight(0xb8a8ff, 0.9);
  moonLight.position.copy(moonDir).multiplyScalar(200);
  lights.add(moonLight);
  const spot = new SpotLight(0xffe2b0, 2300, 0, 0.6, 0.55, 1.2);
  spot.position.set(0, 115, 0);
  spot.target.position.set(0, 0, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0006;
  spot.shadow.camera.near = 40;
  spot.shadow.camera.far = 230;
  lights.add(spot, spot.target);
  for (const sz of [1, -1]) {
    const warm = new PointLight(0xffb070, 700, 0, 1.3);
    warm.position.set(0, 70, sz * 170);
    lights.add(warm);
  }

  // 책상: 둥근 모서리 남색 칠 상판, 금빛 띠 앞치마, 은빛 다리와 금구슬
  const desk = new Group();
  const R = 9;
  const hx = TABLE_HALF_X - 0.8;
  const hz = TABLE_HALF_Z - 0.8;
  const shape = new Shape();
  shape.moveTo(-hx + R, -hz);
  shape.lineTo(hx - R, -hz);
  shape.quadraticCurveTo(hx, -hz, hx, -hz + R);
  shape.lineTo(hx, hz - R);
  shape.quadraticCurveTo(hx, hz, hx - R, hz);
  shape.lineTo(-hx + R, hz);
  shape.quadraticCurveTo(-hx, hz, -hx, hz - R);
  shape.lineTo(-hx, -hz + R);
  shape.quadraticCurveTo(-hx, -hz, -hx + R, -hz);
  const bevel = 0.8;
  const topGeo = new ExtrudeGeometry(shape, {
    depth: TABLE_TOP_T - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 10,
  });
  const top = k.mesh(topGeo, k.std(0x3346a8, 0.4));
  top.rotation.x = -Math.PI / 2;
  top.position.y = TABLE_Y - (TABLE_TOP_T - bevel);
  desk.add(top);
  // 상판 바로 아래 금테(상판 둘레보다 안쪽)
  const trimMat = k.std(0xffcf6e, 0.28, 0.75);
  const silverMat = k.std(0xd8dcf0, 0.3, 0.7);
  const apronMat = k.std(0x23307a, 0.55);
  for (const sz of [1, -1]) {
    const apron = k.mesh(new BoxGeometry(TABLE_HALF_X * 2 - 16, 7, 2), apronMat);
    apron.position.set(0, TABLE_Y - TABLE_TOP_T - 3.5, sz * (TABLE_HALF_Z - 6));
    desk.add(apron);
    for (const [dy, m] of [
      [-1.5, trimMat],
      [1.6, silverMat],
    ] as const) {
      const trim = k.mesh(new BoxGeometry(TABLE_HALF_X * 2 - 16, 0.9, 0.4), m, false, false);
      trim.position.set(0, TABLE_Y - TABLE_TOP_T - 3.5 + dy, sz * (TABLE_HALF_Z - 4.9));
      desk.add(trim);
    }
    // 앞치마 가운데 금별
    const st = new Mesh(starGeo, trimMat);
    st.scale.setScalar(0.28);
    st.position.set(0, TABLE_Y - TABLE_TOP_T - 3.5, sz * (TABLE_HALF_Z - 4.6));
    st.rotation.y = sz > 0 ? 0 : Math.PI;
    desk.add(st);
  }
  for (const sx of [1, -1]) {
    const apron = k.mesh(new BoxGeometry(2, 7, TABLE_HALF_Z * 2 - 12), apronMat);
    apron.position.set(sx * (TABLE_HALF_X - 8), TABLE_Y - TABLE_TOP_T - 3.5, 0);
    desk.add(apron);
  }
  const legMat = k.std(0x2a3a96, 0.45);
  const legH = TABLE_Y - TABLE_TOP_T - FLOOR_Y;
  for (const [a, b] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    const lx = a * (TABLE_HALF_X - 8);
    const lz = b * (TABLE_HALF_Z - 6);
    const leg = k.mesh(new CylinderGeometry(3, 2.4, legH, 16), legMat);
    leg.position.set(lx, FLOOR_Y + legH / 2, lz);
    desk.add(leg);
    for (const [y, r, m] of [
      [TABLE_Y - TABLE_TOP_T - 10, 4, trimMat],
      [FLOOR_Y + legH * 0.45, 3.6, silverMat],
      [FLOOR_Y + 3.4, 4.2, trimMat],
    ] as const) {
      const knob = k.mesh(new SphereGeometry(r, 16, 12), m);
      knob.position.set(lx, y, lz);
      desk.add(knob);
    }
  }

  return {
    room,
    desk,
    lamp,
    lights,
    background: 0x2a1a6a,
    board: {
      base: '#d8c8ee',
      grain: '120,96,160',
      line: 'rgba(58,36,120,0.72)',
      side: 0x6a58b8,
      seam: 0x2e2270,
      leg: 0x2a2468,
      rim: 0xffd36b,
      star: 'rgba(90,56,170,0.85)',
    },
  };
};
