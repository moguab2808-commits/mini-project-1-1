// 판·알·의자 에셋과 장면 조립. 배경·조명·책상은 방 테마(themes/)가 만든다(DEC-050).
// 단위 cm. 판 윗면이 월드 Y=0이다. 판은 두께 BOARD_THICKNESS의 몸체와 다리(BOARD_LEG)를 가진 실제 바둑판 형태이고,
// 그 아래 책상 윗면이 TABLE_Y다. 좌석(SEAT_GEOMETRY.anchorDistance) 바깥에 의자를 둔다.
import { BOARDS, SEAT_GEOMETRY, type BoardId, type ThemeId } from '@alkkagi/shared';
import {
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
  type Texture,
} from 'three';
import {
  BOARD_LEG,
  BOARD_THICKNESS,
  CHAIR_SEAT_Y,
  DEFAULT_BOARD_STYLE,
  FLOOR_Y,
  canvasTexture,
  createKit,
  lcg,
  type BoardStyle,
} from './stage-kit.ts';
import { THEMES } from './themes/index.ts';

export {
  BOARD_LEG,
  BOARD_THICKNESS,
  CHAIR_SEAT_Y,
  FLOOR_Y,
  TABLE_HALF_X,
  TABLE_HALF_Z,
  TABLE_Y,
} from './stage-kit.ts';

/**
 * 판 윗면 텍스처. 캔버스 위쪽이 서버 +y, 오른쪽이 +x다.
 * 아래쪽(y<0, 선공 진영)은 따뜻한 색, 위쪽은 차가운 색으로 옅게 칠하고 위쪽 가장자리에 표식을 둬
 * 판이 돌아갔는지 한눈에 보이게 한다.
 */
export function createBoardTexture(
  board: BoardId,
  style: BoardStyle = DEFAULT_BOARD_STYLE,
): Texture {
  const def = BOARDS[board];
  const extent = def.shape === 'square' ? def.size : def.diameter;
  return canvasTexture(1024, (g, s) => {
    const px = s / extent;
    const rnd = lcg(7);
    g.fillStyle = style.base;
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 160; i++) {
      g.strokeStyle = `rgba(${style.grain},${0.04 + rnd() * 0.06})`;
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
    g.strokeStyle = style.line;
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
    if (style.star) {
      g.fillStyle = style.star;
      star(g, s / 2, s / 2, 16, 7);
      if (def.shape === 'square') {
        // 모서리에서 두 번째 교차점마다 작은 별(바둑판 화점 자리)
        for (const fx of [0.2, 0.8]) for (const fy of [0.2, 0.8]) star(g, s * fx, s * fy, 9, 4);
      }
    } else {
      g.fillStyle = 'rgba(60,32,10,0.8)';
      g.beginPath();
      g.arc(s / 2, s / 2, 7, 0, Math.PI * 2);
      g.fill();
    }
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

/** 다섯 꼭지 별 */
function star(g: CanvasRenderingContext2D, cx: number, cy: number, ro: number, ri: number) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
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
  /** 테마 조명 */
  lights: Group;
  /** 장면 배경색 */
  background: number;
  dispose: () => void;
}

export function buildStage(board: BoardId, theme: ThemeId = 'bar'): Stage {
  const k = createKit();
  const def = BOARDS[board];

  const env = THEMES[theme](k);
  const bs = env.board ?? DEFAULT_BOARD_STYLE;
  const room = env.room;
  const lamp = env.lamp;

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

  // 책상(흔들림 대상): 테마의 책상 + 판
  const table = new Group();
  table.add(env.desk);

  // 판: 몸체(두께) + 다리. 판 돌리기 연출 때 몸체째 회전한다
  const boardPivot = new Group();
  const sideWood = k.std(bs.side, 0.5);
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
  const seamMat = k.std(bs.seam, 0.7);
  const seam =
    def.shape === 'square'
      ? k.mesh(new BoxGeometry(def.size - 1, 0.8, def.size - 1), seamMat)
      : k.mesh(
          new CylinderGeometry(def.diameter / 2 - 0.8, def.diameter / 2 - 0.8, 0.8, 64),
          seamMat,
        );
  seam.position.y = -BOARD_THICKNESS - 0.4;
  boardPivot.add(seam);
  const legWood = k.std(bs.leg, 0.55);
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
  if (bs.rim !== undefined) {
    // 윗면 가장자리 테: 판 안쪽(놀이 면)을 덮지 않도록 바깥으로 0.9cm 두르고 윗면보다 0.25cm만 높다
    const rimMat = k.std(bs.rim, 0.3, 0.75);
    const rim =
      def.shape === 'square'
        ? squareRim(k, def.size, rimMat)
        : k.mesh(new TorusGeometry(def.diameter / 2 + 0.45, 0.55, 8, 96), rimMat, false, true);
    if (def.shape !== 'square') rim.rotation.x = -Math.PI / 2;
    if (def.shape !== 'square') rim.position.y = -0.3;
    boardPivot.add(rim);
  }
  const topTex = createBoardTexture(board, bs);
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

  return {
    room,
    table,
    boardPivot,
    lamp,
    lights: env.lights,
    background: env.background,
    dispose: k.dispose,
  };
}

/** 정사각 판 바깥 둘레의 네 막대 테 */
function squareRim(k: ReturnType<typeof createKit>, size: number, mat: Material): Group {
  const g = new Group();
  const w = 0.9;
  for (const sgn of [1, -1]) {
    const a = k.mesh(new BoxGeometry(size + w * 2, 0.8, w), mat, false, true);
    a.position.set(0, -0.15, sgn * (size / 2 + w / 2));
    g.add(a);
    const b = k.mesh(new BoxGeometry(w, 0.8, size), mat, false, true);
    b.position.set(sgn * (size / 2 + w / 2), -0.15, 0);
    g.add(b);
  }
  return g;
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
