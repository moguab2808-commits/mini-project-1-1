// 방·테이블·판·알 에셋. 모두 코드 도형과 canvas 절차 텍스처이며 외부 파일은 쓰지 않는다.
// 단위 cm. 판 윗면이 월드 Y=0, 책상 윗면은 판 아래 TABLE_Y다.
import { BOARDS, type BoardId } from '@alkkagi/shared';
import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  RepeatWrapping,
  SRGBColorSpace,
  SphereGeometry,
  BackSide,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';

export const BOARD_THICKNESS = 3;
export const TABLE_Y = -4;
export const FLOOR_Y = -80;
export const TABLE_HALF = 56;

function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, s: number) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  if (g) draw(g, size);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** 간단한 결정적 난수: 텍스처 무늬를 실행마다 같게 한다 */
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * 판 윗면 텍스처. 캔버스 위쪽이 서버 +y, 오른쪽이 +x다.
 * 아래쪽(y<0, 선공 진영)은 따뜻한 색, 위쪽은 차가운 색으로 옅게 칠하고 위쪽 가장자리에 표식을 둬
 * 판이 돌아갔는지 한눈에 보이게 한다.
 */
export function createBoardTexture(board: BoardId): Texture {
  const def = BOARDS[board];
  const extent = def.shape === 'square' ? def.size : def.diameter;
  return canvasTexture(1024, (g, s) => {
    const px = s / extent;
    const rnd = lcg(7);
    g.fillStyle = '#dcae6b';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 160; i++) {
      g.strokeStyle = `rgba(120,70,20,${0.04 + rnd() * 0.06})`;
      g.lineWidth = 1 + rnd() * 2;
      const y = rnd() * s;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(
        s * 0.3,
        y + (rnd() - 0.5) * 18,
        s * 0.6,
        y + (rnd() - 0.5) * 18,
        s,
        y + (rnd() - 0.5) * 10,
      );
      g.stroke();
    }
    g.fillStyle = 'rgba(255,140,60,0.10)';
    g.fillRect(0, s / 2, s, s / 2);
    g.fillStyle = 'rgba(80,140,255,0.10)';
    g.fillRect(0, 0, s, s / 2);
    g.strokeStyle = 'rgba(60,32,10,0.65)';
    g.lineWidth = 2;
    if (def.shape === 'square') {
      const n = 10;
      for (let i = 0; i <= n; i++) {
        const p = (i / n) * s;
        g.beginPath();
        g.moveTo(p, 0);
        g.lineTo(p, s);
        g.moveTo(0, p);
        g.lineTo(s, p);
        g.stroke();
      }
      g.lineWidth = 8;
      g.strokeRect(4, 4, s - 8, s - 8);
    } else {
      for (let r = 4.6; r < extent / 2; r += 4.6) {
        g.beginPath();
        g.arc(s / 2, s / 2, r * px, 0, Math.PI * 2);
        g.stroke();
      }
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        g.beginPath();
        g.moveTo(s / 2, s / 2);
        g.lineTo(s / 2 + Math.cos(a) * s * 0.5, s / 2 + Math.sin(a) * s * 0.5);
        g.stroke();
      }
      g.lineWidth = 8;
      g.beginPath();
      g.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2);
      g.stroke();
    }
    g.fillStyle = 'rgba(60,32,10,0.8)';
    g.beginPath();
    g.arc(s / 2, s / 2, 7, 0, Math.PI * 2);
    g.fill();
    // 위쪽(서버 +y) 표식
    g.fillStyle = '#c0392b';
    g.beginPath();
    g.moveTo(s / 2, s * 0.045);
    g.lineTo(s / 2 - 22, s * 0.095);
    g.lineTo(s / 2 + 22, s * 0.095);
    g.closePath();
    g.fill();
  });
}

function createPlankTexture(): Texture {
  const tex = canvasTexture(512, (g, s) => {
    const rnd = lcg(11);
    for (let i = 0; i < 8; i++) {
      const l = 45 + rnd() * 10;
      g.fillStyle = `hsl(25,${35 + rnd() * 10}%,${l * 0.55}%)`;
      g.fillRect(0, (i * s) / 8, s, s / 8);
      g.fillStyle = 'rgba(0,0,0,0.35)';
      g.fillRect(0, (i * s) / 8, s, 2);
    }
  });
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

export interface Disposables {
  geos: BufferGeometry[];
  mats: Material[];
  texs: Texture[];
}

function kit(): Disposables & {
  mesh: (geo: BufferGeometry, mat: Material, cast?: boolean, recv?: boolean) => Mesh;
  std: (color: number, rough?: number, metal?: number) => MeshStandardMaterial;
  dispose: () => void;
} {
  const d: Disposables = { geos: [], mats: [], texs: [] };
  return {
    ...d,
    mesh(geo, mat, cast = true, recv = true) {
      d.geos.push(geo);
      const m = new Mesh(geo, mat);
      m.castShadow = cast;
      m.receiveShadow = recv;
      return m;
    },
    std(color, rough = 0.7, metal = 0) {
      const m = new MeshStandardMaterial({ color, roughness: rough, metalness: metal });
      d.mats.push(m);
      return m;
    },
    dispose() {
      for (const g of d.geos) g.dispose();
      for (const m of d.mats) m.dispose();
      for (const t of d.texs) t.dispose();
    },
  };
}

export interface Stage {
  /** 방·책상·의자 같은 고정 요소 */
  room: Group;
  /** 책상 흔들림을 줄 책상 윗면 전체(책상·판) */
  table: Group;
  /** 판 돌리기 연출로 Y축 회전하는 판 */
  boardPivot: Group;
  dispose: () => void;
}

export function buildStage(board: BoardId): Stage {
  const k = kit();
  const def = BOARDS[board];

  // 방
  const room = new Group();
  const plank = createPlankTexture();
  k.texs.push(plank);
  const floorMat = new MeshStandardMaterial({ map: plank, roughness: 0.85 });
  k.mats.push(floorMat);
  const floor = k.mesh(new PlaneGeometry(400, 400), floorMat, false, true);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  room.add(floor);
  const wallMat = new MeshStandardMaterial({ color: 0x2c1d15, roughness: 0.95, side: BackSide });
  k.mats.push(wallMat);
  const walls = k.mesh(new BoxGeometry(400, 300, 400), wallMat, false, true);
  walls.position.y = FLOOR_Y + 150;
  room.add(walls);

  // 천장 램프
  const lampMat = new MeshStandardMaterial({
    color: 0x2f4536,
    roughness: 0.4,
    metalness: 0.4,
    side: DoubleSide,
  });
  k.mats.push(lampMat);
  const shade = k.mesh(new ConeGeometry(24, 16, 32, 1, true), lampMat, false, false);
  shade.position.y = 86;
  room.add(shade);
  const cord = k.mesh(new CylinderGeometry(0.5, 0.5, 120, 6), k.std(0x111111), false, false);
  cord.position.y = 154;
  room.add(cord);
  const bulbMat = new MeshBasicMaterial({ color: 0xfff1c9 });
  k.mats.push(bulbMat);
  const bulb = k.mesh(new SphereGeometry(4.5, 12, 10), bulbMat, false, false);
  bulb.position.y = 80;
  room.add(bulb);
  const glow = new PointLight(0xffb36b, 0.0, 0);
  glow.position.set(0, 70, 0);
  room.add(glow);

  // 벽 선반과 병: 양쪽 시점 어디서나 보이도록 좌우 벽에 둔다
  const shelfMat = k.std(0x5a3520, 0.6);
  const glass = [0x3f7f5a, 0x8a3a3a, 0x3a5f8a];
  for (const sx of [-1, 1]) {
    const shelf = k.mesh(new BoxGeometry(14, 3, 160), shelfMat);
    shelf.position.set(sx * 192, 6, 0);
    room.add(shelf);
    for (let i = 0; i < 9; i++) {
      const h = 14 + (i % 3) * 4;
      const col = glass[i % 3] ?? 0x3f7f5a;
      const b = k.mesh(new CylinderGeometry(3, 3.4, h, 10), k.std(col, 0.25, 0.1));
      b.position.set(sx * 190, 7.5 + h / 2, -70 + i * 17.5);
      room.add(b);
      const nk = k.mesh(new CylinderGeometry(1, 2.2, 6, 8), k.std(col, 0.25, 0.1));
      nk.position.set(sx * 190, 7.5 + h + 3, -70 + i * 17.5);
      room.add(nk);
    }
  }

  // 책상(흔들림 대상)
  const table = new Group();
  const woodTop = k.std(0x5a3520, 0.55);
  const top = k.mesh(new BoxGeometry(TABLE_HALF * 2, 4, TABLE_HALF * 2), woodTop);
  top.position.y = TABLE_Y - 2;
  table.add(top);
  const legMat = k.std(0x3d2415, 0.6);
  for (const [a, b] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    const h = TABLE_Y - 4 - FLOOR_Y;
    const leg = k.mesh(new CylinderGeometry(3, 3.6, h, 12), legMat);
    leg.position.set(a * (TABLE_HALF - 6), FLOOR_Y + h / 2, b * (TABLE_HALF - 6));
    table.add(leg);
  }
  // 회전판 받침: 판이 도는 동안에도 책상 위에 고정되어 있다
  const lazy = k.mesh(new CylinderGeometry(35, 36, 1, 48), k.std(0x2c2c30, 0.6, 0.1));
  lazy.position.y = TABLE_Y + 0.5;
  table.add(lazy);

  // 판
  const boardPivot = new Group();
  const sideWood = k.std(0xb07a3f, 0.6);
  const bodyGeo =
    def.shape === 'square'
      ? new BoxGeometry(def.size, BOARD_THICKNESS, def.size)
      : new CylinderGeometry(def.diameter / 2, def.diameter / 2, BOARD_THICKNESS, 64);
  const body = k.mesh(bodyGeo, sideWood);
  body.position.y = -BOARD_THICKNESS / 2 - 0.02;
  boardPivot.add(body);
  const topTex = createBoardTexture(board);
  k.texs.push(topTex);
  const topMat = new MeshStandardMaterial({ map: topTex, roughness: 0.55 });
  k.mats.push(topMat);
  const topGeo =
    def.shape === 'square'
      ? new PlaneGeometry(def.size, def.size)
      : new CircleGeometry(def.diameter / 2, 64);
  const topMesh = k.mesh(topGeo, topMat, false, true);
  topMesh.rotation.x = -Math.PI / 2;
  topMesh.position.y = 0;
  boardPivot.add(topMesh);
  table.add(boardPivot);

  return { room, table, boardPivot, dispose: k.dispose };
}

/** 알 무늬: 내 알은 어두운 바탕에 금색 별, 상대 알은 아이보리 바탕에 붉은 가위표 */
function createStoneDecal(mine: boolean): Texture {
  return canvasTexture(128, (g, s) => {
    const c = s / 2;
    g.clearRect(0, 0, s, s);
    if (mine) {
      g.strokeStyle = '#f2c14e';
      g.fillStyle = '#f2c14e';
      g.lineWidth = 7;
      g.beginPath();
      g.arc(c, c, c - 8, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? c * 0.62 : c * 0.26;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        g.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r);
      }
      g.closePath();
      g.fill();
    } else {
      g.strokeStyle = '#b3282d';
      g.lineWidth = 11;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(c, c, c - 8, 0, Math.PI * 2);
      g.stroke();
      g.beginPath();
      g.moveTo(c * 0.5, c * 0.5);
      g.lineTo(c * 1.5, c * 1.5);
      g.moveTo(c * 1.5, c * 0.5);
      g.lineTo(c * 0.5, c * 1.5);
      g.stroke();
    }
  });
}

export interface StoneKit {
  bodyGeo: BufferGeometry;
  decalGeo: BufferGeometry;
  bodyMine: Material;
  bodyOpp: Material;
  decalMine: Material;
  decalOpp: Material;
  dispose: () => void;
}

export function createStoneKit(radius: number): StoneKit {
  const bodyGeo = new SphereGeometry(radius, 24, 12);
  const decalGeo = new CircleGeometry(radius * 0.55, 20);
  decalGeo.rotateX(-Math.PI / 2);
  const bodyMine = new MeshStandardMaterial({ color: 0x24282f, roughness: 0.3, metalness: 0.1 });
  const bodyOpp = new MeshStandardMaterial({ color: 0xf1ebdd, roughness: 0.4 });
  const tMine = createStoneDecal(true);
  const tOpp = createStoneDecal(false);
  const decalMine = new MeshBasicMaterial({ map: tMine, transparent: true, depthWrite: false });
  const decalOpp = new MeshBasicMaterial({ map: tOpp, transparent: true, depthWrite: false });
  return {
    bodyGeo,
    decalGeo,
    bodyMine,
    bodyOpp,
    decalMine,
    decalOpp,
    dispose: () => {
      bodyGeo.dispose();
      decalGeo.dispose();
      for (const m of [bodyMine, bodyOpp, decalMine, decalOpp]) m.dispose();
      tMine.dispose();
      tOpp.dispose();
    },
  };
}
