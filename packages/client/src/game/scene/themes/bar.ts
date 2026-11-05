// 바 테마(기본, DEC-050·DEC-079): "장난감 왕국" 놀이방. 로그인 일러스트(L 세트)와 같은 따뜻한 원목·금빛·보라 마법 화풍.
// 꿀색 마루와 둥근 러그, 원목 징두리 벽지, 장난감 선반(곰 인형·블록·책·성·화분·유리병 불빛), 꼬마전구 줄과 삼각 깃발,
// 저녁 하늘 창, 왕국 문장, 떠다니는 마법 반짝이, 놋쇠 돔 펜던트 조명, 둥근 모서리 꿀색 책상, 금테 판.
// 반복되는 소품은 toy-kit.ts의 도형별 인스턴스 묶음(Batch)으로 그려 그리기 호출을 몇 번으로 줄인다.
import {
  AmbientLight,
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
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
  type ThemeBuilder,
} from '../stage-kit.ts';
import {
  BEAR,
  Batch,
  TOY,
  addBunting,
  addSparkles,
  castle,
  sparkle,
  teddy,
  type Spot,
} from './toy-kit.ts';

/** 방 안쪽 반폭(벽 위치)과 천장 높이 */
const ROOM_HALF = 200;
const WALL_H = 250;
const CEIL_Y = FLOOR_Y + WALL_H;
/** 징두리(아래 원목 판) 높이 비율 */
const WAINSCOT = 0.34;

// ───────────────────────── 절차 텍스처 ─────────────────────────

/** 꿀색 원목 마루: 판자마다 색을 조금씩 달리하고 이음매·결을 그린다 */
function createFloorTexture(): Texture {
  const tex = canvasTexture(512, (g, s) => {
    const rnd = lcg(11);
    const rows = 8;
    const rh = s / rows;
    for (let i = 0; i < rows; i++) {
      // 같은 줄 안에서도 판자 끝 이음이 엇갈린다
      let x = -rnd() * 200;
      while (x < s) {
        const len = 160 + rnd() * 200;
        g.fillStyle = `hsl(${26 + rnd() * 8},${52 + rnd() * 12}%,${40 + rnd() * 10}%)`;
        g.fillRect(x, i * rh, len, rh);
        for (let k = 0; k < 6; k++) {
          g.strokeStyle = `rgba(90,40,10,${0.08 + rnd() * 0.1})`;
          g.lineWidth = 1;
          const y = i * rh + 4 + rnd() * (rh - 8);
          g.beginPath();
          g.moveTo(x, y);
          g.bezierCurveTo(
            x + len * 0.3,
            y + rnd() * 4 - 2,
            x + len * 0.7,
            y + rnd() * 4 - 2,
            x + len,
            y,
          );
          g.stroke();
        }
        g.fillStyle = 'rgba(60,24,6,0.45)';
        g.fillRect(x, i * rh, 2, rh);
        x += len;
      }
      g.fillStyle = 'rgba(60,24,6,0.5)';
      g.fillRect(0, i * rh, s, 2);
      g.fillStyle = 'rgba(255,220,170,0.12)';
      g.fillRect(0, i * rh + 2, s, 2);
    }
  });
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

/** 벽: 아래는 원목 징두리 판, 위는 별·마름모 무늬의 살구색 벽지 */
function createWallTexture(): Texture {
  const tex = canvasTextureWH(512, 1024, (g, w, h) => {
    const split = h * (1 - WAINSCOT);
    const paper = g.createLinearGradient(0, 0, 0, split);
    paper.addColorStop(0, '#d98a4e');
    paper.addColorStop(0.55, '#f1b878');
    paper.addColorStop(1, '#f6c98e');
    g.fillStyle = paper;
    g.fillRect(0, 0, w, split);
    // 세로 줄무늬와 작은 별
    for (let x = 0; x < w; x += 64) {
      g.fillStyle = 'rgba(255,240,210,0.14)';
      g.fillRect(x, 0, 22, split);
    }
    g.fillStyle = 'rgba(255,236,190,0.45)';
    for (let y = 40; y < split - 20; y += 96) {
      for (let x = 43; x < w; x += 128) {
        const ox = (y / 96) % 2 === 0 ? 0 : 64;
        sparkle(g, (x + ox) % w, y, 9);
      }
    }
    // 징두리: 판자 면 + 볼록 판 테두리
    g.fillStyle = '#9a5428';
    g.fillRect(0, split, w, h - split);
    const panels = 2;
    const pw = w / panels;
    for (let i = 0; i < panels; i++) {
      const x0 = i * pw + 16;
      const y0 = split + 34;
      const pwi = pw - 32;
      const phi = h - split - 70;
      g.fillStyle = '#b4693a';
      g.fillRect(x0, y0, pwi, phi);
      g.strokeStyle = 'rgba(255,214,160,0.35)';
      g.lineWidth = 4;
      g.strokeRect(x0 + 2, y0 + 2, pwi - 4, phi - 4);
      g.strokeStyle = 'rgba(60,20,4,0.4)';
      g.strokeRect(x0 + 10, y0 + 10, pwi - 20, phi - 20);
    }
    // 의자 높이 띠(금빛 몰딩)와 걸레받이
    g.fillStyle = '#6a3414';
    g.fillRect(0, split - 6, w, 22);
    g.fillStyle = '#ffcf6e';
    g.fillRect(0, split + 2, w, 5);
    g.fillStyle = '#5a2a10';
    g.fillRect(0, h - 28, w, 28);
  });
  tex.wrapS = RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

/** 창밖: 보랏빛 초저녁 하늘, 노을 띠, 별, 숲 실루엣과 멀리 번지는 마을 불빛 */
function createWindowTexture(seed: number): Texture {
  return canvasTextureWH(512, 512, (g, w, h) => {
    const rnd = lcg(seed);
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#20206a');
    sky.addColorStop(0.45, '#5a3c9a');
    sky.addColorStop(0.72, '#d9728a');
    sky.addColorStop(0.86, '#ffb070');
    sky.addColorStop(1, '#ffd08a');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = `rgba(255,246,210,${0.4 + rnd() * 0.6})`;
      const r = rnd() < 0.1 ? 2.4 : 1 + rnd();
      g.beginPath();
      g.arc(rnd() * w, rnd() * h * 0.5, r, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(255,248,220,0.95)';
    sparkle(g, w * 0.78, h * 0.18, 12);
    // 숲 실루엣
    g.fillStyle = '#2a1840';
    for (let x = -20; x < w + 20; x += 26 + rnd() * 20) {
      const th = h * (0.18 + rnd() * 0.14);
      g.beginPath();
      g.moveTo(x - 22, h);
      g.lineTo(x, h - th);
      g.lineTo(x + 22, h);
      g.fill();
    }
    // 번지는 불빛(보케)
    for (let i = 0; i < 26; i++) {
      const x = rnd() * w;
      const y = h * (0.6 + rnd() * 0.35);
      const r = 6 + rnd() * 16;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,214,140,0.9)');
      gr.addColorStop(1, 'rgba(255,170,90,0)');
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** 동심원 러그: 짙은 다홍·겨자·크림·보라 띠와 지그재그 */
function createRugTexture(): Texture {
  return canvasTexture(1024, (g, s) => {
    const c = s / 2;
    const bands = ['#b8452f', '#f0b34a', '#f6e3c0', '#7a4ab0', '#e0703a', '#f6e3c0', '#b8452f'];
    bands.forEach((col, i) => {
      g.fillStyle = col;
      g.beginPath();
      g.arc(c, c, c * (1 - i * 0.13), 0, Math.PI * 2);
      g.fill();
    });
    g.strokeStyle = '#5a2a10';
    g.lineWidth = 6;
    for (const rr of [0.935, 0.545]) {
      g.beginPath();
      for (let k = 0; k <= 96; k++) {
        const a = (k / 96) * Math.PI * 2;
        const r = c * (rr + (k % 2 === 0 ? 0.025 : -0.025));
        g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      }
      g.stroke();
    }
    // 실 결 느낌
    const rnd = lcg(31);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,240,220'},0.06)`;
      g.fillRect(rnd() * s, rnd() * s, 2, 2);
    }
  });
}

/** 왕국 문장: 보라·파랑 원판에 금빛 왕관과 별, 금테 */
function createCrestTexture(): Texture {
  return canvasTexture(512, (g, s) => {
    const c = s / 2;
    const bg = g.createRadialGradient(c, c * 0.8, 10, c, c, c);
    bg.addColorStop(0, '#6a5ae8');
    bg.addColorStop(1, '#3a1e8a');
    g.fillStyle = bg;
    g.beginPath();
    g.arc(c, c, c, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffd36b';
    g.lineWidth = 18;
    g.beginPath();
    g.arc(c, c, c - 14, 0, Math.PI * 2);
    g.stroke();
    // 왕관
    g.fillStyle = '#ffd36b';
    g.beginPath();
    g.moveTo(c - 130, c + 40);
    g.lineTo(c - 140, c - 70);
    g.lineTo(c - 70, c - 10);
    g.lineTo(c, c - 110);
    g.lineTo(c + 70, c - 10);
    g.lineTo(c + 140, c - 70);
    g.lineTo(c + 130, c + 40);
    g.closePath();
    g.fill();
    g.fillRect(c - 132, c + 52, 264, 34);
    g.fillStyle = '#ff6a8a';
    for (const [x, y] of [
      [c - 140, c - 76],
      [c, c - 118],
      [c + 140, c - 76],
    ] as const) {
      g.beginPath();
      g.arc(x, y, 14, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#7ad8ff';
    g.beginPath();
    g.arc(c, c + 10, 20, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,248,220,0.95)';
    sparkle(g, c - 150, c + 150, 22);
    sparkle(g, c + 150, c + 150, 22);
  });
}

/** 장난감 선반 한 칸에 소품을 왼쪽부터 채운다 */
function fillShelf(
  b: Batch,
  at: Spot,
  y: number,
  width: number,
  depth: number,
  rnd: () => number,
  jars: Vector3[],
) {
  let x = -width / 2 + 2;
  const end = width / 2 - 2;
  let n = 0;
  while (x < end - 6) {
    const pick = (n++ + Math.floor(rnd() * 6)) % 6;
    const room = end - x;
    if (pick === 0 && room > 16) {
      teddy(
        b,
        at,
        x + 8,
        y,
        0,
        0.9 + rnd() * 0.3,
        BEAR[Math.floor(rnd() * BEAR.length)] ?? 0xc98a4e,
      );
      x += 18;
    } else if (pick === 1) {
      // 책 묶음: 세운 책 몇 권과 마지막 한 권은 비스듬히
      const count = 3 + Math.floor(rnd() * 4);
      for (let i = 0; i < count && x < end - 3; i++) {
        const t = 1.6 + rnd() * 1.4;
        const h = 14 + rnd() * 8;
        const lean = i === count - 1 ? -0.25 : 0;
        b.add(
          'box',
          at,
          x + t / 2,
          y + h / 2,
          0,
          t,
          h,
          depth * 0.7,
          TOY[Math.floor(rnd() * TOY.length)] ?? 0xe2504a,
          [0, 0, lean],
        );
        x += t + 0.3;
      }
      x += 3;
    } else if (pick === 2) {
      // 블록 쌓기
      const s = 5 + rnd() * 1.5;
      b.add(
        'box',
        at,
        x + s,
        y + s / 2,
        0,
        s,
        s,
        s,
        TOY[Math.floor(rnd() * TOY.length)] ?? 0xffc94a,
        [0, rnd() * 0.4, 0],
      );
      b.add(
        'box',
        at,
        x + s * 2.05,
        y + s / 2,
        1,
        s,
        s,
        s,
        TOY[Math.floor(rnd() * TOY.length)] ?? 0x3a86e8,
        [0, -0.3, 0],
      );
      b.add(
        'box',
        at,
        x + s * 1.5,
        y + s * 1.5,
        0.5,
        s,
        s,
        s,
        TOY[Math.floor(rnd() * TOY.length)] ?? 0x5bbf6a,
        [0, 0.5, 0],
      );
      x += s * 2.8;
    } else if (pick === 3) {
      // 화분: 테라코타 화분 + 이파리 덩이
      b.add('cyl', at, x + 5, y + 3.5, 0, 4, 7, 4, 0xc0603a);
      b.add('cyl', at, x + 5, y + 7.2, 0, 4.4, 1, 4.4, 0xa84e2c);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + rnd();
        b.add(
          'ico',
          at,
          x + 5 + Math.cos(a) * 3,
          y + 10 + rnd() * 4,
          Math.sin(a) * 3,
          3.2,
          3.2,
          3.2,
          rnd() < 0.5 ? 0x4a9a4a : 0x6abf5a,
        );
      }
      x += 11;
    } else if (pick === 4) {
      // 유리병 등불(빛나는 알은 따로 그린다)
      b.add('cyl', at, x + 4, y + 5, 0, 3.4, 10, 3.4, 0xffe2a8);
      b.add('cyl', at, x + 4, y + 10.6, 0, 2.4, 1.6, 2.4, 0x8a5a2c);
      const cs = Math.cos(at.yaw);
      const sn = Math.sin(at.yaw);
      jars.push(new Vector3(at.x + (x + 4) * cs, at.y + y + 5, at.z - (x + 4) * sn));
      x += 9;
    } else {
      // 공
      const r = 3.5 + rnd() * 1.5;
      b.add(
        'sphere',
        at,
        x + r + 1,
        y + r,
        0,
        r,
        r,
        r,
        TOY[Math.floor(rnd() * TOY.length)] ?? 0xe2504a,
      );
      x += r * 2 + 3;
    }
  }
}

/** 선반장: 옆판·윗판·칸·뒤판. 앞이 지역 +z */
function bookcase(
  b: Batch,
  at: Spot,
  w: number,
  h: number,
  d: number,
  shelves: number,
  rnd: () => number,
  jars: Vector3[],
) {
  const wood = 0xa8612c;
  const dark = 0x6a3414;
  const t = 2.4;
  b.add('box', at, -w / 2 + t / 2, h / 2, 0, t, h, d, wood);
  b.add('box', at, w / 2 - t / 2, h / 2, 0, t, h, d, wood);
  b.add('box', at, 0, h - t / 2, 0, w + 3, t, d + 2, wood);
  b.add('box', at, 0, h / 2, -d / 2 + 0.5, w - t * 2, h, 1, dark);
  const gap = (h - t * 2) / shelves;
  for (let i = 0; i < shelves; i++) {
    const y = t + i * gap;
    b.add('box', at, 0, y, 0, w - t * 2, t, d, wood);
    b.add('box', at, 0, y + t / 2 - 0.2, d / 2 - 0.3, w - t * 2, 0.8, 0.6, 0xffcf6e); // 칸 앞 금빛 띠
    fillShelf(b, at, y + t / 2, w - t * 2, d, rnd, jars);
  }
}

// ───────────────────────── 테마 ─────────────────────────

export const buildBarTheme: ThemeBuilder = (k) => {
  const room = new Group();
  const batch = new Batch();
  const rnd = lcg(42);
  const jars: Vector3[] = [];

  // 바닥·벽·천장
  const plank = createFloorTexture();
  k.texs.push(plank);
  const floorMat = new MeshStandardMaterial({ map: plank, roughness: 0.75 });
  k.mats.push(floorMat);
  const floor = k.mesh(new PlaneGeometry(ROOM_HALF * 2, ROOM_HALF * 2), floorMat, false, true);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  room.add(floor);

  const wallTex = createWallTexture();
  k.texs.push(wallTex);
  const wallMat = new MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
  k.mats.push(wallMat);
  const wallGeo = new PlaneGeometry(ROOM_HALF * 2, WALL_H);
  k.geos.push(wallGeo);
  for (let i = 0; i < 4; i++) {
    const yaw = (i * Math.PI) / 2;
    const wall = new Mesh(wallGeo, wallMat);
    wall.receiveShadow = true;
    wall.position.set(-Math.sin(yaw) * ROOM_HALF, FLOOR_Y + WALL_H / 2, -Math.cos(yaw) * ROOM_HALF);
    wall.rotation.y = yaw;
    room.add(wall);
  }

  const ceilTex = createFloorTexture();
  ceilTex.repeat.set(3, 3);
  k.texs.push(ceilTex);
  const ceilMat = new MeshStandardMaterial({ map: ceilTex, color: 0xc89068, roughness: 0.9 });
  k.mats.push(ceilMat);
  const ceil = k.mesh(new PlaneGeometry(ROOM_HALF * 2, ROOM_HALF * 2), ceilMat, false, false);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = CEIL_Y;
  room.add(ceil);
  const origin: Spot = { x: 0, y: 0, z: 0, yaw: 0 };
  for (let i = -2; i <= 2; i++) {
    batch.add('box', origin, i * 80, CEIL_Y - 6, 0, 10, 12, ROOM_HALF * 2, 0x6a3414);
  }

  // 둥근 러그와 뜨개 방석
  const rugTex = createRugTexture();
  k.texs.push(rugTex);
  const rugMat = new MeshStandardMaterial({ map: rugTex, roughness: 1 });
  k.mats.push(rugMat);
  const rug = k.mesh(new CircleGeometry(125, 64), rugMat, false, true);
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = FLOOR_Y + 0.3;
  room.add(rug);
  for (const [px, pz, c] of [
    [-78, 48, 0xf0b34a],
    [80, -46, 0xe2504a],
    [86, 52, 0x7a4ab0],
    [-84, -50, 0x48c6c0],
  ] as const) {
    batch.add('sphere', origin, px, FLOOR_Y + 9, pz, 15, 10, 15, c);
    batch.add(
      'cyl',
      origin,
      px,
      FLOOR_Y + 17.5,
      pz,
      6,
      1.2,
      6,
      new Color(c).multiplyScalar(0.8).getHex(),
    );
  }

  // 끝 벽(두 좌석이 마주 보는 쪽): 가운데 저녁 하늘 창, 양옆 장난감 선반장, 선반장 위 장난감 성
  [0, Math.PI].forEach((yaw, wi) => {
    const wallZ = -ROOM_HALF * Math.cos(yaw);
    const inward = Math.cos(yaw); // 끝 벽에서 방 안쪽 z 부호
    const winTex = createWindowTexture(7 + wi);
    k.texs.push(winTex);
    const winMat = new MeshBasicMaterial({ map: winTex });
    k.mats.push(winMat);
    const win = k.mesh(new PlaneGeometry(116, 96), winMat, false, false);
    win.position.set(0, 58, wallZ + inward * 0.6);
    win.rotation.y = yaw;
    room.add(win);
    const at: Spot = { x: 0, y: 0, z: wallZ + inward * 2, yaw };
    // 창틀·창살·창턱
    batch.add('box', at, 0, 58 + 50, 2, 128, 8, 6, 0x8a4a22);
    batch.add('box', at, 0, 58 - 50, 4, 132, 6, 12, 0x8a4a22);
    batch.add('box', at, -62, 58, 2, 8, 104, 6, 0x8a4a22);
    batch.add('box', at, 62, 58, 2, 8, 104, 6, 0x8a4a22);
    batch.add('box', at, 0, 58, 1.5, 3, 96, 3, 0x8a4a22);
    batch.add('box', at, 0, 58 + 10, 1.5, 116, 3, 3, 0x8a4a22);
    // 창턱 위 작은 장난감
    teddy(batch, at, -38, 58 - 47, 6, 1, 0xe8c08a);
    batch.add('box', at, 30, 58 - 47 + 3, 6, 6, 6, 6, 0x3a86e8, [0, 0.3, 0]);
    batch.add('box', at, 38, 58 - 47 + 3, 6, 6, 6, 6, 0xf07a1a, [0, -0.2, 0]);
    batch.add('box', at, 34, 58 - 47 + 9, 6, 6, 6, 6, 0xffc94a, [0, 0.6, 0]);
    // 커튼(창 양옆에 늘어진 보라 천)
    for (const sx of [-1, 1]) {
      batch.add('box', at, sx * 76, 50, 5, 16, 128, 3, 0x6a3ab0);
      batch.add('box', at, sx * 76, 30, 7, 18, 4, 4, 0xffcf6e); // 커튼 끈
    }
    batch.add('cyl', at, 0, 118, 6, 1.2, 190, 1.2, 0xffcf6e, [0, 0, Math.PI / 2]);
    for (const sx of [-1, 1]) {
      const bat: Spot = { x: sx * 135, y: FLOOR_Y, z: wallZ + inward * 16, yaw };
      bookcase(batch, bat, 92, 176, 28, 5, rnd, jars);
      castle(batch, bat, sx * -12, 176, -2, 1);
      teddy(batch, bat, sx * 30, 176, 2, 1.3, 0xc98a4e);
    }
  });

  // 옆 벽: 선반장 두 개 사이에 왕국 문장
  const crestTex = createCrestTexture();
  k.texs.push(crestTex);
  const crestMat = new MeshStandardMaterial({
    map: crestTex,
    roughness: 0.5,
    emissive: 0xffffff,
    emissiveMap: crestTex,
    emissiveIntensity: 0.35,
  });
  k.mats.push(crestMat);
  [Math.PI / 2, -Math.PI / 2].forEach((yaw) => {
    const wallX = -ROOM_HALF * Math.sin(yaw);
    const inward = Math.sin(yaw);
    for (const sz of [-1, 1]) {
      const at: Spot = { x: wallX + inward * 16, y: FLOOR_Y, z: sz * 95, yaw };
      bookcase(batch, at, 120, 150, 28, 4, rnd, jars);
      teddy(batch, at, -34, 150, 0, 1.6, BEAR[(sz + 1) % BEAR.length] ?? 0xe8c08a);
      batch.add('box', at, 20, 150 + 4, 0, 8, 8, 8, 0xe2504a, [0, 0.4, 0]);
      batch.add('box', at, 30, 150 + 4, 0, 8, 8, 8, 0x3a86e8, [0, -0.2, 0]);
      batch.add('box', at, 25, 150 + 12, 0, 8, 8, 8, 0xffc94a, [0, 0.7, 0]);
    }
    const crest = k.mesh(new CircleGeometry(34, 48), crestMat, false, false);
    crest.position.set(wallX + inward * 3.4, 70, 0);
    crest.rotation.y = yaw;
    room.add(crest);
    const at: Spot = { x: wallX + inward * 1, y: 0, z: 0, yaw };
    batch.add('cyl', at, 0, 70, 0.6, 37, 1.6, 37, 0x8a4a22, [Math.PI / 2, 0, 0]);
    // 문장 아래 큰 화분
    const pot: Spot = { x: wallX + inward * 26, y: FLOOR_Y, z: 0, yaw };
    batch.add('cyl', pot, 0, 13, 0, 11, 26, 11, 0xc0603a);
    batch.add('cyl', pot, 0, 27, 0, 12.5, 3, 12.5, 0xa84e2c);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 4 + rnd() * 7;
      batch.add(
        'ico',
        pot,
        Math.cos(a) * r,
        34 + rnd() * 26,
        Math.sin(a) * r,
        7,
        7,
        7,
        rnd() < 0.5 ? 0x4a9a4a : 0x6abf5a,
      );
    }
  });

  // 방 구석 큰 곰 인형과 장난감 상자
  teddy(batch, { x: -160, y: FLOOR_Y, z: 150, yaw: Math.PI * 0.75 }, 0, 0, 0, 3, 0xc98a4e);
  teddy(batch, { x: 160, y: FLOOR_Y, z: -150, yaw: -Math.PI * 0.25 }, 0, 0, 0, 3, 0xf2e6d2);
  for (const [cx, cz, yaw] of [
    [160, 150, -Math.PI * 0.75],
    [-160, -150, Math.PI * 0.25],
  ] as const) {
    const at: Spot = { x: cx, y: FLOOR_Y, z: cz, yaw };
    batch.add('box', at, 0, 14, 0, 40, 28, 26, 0xe2504a);
    batch.add('box', at, 0, 28.5, 0, 42, 3, 28, 0xffcf6e);
    batch.add('box', at, 0, 14, 13.2, 10, 10, 0.6, 0xffc94a);
    batch.add('sphere', at, -8, 33, 0, 6, 6, 6, 0x3a86e8);
    batch.add('box', at, 9, 33, 2, 7, 7, 7, 0x5bbf6a, [0, 0.5, 0]);
  }

  batch.flush(k, room);

  // 유리병 등불의 빛
  addBulbs(k, room, jars, 2.2, [0xffd37a, 0xffc35c, 0xffe7a8]);

  // 꼬마전구 줄: 벽을 따라 한 바퀴, 천장 가운데로 모이는 네 줄
  const wireMat = new MeshBasicMaterial({ color: 0x3a2010 });
  k.mats.push(wireMat);
  const bulbs: Vector3[] = [];
  const e = ROOM_HALF - 4;
  const ringY = CEIL_Y - 18;
  const corners = [
    new Vector3(e, ringY, e),
    new Vector3(-e, ringY, e),
    new Vector3(-e, ringY, -e),
    new Vector3(e, ringY, -e),
  ];
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % 4] ?? a;
    room.add(k.mesh(festoon(a, b, 5, 14, 4, bulbs), wireMat, false, false));
  });
  const hub = new Vector3(0, CEIL_Y - 4, 0);
  for (const c of corners) {
    room.add(k.mesh(festoon(c, hub, 1, 26, 9, bulbs), wireMat, false, false));
  }
  addBulbs(k, room, bulbs, 1.6, [0xffd37a, 0xffb070, 0xffe7a8, 0xc8a0ff, 0x9ad0ff]);

  // 삼각 깃발: 각 벽 위쪽에 처지는 줄
  addBunting(k, room, wireMat, [
    [new Vector3(-170, CEIL_Y - 30, -e + 6), new Vector3(170, CEIL_Y - 30, -e + 6), 0],
    [new Vector3(-170, CEIL_Y - 30, e - 6), new Vector3(170, CEIL_Y - 30, e - 6), Math.PI],
    [new Vector3(-e + 6, CEIL_Y - 30, -170), new Vector3(-e + 6, CEIL_Y - 30, 170), Math.PI / 2],
    [new Vector3(e - 6, CEIL_Y - 30, -170), new Vector3(e - 6, CEIL_Y - 30, 170), -Math.PI / 2],
  ]);

  // 떠다니는 마법 반짝이(판 위 공간은 비운다)
  addSparkles(k, room, rnd, { count: 160, rMin: 70, rMax: 185, yMin: -30, yMax: 140 });

  // 천장 펜던트: 놋쇠 돔 갓, 금빛 테, 따뜻한 전구
  const lamp = new Group();
  room.add(lamp);
  const brass = k.std(0xc9873a, 0.35, 0.6);
  const shade = k.mesh(
    new SphereGeometry(21, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    brass,
    false,
    false,
  );
  shade.position.y = 84;
  lamp.add(shade);
  const innerMat = new MeshBasicMaterial({ color: 0xffe2a8, side: DoubleSide });
  k.mats.push(innerMat);
  const inner = k.mesh(
    new SphereGeometry(20.6, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    innerMat,
    false,
    false,
  );
  inner.position.y = 84;
  inner.scale.y = 0.98;
  lamp.add(inner);
  const ring = k.mesh(new TorusGeometry(21, 1, 8, 48), k.std(0xffcf6e, 0.3, 0.8), false, false);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 84;
  lamp.add(ring);
  const cap = k.mesh(new CylinderGeometry(3, 4, 5, 16), brass, false, false);
  cap.position.y = 106;
  lamp.add(cap);
  const cord = k.mesh(
    new CylinderGeometry(0.5, 0.5, CEIL_Y - 108, 6),
    k.std(0x2a1408),
    false,
    false,
  );
  cord.position.y = (CEIL_Y + 108) / 2;
  lamp.add(cord);
  const bulbMat = new MeshBasicMaterial({ color: 0xfff4d0 });
  k.mats.push(bulbMat);
  const bulb = k.mesh(new SphereGeometry(5, 16, 12), bulbMat, false, false);
  bulb.position.y = 85;
  lamp.add(bulb);

  // 조명: 따뜻한 전체광 + 펜던트 주 스포트라이트(그림자) + 창 쪽 보랏빛 마법 보조광
  const lights = new Group();
  lights.add(new AmbientLight(0xffe6c8, 0.25));
  lights.add(new HemisphereLight(0xffd6a0, 0x6a3418, 0.75));
  const spot = new SpotLight(0xffc070, 950, 0, 0.95, 0.55, 1.2);
  spot.position.set(0, 78, 0);
  spot.target.position.set(0, 0, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0006;
  spot.shadow.camera.near = 20;
  spot.shadow.camera.far = 160;
  lights.add(spot, spot.target);
  const fill = new DirectionalLight(0xa890ff, 0.55);
  fill.position.set(-60, 50, 30);
  lights.add(fill);
  const wash = new PointLight(0xffa060, 0.55, 0, 0);
  wash.position.set(0, CEIL_Y - 30, 0);
  lights.add(wash);

  // 책상: 둥근 모서리 꿀색 상판, 금빛 띠를 두른 앞치마, 굵은 장난감 다리와 금구슬
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
  const top = k.mesh(topGeo, k.std(0xb8642a, 0.45));
  top.rotation.x = -Math.PI / 2;
  top.position.y = TABLE_Y - (TABLE_TOP_T - bevel);
  desk.add(top);
  const apronMat = k.std(0x8a4a22, 0.6);
  const trimMat = k.std(0xffcf6e, 0.3, 0.7);
  for (const sz of [1, -1]) {
    const apron = k.mesh(new BoxGeometry(TABLE_HALF_X * 2 - 16, 6, 2), apronMat);
    apron.position.set(0, TABLE_Y - TABLE_TOP_T - 3, sz * (TABLE_HALF_Z - 6));
    desk.add(apron);
    const trim = k.mesh(new BoxGeometry(TABLE_HALF_X * 2 - 16, 0.8, 0.4), trimMat, false, false);
    trim.position.set(0, TABLE_Y - TABLE_TOP_T - 3, sz * (TABLE_HALF_Z - 4.9));
    desk.add(trim);
  }
  for (const sx of [1, -1]) {
    const apron = k.mesh(new BoxGeometry(2, 6, TABLE_HALF_Z * 2 - 12), apronMat);
    apron.position.set(sx * (TABLE_HALF_X - 8), TABLE_Y - TABLE_TOP_T - 3, 0);
    desk.add(apron);
  }
  const legMat = k.std(0xa8612c, 0.55);
  const legH = TABLE_Y - TABLE_TOP_T - FLOOR_Y;
  for (const [a, b] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    const lx = a * (TABLE_HALF_X - 8);
    const lz = b * (TABLE_HALF_Z - 6);
    const leg = k.mesh(new CylinderGeometry(3.2, 2.6, legH, 16), legMat);
    leg.position.set(lx, FLOOR_Y + legH / 2, lz);
    desk.add(leg);
    for (const [y, r, m] of [
      [TABLE_Y - TABLE_TOP_T - 9, 4.2, legMat],
      [FLOOR_Y + legH * 0.45, 3.8, trimMat],
      [FLOOR_Y + 3.6, 4.4, legMat],
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
    background: 0x5a3420,
    board: {
      base: '#e3a65c',
      grain: '150,80,25',
      line: 'rgba(100,44,10,0.7)',
      side: 0xc7793a,
      seam: 0x7a3e18,
      leg: 0x8a4a22,
      rim: 0xffc861,
      star: 'rgba(150,60,20,0.85)',
    },
  };
};
