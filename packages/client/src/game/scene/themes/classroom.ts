// 교실 테마(DEC-053·DEC-083): "장난감 왕국" 마법학교 교실. 초록·크림 색 바탕의 밝은 낮 장면.
// 마법진·별·물약 병 분필 낙서가 그려진 초록 칠판과 달·별 시계, 맑은 하늘·뭉게구름·먼 장난감 성이 보이는 아치 창,
// 원목 징두리 크림 벽, 주문서·물약 병(빛나는 알)·수정 구슬·지구본을 채운 책장, 학교 페넌트·주문 시간표·학교 문장,
// 천장의 둥근 마법 등불과 행성·별 모빌, 은은한 낮 반짝이, 연두 상판에 연필 홈·낙서 스티커를 붙인 학교 책상, 초록 테 판.
// 반복되는 소품은 toy-kit.ts의 도형별 인스턴스 묶음(Batch)으로 그려 그리기 호출을 몇 번으로 줄인다.
import {
  AdditiveBlending,
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
  ShapeGeometry,
  SphereGeometry,
  SpotLight,
  TorusGeometry,
  Vector3,
  Euler,
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
  canvasTexture,
  canvasTextureWH,
  lcg,
  type Kit,
  type ThemeBuilder,
} from '../stage-kit.ts';
import {
  BEAR,
  Batch,
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

/** 마법학교 색: 초록·크림·금 */
const GREEN = 0x4fae62;
const DEEP_GREEN = 0x2f7a48;
const CREAM = 0xf6ecd0;
const GOLD = 0xffcf6e;
const WOOD = 0xc07a3c;
const DARK_WOOD = 0x7a4220;
/** 물약 색(빛나는 알) */
const POTION = [0xff6fb5, 0x6ff0c0, 0xb07aff, 0x5ad0ff, 0xffc94a, 0xff8a5a];
/** 주문서 표지 색 */
const SPELLBOOK = [0x2f7a48, 0x8a4ae0, 0xe2504a, 0x3a86e8, 0xf07a1a, 0x48c6c0, 0x5bbf6a, 0xb8452f];

const pick = <T>(arr: readonly T[], rnd: () => number, fallback: T): T =>
  arr[Math.floor(rnd() * arr.length)] ?? fallback;

/** Spot 지역 좌표를 월드 좌표로(Batch와 같은 규칙) */
function world(at: Spot, lx: number, ly: number, lz: number): Vector3 {
  const cs = Math.cos(at.yaw);
  const sn = Math.sin(at.yaw);
  return new Vector3(at.x + lx * cs + lz * sn, at.y + ly, at.z - lx * sn + lz * cs);
}

// ───────────────────────── 절차 텍스처 ─────────────────────────

/** 밝은 꿀색 원목 마루 */
function createFloorTexture(): Texture {
  const tex = canvasTexture(512, (g, s) => {
    const rnd = lcg(17);
    const rows = 8;
    const rh = s / rows;
    for (let i = 0; i < rows; i++) {
      let x = -rnd() * 200;
      while (x < s) {
        const len = 150 + rnd() * 200;
        g.fillStyle = `hsl(${30 + rnd() * 6},${50 + rnd() * 10}%,${52 + rnd() * 9}%)`;
        g.fillRect(x, i * rh, len, rh);
        for (let k = 0; k < 6; k++) {
          g.strokeStyle = `rgba(120,60,20,${0.07 + rnd() * 0.08})`;
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
        g.fillStyle = 'rgba(90,40,10,0.4)';
        g.fillRect(x, i * rh, 2, rh);
        x += len;
      }
      g.fillStyle = 'rgba(90,40,10,0.45)';
      g.fillRect(0, i * rh, s, 2);
      g.fillStyle = 'rgba(255,236,200,0.18)';
      g.fillRect(0, i * rh + 2, s, 2);
    }
  });
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

/** 벽: 아래는 원목 징두리, 위는 크림 바탕에 연두 줄무늬와 작은 금빛 별 */
function createWallTexture(): Texture {
  const tex = canvasTextureWH(512, 1024, (g, w, h) => {
    const split = h * (1 - WAINSCOT);
    const paper = g.createLinearGradient(0, 0, 0, split);
    paper.addColorStop(0, '#e6efc8');
    paper.addColorStop(0.5, '#f6f0d4');
    paper.addColorStop(1, '#fbf3dc');
    g.fillStyle = paper;
    g.fillRect(0, 0, w, split);
    for (let x = 0; x < w; x += 64) {
      g.fillStyle = 'rgba(110,200,110,0.2)';
      g.fillRect(x, 0, 26, split);
      g.fillStyle = 'rgba(90,180,100,0.3)';
      g.fillRect(x + 30, 0, 3, split);
    }
    g.fillStyle = 'rgba(230,170,60,0.5)';
    for (let y = 40; y < split - 30; y += 96) {
      for (let x = 45; x < w; x += 128) {
        const ox = (y / 96) % 2 === 0 ? 0 : 64;
        sparkle(g, (x + ox) % w, y, 8);
      }
    }
    // 징두리: 원목 판 + 볼록 판 테두리
    g.fillStyle = '#a8602c';
    g.fillRect(0, split, w, h - split);
    const panels = 2;
    const pw = w / panels;
    for (let i = 0; i < panels; i++) {
      const x0 = i * pw + 16;
      const y0 = split + 34;
      const pwi = pw - 32;
      const phi = h - split - 70;
      g.fillStyle = '#c47c40';
      g.fillRect(x0, y0, pwi, phi);
      g.strokeStyle = 'rgba(255,224,170,0.4)';
      g.lineWidth = 4;
      g.strokeRect(x0 + 2, y0 + 2, pwi - 4, phi - 4);
      g.strokeStyle = 'rgba(80,30,6,0.35)';
      g.strokeRect(x0 + 10, y0 + 10, pwi - 20, phi - 20);
    }
    // 초록 몰딩 띠와 걸레받이
    g.fillStyle = '#2f7a48';
    g.fillRect(0, split - 8, w, 24);
    g.fillStyle = '#ffd36b';
    g.fillRect(0, split + 2, w, 5);
    g.fillStyle = '#2f6a40';
    g.fillRect(0, h - 28, w, 28);
  });
  tex.wrapS = RepeatWrapping;
  tex.repeat.set(3, 1);
  return tex;
}

/** 천장: 크림 바탕에 금빛 별·반짝임 */
function createCeilingTexture(): Texture {
  const tex = canvasTexture(256, (g, s) => {
    const rnd = lcg(61);
    g.fillStyle = '#fbf2d8';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? 'rgba(230,170,60,0.55)' : 'rgba(110,190,120,0.45)';
      const x = rnd() * s;
      const y = rnd() * s;
      if (i % 3 === 0) {
        g.beginPath();
        starPath(g, x, y, 9);
        g.fill();
      } else sparkle(g, x, y, 8);
    }
  });
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

/** 창밖: 맑은 낮 하늘, 뭉게구름, 초록 언덕, 무지개와 먼 장난감 성 */
function createSkyTexture(seed: number, withCastle: boolean): Texture {
  return canvasTextureWH(512, 640, (g, w, h) => {
    const rnd = lcg(seed);
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#3a9ae8');
    sky.addColorStop(0.55, '#8ccdf6');
    sky.addColorStop(1, '#d8f0ff');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    // 해와 빛 번짐
    const sx = w * (0.2 + rnd() * 0.15);
    const sy = h * 0.16;
    const sun = g.createRadialGradient(sx, sy, 0, sx, sy, 140);
    sun.addColorStop(0, 'rgba(255,252,220,1)');
    sun.addColorStop(0.2, 'rgba(255,246,190,0.9)');
    sun.addColorStop(1, 'rgba(255,240,180,0)');
    g.fillStyle = sun;
    g.fillRect(0, 0, w, h);
    // 무지개
    if (withCastle) {
      ['#ff6a6a', '#ffb04a', '#ffe36a', '#7ade7a', '#6ab8ff', '#a87aff'].forEach((c, i) => {
        g.strokeStyle = c;
        g.globalAlpha = 0.45;
        g.lineWidth = 12;
        g.beginPath();
        g.arc(w * 0.62, h * 0.78, 250 - i * 12, Math.PI, Math.PI * 2);
        g.stroke();
      });
      g.globalAlpha = 1;
    }
    // 뭉게구름
    const cloud = (cx: number, cy: number, sc: number) => {
      g.fillStyle = 'rgba(180,210,235,0.55)';
      for (const [dx, dy, r] of [
        [-40, 10, 30],
        [0, 6, 40],
        [42, 12, 28],
        [-10, -22, 30],
        [22, -16, 26],
      ] as const) {
        g.beginPath();
        g.arc(cx + dx * sc, cy + (dy + 6) * sc, r * sc, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#ffffff';
      for (const [dx, dy, r] of [
        [-40, 10, 30],
        [0, 6, 40],
        [42, 12, 28],
        [-10, -22, 30],
        [22, -16, 26],
      ] as const) {
        g.beginPath();
        g.arc(cx + dx * sc, cy + dy * sc, r * sc, 0, Math.PI * 2);
        g.fill();
      }
    };
    for (let i = 0; i < 5; i++) {
      cloud(rnd() * w, h * (0.12 + rnd() * 0.45), 0.6 + rnd() * 0.7);
    }
    // 먼 언덕
    g.fillStyle = '#9ad66a';
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h * 0.8 - Math.sin(x / 70 + seed) * 22);
    g.lineTo(w, h);
    g.fill();
    // 먼 장난감 성
    if (withCastle) {
      const cx = w * 0.62;
      const base = h * 0.79;
      g.fillStyle = '#f6ead0';
      g.fillRect(cx - 50, base - 50, 100, 50);
      for (const [tx, th] of [
        [-58, 80],
        [58, 80],
        [0, 110],
      ] as const) {
        g.fillStyle = '#f6ead0';
        g.fillRect(cx + tx - 14, base - th, 28, th);
        g.fillStyle = tx === 0 ? '#8a4ae0' : tx < 0 ? '#3a86e8' : '#e2504a';
        g.beginPath();
        g.moveTo(cx + tx - 18, base - th);
        g.lineTo(cx + tx, base - th - 42);
        g.lineTo(cx + tx + 18, base - th);
        g.fill();
        g.fillStyle = '#ffc94a';
        g.fillRect(cx + tx, base - th - 58, 14, 8);
      }
      g.fillStyle = '#7a4a9a';
      g.beginPath();
      g.arc(cx, base - 8, 12, Math.PI, 0);
      g.fillRect(cx - 12, base - 8, 24, 8);
      g.fill();
    }
    // 가까운 언덕과 나무
    g.fillStyle = '#5bbf5a';
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) g.lineTo(x, h * 0.9 - Math.sin(x / 50 + seed * 2) * 14);
    g.lineTo(w, h);
    g.fill();
    for (let i = 0; i < 6; i++) {
      const x = rnd() * w;
      const y = h * (0.86 + rnd() * 0.06);
      g.fillStyle = '#8a5a2c';
      g.fillRect(x - 3, y - 6, 6, 18);
      g.fillStyle = rnd() < 0.5 ? '#3f9a4a' : '#4fb05a';
      g.beginPath();
      g.arc(x, y - 14, 14 + rnd() * 6, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** 분필 선 하나(두 번 겹쳐 그려 손그림처럼) */
function chalk(
  g: CanvasRenderingContext2D,
  color: string,
  width: number,
  path: (g: CanvasRenderingContext2D) => void,
) {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.globalAlpha = 0.85;
  g.beginPath();
  path(g);
  g.stroke();
  g.globalAlpha = 0.35;
  g.save();
  g.translate(1.5, -1);
  g.beginPath();
  path(g);
  g.stroke();
  g.restore();
  g.globalAlpha = 1;
}

/** 다섯 꼭지 별 경로 */
function starPath(g: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  for (let i = 0; i <= 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
}

/** 칠판: 초록 바탕에 마법진·별·달·물약 병·마법 모자 분필 낙서 */
function createChalkboardTexture(): Texture {
  return canvasTextureWH(1024, 512, (g, w, h) => {
    const rnd = lcg(53);
    const bg = g.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#3f8a5a');
    bg.addColorStop(1, '#2e6e48');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    // 지운 자국
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(255,255,255,${0.03 + rnd() * 0.04})`;
      g.beginPath();
      g.ellipse(rnd() * w, rnd() * h, 60 + rnd() * 90, 20 + rnd() * 30, rnd(), 0, Math.PI * 2);
      g.fill();
    }
    const W = 'rgba(255,255,250,1)';
    const Y = '#ffe27a';
    const P = '#ff9ec4';
    const C = '#8fe3ff';
    const L = '#c8f59a';
    // 마법진(왼쪽)
    const mx = 220;
    const my = 260;
    chalk(g, W, 6, (c) => c.arc(mx, my, 150, 0, Math.PI * 2));
    chalk(g, W, 4, (c) => c.arc(mx, my, 126, 0, Math.PI * 2));
    chalk(g, Y, 5, (c) => {
      for (const off of [0, Math.PI]) {
        for (let i = 0; i <= 3; i++) {
          const a = -Math.PI / 2 + off + (i * Math.PI * 2) / 3;
          const x = mx + Math.cos(a) * 120;
          const y = my + Math.sin(a) * 120;
          if (i === 0) c.moveTo(x, y);
          else c.lineTo(x, y);
        }
      }
    });
    chalk(g, C, 4, (c) => c.arc(mx, my, 48, 0, Math.PI * 2));
    chalk(g, Y, 4, (c) => starPath(c, mx, my, 34));
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = mx + Math.cos(a) * 138;
      const y = my + Math.sin(a) * 138;
      chalk(g, W, 3, (c) => {
        c.moveTo(x - 5, y - 5);
        c.lineTo(x + 5, y + 5);
        c.moveTo(x + 5, y - 5);
        c.lineTo(x - 5, y + 5);
      });
    }
    // 둥근 물약 병(가운데)
    const fx = 520;
    const fy = 330;
    chalk(g, P, 6, (c) => {
      c.moveTo(fx - 22, fy - 120);
      c.lineTo(fx - 22, fy - 70);
      c.arc(fx, fy, 74, -Math.PI / 2 - 0.3, Math.PI * 1.5 + 0.3, true);
      c.moveTo(fx + 22, fy - 70);
      c.lineTo(fx + 22, fy - 120);
    });
    chalk(g, P, 5, (c) => {
      c.moveTo(fx - 30, fy - 122);
      c.lineTo(fx + 30, fy - 122);
    });
    chalk(g, P, 4, (c) => {
      c.moveTo(fx - 66, fy + 10);
      c.bezierCurveTo(fx - 30, fy - 10, fx + 30, fy + 20, fx + 66, fy);
    });
    for (const [bx, by, r] of [
      [fx - 20, fy + 30, 10],
      [fx + 18, fy + 40, 7],
      [fx + 2, fy - 150, 9],
      [fx + 22, fy - 180, 6],
    ] as const) {
      chalk(g, P, 3, (c) => c.arc(bx, by, r, 0, Math.PI * 2));
    }
    // 키 큰 물약 병
    const tx = 660;
    chalk(g, C, 5, (c) => {
      c.moveTo(tx - 8, 200);
      c.lineTo(tx - 8, 240);
      c.lineTo(tx - 34, 280);
      c.lineTo(tx - 34, 410);
      c.lineTo(tx + 34, 410);
      c.lineTo(tx + 34, 280);
      c.lineTo(tx + 8, 240);
      c.lineTo(tx + 8, 200);
    });
    chalk(g, C, 4, (c) => {
      c.moveTo(tx - 34, 340);
      c.lineTo(tx + 34, 340);
    });
    // 화살표: 물약 → 마법진
    chalk(g, L, 5, (c) => {
      c.moveTo(430, 150);
      c.quadraticCurveTo(390, 100, 330, 120);
      c.moveTo(330, 120);
      c.lineTo(352, 104);
      c.moveTo(330, 120);
      c.lineTo(350, 136);
    });
    // 마법 모자와 달·별(오른쪽)
    chalk(g, P, 6, (c) => {
      c.moveTo(780, 400);
      c.lineTo(920, 400);
      c.moveTo(800, 400);
      c.quadraticCurveTo(840, 300, 870, 220);
      c.quadraticCurveTo(880, 300, 900, 400);
    });
    chalk(g, Y, 4, (c) => starPath(c, 852, 340, 18));
    chalk(g, Y, 6, (c) => {
      c.arc(900, 110, 54, Math.PI * 0.35, Math.PI * 1.65);
      c.arc(926, 100, 46, Math.PI * 1.55, Math.PI * 0.45, true);
    });
    chalk(g, W, 4, (c) => starPath(c, 790, 90, 22));
    chalk(g, Y, 4, (c) => starPath(c, 980, 240, 16));
    g.fillStyle = 'rgba(255,250,220,0.9)';
    sparkle(g, 760, 200, 14);
    sparkle(g, 420, 440, 12);
    sparkle(g, 960, 420, 12);
    // 글씨(라틴 문자만)
    g.globalAlpha = 0.85;
    g.fillStyle = W;
    g.font = 'bold 46px sans-serif';
    g.fillText('MAGIC 101', 420, 70);
    g.font = 'bold 34px sans-serif';
    g.fillStyle = Y;
    g.fillText('A+', 950, 480);
    g.globalAlpha = 1;
    // 분필 결: 바탕색 점을 흩뿌린다
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(46,110,72,0.5)' : 'rgba(255,255,255,0.05)';
      g.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
  });
}

/** 주문 시간표 포스터: 초록 머리띠, 요일 칸, 칸마다 마법 아이콘 */
function createTimetableTexture(): Texture {
  return canvasTextureWH(512, 640, (g, w, h) => {
    const rnd = lcg(71);
    g.fillStyle = '#fbf3dc';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#2f7a48';
    g.fillRect(0, 0, w, 110);
    g.fillStyle = '#ffd36b';
    g.fillRect(0, 104, w, 8);
    g.fillStyle = '#fff6dc';
    g.font = 'bold 50px sans-serif';
    g.textAlign = 'center';
    g.fillText('SPELL TIMETABLE', w / 2, 72);
    const cols = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
    const cw = (w - 40) / cols.length;
    g.font = 'bold 28px sans-serif';
    g.fillStyle = '#2f6a40';
    cols.forEach((c, i) => g.fillText(c, 20 + cw * (i + 0.5), 152));
    const rows = 4;
    const rh = (h - 200) / rows;
    const fills = ['#ffd6e6', '#d4f4d8', '#dcd0ff', '#cfeeff', '#fff0b8', '#ffe0c8'];
    const inks = ['#e2507a', '#3f9a5a', '#7a4ae0', '#2a86d8', '#e0a020', '#e0703a'];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols.length; c++) {
        const x = 20 + c * cw + 4;
        const y = 175 + r * rh + 4;
        const k = Math.floor(rnd() * fills.length);
        g.fillStyle = fills[k] ?? '#d4f4d8';
        g.beginPath();
        g.roundRect(x, y, cw - 8, rh - 8, 12);
        g.fill();
        const ink = inks[k] ?? '#3f9a5a';
        const cx = x + (cw - 8) / 2;
        const cy = y + (rh - 8) / 2;
        g.fillStyle = ink;
        g.strokeStyle = ink;
        g.lineWidth = 5;
        const icon = (r * 5 + c * 3 + k) % 5;
        if (icon === 0) {
          g.beginPath();
          starPath(g, cx, cy, 26);
          g.fill();
        } else if (icon === 1) {
          g.beginPath();
          g.arc(cx, cy, 24, Math.PI * 0.3, Math.PI * 1.7);
          g.arc(cx + 12, cy - 4, 20, Math.PI * 1.6, Math.PI * 0.4, true);
          g.fill();
        } else if (icon === 2) {
          g.beginPath();
          g.arc(cx, cy + 8, 20, 0, Math.PI * 2);
          g.fill();
          g.fillRect(cx - 7, cy - 26, 14, 20);
          g.fillStyle = '#8a5a2c';
          g.fillRect(cx - 9, cy - 32, 18, 8);
        } else if (icon === 3) {
          g.beginPath();
          g.moveTo(cx - 24, cy + 24);
          g.lineTo(cx + 18, cy - 18);
          g.stroke();
          g.beginPath();
          starPath(g, cx + 20, cy - 20, 13);
          g.fill();
        } else {
          sparkle(g, cx, cy, 26);
        }
      }
    }
    g.strokeStyle = '#2f7a48';
    g.lineWidth = 10;
    g.strokeRect(5, 5, w - 10, h - 10);
  });
}

/** 학교 페넌트: 바탕색 띠와 깃대 쪽 줄, 가운데 상징 */
function createPennantTexture(field: string, band: string, mark: number): Texture {
  return canvasTextureWH(512, 256, (g, w, h) => {
    g.fillStyle = field;
    g.fillRect(0, 0, w, h);
    g.fillStyle = band;
    g.fillRect(0, 0, 70, h);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(70, h * 0.1, w, 10);
    g.fillRect(70, h * 0.9 - 10, w, 10);
    g.fillStyle = '#fff6dc';
    const cx = 200;
    const cy = h / 2;
    if (mark === 0) {
      g.beginPath();
      starPath(g, cx, cy, 52);
      g.fill();
    } else if (mark === 1) {
      g.beginPath();
      g.arc(cx, cy, 50, Math.PI * 0.3, Math.PI * 1.7);
      g.arc(cx + 24, cy - 8, 42, Math.PI * 1.6, Math.PI * 0.4, true);
      g.fill();
    } else if (mark === 2) {
      g.beginPath();
      g.arc(cx, cy + 14, 40, 0, Math.PI * 2);
      g.fill();
      g.fillRect(cx - 14, cy - 56, 28, 40);
    } else {
      sparkle(g, cx, cy, 56);
    }
  });
}

/** 학교 문장: 초록 방패에 금빛 별·지팡이, 크림 테 */
function createEmblemTexture(): Texture {
  return canvasTexture(512, (g, s) => {
    const c = s / 2;
    g.fillStyle = '#fff3d6';
    g.beginPath();
    g.arc(c, c, c, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffc94a';
    g.lineWidth = 18;
    g.beginPath();
    g.arc(c, c, c - 14, 0, Math.PI * 2);
    g.stroke();
    // 방패
    const sh = g.createLinearGradient(0, 80, 0, 440);
    sh.addColorStop(0, '#4fb86a');
    sh.addColorStop(1, '#2a7044');
    g.fillStyle = sh;
    g.beginPath();
    g.moveTo(c - 140, 110);
    g.lineTo(c + 140, 110);
    g.lineTo(c + 140, 270);
    g.quadraticCurveTo(c + 130, 380, c, 440);
    g.quadraticCurveTo(c - 130, 380, c - 140, 270);
    g.closePath();
    g.fill();
    g.strokeStyle = '#ffd36b';
    g.lineWidth = 10;
    g.stroke();
    // 지팡이와 별
    g.strokeStyle = '#8a4a22';
    g.lineWidth = 16;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(c - 70, 380);
    g.lineTo(c + 40, 210);
    g.stroke();
    g.fillStyle = '#ffd36b';
    g.beginPath();
    starPath(g, c + 50, 190, 62);
    g.fill();
    g.fillStyle = 'rgba(255,250,230,0.95)';
    sparkle(g, c - 70, 190, 22);
    sparkle(g, c + 90, 330, 18);
  });
}

/** 시계: 크림 판에 달·별 눈금, 초록 테 */
function createClockTexture(): Texture {
  return canvasTexture(256, (g, s) => {
    const c = s / 2;
    g.fillStyle = '#2f7a48';
    g.beginPath();
    g.arc(c, c, c, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff6dc';
    g.beginPath();
    g.arc(c, c, c - 16, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.fillStyle = i % 3 === 0 ? '#e0a020' : '#3f9a5a';
      const x = c + Math.sin(a) * (c - 36);
      const y = c - Math.cos(a) * (c - 36);
      if (i % 3 === 0) {
        g.beginPath();
        starPath(g, x, y, 12);
        g.fill();
      } else {
        g.beginPath();
        g.arc(x, y, 5, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.strokeStyle = '#5a2a10';
    g.lineCap = 'round';
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(c, c);
    g.lineTo(c + 30, c - 40);
    g.stroke();
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(c, c);
    g.lineTo(c - 62, c + 16);
    g.stroke();
    g.fillStyle = '#e2504a';
    g.beginPath();
    g.arc(c, c, 9, 0, Math.PI * 2);
    g.fill();
  });
}

/** 동그란 러그: 초록·크림 띠에 금빛 별 */
function createRugTexture(): Texture {
  return canvasTexture(1024, (g, s) => {
    const c = s / 2;
    const bands = ['#2f7a48', '#f6ecd0', '#5bbf6a', '#ffcf6e', '#a8dca0', '#f6ecd0', '#4fae62'];
    bands.forEach((col, i) => {
      g.fillStyle = col;
      g.beginPath();
      g.arc(c, c, c * (1 - i * 0.12), 0, Math.PI * 2);
      g.fill();
    });
    g.fillStyle = '#ffcf6e';
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      g.beginPath();
      starPath(g, c + Math.cos(a) * c * 0.94, c + Math.sin(a) * c * 0.94, 16);
      g.fill();
    }
    g.fillStyle = '#ffffff';
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      sparkle(g, c + Math.cos(a) * c * 0.58, c + Math.sin(a) * c * 0.58, 12);
    }
    const rnd = lcg(37);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,250,230'},0.06)`;
      g.fillRect(rnd() * s, rnd() * s, 2, 2);
    }
  });
}

/** 지구본: 파란 바다와 초록 대륙 */
function createGlobeTexture(): Texture {
  return canvasTextureWH(512, 256, (g, w, h) => {
    const rnd = lcg(91);
    g.fillStyle = '#3a9ae8';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9; i++) {
      const cx = rnd() * w;
      const cy = h * (0.2 + rnd() * 0.6);
      g.fillStyle = rnd() < 0.7 ? '#5bbf5a' : '#e8c070';
      for (let j = 0; j < 7; j++) {
        g.beginPath();
        g.arc(cx + (rnd() - 0.5) * 70, cy + (rnd() - 0.5) * 40, 14 + rnd() * 20, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 2;
    for (let y = h / 6; y < h; y += h / 6) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(w, y);
      g.stroke();
    }
  });
}

/** 책상 스티커(별·하트·달) */
function createStickerTexture(kind: number): Texture {
  return canvasTexture(128, (g, s) => {
    const c = s / 2;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(c, c, c - 2, 0, Math.PI * 2);
    g.fill();
    if (kind === 0) {
      g.fillStyle = '#ffc94a';
      g.beginPath();
      starPath(g, c, c + 3, 50);
      g.fill();
    } else if (kind === 1) {
      g.fillStyle = '#ff6f9a';
      g.beginPath();
      g.moveTo(c, c + 40);
      g.bezierCurveTo(c - 70, c - 6, c - 30, c - 54, c, c - 20);
      g.bezierCurveTo(c + 30, c - 54, c + 70, c - 6, c, c + 40);
      g.fill();
    } else {
      g.fillStyle = '#8a5ae0';
      g.beginPath();
      g.arc(c, c, 44, Math.PI * 0.3, Math.PI * 1.7);
      g.arc(c + 20, c - 6, 36, Math.PI * 1.6, Math.PI * 0.4, true);
      g.fill();
      g.fillStyle = '#ffc94a';
      sparkle(g, c + 26, c + 24, 14);
    }
  });
}

// ───────────────────────── 도형 도우미 ─────────────────────────

/** 아치 창 모양 판(아래 가운데가 원점). UV는 0~1로 맞춘다 */
function archGeometry(w: number, h: number): ShapeGeometry {
  const s = new Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h - w / 2);
  s.absarc(0, h - w / 2, w / 2, 0, Math.PI, false);
  s.lineTo(-w / 2, 0);
  const geo = new ShapeGeometry(s, 24);
  const pos = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) {
    uv.setXY(i, (pos.getX(i) + w / 2) / w, pos.getY(i) / h);
  }
  uv.needsUpdate = true;
  return geo;
}

/** 다섯 꼭지 입체 별(지름 약 2) */
function starGeometry(): ExtrudeGeometry {
  const s = new Shape();
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 1 : 0.45;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const geo = new ExtrudeGeometry(s, {
    depth: 0.3,
    bevelEnabled: true,
    bevelThickness: 0.12,
    bevelSize: 0.08,
    bevelSegments: 1,
  });
  geo.translate(0, 0, -0.15);
  return geo;
}

/** 같은 지오메트리를 위치·크기·yaw만 달리해 하나의 인스턴스로 */
function instanced(
  geo: BufferGeometry,
  mat: Material,
  items: readonly { p: Vector3; s: number; yaw: number; color: number }[],
): InstancedMesh {
  const mesh = new InstancedMesh(geo, mat, items.length);
  const m = new Matrix4();
  const q = new Quaternion();
  const e = new Euler();
  const sc = new Vector3();
  items.forEach((it, i) => {
    q.setFromEuler(e.set(0, it.yaw, 0));
    mesh.setMatrixAt(i, m.compose(it.p, q, sc.set(it.s, it.s, it.s)));
    mesh.setColorAt(i, new Color(it.color));
  });
  return mesh;
}

/** 빛나는 알 하나(물약 몸통) */
interface Glow {
  p: Vector3;
  r: number;
}

/** 빛나는 알: 조명을 받지 않는 몸통과 은은한 번짐을 인스턴스 두 개로 */
function addGlowBalls(k: Kit, parent: Group, items: readonly Glow[], colors: readonly number[]) {
  const core = new SphereGeometry(1, 14, 10);
  const halo = new SphereGeometry(1, 20, 14);
  k.geos.push(core, halo);
  const coreMat = new MeshBasicMaterial({ color: 0xffffff });
  const haloMat = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.25,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  k.mats.push(coreMat, haloMat);
  const colorAt = (i: number) => colors[i % colors.length] ?? 0xffffff;
  parent.add(
    instanced(
      core,
      coreMat,
      items.map((g, i) => ({ p: g.p, s: g.r, yaw: 0, color: colorAt(i) })),
    ),
    instanced(
      halo,
      haloMat,
      items.map((g, i) => ({ p: g.p, s: g.r * 2, yaw: 0, color: colorAt(i) })),
    ),
  );
}

/** 물약 병 하나: 빛나는 몸통 알은 glow에 넣고 목·코르크만 Batch로 */
function potion(b: Batch, at: Spot, lx: number, ly: number, lz: number, r: number, glow: Glow[]) {
  glow.push({ p: world(at, lx, ly + r, lz), r });
  b.add('cyl', at, lx, ly + r * 2.1, lz, r * 0.4, r * 1.2, r * 0.4, 0xd8f4ff);
  b.add('cyl', at, lx, ly + r * 2.9, lz, r * 0.48, r * 0.6, r * 0.48, 0xa86a3a);
}

/** 책장 한 칸을 왼쪽부터 채운다: 주문서·물약·곰 인형·수정 구슬·누운 책·화분 */
function fillShelf(
  b: Batch,
  at: Spot,
  y: number,
  width: number,
  depth: number,
  rnd: () => number,
  glow: Glow[],
) {
  let x = -width / 2 + 2;
  const end = width / 2 - 2;
  let n = 0;
  while (x < end - 6) {
    const kind = (n++ + Math.floor(rnd() * 6)) % 6;
    const room = end - x;
    if (kind === 0 || kind === 5) {
      // 주문서: 세운 책, 금빛 띠, 마지막 권은 비스듬히
      const count = 3 + Math.floor(rnd() * 4);
      for (let i = 0; i < count && x < end - 3; i++) {
        const t = 2 + rnd() * 1.6;
        const h = 14 + rnd() * 8;
        const lean = i === count - 1 ? -0.22 : 0;
        const col = pick(SPELLBOOK, rnd, GREEN);
        b.add('box', at, x + t / 2, y + h / 2, 0, t, h, depth * 0.7, col, [0, 0, lean]);
        if (lean === 0) {
          b.add('box', at, x + t / 2, y + h * 0.78, depth * 0.35, t + 0.1, 1, 0.2, GOLD);
          b.add('box', at, x + t / 2, y + h * 0.22, depth * 0.35, t + 0.1, 0.8, 0.2, GOLD);
        }
        x += t + 0.3;
      }
      x += 3;
    } else if (kind === 1) {
      // 물약 병 두세 개
      const count = 2 + Math.floor(rnd() * 2);
      for (let i = 0; i < count && x < end - 6; i++) {
        const r = 2.2 + rnd() * 1.2;
        potion(b, at, x + r + 0.5, y, (rnd() - 0.5) * 4, r, glow);
        x += r * 2 + 1.5;
      }
      x += 2;
    } else if (kind === 2 && room > 16) {
      teddy(b, at, x + 8, y, 0, 0.85 + rnd() * 0.25, pick(BEAR, rnd, 0xc98a4e));
      x += 18;
    } else if (kind === 3) {
      // 수정 구슬: 금빛 받침 위 하늘색 구슬
      b.add('cyl', at, x + 5, y + 1.2, 0, 3.6, 2.4, 3.6, GOLD);
      b.add('sphere', at, x + 5, y + 6, 0, 4.2, 4.2, 4.2, 0xa8e4ff);
      b.add('sphere', at, x + 3.6, y + 7.6, 2.6, 1, 1, 1, 0xffffff);
      x += 12;
    } else {
      // 누운 책 더미 위 작은 지구본
      let yy = y;
      for (let i = 0; i < 3; i++) {
        const t = 2.4 + rnd();
        b.add(
          'box',
          at,
          x + 7,
          yy + t / 2,
          0,
          13 - i,
          t,
          depth * 0.6,
          pick(SPELLBOOK, rnd, GREEN),
          [0, (rnd() - 0.5) * 0.3, 0],
        );
        yy += t;
      }
      b.add('cyl', at, x + 7, yy + 0.8, 0, 1.6, 1.6, 1.6, GOLD);
      b.add('sphere', at, x + 7, yy + 5, 0, 3.6, 3.6, 3.6, 0x3a86e8);
      b.add('sphere', at, x + 6, yy + 6, 2, 1.8, 1.4, 1.6, 0x5bbf5a);
      x += 15;
    }
  }
}

/** 책장: 옆판·윗판·칸·뒤판(초록 칠). 앞이 지역 +z */
function bookcase(
  b: Batch,
  at: Spot,
  w: number,
  h: number,
  d: number,
  shelves: number,
  rnd: () => number,
  glow: Glow[],
) {
  const t = 2.4;
  b.add('box', at, -w / 2 + t / 2, h / 2, 0, t, h, d, WOOD);
  b.add('box', at, w / 2 - t / 2, h / 2, 0, t, h, d, WOOD);
  b.add('box', at, 0, h - t / 2, 0, w + 3, t, d + 2, WOOD);
  b.add('box', at, 0, h + 1.2, -d / 2 + 3, w - 6, 2.4, 2, DEEP_GREEN);
  b.add('box', at, 0, h / 2, -d / 2 + 0.5, w - t * 2, h, 1, DEEP_GREEN);
  const gap = (h - t * 2) / shelves;
  for (let i = 0; i < shelves; i++) {
    const y = t + i * gap;
    b.add('box', at, 0, y, 0, w - t * 2, t, d, WOOD);
    b.add('box', at, 0, y + t / 2 - 0.2, d / 2 - 0.3, w - t * 2, 0.8, 0.6, GOLD);
    fillShelf(b, at, y + t / 2, w - t * 2, d, rnd, glow);
  }
}

/** 아치 창 하나: 하늘 판, 둥근 창틀(토러스 반쪽), 창살, 창턱 */
function archWindow(
  room: Group,
  b: Batch,
  at: Spot,
  w: number,
  h: number,
  skyGeo: BufferGeometry,
  skyMat: Material,
  archGeo: BufferGeometry,
  frameMat: Material,
) {
  const p = world(at, 0, 0, 0.6);
  const sky = new Mesh(skyGeo, skyMat);
  sky.position.copy(p);
  sky.rotation.y = at.yaw;
  room.add(sky);
  const arch = new Mesh(archGeo, frameMat);
  arch.position.copy(world(at, 0, h - w / 2, 2));
  arch.rotation.y = at.yaw;
  room.add(arch);
  const spring = h - w / 2;
  b.add('box', at, -w / 2 - 1.5, spring / 2, 2, 5, spring, 5, CREAM);
  b.add('box', at, w / 2 + 1.5, spring / 2, 2, 5, spring, 5, CREAM);
  b.add('box', at, 0, -2, 5, w + 14, 4, 12, CREAM);
  b.add('box', at, 0, -6, 3, w + 6, 5, 6, DEEP_GREEN);
  b.add('box', at, 0, h / 2, 1.5, 2.4, h, 2.4, CREAM);
  b.add('box', at, 0, spring, 1.5, w, 2.4, 2.4, CREAM);
  b.add('box', at, 0, spring * 0.5, 1.5, w, 2, 2, CREAM);
  for (const a of [Math.PI / 4, (Math.PI * 3) / 4]) {
    const r = w / 4;
    b.add('box', at, Math.cos(a) * r, spring + Math.sin(a) * r, 1.5, 2, w / 2, 2, CREAM, [
      0,
      0,
      a - Math.PI / 2,
    ]);
  }
}

// ───────────────────────── 테마 ─────────────────────────

export const buildClassroomTheme: ThemeBuilder = (k) => {
  const room = new Group();
  const batch = new Batch();
  const rnd = lcg(29);
  const glow: Glow[] = [];
  const stars: { p: Vector3; s: number; yaw: number; color: number }[] = [];
  const origin: Spot = { x: 0, y: 0, z: 0, yaw: 0 };

  // 바닥·벽·천장
  const plank = createFloorTexture();
  k.texs.push(plank);
  const floorMat = new MeshStandardMaterial({ map: plank, roughness: 0.7 });
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

  const ceilTex = createCeilingTexture();
  k.texs.push(ceilTex);
  const ceilMat = new MeshStandardMaterial({
    map: ceilTex,
    roughness: 0.95,
    emissive: 0xffffff,
    emissiveMap: ceilTex,
    emissiveIntensity: 0.3,
  });
  k.mats.push(ceilMat);
  const ceil = k.mesh(new PlaneGeometry(ROOM_HALF * 2, ROOM_HALF * 2), ceilMat, false, false);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = CEIL_Y;
  room.add(ceil);
  for (let i = -2; i <= 2; i++) {
    batch.add('box', origin, i * 80, CEIL_Y - 5, 0, 9, 10, ROOM_HALF * 2, 0xd08a4a);
    batch.add('box', origin, 0, CEIL_Y - 5, i * 80, ROOM_HALF * 2, 6, 6, 0xd08a4a);
  }
  // 천장 몰딩(초록)
  for (let i = 0; i < 4; i++) {
    const yaw = (i * Math.PI) / 2;
    const at: Spot = {
      x: -Math.sin(yaw) * ROOM_HALF,
      y: CEIL_Y,
      z: -Math.cos(yaw) * ROOM_HALF,
      yaw,
    };
    batch.add('box', at, 0, -4, 3, ROOM_HALF * 2, 8, 6, DEEP_GREEN);
    batch.add('box', at, 0, -8.5, 4, ROOM_HALF * 2, 1.5, 6, GOLD);
  }

  // 러그
  const rugTex = createRugTexture();
  k.texs.push(rugTex);
  const rugMat = new MeshStandardMaterial({ map: rugTex, roughness: 1 });
  k.mats.push(rugMat);
  const rug = k.mesh(new CircleGeometry(125, 64), rugMat, false, true);
  rug.rotation.x = -Math.PI / 2;
  rug.position.y = FLOOR_Y + 0.3;
  room.add(rug);

  // 창 공용 자원
  const skyTexA = createSkyTexture(3, true);
  const skyTexB = createSkyTexture(8, false);
  k.texs.push(skyTexA, skyTexB);
  const skyMatA = new MeshBasicMaterial({ map: skyTexA });
  const skyMatB = new MeshBasicMaterial({ map: skyTexB });
  k.mats.push(skyMatA, skyMatB);
  const frameMat = k.std(CREAM, 0.5);
  const BIG_W = 100;
  const BIG_H = 126;
  const SIDE_W = 66;
  const SIDE_H = 104;
  const bigSky = archGeometry(BIG_W, BIG_H);
  const sideSky = archGeometry(SIDE_W, SIDE_H);
  const bigArch = new TorusGeometry(BIG_W / 2 + 1.5, 2.6, 8, 32, Math.PI);
  const sideArch = new TorusGeometry(SIDE_W / 2 + 1.5, 2.6, 8, 24, Math.PI);
  k.geos.push(bigSky, sideSky, bigArch, sideArch);

  // 앞 벽(좌석 0이 보는 쪽, z-): 큰 칠판, 분필 받침, 시계, 양옆 책장
  {
    const yaw = 0;
    const wallZ = -ROOM_HALF;
    const at: Spot = { x: 0, y: 0, z: wallZ, yaw };
    const cbTex = createChalkboardTexture();
    k.texs.push(cbTex);
    const cbMat = new MeshStandardMaterial({
      map: cbTex,
      roughness: 0.85,
      emissive: 0xffffff,
      emissiveMap: cbTex,
      emissiveIntensity: 0.18,
    });
    k.mats.push(cbMat);
    const cbW = 176;
    const cbH = 88;
    const cbY = 50;
    const cb = k.mesh(new PlaneGeometry(cbW, cbH), cbMat, false, true);
    cb.position.set(0, cbY, wallZ + 2.2);
    room.add(cb);
    // 원목 테두리와 분필 받침
    batch.add('box', at, 0, cbY + cbH / 2 + 2.5, 2, cbW + 12, 5, 4, WOOD);
    batch.add('box', at, 0, cbY - cbH / 2 - 2.5, 2, cbW + 12, 5, 4, WOOD);
    batch.add('box', at, -cbW / 2 - 3, cbY, 2, 6, cbH + 10, 4, WOOD);
    batch.add('box', at, cbW / 2 + 3, cbY, 2, 6, cbH + 10, 4, WOOD);
    batch.add('box', at, 0, cbY - cbH / 2 - 5, 6, cbW + 6, 2, 9, DARK_WOOD);
    const chalkCols = [0xffffff, 0xffe27a, 0xff9ec4, 0x8fe3ff, 0xc8f59a];
    for (let i = 0; i < 7; i++) {
      batch.add(
        'cyl',
        at,
        -60 + i * 9 + rnd() * 3,
        cbY - cbH / 2 - 3.4,
        6 + rnd() * 2,
        0.6,
        5 + rnd() * 2,
        0.6,
        chalkCols[i % chalkCols.length] ?? 0xffffff,
        [0, rnd(), Math.PI / 2],
      );
    }
    batch.add('box', at, 50, cbY - cbH / 2 - 2.6, 6, 12, 3, 5, 0x3a2a60);
    batch.add('box', at, 50, cbY - cbH / 2 - 0.8, 6, 12, 1, 5, 0xe8e0d0);
    // 칠판 위 시계
    const clockTex = createClockTexture();
    k.texs.push(clockTex);
    const clockMat = new MeshStandardMaterial({ map: clockTex, roughness: 0.5 });
    k.mats.push(clockMat);
    const clock = k.mesh(new CircleGeometry(15, 40), clockMat, false, false);
    clock.position.set(0, cbY + cbH / 2 + 26, wallZ + 3.4);
    room.add(clock);
    batch.add('cyl', at, 0, cbY + cbH / 2 + 26, 1.6, 16.5, 3, 16.5, GOLD, [Math.PI / 2, 0, 0]);
    // 칠판 양옆 별 장식
    for (const sx of [-1, 1]) {
      stars.push({ p: world(at, sx * 26, cbY + cbH / 2 + 34, 2), s: 4, yaw, color: GOLD });
      stars.push({ p: world(at, sx * 30, cbY + cbH / 2 + 16, 2), s: 2.6, yaw, color: 0xff9ec4 });
    }
    for (const sx of [-1, 1]) {
      const bat: Spot = { x: sx * 140, y: FLOOR_Y, z: wallZ + 16, yaw };
      bookcase(batch, bat, 90, 176, 28, 5, rnd, glow);
      castle(batch, bat, sx * -14, 176, -2, 0.95);
      teddy(batch, bat, sx * 28, 176, 2, 1.3, sx < 0 ? 0xe8c08a : 0xc98a4e);
    }
  }

  // 뒤 벽(좌석 1이 보는 쪽, z+): 큰 아치 창과 초록 커튼, 창턱 장난감, 양옆 책장
  {
    const yaw = Math.PI;
    const wallZ = ROOM_HALF;
    const at: Spot = { x: 0, y: 0, z: wallZ, yaw };
    const winY = 2;
    archWindow(room, batch, { ...at, y: winY }, BIG_W, BIG_H, bigSky, skyMatA, bigArch, frameMat);
    const sill: Spot = { x: 0, y: winY, z: wallZ, yaw };
    teddy(batch, sill, -34, 0, 6, 1, 0xf2e6d2);
    potion(batch, sill, 20, 0, 6, 3, glow);
    potion(batch, sill, 30, 0, 7, 2.4, glow);
    batch.add('box', sill, 40, 3, 6, 6, 6, 6, 0x5bbf6a, [0, 0.3, 0]);
    for (const sx of [-1, 1]) {
      batch.add('box', at, sx * (BIG_W / 2 + 14), winY + 64, 6, 16, 136, 3, GREEN);
      batch.add('box', at, sx * (BIG_W / 2 + 14), winY + 40, 8, 18, 4, 4, GOLD);
    }
    batch.add('box', at, 0, winY + BIG_H + 14, 6, BIG_W + 48, 10, 4, DEEP_GREEN);
    batch.add('box', at, 0, winY + BIG_H + 9, 8, BIG_W + 48, 1.6, 2, GOLD);
    for (const sx of [-1, 1]) {
      const bat: Spot = { x: sx * 140, y: FLOOR_Y, z: wallZ - 16, yaw };
      bookcase(batch, bat, 90, 176, 28, 5, rnd, glow);
      castle(batch, bat, sx * 14, 176, -2, 0.95);
      teddy(batch, bat, sx * -28, 176, 2, 1.3, 0xb06a3a);
    }
  }

  // 옆 벽: 아치 창 두 개(창턱에 물약), 창 아래 낮은 책장, 가운데 시간표·문장과 페넌트
  const timetableTex = createTimetableTexture();
  const emblemTex = createEmblemTexture();
  k.texs.push(timetableTex, emblemTex);
  const timetableMat = new MeshStandardMaterial({ map: timetableTex, roughness: 0.8 });
  const emblemMat = new MeshStandardMaterial({
    map: emblemTex,
    roughness: 0.5,
    emissive: 0xffffff,
    emissiveMap: emblemTex,
    emissiveIntensity: 0.2,
  });
  k.mats.push(timetableMat, emblemMat);
  [Math.PI / 2, -Math.PI / 2].forEach((yaw, wi) => {
    const wallX = -ROOM_HALF * Math.sin(yaw);
    const inward = Math.sin(yaw);
    for (const sz of [-1, 1]) {
      const at: Spot = { x: wallX, y: 6, z: sz * 92, yaw };
      archWindow(room, batch, at, SIDE_W, SIDE_H, sideSky, skyMatB, sideArch, frameMat);
      for (let i = 0; i < 4; i++) potion(batch, at, -24 + i * 15, 0, 6, 2.2 + rnd() * 0.8, glow);
      const low: Spot = { x: wallX + inward * 14, y: FLOOR_Y, z: sz * 92, yaw };
      bookcase(batch, low, 82, 84, 24, 2, rnd, glow);
    }
    const mid: Spot = { x: wallX, y: 0, z: 0, yaw };
    if (wi === 0) {
      const poster = k.mesh(new PlaneGeometry(48, 60), timetableMat, false, true);
      poster.position.copy(world(mid, 0, 50, 1.2));
      poster.rotation.y = yaw;
      room.add(poster);
      for (const [px, py] of [
        [-21, 77],
        [21, 77],
        [-21, 23],
        [21, 23],
      ] as const) {
        batch.add('sphere', mid, px, py, 1.6, 1.2, 1.2, 1.2, 0xe2504a);
      }
    } else {
      const emblem = k.mesh(new CircleGeometry(28, 48), emblemMat, false, false);
      emblem.position.copy(world(mid, 0, 54, 3.4));
      emblem.rotation.y = yaw;
      room.add(emblem);
      batch.add('cyl', mid, 0, 54, 1.6, 30.5, 3, 30.5, GOLD, [Math.PI / 2, 0, 0]);
    }
    // 가운데 아래: 지구본 받침대(옆 벽 하나) / 수정 구슬 받침대(다른 옆 벽)
    const stand: Spot = { x: wallX + inward * 26, y: FLOOR_Y, z: 0, yaw };
    batch.add('cyl', stand, 0, 30, 0, 9, 60, 9, WOOD);
    batch.add('cyl', stand, 0, 61, 0, 12, 3, 12, DEEP_GREEN);
    batch.add('cyl', stand, 0, 2, 0, 13, 4, 13, DARK_WOOD);
    if (wi === 1) {
      batch.add('cyl', stand, 0, 64, 0, 5, 3, 5, GOLD);
    }
  });

  // 수정 구슬(+x 벽 받침대 위): 보랏빛으로 은은히 빛나는 유리 구슬
  const crystalMat = new MeshStandardMaterial({
    color: 0xc8a8ff,
    emissive: 0x8a5ae0,
    emissiveIntensity: 0.6,
    roughness: 0.1,
    metalness: 0.1,
  });
  k.mats.push(crystalMat);
  const crystal = k.mesh(new SphereGeometry(10, 32, 20), crystalMat, false, false);
  crystal.position.set(ROOM_HALF - 26, FLOOR_Y + 76, 0);
  room.add(crystal);

  // 지구본(-x 벽 받침대 위)
  const globeTex = createGlobeTexture();
  k.texs.push(globeTex);
  const globeMat = new MeshStandardMaterial({ map: globeTex, roughness: 0.4 });
  k.mats.push(globeMat);
  const globe = k.mesh(new SphereGeometry(12, 32, 20), globeMat, false, false);
  globe.position.set(-ROOM_HALF + 26, FLOOR_Y + 78, 0);
  globe.rotation.set(0, 1.2, 0.4);
  room.add(globe);
  const meridian = k.mesh(new TorusGeometry(13.6, 0.7, 8, 40), k.std(GOLD, 0.3, 0.7), false, false);
  meridian.position.copy(globe.position);
  meridian.rotation.set(0, Math.PI / 2, 0.4);
  room.add(meridian);
  batch.add('cyl', { x: -ROOM_HALF + 26, y: FLOOR_Y, z: 0, yaw: 0 }, 0, 64, 0, 3, 4, 3, GOLD);

  // 학교 페넌트
  const pennantDefs = [
    ['#3f9a5a', '#ffcf6e', 0],
    ['#e2504a', '#fff3d6', 1],
    ['#3a86e8', '#ffcf6e', 2],
    ['#8a4ae0', '#fff3d6', 3],
  ] as const;
  const pennantGeo = new ShapeGeometry(
    (() => {
      const s = new Shape();
      s.moveTo(0, -11);
      s.lineTo(46, 0);
      s.lineTo(0, 11);
      s.lineTo(0, -11);
      return s;
    })(),
  );
  {
    const pos = pennantGeo.getAttribute('position');
    const uv = pennantGeo.getAttribute('uv');
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 46, (pos.getY(i) + 11) / 22);
    uv.needsUpdate = true;
  }
  k.geos.push(pennantGeo);
  const pennantMats = pennantDefs.map(([f, b, m]) => {
    const tex = createPennantTexture(f, b, m);
    k.texs.push(tex);
    const mat = new MeshStandardMaterial({ map: tex, roughness: 0.8, side: DoubleSide });
    k.mats.push(mat);
    return mat;
  });
  const wallSpot = (yaw: number): Spot => ({
    x: -ROOM_HALF * Math.sin(yaw),
    y: 0,
    z: -ROOM_HALF * Math.cos(yaw),
    yaw,
  });
  // [벽 yaw, 지역 x, 높이]: 앞 벽은 시계 양옆, 옆 벽은 시간표·문장 위
  const pennants: [number, number, number][] = [
    [0, -94, 112],
    [0, 48, 112],
    [Math.PI / 2, -52, 104],
    [Math.PI / 2, 6, 104],
    [-Math.PI / 2, -52, 104],
    [-Math.PI / 2, 6, 104],
  ];
  pennants.forEach(([yaw, lx, y], i) => {
    const at = wallSpot(yaw);
    const mat = pennantMats[i % pennantMats.length] ?? frameMat;
    const p = new Mesh(pennantGeo, mat);
    p.position.copy(world(at, lx, y, 1.4));
    p.rotation.set(0, yaw, -0.18);
    room.add(p);
    batch.add('cyl', at, lx - 1, y, 1.6, 0.8, 26, 0.8, DARK_WOOD, [0, 0, -0.18]);
    batch.add('sphere', at, lx - 1 + Math.sin(0.18) * 13, y + 13, 1.6, 1.3, 1.3, 1.3, GOLD);
  });

  // 방 구석: 큰 곰 인형, 장난감 상자, 마법 모자 쓴 곰
  teddy(batch, { x: -165, y: FLOOR_Y, z: 160, yaw: Math.PI * 0.75 }, 0, 0, 0, 3, 0xc98a4e);
  teddy(batch, { x: 165, y: FLOOR_Y, z: -160, yaw: -Math.PI * 0.25 }, 0, 0, 0, 3, 0xf2e6d2);
  for (const [cx, cz, yaw, hat] of [
    [-165, 160, Math.PI * 0.75, 0x8a4ae0],
    [165, -160, -Math.PI * 0.25, 0x2f7a48],
  ] as const) {
    const at: Spot = { x: cx, y: FLOOR_Y, z: cz, yaw };
    batch.add('cyl', at, 0, 46.5, 1.2, 11, 1.2, 11, hat);
    batch.add('cone', at, 0, 57, 0.6, 8, 20, 8, hat, [-0.15, 0, 0]);
    stars.push({ p: world(at, 0, 54, 7.6), s: 2.4, yaw, color: GOLD });
  }
  for (const [cx, cz, yaw] of [
    [165, 160, -Math.PI * 0.75],
    [-165, -160, Math.PI * 0.25],
  ] as const) {
    const at: Spot = { x: cx, y: FLOOR_Y, z: cz, yaw };
    batch.add('box', at, 0, 14, 0, 40, 28, 26, GREEN);
    batch.add('box', at, 0, 28.5, 0, 42, 3, 28, GOLD);
    batch.add('box', at, 0, 14, 13.2, 10, 10, 0.6, CREAM);
    batch.add('sphere', at, -8, 33, 0, 6, 6, 6, 0xe2504a);
    batch.add('box', at, 9, 33, 2, 7, 7, 7, 0x3a86e8, [0, 0.5, 0]);
    potion(batch, at, 2, 30, -6, 3, glow);
  }

  // 천장 마법 등불(판 위는 비운다): 금빛 갓·줄과 빛나는 구슬
  const orbs: Vector3[] = [];
  for (const [ox, oz] of [
    [-110, -110],
    [110, -110],
    [-110, 110],
    [110, 110],
    [0, -135],
    [0, 135],
    [-135, 0],
    [135, 0],
  ] as const) {
    const y = CEIL_Y - 48;
    orbs.push(new Vector3(ox, y, oz));
    batch.add('cyl', origin, ox, (CEIL_Y + y + 7) / 2, oz, 0.35, CEIL_Y - y - 7, 0.35, DARK_WOOD);
    batch.add('cyl', origin, ox, y + 6.2, oz, 2.4, 2, 2.4, GOLD);
    batch.add('cone', origin, ox, y - 7.6, oz, 1.4, 3, 1.4, GOLD, [Math.PI, 0, 0]);
  }
  addGlowBalls(
    k,
    room,
    orbs.map((p) => ({ p, r: 5.5 })),
    [0xfff4d0, 0xd8ffe8, 0xffe7a8, 0xe8dcff],
  );

  batch.flush(k, room);

  // 물약 병의 빛
  addGlowBalls(k, room, glow, POTION);

  // 벽의 입체 별 장식
  const starGeo = starGeometry();
  k.geos.push(starGeo);
  const starMat = new MeshStandardMaterial({
    roughness: 0.35,
    metalness: 0.3,
    emissive: 0x6a4a10,
    emissiveIntensity: 0.4,
  });
  k.mats.push(starMat);
  room.add(instanced(starGeo, starMat, stars));

  // 삼각 깃발: 초록·크림·금 학교 색
  const wireMat = new MeshBasicMaterial({ color: 0x3a2a14 });
  k.mats.push(wireMat);
  const e = ROOM_HALF - 4;
  addBunting(
    k,
    room,
    wireMat,
    [
      [new Vector3(-170, CEIL_Y - 22, -e + 6), new Vector3(170, CEIL_Y - 22, -e + 6), 0],
      [new Vector3(-170, CEIL_Y - 22, e - 6), new Vector3(170, CEIL_Y - 22, e - 6), Math.PI],
      [new Vector3(-e + 6, CEIL_Y - 22, -170), new Vector3(-e + 6, CEIL_Y - 22, 170), Math.PI / 2],
      [new Vector3(e - 6, CEIL_Y - 22, -170), new Vector3(e - 6, CEIL_Y - 22, 170), -Math.PI / 2],
    ],
    [0x4fae62, 0xfff3d6, 0xffc94a, 0x2f7a48, 0xff8fb0, 0x3a86e8],
  );

  // 햇빛 자국: 옆 창에서 바닥으로 떨어지는 따뜻한 빛
  {
    const patchGeo = archGeometry(44, 90);
    k.geos.push(patchGeo);
    const patchMat = new MeshBasicMaterial({
      color: 0xfff0b0,
      transparent: true,
      opacity: 0.22,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    k.mats.push(patchMat);
    for (const sz of [-1, 1]) {
      const m = new Mesh(patchGeo, patchMat);
      m.rotation.set(-Math.PI / 2, 0, -Math.PI / 2);
      m.position.set(-ROOM_HALF + 50, FLOOR_Y + 0.5, sz * 92 + 10);
      room.add(m);
    }
  }

  // 떠다니는 반짝이(낮이라 적고 은은하게, 판 위 공간은 비운다)
  addSparkles(k, room, rnd, {
    count: 80,
    rMin: 115,
    rMax: 190,
    yMin: -20,
    yMax: 140,
    size: 4,
    colors: [0xffe27a, 0xffffff, 0xb8f5c8, 0xffc0e0],
  });

  // ───── 위에서 내려오는 물체(lamp): 판 위 마법 등불과 행성·별 모빌 ─────
  const lamp = new Group();
  room.add(lamp);
  const lb = new Batch();
  const lampAt: Spot = { x: 0, y: 0, z: 0, yaw: 0 };
  const ORB_Y = 86;
  // 등불: 금빛 테 세 줄, 위 뚜껑, 아래 방울
  const gold = k.std(GOLD, 0.3, 0.75);
  const cageGeo = new TorusGeometry(9, 0.45, 6, 40);
  k.geos.push(cageGeo);
  for (let i = 0; i < 3; i++) {
    const ring = new Mesh(cageGeo, gold);
    ring.position.y = ORB_Y;
    ring.rotation.set(0, (i * Math.PI) / 3, 0);
    lamp.add(ring);
  }
  const belt = new Mesh(cageGeo, gold);
  belt.position.y = ORB_Y;
  belt.rotation.x = Math.PI / 2;
  lamp.add(belt);
  lb.add('cyl', lampAt, 0, ORB_Y + 9.6, 0, 3.4, 2.4, 3.4, GOLD);
  lb.add('cone', lampAt, 0, ORB_Y + 12.4, 0, 3.4, 3.4, 3.4, DEEP_GREEN);
  lb.add('cone', lampAt, 0, ORB_Y - 11, 0, 1.6, 3.6, 1.6, GOLD, [Math.PI, 0, 0]);
  const orbMat = new MeshBasicMaterial({ color: 0xfff8e0 });
  k.mats.push(orbMat);
  const orb = k.mesh(new SphereGeometry(7.6, 24, 16), orbMat, false, false);
  orb.position.y = ORB_Y;
  lamp.add(orb);
  const haloMat = new MeshBasicMaterial({
    color: 0xfff0c0,
    transparent: true,
    opacity: 0.18,
    blending: AdditiveBlending,
    depthWrite: false,
  });
  k.mats.push(haloMat);
  const halo = k.mesh(new SphereGeometry(15, 20, 14), haloMat, false, false);
  halo.position.y = ORB_Y;
  lamp.add(halo);
  // 줄과 모빌
  const HUB_Y = 150;
  lb.add(
    'cyl',
    lampAt,
    0,
    (CEIL_Y + ORB_Y + 14) / 2,
    0,
    0.35,
    CEIL_Y - ORB_Y - 14,
    0.35,
    DARK_WOOD,
  );
  lb.add('sphere', lampAt, 0, HUB_Y, 0, 2.2, 2.2, 2.2, GOLD);
  const mobileStars: { p: Vector3; s: number; yaw: number; color: number }[] = [];
  const planets = [
    { a: 0.3, r: 4.6, c: 0xff8a5a, ring: true },
    { a: 1.9, r: 3.6, c: 0x5ad0ff, ring: false },
    { a: 3.4, r: 5.2, c: 0xffc94a, ring: true },
    { a: 4.9, r: 3.8, c: 0x8a4ae0, ring: false },
  ];
  for (const [i, pl] of planets.entries()) {
    const arm = 44;
    const px = Math.cos(pl.a) * arm;
    const pz = Math.sin(pl.a) * arm;
    lb.add('cyl', lampAt, px / 2, HUB_Y, pz / 2, 0.4, arm, 0.4, DARK_WOOD, [
      Math.PI / 2,
      -pl.a + Math.PI / 2,
      0,
    ]);
    const drop = 16 + (i % 2) * 10;
    lb.add('cyl', lampAt, px, HUB_Y - drop / 2, pz, 0.15, drop, 0.15, 0xf6ecd0);
    lb.add('sphere', lampAt, px, HUB_Y - drop - pl.r, pz, pl.r, pl.r, pl.r, pl.c);
    if (pl.ring) {
      lb.add(
        'cyl',
        lampAt,
        px,
        HUB_Y - drop - pl.r,
        pz,
        pl.r * 1.8,
        0.3,
        pl.r * 1.8,
        0xfff3d6,
        [0.35, 0, 0.2],
      );
    }
    // 팔 사이 별
    const sa = pl.a + 0.78;
    const sp = new Vector3(Math.cos(sa) * 30, HUB_Y - 12 - (i % 2) * 8, Math.sin(sa) * 30);
    lb.add('cyl', lampAt, sp.x, (HUB_Y + sp.y) / 2, sp.z, 0.15, HUB_Y - sp.y, 0.15, 0xf6ecd0);
    mobileStars.push({ p: sp.setY(sp.y - 2.6), s: 2.6, yaw: sa, color: i % 2 ? 0xfff3d6 : GOLD });
  }
  lb.flush(k, lamp);
  lamp.add(instanced(starGeo, starMat, mobileStars));

  // ───── 조명: 밝은 낮(하늘빛 전체광 + 창 햇빛) + 판 위 등불 주 스포트라이트(그림자) ─────
  const lights = new Group();
  lights.add(new AmbientLight(0xfff8ec, 0.35));
  lights.add(new HemisphereLight(0xeaf6ff, 0xc8985a, 0.85));
  const spot = new SpotLight(0xfff0d0, 760, 0, 0.95, 0.55, 1.2);
  spot.position.set(0, 78, 0);
  spot.target.position.set(0, 0, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0006;
  spot.shadow.camera.near = 20;
  spot.shadow.camera.far = 160;
  lights.add(spot, spot.target);
  const sun = new DirectionalLight(0xffeab8, 0.9);
  sun.position.set(-150, 140, 50);
  lights.add(sun);
  const fill = new DirectionalLight(0xd8f0ff, 0.35);
  fill.position.set(80, 60, -60);
  lights.add(fill);
  const wash = new PointLight(0xfff4e0, 0.5, 0, 0);
  wash.position.set(0, CEIL_Y - 30, 0);
  lights.add(wash);

  // ───── 책상: 연두 상판(둥근 모서리)과 크림 띠, 연필 홈·스티커, 초록 다리와 크림 공 발 ─────
  const desk = new Group();
  const R = 7;
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
  const top = k.mesh(topGeo, k.std(0x86cc94, 0.45));
  top.rotation.x = -Math.PI / 2;
  top.position.y = TABLE_Y - (TABLE_TOP_T - bevel);
  desk.add(top);
  // 앞치마(크림)와 책 넣는 칸
  const apronMat = k.std(CREAM, 0.55);
  const trimMat = k.std(GOLD, 0.3, 0.7);
  for (const sz of [1, -1]) {
    const apron = k.mesh(new BoxGeometry(TABLE_HALF_X * 2 - 14, 6, 2), apronMat);
    apron.position.set(0, TABLE_Y - TABLE_TOP_T - 3, sz * (TABLE_HALF_Z - 5));
    desk.add(apron);
    const trim = k.mesh(new BoxGeometry(TABLE_HALF_X * 2 - 14, 0.8, 0.4), trimMat, false, false);
    trim.position.set(0, TABLE_Y - TABLE_TOP_T - 3, sz * (TABLE_HALF_Z - 3.9));
    desk.add(trim);
  }
  for (const sx of [1, -1]) {
    const apron = k.mesh(new BoxGeometry(2, 6, TABLE_HALF_Z * 2 - 10), apronMat);
    apron.position.set(sx * (TABLE_HALF_X - 7), TABLE_Y - TABLE_TOP_T - 3, 0);
    desk.add(apron);
  }
  const shelf = k.mesh(
    new BoxGeometry(TABLE_HALF_X * 2 - 18, 1.6, TABLE_HALF_Z * 2 - 14),
    apronMat,
  );
  shelf.position.set(0, TABLE_Y - TABLE_TOP_T - 14, 0);
  desk.add(shelf);
  const legMat = k.std(0x4f9e64, 0.4, 0.2);
  const footMat = k.std(CREAM, 0.5);
  const legH = TABLE_Y - TABLE_TOP_T - FLOOR_Y;
  for (const [a, b] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    const lx = a * (TABLE_HALF_X - 7);
    const lz = b * (TABLE_HALF_Z - 5);
    const leg = k.mesh(new CylinderGeometry(2.4, 2, legH, 16), legMat);
    leg.position.set(lx, FLOOR_Y + legH / 2, lz);
    desk.add(leg);
    const foot = k.mesh(new SphereGeometry(3.6, 16, 12), footMat);
    foot.position.set(lx, FLOOR_Y + 3.2, lz);
    desk.add(foot);
    const collar = k.mesh(new CylinderGeometry(3.2, 3.2, 2, 16), trimMat);
    collar.position.set(lx, TABLE_Y - TABLE_TOP_T - 14, lz);
    desk.add(collar);
  }
  // 연필 홈(오른쪽 판 옆, Z 방향)과 연필 두 자루
  const db = new Batch();
  const deskAt: Spot = { x: 0, y: 0, z: 0, yaw: 0 };
  const gx = 36;
  db.add('box', deskAt, gx, TABLE_Y + 0.04, 0, 3.2, 0.08, 34, 0x6aa874);
  db.add('box', deskAt, gx, TABLE_Y + 0.06, 0, 2.2, 0.08, 33, 0x3f7a4a);
  db.add('cyl', deskAt, gx - 0.4, TABLE_Y + 0.7, -2, 0.6, 15, 0.6, 0xffc94a, [Math.PI / 2, 0, 0]);
  db.add('cone', deskAt, gx - 0.4, TABLE_Y + 0.7, 6.5, 0.6, 2, 0.6, 0xf3d8a8, [Math.PI / 2, 0, 0]);
  db.add('box', deskAt, gx - 0.4, TABLE_Y + 0.7, -10.2, 1.1, 1.1, 1.6, 0xff8fb0);
  db.add('cyl', deskAt, gx + 0.6, TABLE_Y + 0.7, 3, 0.6, 12, 0.6, 0x3a86e8, [Math.PI / 2, 0, 0]);
  db.add('cone', deskAt, gx + 0.6, TABLE_Y + 0.7, 10, 0.6, 2, 0.6, 0xf3d8a8, [Math.PI / 2, 0, 0]);
  // 왼쪽: 작은 별 지우개와 분필
  db.add('box', deskAt, -36, TABLE_Y + 1, -12, 4, 2, 2.6, 0xff8fb0, [0, 0.4, 0]);
  db.flush(k, desk);
  for (const [kind, sx, sz, rot] of [
    [0, -36, 6, 0.3],
    [1, -30, -4, -0.2],
    [2, 38, 18, 0.5],
  ] as const) {
    const tex = createStickerTexture(kind);
    k.texs.push(tex);
    const mat = new MeshStandardMaterial({
      map: tex,
      transparent: true,
      roughness: 0.4,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    k.mats.push(mat);
    const st = k.mesh(new CircleGeometry(2.6, 24), mat, false, true);
    st.rotation.set(-Math.PI / 2, 0, rot);
    st.position.set(sx, TABLE_Y + 0.05, sz);
    desk.add(st);
  }

  return {
    room,
    desk,
    lamp,
    lights,
    background: 0xbfe4f6,
    board: {
      base: '#e2a862',
      grain: '150,85,30',
      line: 'rgba(80,46,12,0.72)',
      side: 0xc7843e,
      seam: 0x2f7a48,
      leg: 0x2f7a48,
      rim: 0x4fae62,
      star: 'rgba(40,110,60,0.85)',
    },
  };
};
