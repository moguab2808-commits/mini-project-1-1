// 방·테이블·판·알 에셋. 모두 코드 도형과 canvas 절차 텍스처이며 외부 파일은 쓰지 않는다.
// 단위 cm. 판 윗면이 월드 Y=0이다. 판은 두께 BOARD_THICKNESS의 몸체와 다리(BOARD_LEG)를 가진 실제 바둑판 형태이고,
// 그 아래 책상 윗면이 TABLE_Y다. 좌석(SEAT_GEOMETRY.anchorDistance) 바깥에 의자를 둔다.
import { BOARDS, SEAT_GEOMETRY, type BoardId } from '@alkkagi/shared';
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

export const BOARD_THICKNESS = 6;
export const BOARD_LEG = 3.5;
/** 책상 윗면 높이(판 윗면 기준) */
export const TABLE_Y = -(BOARD_THICKNESS + BOARD_LEG);
export const FLOOR_Y = -84;
/** 책상 반폭(좌우 X)·반깊이(좌석 쪽 Z). 캐릭터 배가 닿지 않게 깊이는 좌석 기준점보다 안쪽이다 */
export const TABLE_HALF_X = 44;
export const TABLE_HALF_Z = 25;
const TABLE_TOP_T = 3;
/** 의자 방석 윗면 높이 */
export const CHAIR_SEAT_Y = -36.5;

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
  /** 천장 램프. 카메라가 높이 올라가면 시야를 가리지 않게 숨긴다 */
  lamp: Group;
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
  const wallMat = new MeshStandardMaterial({ color: 0x6a4a35, roughness: 0.95, side: BackSide });
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
  const lamp = new Group();
  room.add(lamp);
  lamp.add(shade);
  const cord = k.mesh(new CylinderGeometry(0.5, 0.5, 120, 6), k.std(0x111111), false, false);
  cord.position.y = 154;
  lamp.add(cord);
  const bulbMat = new MeshBasicMaterial({ color: 0xfff1c9 });
  k.mats.push(bulbMat);
  const bulb = k.mesh(new SphereGeometry(4.5, 12, 10), bulbMat, false, false);
  bulb.position.y = 80;
  lamp.add(bulb);
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

  // 의자: 좌석마다 기준점 바깥(엉덩이 아래)에 둔다. 흔들림·회전과 무관하다
  const chairMat = k.std(0x6b3f22, 0.55);
  const chairLeg = k.std(0x3b2416, 0.6);
  for (const side of [1, -1]) {
    const cz = side * (SEAT_GEOMETRY.anchorDistance + 6);
    const seat = k.mesh(new CylinderGeometry(11, 11, 2.6, 24), chairMat);
    seat.position.set(0, CHAIR_SEAT_Y - 1.3, cz);
    room.add(seat);
    const post = k.mesh(new CylinderGeometry(1.6, 2, CHAIR_SEAT_Y - 2.6 - FLOOR_Y, 10), chairLeg);
    post.position.set(0, (CHAIR_SEAT_Y - 2.6 + FLOOR_Y) / 2, cz);
    room.add(post);
    const base = k.mesh(new CylinderGeometry(9, 10, 1.4, 20), chairLeg);
    base.position.set(0, FLOOR_Y + 0.7, cz);
    room.add(base);
    const back = k.mesh(new BoxGeometry(20, 16, 2), chairMat);
    back.position.set(0, CHAIR_SEAT_Y + 12, cz + side * 11);
    room.add(back);
    for (const bx of [-8, 8]) {
      const rod = k.mesh(new CylinderGeometry(0.8, 0.8, 12, 6), chairLeg);
      rod.position.set(bx, CHAIR_SEAT_Y + 4, cz + side * 11);
      room.add(rod);
    }
  }

  // 책상(흔들림 대상): 상판·다리·가로대
  const table = new Group();
  const woodTop = k.std(0x5a3520, 0.55);
  const top = k.mesh(new BoxGeometry(TABLE_HALF_X * 2, TABLE_TOP_T, TABLE_HALF_Z * 2), woodTop);
  top.position.y = TABLE_Y - TABLE_TOP_T / 2;
  table.add(top);
  const edgeMat = k.std(0x3f2414, 0.5);
  for (const sz of [1, -1]) {
    const lip = k.mesh(new BoxGeometry(TABLE_HALF_X * 2 + 0.6, 1.2, 1.2), edgeMat);
    lip.position.set(0, TABLE_Y - 0.6, sz * (TABLE_HALF_Z + 0.3));
    table.add(lip);
  }
  const legMat = k.std(0x3d2415, 0.6);
  const legH = TABLE_Y - TABLE_TOP_T - FLOOR_Y;
  for (const [a, b] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    const leg = k.mesh(new BoxGeometry(4.5, legH, 4.5), legMat);
    leg.position.set(a * (TABLE_HALF_X - 5), FLOOR_Y + legH / 2, b * (TABLE_HALF_Z - 5));
    table.add(leg);
  }
  for (const b of [1, -1]) {
    const apron = k.mesh(new BoxGeometry(TABLE_HALF_X * 2 - 10, 6, 2), legMat);
    apron.position.set(0, TABLE_Y - TABLE_TOP_T - 3, b * (TABLE_HALF_Z - 5));
    table.add(apron);
  }

  // 판: 몸체(두께) + 다리. 판 돌리기 연출 때 몸체째 회전한다
  const boardPivot = new Group();
  const sideWood = k.std(0xc08a4c, 0.5);
  const body =
    def.shape === 'square'
      ? k.mesh(new BoxGeometry(def.size, BOARD_THICKNESS, def.size), sideWood)
      : k.mesh(
          new CylinderGeometry(def.diameter / 2, def.diameter / 2 - 0.6, BOARD_THICKNESS, 72),
          sideWood,
        );
  body.position.y = -BOARD_THICKNESS / 2 - 0.02;
  boardPivot.add(body);
  // 몸체 아래 가장자리를 어둡게 둘러 두께가 보이게 한다
  const seamMat = k.std(0x6e4522, 0.7);
  const seam =
    def.shape === 'square'
      ? k.mesh(new BoxGeometry(def.size - 1, 0.8, def.size - 1), seamMat)
      : k.mesh(
          new CylinderGeometry(def.diameter / 2 - 0.8, def.diameter / 2 - 0.8, 0.8, 64),
          seamMat,
        );
  seam.position.y = -BOARD_THICKNESS - 0.4;
  boardPivot.add(seam);
  const legWood = k.std(0x8a5a2c, 0.55);
  const legGeo = new CylinderGeometry(3, 2, BOARD_LEG, 12);
  k.geos.push(legGeo);
  const legSpots: [number, number][] =
    def.shape === 'square'
      ? [
          [1, 1],
          [1, -1],
          [-1, 1],
          [-1, -1],
        ].map(([a, b]) => [(a ?? 1) * (def.size / 2 - 7), (b ?? 1) * (def.size / 2 - 7)])
      : [0, 1, 2, 3].map((i) => {
          const a = Math.PI / 4 + (i * Math.PI) / 2;
          return [Math.cos(a) * def.diameter * 0.3, Math.sin(a) * def.diameter * 0.3];
        });
  for (const [lx, lz] of legSpots) {
    const leg = new Mesh(legGeo, legWood);
    leg.castShadow = true;
    leg.receiveShadow = true;
    leg.position.set(lx, -BOARD_THICKNESS - BOARD_LEG / 2 - 0.02, lz);
    boardPivot.add(leg);
  }
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

  return { room, table, boardPivot, lamp, dispose: k.dispose };
}

export interface StoneKit {
  bodyGeo: BufferGeometry;
  bodyMine: Material;
  bodyOpp: Material;
  dispose: () => void;
}

export function createStoneKit(radius: number): StoneKit {
  const bodyGeo = new SphereGeometry(radius, 24, 12);
  const bodyMine = new MeshStandardMaterial({ color: 0x24282f, roughness: 0.3, metalness: 0.1 });
  const bodyOpp = new MeshStandardMaterial({ color: 0xf1ebdd, roughness: 0.4 });
  return {
    bodyGeo,
    bodyMine,
    bodyOpp,
    dispose: () => {
      bodyGeo.dispose();
      for (const m of [bodyMine, bodyOpp]) m.dispose();
    },
  };
}
