// 해변 테마(DEC-053·DEC-083): "장난감 해적섬의 노을 해변". 장난감 왕국 화풍(toy-kit.ts)으로 다시 그렸다.
// 분홍·주황 노을 하늘과 장난감 해, 뭉게구름, 반짝이는 하늘색 바다, 멀리 해적선 두 척·야자섬·줄무늬 등대·고무 오리,
// 따뜻한 모래섬 위 모래성·양동이와 삽·불가사리·조개·비치볼·줄무늬 파라솔·야자수·해적 깃발·보물 상자·세일러 곰 인형,
// 횃불 기둥 사이 꼬마전구 줄과 삼각 깃발, 노을빛 반짝이. 책상은 밧줄을 두른 나무 상자 해적 탁자, 판은 모래빛 나무에 청록 테.
// 하늘·바다는 조명을 받지 않는 canvas 그림이고, 판 위는 머리 위 흰빛 주 조명(그림자)으로 알·방해요소 색이 읽히게 한다.
// 반복 소품은 Batch(도형별 인스턴스)로 그려 그리기 호출을 줄인다.
import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  RingGeometry,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
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
import { BEAR, Batch, TOY, addBunting, addSparkles, sparkle, teddy, type Spot } from './toy-kit.ts';

/** 바다 수면 높이: 모래 바닥보다 조금 낮다 */
const SEA_Y = FLOOR_Y - 3;
/** 하늘 구 반경. 바다 원판 가장자리가 하늘 적도와 맞물려 수평선이 된다 */
const SKY_R = 430;
/** 모래섬 반경 */
const SAND_R = 190;
/** 해가 지는 방향(-Z 쪽, 약간 왼쪽). 하늘 그림·석양 조명·바다 반사가 이 각도를 따른다 */
const SUN_AZ = -Math.PI / 2 - 0.18;

const SAND = 0xf2c47e;
const SAND_DARK = 0xd9a05a;
const GOLD = 0xffc94a;

// ───────────────────────── 절차 텍스처 ─────────────────────────

/** 해골과 엇갈린 뼈(해적 문장). fg가 뼈, bg가 눈·코 구멍 */
function drawSkull(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fg: string,
  bg: string,
) {
  g.strokeStyle = fg;
  g.fillStyle = fg;
  g.lineCap = 'round';
  g.lineWidth = r * 0.32;
  for (const s of [-1, 1]) {
    const x0 = cx - 1.25 * r;
    const x1 = cx + 1.25 * r;
    const y0 = cy + 0.25 * r - s * 0.75 * r;
    const y1 = cy + 0.25 * r + s * 0.75 * r;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    for (const [ex, ey, dx, dy] of [
      [x0, y0, 1, -s],
      [x1, y1, -1, s],
    ] as const) {
      for (const k of [-1, 1]) {
        g.beginPath();
        g.arc(ex + k * dy * 0.14 * r, ey - k * dx * 0.14 * r, r * 0.2, 0, Math.PI * 2);
        g.fill();
      }
    }
  }
  g.beginPath();
  g.arc(cx, cy - 0.15 * r, r * 0.8, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.roundRect(cx - 0.46 * r, cy + 0.3 * r, 0.92 * r, 0.5 * r, 0.14 * r);
  g.fill();
  g.fillStyle = bg;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.ellipse(cx + s * 0.32 * r, cy - 0.1 * r, 0.21 * r, 0.24 * r, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.beginPath();
  g.moveTo(cx, cy + 0.1 * r);
  g.lineTo(cx - 0.1 * r, cy + 0.28 * r);
  g.lineTo(cx + 0.1 * r, cy + 0.28 * r);
  g.fill();
  g.fillRect(cx - 0.03 * r - 0.16 * r, cy + 0.52 * r, 0.06 * r, 0.26 * r);
  g.fillRect(cx - 0.03 * r, cy + 0.52 * r, 0.06 * r, 0.26 * r);
  g.fillRect(cx - 0.03 * r + 0.16 * r, cy + 0.52 * r, 0.06 * r, 0.26 * r);
}

/** 퐁실한 만화 구름 한 덩이: 둥근 뭉치 + 납작한 밑면, 아래쪽은 노을빛으로 물든다 */
function drawCloud(
  g: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  rnd: () => number,
  warm: number,
) {
  const h = w * 0.36;
  const grad = g.createLinearGradient(0, cy - h, 0, cy + h * 0.2);
  grad.addColorStop(0, '#fff6f2');
  grad.addColorStop(0.55, `rgb(255,${210 - warm * 30},${220 - warm * 70})`);
  grad.addColorStop(1, `rgb(255,${150 - warm * 20},${140 - warm * 50})`);
  g.fillStyle = grad;
  g.beginPath();
  const n = 5 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const px = cx - w / 2 + t * w;
    const pr = h * (0.42 + Math.sin(t * Math.PI) * 0.5) * (0.85 + rnd() * 0.3);
    g.moveTo(px + pr, cy);
    g.arc(px, cy - pr * 0.35, pr, 0, Math.PI * 2);
  }
  g.fill();
  g.fillRect(cx - w / 2 - h * 0.2, cy - h * 0.2, w + h * 0.4, h * 0.42);
}

/** 하늘(등장방형): 위는 하늘색, 가운데 분홍, 수평선은 주황·금빛. 장난감 해·뭉게구름·갈매기. 아래 절반은 바다색 */
function createSkyTexture(): Texture {
  return canvasTextureWH(2048, 1024, (g, w, h) => {
    const hz = h / 2;
    const sky = g.createLinearGradient(0, 0, 0, hz);
    sky.addColorStop(0, '#3f6fd8');
    sky.addColorStop(0.3, '#6a9aec');
    sky.addColorStop(0.56, '#c79ae0');
    sky.addColorStop(0.74, '#ff8fb0');
    sky.addColorStop(0.88, '#ff9a5a');
    sky.addColorStop(1, '#ffd27a');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, hz);
    g.fillStyle = '#2f8fe0';
    g.fillRect(0, hz, w, hz);

    const rnd = lcg(52);
    // 위쪽에 이른 별 반짝임
    for (let i = 0; i < 60; i++) {
      g.fillStyle = `rgba(255,250,230,${0.4 + rnd() * 0.5})`;
      const x = rnd() * w;
      const y = rnd() * hz * 0.35;
      if (rnd() < 0.2) sparkle(g, x, y, 5 + rnd() * 4);
      else g.fillRect(x, y, 2, 2);
    }

    // SphereGeometry의 u: 0=-X, 0.25=+Z, 0.5=+X, 0.75=-Z
    const sunU = (((Math.atan2(Math.sin(SUN_AZ), -Math.cos(SUN_AZ)) / (2 * Math.PI)) % 1) + 1) % 1;
    const sx = sunU * w;
    // 해 둘레 빛무리(가장자리 반복을 위해 좌우로 한 번 더)
    for (const ox of [-w, 0, w]) {
      g.save();
      g.translate(sx + ox, hz);
      g.scale(3, 1);
      const glow = g.createRadialGradient(0, 0, 0, 0, 0, 220);
      glow.addColorStop(0, 'rgba(255,236,150,0.95)');
      glow.addColorStop(0.35, 'rgba(255,170,90,0.55)');
      glow.addColorStop(1, 'rgba(255,120,120,0)');
      g.fillStyle = glow;
      g.fillRect(-220, -220, 440, 220);
      g.restore();
    }

    // 뭉게구름(해에서 멀수록 분홍빛이 옅다)
    for (let i = 0; i < 22; i++) {
      const cx = rnd() * w;
      const cy = h * (0.27 + rnd() * 0.17);
      const cw = 110 + rnd() * 170;
      const d = Math.abs(((cx - sx + w * 1.5) % w) - w / 2) / (w / 2);
      for (const ox of [-w, 0, w]) drawCloud(g, cx + ox, cy, cw, rnd, 1 - d);
    }

    // 장난감 해: 노랑→주황 원판, 아래쪽은 가로 줄로 잘려 바다에 잠긴다
    g.save();
    g.beginPath();
    g.rect(0, 0, w, hz);
    g.clip();
    const sy = hz - 30;
    const sr = 66;
    const sun = g.createLinearGradient(0, sy - sr, 0, sy + sr);
    sun.addColorStop(0, '#fff6b0');
    sun.addColorStop(0.5, '#ffd25a');
    sun.addColorStop(1, '#ff8a3a');
    g.fillStyle = sun;
    g.beginPath();
    g.arc(sx, sy, sr, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 4; i++) {
      g.fillStyle = `rgba(255,${150 + i * 10},${120 + i * 10},0.95)`;
      g.fillRect(sx - sr, sy + 12 + i * 15, sr * 2, 4 + i * 1.6);
    }
    g.restore();

    // 갈매기
    g.strokeStyle = 'rgba(70,40,90,0.7)';
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const x = rnd() * w;
      const y = h * (0.2 + rnd() * 0.22);
      const s = 7 + rnd() * 6;
      g.beginPath();
      g.moveTo(x - s, y);
      g.quadraticCurveTo(x - s / 2, y - s * 0.6, x, y);
      g.quadraticCurveTo(x + s / 2, y - s * 0.6, x + s, y);
      g.stroke();
    }
  });
}

/** 바다(위에서 본 원판): 섬 둘레는 청록, 멀수록 파랑, 수평선은 노을빛. 해 쪽 금빛 물결 기둥과 반짝임 */
function createSeaTexture(): Texture {
  return canvasTexture(1024, (g, s) => {
    const c = s / 2;
    const base = g.createRadialGradient(c, c, 0, c, c, c);
    base.addColorStop(0, '#5ae8d8');
    base.addColorStop(0.44, '#5ae8d8');
    base.addColorStop(0.52, '#2fcbe0');
    base.addColorStop(0.7, '#2a9cf0');
    base.addColorStop(0.86, '#4a7ae0');
    base.addColorStop(0.95, '#c58ac8');
    base.addColorStop(1, '#ffb47a');
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);

    const rnd = lcg(7);
    // 만화식 잔물결(흰 반달)
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 2.4;
    for (let i = 0; i < 420; i++) {
      const a = rnd() * Math.PI * 2;
      const r = c * (0.46 + rnd() * 0.5);
      const px = c + Math.cos(a) * r;
      const py = c + Math.sin(a) * r;
      const ww = 6 + rnd() * 8;
      g.beginPath();
      g.arc(px, py, ww, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    }
    // 해 방향 반사 기둥. 캔버스 위쪽(행 0)이 월드 -Z, 오른쪽이 +X다
    const dx = Math.cos(SUN_AZ);
    const dz = Math.sin(SUN_AZ);
    for (let i = 0; i < 320; i++) {
      const t = 0.45 + rnd() * 0.55;
      const spread = (rnd() - 0.5) * (0.05 + t * 0.12) * s;
      const px = c + dx * t * c - dz * spread;
      const py = c + dz * t * c + dx * spread;
      g.fillStyle = `rgba(255,${210 + rnd() * 40},${120 + rnd() * 60},${0.35 + t * 0.55})`;
      g.fillRect(px - 6 - rnd() * 10, py, 12 + rnd() * 20, 2.5);
    }
    // 반짝임 ✦
    for (let i = 0; i < 120; i++) {
      const a = rnd() * Math.PI * 2;
      const r = c * (0.46 + rnd() * 0.5);
      g.fillStyle = `rgba(255,252,230,${0.6 + rnd() * 0.4})`;
      sparkle(g, c + Math.cos(a) * r, c + Math.sin(a) * r, 3 + rnd() * 4);
    }
  });
}

/** 모래: 따뜻한 살구빛 바탕에 알갱이·작은 조개 조각·바람 자국 */
function createSandTexture(): Texture {
  const tex = canvasTexture(512, (g, s) => {
    g.fillStyle = '#f0c27c';
    g.fillRect(0, 0, s, s);
    const rnd = lcg(31);
    for (let i = 0; i < 6000; i++) {
      const l = rnd();
      g.fillStyle =
        l < 0.45
          ? 'rgba(190,120,60,0.22)'
          : l < 0.9
            ? 'rgba(255,248,225,0.4)'
            : 'rgba(255,150,150,0.35)';
      g.fillRect(rnd() * s, rnd() * s, 2, 2);
    }
    g.strokeStyle = 'rgba(200,130,70,0.22)';
    g.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const y = rnd() * s;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(s * 0.3, y + 12, s * 0.6, y - 12, s, y);
      g.stroke();
    }
  });
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(7, 7);
  return tex;
}

/** 나무 상자 면: 가로 널판, 진한 테두리 틀, 대각선 버팀목, 못 */
function createCrateTexture(): Texture {
  return canvasTexture(256, (g, s) => {
    const rnd = lcg(23);
    const rows = 4;
    for (let i = 0; i < rows; i++) {
      g.fillStyle = `hsl(${28 + rnd() * 6},${58 + rnd() * 10}%,${50 + rnd() * 8}%)`;
      g.fillRect(0, (i * s) / rows, s, s / rows);
      for (let k = 0; k < 5; k++) {
        g.fillStyle = `rgba(110,50,15,${0.1 + rnd() * 0.12})`;
        g.fillRect(0, (i * s) / rows + 4 + rnd() * (s / rows - 8), s, 1.5);
      }
      g.fillStyle = 'rgba(80,36,10,0.6)';
      g.fillRect(0, (i * s) / rows, s, 3);
    }
    const f = 26;
    g.save();
    g.beginPath();
    g.rect(f, f, s - f * 2, s - f * 2);
    g.clip();
    g.translate(s / 2, s / 2);
    g.rotate(-Math.PI / 4);
    g.fillStyle = '#b06a30';
    g.fillRect(-s, -f / 2, s * 2, f);
    g.fillStyle = 'rgba(70,30,8,0.5)';
    g.fillRect(-s, -f / 2, s * 2, 2);
    g.fillRect(-s, f / 2 - 2, s * 2, 2);
    g.restore();
    g.fillStyle = '#b06a30';
    g.fillRect(0, 0, s, f);
    g.fillRect(0, s - f, s, f);
    g.fillRect(0, 0, f, s);
    g.fillRect(s - f, 0, f, s);
    g.strokeStyle = 'rgba(70,30,8,0.6)';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, s - 3, s - 3);
    g.strokeRect(f, f, s - f * 2, s - f * 2);
    g.fillStyle = '#ffd36b';
    for (const [x, y] of [
      [f / 2, f / 2],
      [s - f / 2, f / 2],
      [f / 2, s - f / 2],
      [s - f / 2, s - f / 2],
    ] as const) {
      g.beginPath();
      g.arc(x, y, 5, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** 탁자 널판: 볕 받은 꿀빛 원목 */
function createPlankTexture(): Texture {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#d68e48';
    g.fillRect(0, 0, s, s);
    const rnd = lcg(19);
    for (let i = 0; i < 46; i++) {
      g.fillStyle = `rgba(${rnd() < 0.6 ? '120,60,20' : '255,225,180'},${0.1 + rnd() * 0.15})`;
      g.fillRect(0, rnd() * s, s, 1 + rnd() * 2);
    }
  });
}

/** 꼰 밧줄: 비스듬한 줄무늬. v 방향으로 반복한다 */
function createRopeTexture(): Texture {
  const tex = canvasTexture(64, (g, s) => {
    g.fillStyle = '#e0b878';
    g.fillRect(0, 0, s, s);
    g.strokeStyle = '#9a6a34';
    g.lineWidth = 7;
    for (let i = -2; i < 3; i++) {
      g.beginPath();
      g.moveTo(0, i * (s / 2));
      g.lineTo(s, i * (s / 2) + s);
      g.stroke();
    }
  });
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  return tex;
}

/** 세로 띠 무늬(비치볼·파라솔). u를 따라 색이 바뀐다 */
function createStripeTexture(colors: readonly string[]): Texture {
  return canvasTextureWH(512, 64, (g, w, h) => {
    const n = colors.length;
    colors.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect((i * w) / n, 0, w / n + 1, h);
    });
  });
}

/** 돛: 크림색 천에 빨간 띠, 가운데 해적 문장 */
function createSailTexture(): Texture {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#fff2d8';
    g.fillRect(0, 0, s, s);
    g.fillStyle = '#e2504a';
    g.fillRect(0, 10, s, 22);
    g.fillRect(0, s - 32, s, 22);
    g.fillStyle = 'rgba(150,90,40,0.25)';
    for (let x = 0; x < s; x += 32) g.fillRect(x, 0, 2, s);
    drawSkull(g, s / 2, s / 2 - 4, 46, '#2a2038', '#fff2d8');
  });
}

/** 해적 깃발: 짙은 남보라 바탕에 흰 해골 */
function createFlagTexture(): Texture {
  return canvasTextureWH(256, 192, (g, w, h) => {
    g.fillStyle = '#231a3a';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffc94a';
    g.fillRect(0, 0, w, 8);
    g.fillRect(0, h - 8, w, 8);
    drawSkull(g, w / 2, h / 2 - 6, 50, '#fff6e6', '#231a3a');
  });
}

// ───────────────────────── 도우미 ─────────────────────────

/** 지역 좌표를 월드 좌표로(Batch와 같은 변환) */
function wpos(at: Spot, lx: number, ly: number, lz: number): Vector3 {
  const cs = Math.cos(at.yaw);
  const sn = Math.sin(at.yaw);
  return new Vector3(at.x + lx * cs + lz * sn, at.y + ly, at.z - lx * sn + lz * cs);
}

/** (x, z)에서 섬 가운데를 바라보는 놓을 자리 */
function facing(x: number, y: number, z: number, turn = 0): Spot {
  return { x, y, z, yaw: Math.atan2(-x, -z) + turn };
}

/** 원기둥의 v 좌표를 늘려 밧줄 무늬가 길이에 맞게 반복되게 한다 */
function ropeGeo(len: number, r: number): BufferGeometry {
  const geo = new CylinderGeometry(r, r, len, 10, 1, true);
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setY(i, (uv.getY(i) * len) / (r * 3));
  return geo;
}

// ───────────────────────── 소품(Batch) ─────────────────────────

/** 장난감 야자수: 줄무늬 마디 줄기, 늘어진 넓은 잎, 코코넛 */
function palm(b: Batch, at: Spot, sc: number, rnd: () => number) {
  let x = 0;
  let y = 0;
  const segH = 12 * sc;
  for (let i = 0; i < 9; i++) {
    const tilt = 0.04 + i * 0.035;
    const r = (4.4 - i * 0.22) * sc;
    b.add(
      'cyl',
      at,
      x + (Math.sin(tilt) * segH) / 2,
      y + (Math.cos(tilt) * segH) / 2,
      0,
      r,
      segH * 1.02,
      r,
      i % 2 ? 0xb87a3e : 0x8e5428,
      [0, 0, -tilt],
    );
    x += Math.sin(tilt) * segH;
    y += Math.cos(tilt) * segH;
  }
  const leafCols = [0x3aaa4a, 0x5ccf5a, 0x2e9442, 0x7ad860];
  for (let j = 0; j < 9; j++) {
    const a = (j / 9) * Math.PI * 2 + rnd() * 0.3;
    const L = (26 + rnd() * 8) * sc;
    const droop = 0.3 + rnd() * 0.35;
    const d = L * 0.48;
    b.add(
      'sphere',
      at,
      x + Math.cos(droop) * Math.cos(a) * d,
      y - Math.sin(droop) * d + 2 * sc,
      -Math.cos(droop) * Math.sin(a) * d,
      L / 2,
      0.9 * sc,
      L * 0.15,
      leafCols[j % leafCols.length] ?? 0x3aaa4a,
      [0, a, -droop],
    );
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    b.add(
      'sphere',
      at,
      x + Math.cos(a) * 3 * sc,
      y - 2.5 * sc,
      Math.sin(a) * 3 * sc,
      2.6 * sc,
      2.6 * sc,
      2.6 * sc,
      0x6a3e1e,
    );
  }
}

/** 모래성: 넓은 받침, 성채, 양동이 모양 탑, 작은 깃발과 조개 장식. sc=1이 폭 약 44cm */
function sandcastle(b: Batch, at: Spot, sc: number) {
  const P = (
    kind: 'box' | 'cyl' | 'cone' | 'sphere',
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    c: number,
  ) => b.add(kind, at, x * sc, y * sc, z * sc, sx * sc, sy * sc, sz * sc, c);
  P('cyl', 0, 2.5, 0, 24, 5, 22, SAND_DARK);
  P('box', 0, 12, 0, 22, 14, 18, SAND);
  for (let i = -2; i <= 2; i++) {
    P('box', i * 4.6, 20.2, 9, 2.4, 2.4, 1.8, SAND);
    P('box', i * 4.6, 20.2, -9, 2.4, 2.4, 1.8, SAND);
  }
  P('box', 0, 9, 9.1, 6, 9, 0.4, 0x8a5a30);
  P('cyl', 0, 13.5, 9.2, 3, 0.4, 0.2, 0x8a5a30);
  const towers: [number, number, number][] = [
    [-12, 10, 18],
    [12, 10, 18],
    [-12, -9, 16],
    [12, -9, 16],
    [0, -2, 30],
  ];
  towers.forEach(([x, z, h], i) => {
    const r = i === 4 ? 6.5 : 5;
    P('cyl', x, h / 2 + 5, z, r, h, r, SAND);
    P('cyl', x, h + 5.8, z, r + 1, 1.6, r + 1, SAND_DARK);
    P('cyl', x, h + 9, z, 0.25, 6, 0.25, 0x6a3a1a);
    P('box', x + 1.8, h + 10.5, z, 3.4, 2.2, 0.2, TOY[(i * 3) % TOY.length] ?? 0xe2504a);
    P('box', x, h / 2 + 7, z + r - 0.1, 1.6, 2.4, 0.4, 0x8a5a30);
  });
  for (let i = 0; i < 6; i++) {
    const a = -1 + (i / 5) * 2;
    P(
      'sphere',
      Math.sin(a) * 23,
      4.6,
      Math.cos(a) * 21,
      1.4,
      0.8,
      1.2,
      [0xffb0c8, 0xfff2e0, 0xffd08a][i % 3] ?? 0xffb0c8,
    );
  }
}

/** 불가사리: 가운데 원판과 다섯 팔 */
function starfish(b: Batch, at: Spot, lx: number, lz: number, sc: number, c: number, spin: number) {
  const y = 0.6 * sc;
  b.add('sphere', at, lx, y, lz, 2.2 * sc, 0.9 * sc, 2.2 * sc, c);
  for (let i = 0; i < 5; i++) {
    const a = spin + (i / 5) * Math.PI * 2;
    const d = 3.2 * sc;
    b.add(
      'sphere',
      at,
      lx + Math.cos(a) * d,
      y,
      lz - Math.sin(a) * d,
      3.8 * sc,
      0.8 * sc,
      1.4 * sc,
      c,
      [0, a, 0],
    );
  }
}

/** 열린 보물 상자: 몸통·금띠·젖힌 뚜껑·금화 더미·보석. 금화 반짝임 자리를 glints에 더한다 */
function chest(b: Batch, at: Spot, rnd: () => number, glints: Vector3[]) {
  b.add('box', at, 0, 8, 0, 30, 16, 20, 0x8a4a22);
  b.add('box', at, 0, 1.5, 0, 30.6, 3, 20.6, GOLD);
  b.add('box', at, 0, 14.5, 0, 30.6, 3, 20.6, GOLD);
  for (const sx of [-1, 1]) b.add('box', at, sx * 10, 8, 0, 2.4, 16.4, 20.8, GOLD);
  b.add('box', at, 0, 12, 10.5, 4, 5, 0.8, 0xffe08a);
  // 뚜껑: 뒤 경첩에서 뒤로 젖혔다
  const th = -1.9;
  const ly = 16 + 1.5 * Math.cos(th) - 10 * Math.sin(th);
  const lz = -10 + 1.5 * Math.sin(th) + 10 * Math.cos(th);
  b.add('box', at, 0, ly, lz, 30, 3, 20, 0x9a5426, [th, 0, 0]);
  b.add('box', at, 0, ly + 0.2, lz - 0.3, 30.6, 3.2, 3, GOLD, [th, 0, 0]);
  // 금화 더미
  b.add('sphere', at, 0, 16, 0, 13.5, 4.5, 8.5, GOLD);
  for (let i = 0; i < 26; i++) {
    const x = (rnd() - 0.5) * 24;
    const z = (rnd() - 0.5) * 14;
    const y = 16 + 4.2 * Math.sqrt(Math.max(0, 1 - (x / 13) ** 2 - (z / 8) ** 2));
    b.add('cyl', at, x, y + 0.3, z, 1.8, 0.5, 1.8, 0xffd84a, [rnd() - 0.5, 0, rnd() - 0.5]);
    if (i % 4 === 0) glints.push(wpos(at, x, y + 1, z));
  }
  for (const [x, z, c] of [
    [-6, 2, 0xe2504a],
    [4, -2, 0x3a86e8],
    [8, 3, 0x5bbf6a],
    [-1, 4, 0xb86ae8],
  ] as const) {
    b.add('ico', at, x, 20, z, 1.8, 1.8, 1.8, c);
  }
  // 앞에 흩어진 금화
  for (let i = 0; i < 14; i++) {
    const x = (rnd() - 0.5) * 34;
    const z = 12 + rnd() * 12;
    b.add('cyl', at, x, 0.3, z, 1.8, 0.5, 1.8, 0xffd84a, [rnd() * 0.2, 0, rnd() * 0.2]);
  }
}

/** 세일러 모자와 파란 깃을 한 곰 인형 */
function sailorTeddy(
  b: Batch,
  at: Spot,
  lx: number,
  ly: number,
  lz: number,
  sc: number,
  fur: number,
) {
  teddy(b, at, lx, ly, lz, sc, fur);
  b.add('cyl', at, lx, ly + 16.2 * sc, lz + 0.4 * sc, 3.1 * sc, 1.6 * sc, 3.1 * sc, 0xffffff);
  b.add('cyl', at, lx, ly + 15.7 * sc, lz + 0.4 * sc, 3.2 * sc, 0.6 * sc, 3.2 * sc, 0x2a5ad0);
  b.add('box', at, lx, ly + 9 * sc, lz + 0.6 * sc, 7.4 * sc, 1.2 * sc, 5.6 * sc, 0x2a5ad0);
  b.add('sphere', at, lx, ly + 8.6 * sc, lz + 3.6 * sc, 1.2 * sc, 0.9 * sc, 0.8 * sc, 0xe2504a);
}

/** 양동이와 삽 */
function bucketSpade(b: Batch, at: Spot, c: number, c2: number) {
  b.add('cyl', at, 0, 5.5, 0, 6, 11, 6, c);
  b.add('cyl', at, 0, 11.2, 0, 6.6, 1.4, 6.6, c2);
  b.add('cyl', at, 0, 10.6, 0, 5.6, 0.6, 5.6, SAND);
  b.add('box', at, 0, 16, 0, 12, 0.7, 0.7, c2, [0, 0, 0]);
  for (const sx of [-1, 1]) b.add('box', at, sx * 6, 13.4, 0, 0.7, 5.2, 0.7, c2);
  b.add('cyl', at, 11, 9, 2, 0.9, 20, 0.9, 0xffc94a, [0.2, 0, 0.35]);
  b.add('box', at, 14.2, 18, 3.6, 3, 1.4, 1.4, 0xffc94a, [0.2, 0, 0.35]);
  b.add('box', at, 8, 1, 0.6, 6.5, 0.8, 8, c2, [0, 0.4, 0]);
}

/** 해적선: 통통한 선체, 금빛 띠, 선미루, 포문, 돛대. 돛과 깃발은 따로 붙인다(선체 지역 +x가 뱃머리) */
function shipHull(b: Batch, at: Spot, sc: number) {
  const P = (
    kind: 'box' | 'cyl' | 'sphere' | 'cone',
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    c: number,
    rot: [number, number, number] = [0, 0, 0],
  ) => b.add(kind, at, x * sc, y * sc, z * sc, sx * sc, sy * sc, sz * sc, c, rot);
  P('box', 0, 7, 0, 84, 18, 28, 0x7a3e1e);
  P('box', 42, 7, 0, 20, 18, 20, 0x7a3e1e, [0, Math.PI / 4, 0]);
  P('box', 0, 11, 0, 85, 3.2, 28.6, GOLD);
  P('box', 42.2, 11, 0, 20.6, 3.2, 20.6, GOLD, [0, Math.PI / 4, 0]);
  P('box', 0, 16.4, 0, 82, 1.6, 26, 0xc98a4e);
  P('box', -32, 22, 0, 22, 12, 28.6, 0x8a4a22);
  P('box', -32, 28.6, 0, 23, 1.8, 29, 0xe2504a);
  P('box', -43.4, 22, 0, 0.6, 7, 16, 0xffd36b);
  for (let i = 0; i < 4; i++) {
    for (const sz of [-1, 1]) {
      P('cyl', -10 + i * 13, 6, sz * 14.3, 2, 0.6, 2, 0x2a1a2a, [Math.PI / 2, 0, 0]);
      P('cyl', -10 + i * 13, 6, sz * 15, 1.1, 3, 1.1, 0x333344, [Math.PI / 2, 0, 0]);
    }
  }
  P('cyl', 54, 18, 0, 0.9, 26, 0.9, 0x6a3a1a, [0, 0, -1.2]);
  P('cyl', -10, 50, 0, 1.6, 68, 1.6, 0x6a3a1a);
  P('cyl', 18, 44, 0, 1.4, 56, 1.4, 0x6a3a1a);
  P('cyl', -10, 76, 0, 4, 3, 4, 0x8a4a22);
  P('cyl', 18, 63, 0, 3.4, 2.6, 3.4, 0x8a4a22);
  for (const [x, y, w] of [
    [-10, 70, 34],
    [-10, 38, 40],
    [18, 60, 28],
    [18, 32, 34],
  ] as const) {
    P('cyl', x, y, 0, 0.7, w, 0.7, 0x6a3a1a, [Math.PI / 2, 0, 0]);
  }
}

/** 등대: 빨강·흰 줄무늬 탑, 남색 난간, 빛나는 등실, 빨간 고깔 지붕 */
function lighthouse(b: Batch, at: Spot, sc: number, lamps: Vector3[]) {
  const segs = 7;
  const segH = 11 * sc;
  for (let i = 0; i < segs; i++) {
    const r = (10 - i * 0.55) * sc;
    b.add('cyl', at, 0, i * segH + segH / 2, 0, r, segH, r, i % 2 ? 0xfff4e6 : 0xe2504a);
  }
  const top = segs * segH;
  b.add('cyl', at, 0, top + 1, 0, 9 * sc, 2 * sc, 9 * sc, 0x2a3a7a);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.add(
      'cyl',
      at,
      Math.cos(a) * 8.5 * sc,
      top + 4 * sc,
      Math.sin(a) * 8.5 * sc,
      0.4 * sc,
      5 * sc,
      0.4 * sc,
      0x2a3a7a,
    );
  }
  b.add('cyl', at, 0, top + 6 * sc, 0, 5 * sc, 9 * sc, 5 * sc, 0xfff0a0);
  b.add('cone', at, 0, top + 14 * sc, 0, 7.4 * sc, 8 * sc, 7.4 * sc, 0xe2504a);
  b.add('sphere', at, 0, top + 18.6 * sc, 0, 1.4 * sc, 1.4 * sc, 1.4 * sc, GOLD);
  b.add('box', at, 0, 30 * sc, 8.7 * sc, 4 * sc, 7 * sc, 1 * sc, 0x2a3a7a);
  lamps.push(wpos(at, 0, top + 6 * sc, 0));
}

/** 바다 위 작은 섬: 모래 언덕·바위·덤불·야자수 */
function island(b: Batch, at: Spot, r: number, palms: number, rnd: () => number) {
  b.add('sphere', at, 0, 0, 0, r, r * 0.26, r * 0.85, SAND);
  b.add('cyl', at, 0, 0.4, 0, r * 1.06, 0.8, r * 0.92, 0xffffff);
  for (let i = 0; i < 4; i++) {
    const a = rnd() * Math.PI * 2;
    const s = r * (0.14 + rnd() * 0.1);
    b.add(
      'ico',
      at,
      Math.cos(a) * r * 0.6,
      s * 0.5,
      Math.sin(a) * r * 0.5,
      s,
      s * 0.8,
      s,
      0xa88ab8,
    );
  }
  for (let i = 0; i < 5; i++) {
    const a = rnd() * Math.PI * 2;
    const s = r * (0.1 + rnd() * 0.08);
    b.add(
      'ico',
      at,
      Math.cos(a) * r * 0.35,
      r * 0.2,
      Math.sin(a) * r * 0.3,
      s,
      s,
      s,
      rnd() < 0.5 ? 0x4aa84a : 0x6ad060,
    );
  }
  for (let i = 0; i < palms; i++) {
    palm(
      b,
      { ...at, x: at.x + (i - (palms - 1) / 2) * r * 0.6, yaw: at.yaw + i * 2.2 },
      r / 40 + rnd() * 0.2,
      rnd,
    );
  }
}

/** 커다란 고무 오리(지역 +x가 앞) */
function duck(b: Batch, at: Spot, sc: number) {
  const S = (x: number, y: number, z: number, rx: number, ry: number, rz: number, c: number) =>
    b.add('sphere', at, x * sc, y * sc, z * sc, rx * sc, ry * sc, rz * sc, c);
  S(0, 4, 0, 14, 9, 11, 0xffd23a);
  S(-12, 9, 0, 4, 5, 6, 0xffd23a);
  S(9, 16, 0, 7.4, 7.4, 7.4, 0xffd23a);
  S(16.5, 14.6, 0, 4, 1.6, 3.2, 0xff8a1a);
  S(13.6, 18, 3.6, 1.1, 1.3, 1.1, 0x1a1020);
  S(13.6, 18, -3.6, 1.1, 1.3, 1.1, 0x1a1020);
  S(2, 8, 9, 6, 3, 2.5, 0xffc020);
  S(2, 8, -9, 6, 3, 2.5, 0xffc020);
}

/** 횃불 기둥: 줄무늬 대와 불꽃 받침. 불꽃 자리를 flames에 더한다 */
function torchPost(b: Batch, at: Spot, h: number, flames: Vector3[]) {
  for (let i = 0; i < 6; i++) {
    b.add('cyl', at, 0, (i + 0.5) * (h / 6), 0, 2.2, h / 6, 2.2, i % 2 ? 0x8e5428 : 0xb87a3e);
  }
  b.add('cyl', at, 0, h + 3, 0, 4, 6, 4, 0x6a3a1a);
  b.add('cyl', at, 0, h + 0.5, 0, 4.4, 1, 4.4, GOLD);
  b.add('cone', at, 0, h + 9, 0, 3, 8, 3, 0xff8a2a);
  flames.push(wpos(at, 0, h + 8, 0));
}

// ───────────────────────── 테마 ─────────────────────────

export const buildBeachTheme: ThemeBuilder = (k) => {
  const room = new Group();
  const batch = new Batch();
  const rnd = lcg(77);
  const glows: Vector3[] = [];
  const flames: Vector3[] = [];
  const lamps: Vector3[] = [];

  // 하늘 구: 중심을 수면 높이에 두어 적도가 바다 가장자리와 맞닿게 한다
  const skyTex = createSkyTexture();
  k.texs.push(skyTex);
  const skyMat = new MeshBasicMaterial({
    map: skyTex,
    side: BackSide,
    fog: false,
    toneMapped: false,
  });
  k.mats.push(skyMat);
  const sky = k.mesh(new SphereGeometry(SKY_R, 64, 32), skyMat, false, false);
  sky.position.y = SEA_Y;
  room.add(sky);

  // 바다
  const seaTex = createSeaTexture();
  k.texs.push(seaTex);
  const seaMat = new MeshBasicMaterial({ map: seaTex, toneMapped: false });
  k.mats.push(seaMat);
  const sea = k.mesh(new CircleGeometry(SKY_R - 2, 96), seaMat, false, false);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = SEA_Y;
  room.add(sea);

  // 모래섬: 윗면은 바닥 높이, 가장자리는 젖은 모래 경사로 물속에 잠긴다
  const sandTex = createSandTexture();
  k.texs.push(sandTex);
  const sandMat = new MeshStandardMaterial({ map: sandTex, roughness: 0.95 });
  k.mats.push(sandMat);
  const sand = k.mesh(new CircleGeometry(SAND_R, 64), sandMat, false, true);
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = FLOOR_Y;
  room.add(sand);
  const shore = k.mesh(
    new CylinderGeometry(SAND_R, SAND_R + 14, 4, 64, 1, true),
    k.std(0xdba468, 1),
    false,
    true,
  );
  shore.position.y = FLOOR_Y - 2;
  room.add(shore);
  const foamMat = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
    toneMapped: false,
  });
  k.mats.push(foamMat);
  for (const [r0, r1] of [
    [SAND_R + 11, SAND_R + 17],
    [SAND_R + 26, SAND_R + 29],
  ] as const) {
    const foam = k.mesh(new RingGeometry(r0, r1, 96), foamMat, false, false);
    foam.rotation.x = -Math.PI / 2;
    foam.position.y = SEA_Y + 0.2;
    room.add(foam);
  }

  // ── 먼 바다: 해적선 두 척, 등대섬, 야자섬, 고무 오리
  const sailTex = createSailTexture();
  const flagTex = createFlagTexture();
  k.texs.push(sailTex, flagTex);
  const sailMat = new MeshStandardMaterial({
    map: sailTex,
    side: DoubleSide,
    roughness: 0.8,
    emissive: 0xffd0a0,
    emissiveMap: sailTex,
    emissiveIntensity: 0.25,
  });
  const flagMat = new MeshStandardMaterial({ map: flagTex, side: DoubleSide, roughness: 0.8 });
  k.mats.push(sailMat, flagMat);
  const flagGeo = new PlaneGeometry(1, 0.75);
  k.geos.push(flagGeo);
  const addFlag = (parent: Group, x: number, y: number, z: number, yaw: number, w: number) => {
    const flag = new Mesh(flagGeo, flagMat); // 공유 지오메트리(정리 목록에는 위에서 한 번 넣었다)
    flag.scale.setScalar(w);
    flag.position.set(x, y, z);
    flag.rotation.y = yaw;
    parent.add(flag);
  };

  const ship = (x: number, z: number, yaw: number, sc: number) => {
    const at: Spot = { x, y: SEA_Y - 2, z, yaw };
    shipHull(batch, at, sc);
    const g = new Group();
    g.position.set(x, SEA_Y - 2, z);
    g.rotation.y = yaw;
    g.scale.setScalar(sc);
    room.add(g);
    // 바람을 받아 +z로 부푼 돛(원기둥 일부)
    for (const [mx, y0, y1, w] of [
      [-10, 39, 69, 32],
      [18, 33, 59, 24],
      [-10, 19, 37, 38],
    ] as const) {
      const R = w * 1.1;
      const th = 2 * Math.asin(w / 2 / R);
      const sail = k.mesh(
        new CylinderGeometry(R, R, y1 - y0, 12, 1, true, Math.PI / 2 - th / 2, th),
        sailMat,
        false,
        false,
      );
      sail.rotation.y = -Math.PI / 2;
      sail.position.set(mx, (y0 + y1) / 2, -R * Math.cos(th / 2) + 1.5);
      g.add(sail);
    }
    addFlag(g, -10 + 7, 86, 0, 0, 14);
    addFlag(g, 18 + 6, 70, 0, 0, 10);
  };
  ship(110, -320, 0.2, 1.15);
  ship(-140, 335, Math.PI + 0.35, 1);

  island(batch, facing(-230, SEA_Y, -285), 42, 2, rnd);
  island(batch, facing(330, SEA_Y, -40), 34, 1, rnd);
  island(batch, facing(-335, SEA_Y, 90), 38, 2, rnd);
  island(batch, facing(150, SEA_Y, 345, Math.PI), 40, 0, rnd);
  lighthouse(batch, facing(155, SEA_Y + 6, 345), 1.3, lamps);
  island(batch, facing(-300, SEA_Y, -170), 22, 1, rnd);
  island(batch, facing(40, SEA_Y, 380), 26, 1, rnd);
  duck(batch, { x: -250, y: SEA_Y - 2, z: -110, yaw: -0.6 }, 1.4);
  duck(batch, { x: 240, y: SEA_Y - 2, z: 150, yaw: 2.4 }, 1.1);
  // 부표
  for (const [x, z] of [
    [-110, -250],
    [200, -210],
    [100, 250],
    [-240, 230],
  ] as const) {
    const at: Spot = { x, y: SEA_Y, z, yaw: 0 };
    batch.add('sphere', at, 0, 1, 0, 4, 4, 4, 0xe2504a);
    batch.add('cyl', at, 0, 2.6, 0, 4.1, 1.4, 4.1, 0xffffff);
  }

  // ── 모래섬 위 소품(판·좌석 둘레는 비운다)
  palm(batch, facing(-150, FLOOR_Y, -122, 0.4), 1.25, rnd);
  palm(batch, facing(148, FLOOR_Y, -128, 2.6), 1.15, rnd);
  palm(batch, facing(150, FLOOR_Y, 128, -0.5), 1.25, rnd);
  palm(batch, facing(-148, FLOOR_Y, 126, 2.8), 1.1, rnd);
  palm(batch, facing(-172, FLOOR_Y, -10, 1.6), 0.95, rnd);
  palm(batch, facing(172, FLOOR_Y, 20, -1.4), 1, rnd);

  sandcastle(batch, facing(-78, FLOOR_Y, -112), 1.2);
  sandcastle(batch, facing(84, FLOOR_Y, 112), 1.1);
  sailorTeddy(batch, facing(70, FLOOR_Y, -100), 0, 0, 0, 1.6, BEAR[1] ?? 0xe8c08a);
  sailorTeddy(batch, facing(-74, FLOOR_Y, 104), 0, 0, 0, 1.5, BEAR[0] ?? 0xc98a4e);
  bucketSpade(batch, facing(100, FLOOR_Y, -86, 0.5), 0x3a86e8, 0xffc94a);
  bucketSpade(batch, facing(-104, FLOOR_Y, 90, -0.4), 0xe2504a, 0x48c6c0);
  chest(batch, facing(-122, FLOOR_Y, -58), rnd, glows);
  chest(batch, facing(124, FLOOR_Y, 62), rnd, glows);

  // 불가사리·조개 흩뿌리기
  const starCols = [0xff7a4a, 0xff8fb0, 0xffb03a, 0xe2504a, 0xb86ae8];
  for (let i = 0; i < 34; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 70 + rnd() * 112;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (Math.abs(x) < 55 && Math.abs(z) < 70) continue;
    const at: Spot = { x, y: FLOOR_Y, z, yaw: 0 };
    if (i % 2 === 0) {
      starfish(
        batch,
        at,
        0,
        0,
        0.9 + rnd() * 0.6,
        starCols[i % starCols.length] ?? 0xff7a4a,
        rnd(),
      );
    } else {
      batch.add(
        'sphere',
        { ...at, yaw: rnd() * 6 },
        0,
        0.6,
        0,
        2.8,
        1.4,
        2.2,
        [0xffc0d0, 0xfff2e0, 0xffd0a0, 0xc8b0ff][i % 4] ?? 0xffc0d0,
      );
    }
  }

  // 횃불 기둥 네 개와 사이를 잇는 꼬마전구 줄
  const POST = 128;
  const postH = 168;
  const postTops: Vector3[] = [];
  for (const [sx, sz] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ] as const) {
    const at: Spot = { x: sx * POST, y: FLOOR_Y, z: sz * POST, yaw: 0 };
    torchPost(batch, at, postH, flames);
    postTops.push(new Vector3(sx * POST, FLOOR_Y + postH - 6, sz * POST));
  }

  // 해적 깃발 기둥(모래섬 가장자리)
  const flagPoles: [number, number][] = [
    [-60, -175],
    [64, 172],
    [-182, 50],
    [180, -60],
  ];
  for (const [x, z] of flagPoles) {
    const at: Spot = { x, y: FLOOR_Y, z, yaw: 0 };
    batch.add('cyl', at, 0, 50, 0, 1.2, 100, 1.2, 0x6a3a1a);
    batch.add('sphere', at, 0, 101, 0, 2, 2, 2, GOLD);
    const yaw = Math.atan2(-x, -z);
    const fp = wpos({ x, y: FLOOR_Y, z, yaw }, 10, 88, 0);
    addFlag(room, fp.x, fp.y, fp.z, yaw, 20);
  }

  batch.flush(k, room);

  // 비치볼과 줄무늬 파라솔(띠 무늬 텍스처)
  const ballTex = createStripeTexture([
    '#e2504a',
    '#fff6e6',
    '#3a86e8',
    '#fff6e6',
    '#ffc94a',
    '#fff6e6',
  ]);
  const umbTex = createStripeTexture([
    '#e2504a',
    '#fff6e6',
    '#ff8a3a',
    '#fff6e6',
    '#e2504a',
    '#fff6e6',
    '#ff8a3a',
    '#fff6e6',
  ]);
  const umbTex2 = createStripeTexture([
    '#3a86e8',
    '#fff6e6',
    '#48c6c0',
    '#fff6e6',
    '#3a86e8',
    '#fff6e6',
    '#48c6c0',
    '#fff6e6',
  ]);
  k.texs.push(ballTex, umbTex, umbTex2);
  const ballMat = new MeshStandardMaterial({ map: ballTex, roughness: 0.35 });
  k.mats.push(ballMat);
  const ballGeo = new SphereGeometry(1, 24, 16);
  k.geos.push(ballGeo);
  for (const [x, z, r] of [
    [96, -56, 9],
    [-92, 64, 10],
    [-40, -150, 8],
    [150, 70, 8],
  ] as const) {
    const m = new Mesh(ballGeo, ballMat);
    m.castShadow = true;
    m.scale.setScalar(r);
    m.position.set(x, FLOOR_Y + r, z);
    m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
    room.add(m);
  }
  const poleMat = k.std(0xfff6e6, 0.5);
  for (const [x, z, tex, tilt] of [
    [-118, 34, umbTex, 0.14],
    [116, -32, umbTex2, -0.14],
  ] as const) {
    const umb = new Group();
    umb.position.set(x, FLOOR_Y, z);
    umb.rotation.z = tilt;
    room.add(umb);
    const pole = k.mesh(new CylinderGeometry(1, 1, 112, 8), poleMat);
    pole.position.y = 56;
    umb.add(pole);
    const canMat = new MeshStandardMaterial({ map: tex, side: DoubleSide, roughness: 0.7 });
    k.mats.push(canMat);
    const canopy = k.mesh(new ConeGeometry(46, 16, 16, 1, true), canMat, true, false);
    canopy.position.y = 108;
    umb.add(canopy);
    const tip = k.mesh(new SphereGeometry(2.4, 12, 8), k.std(GOLD, 0.3, 0.4), false, false);
    tip.position.y = 117;
    umb.add(tip);
    // 파라솔 아래 줄무늬 수건
    const towel = k.mesh(
      new PlaneGeometry(26, 46),
      new MeshStandardMaterial({ map: tex, roughness: 0.9 }),
      false,
      true,
    );
    k.mats.push(towel.material as Material);
    towel.rotation.x = -Math.PI / 2;
    towel.rotation.z = tilt * 3;
    towel.position.set(-tilt * 120, 0.4, 0);
    umb.add(towel);
  }

  // 빛: 등대 등실, 횃불, 보물 반짝임
  addBulbs(k, room, lamps, 6, [0xfff0a0]);
  addBulbs(k, room, flames, 3, [0xffb040, 0xffd060]);
  addBulbs(k, room, glows, 0.6, [0xfff4c0, 0xffe080]);

  // 꼬마전구 줄과 삼각 깃발
  const wireMat = new MeshBasicMaterial({ color: 0x3a2010 });
  k.mats.push(wireMat);
  const bulbs: Vector3[] = [];
  postTops.forEach((a, i) => {
    const b = postTops[(i + 1) % 4] ?? a;
    room.add(k.mesh(festoon(a, b, 3, 14, 5, bulbs), wireMat, false, false));
  });
  addBulbs(k, room, bulbs, 1.5, [0xffd37a, 0xff9a7a, 0xffe7a8, 0xff8fb0, 0x9ad0ff]);
  const by = FLOOR_Y + postH - 22;
  addBunting(
    k,
    room,
    wireMat,
    [
      [new Vector3(POST, by, -POST), new Vector3(POST, by, POST), -Math.PI / 2],
      [new Vector3(-POST, by, POST), new Vector3(-POST, by, -POST), Math.PI / 2],
    ],
    [0xe2504a, 0xffc94a, 0x3a86e8, 0xfff6e6, 0x48c6c0, 0xff8fb0],
    3,
    18,
    5,
  );

  // 노을빛 반짝이(판 위 공간은 비운다)
  addSparkles(k, room, rnd, {
    count: 170,
    rMin: 70,
    rMax: 185,
    yMin: -40,
    yMax: 130,
    colors: [0xffd36b, 0xff9a6a, 0xffb0d8, 0x9ae0ff, 0xffffff],
  });

  // 조명: 노을 쪽 주황 키 라이트 + 하늘색 보조광, 판은 머리 위 흰빛 주 조명(그림자)으로 밝게
  const lights = new Group();
  lights.add(new AmbientLight(0xfff0e0, 0.3));
  lights.add(new HemisphereLight(0x9ad4ff, 0xf2b070, 0.75));
  // 주 조명은 거의 머리 위에서(옆으로 살짝) 비춰 상대 캐릭터 그림자가 판을 덮지 않게 한다
  const main = new DirectionalLight(0xfff2e0, 2.0);
  main.position.set(30, 130, 0);
  main.target.position.set(0, 0, 0);
  main.castShadow = true;
  main.shadow.mapSize.set(1024, 1024);
  main.shadow.bias = -0.0006;
  main.shadow.camera.near = 40;
  main.shadow.camera.far = 260;
  main.shadow.camera.left = -70;
  main.shadow.camera.right = 70;
  main.shadow.camera.top = 70;
  main.shadow.camera.bottom = -70;
  lights.add(main, main.target);
  const sunset = new DirectionalLight(0xff8a3a, 1.4);
  sunset.position.set(Math.cos(SUN_AZ) * 200, 40, Math.sin(SUN_AZ) * 200);
  lights.add(sunset);
  const fill = new DirectionalLight(0x8ac8ff, 0.7);
  fill.position.set(-Math.cos(SUN_AZ) * 100, 70, -Math.sin(SUN_AZ) * 100);
  lights.add(fill);

  return {
    room,
    desk: buildDesk(k),
    lamp: new Group(),
    lights,
    background: 0x2f8fe0,
    board: {
      base: '#ebbd7c',
      grain: '170,100,40',
      line: 'rgba(110,60,20,0.72)',
      side: 0xd49a5a,
      seam: 0x2a9ab0,
      leg: 0x8a5428,
      rim: 0x38c6d8,
      star: 'rgba(30,130,170,0.85)',
    },
  };
};

/** 해적 탁자: 널판 상판에 밧줄 테, 아래는 두 줄로 쌓은 나무 상자 */
function buildDesk(k: Kit): Group {
  const desk = new Group();
  const plankTex = createPlankTexture();
  const crateTex = createCrateTexture();
  const ropeTex = createRopeTexture();
  k.texs.push(plankTex, crateTex, ropeTex);
  const plankA = new MeshStandardMaterial({ map: plankTex, roughness: 0.6 });
  const plankB = new MeshStandardMaterial({ map: plankTex, roughness: 0.6, color: 0xf2dcc4 });
  const crateMat = new MeshStandardMaterial({ map: crateTex, roughness: 0.7 });
  const ropeMat = new MeshStandardMaterial({ map: ropeTex, roughness: 0.9 });
  k.mats.push(plankA, plankB, crateMat, ropeMat);

  const under = k.mesh(
    new BoxGeometry(TABLE_HALF_X * 2 - 1, 0.6, TABLE_HALF_Z * 2 - 1),
    k.std(0x4a2a14, 0.9),
  );
  under.position.y = TABLE_Y - TABLE_TOP_T + 0.2;
  desk.add(under);
  const n = 5;
  const gap = 0.5;
  const pw = (TABLE_HALF_Z * 2 - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const p = k.mesh(new BoxGeometry(TABLE_HALF_X * 2, TABLE_TOP_T, pw), i % 2 ? plankB : plankA);
    p.position.set(0, TABLE_Y - TABLE_TOP_T / 2, -TABLE_HALF_Z + pw / 2 + i * (pw + gap));
    desk.add(p);
  }
  // 상판 가장자리 밧줄(Z로는 TABLE_HALF_Z + 1.5 안쪽)
  const rr = 1.2;
  const ry = TABLE_Y - TABLE_TOP_T / 2;
  for (const sz of [1, -1]) {
    const rope = k.mesh(ropeGeo(TABLE_HALF_X * 2 + 2, rr), ropeMat, false, true);
    rope.rotation.z = Math.PI / 2;
    rope.position.set(0, ry, sz * (TABLE_HALF_Z + 0.2));
    desk.add(rope);
  }
  for (const sx of [1, -1]) {
    const rope = k.mesh(ropeGeo(TABLE_HALF_Z * 2 + 2, rr), ropeMat, false, true);
    rope.rotation.x = Math.PI / 2;
    rope.position.set(sx * (TABLE_HALF_X + 0.2), ry, 0);
    desk.add(rope);
  }
  const knotMat = k.std(0xc89858, 0.9);
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const knot = k.mesh(new SphereGeometry(1.5, 10, 8), knotMat, false, false);
      knot.position.set(sx * (TABLE_HALF_X + 0.2), ry, sz * TABLE_HALF_Z);
      desk.add(knot);
    }
  }

  // 상자 두 무더기(아래 큰 상자 + 위 작은 상자). 위 상자 윗면이 상판 밑면에 닿는다
  const legH = TABLE_Y - TABLE_TOP_T - FLOOR_Y;
  const lowH = 37;
  const upH = legH - lowH;
  const bandMat = k.std(GOLD, 0.35, 0.6);
  for (const sx of [1, -1]) {
    const low = k.mesh(new BoxGeometry(38, lowH, 40), crateMat);
    low.position.set(sx * 23, FLOOR_Y + lowH / 2, 0);
    low.rotation.y = sx * 0.04;
    desk.add(low);
    const up = k.mesh(new BoxGeometry(34, upH, 36), crateMat);
    up.position.set(sx * 24, FLOOR_Y + lowH + upH / 2, 0);
    up.rotation.y = -sx * 0.06;
    desk.add(up);
    // 아래 상자를 두른 밧줄과 금빛 모서리
    for (const sz of [1, -1]) {
      const rope = k.mesh(ropeGeo(39, 0.9), ropeMat, false, false);
      rope.rotation.z = Math.PI / 2;
      rope.position.set(sx * 23, FLOOR_Y + lowH * 0.62, sz * 20.4);
      rope.rotation.y = sx * 0.04;
      desk.add(rope);
    }
    for (const cz of [1, -1]) {
      const band = k.mesh(new BoxGeometry(1.2, upH, 1.2), bandMat, false, false);
      band.position.set(sx * 24 + sx * 16.6, FLOOR_Y + lowH + upH / 2, cz * 17.6);
      desk.add(band);
    }
  }
  return desk;
}
