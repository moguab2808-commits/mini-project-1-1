// 바 테마(기본, DEC-050): 나무 바닥·벽, 병 선반, 천장 램프와 따뜻한 스포트라이트, 짙은 나무 책상.
import {
  BackSide,
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Group,
  HemisphereLight,
  AmbientLight,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  RepeatWrapping,
  SphereGeometry,
  SpotLight,
  type Texture,
} from 'three';
import {
  FLOOR_Y,
  TABLE_HALF_X,
  TABLE_HALF_Z,
  TABLE_TOP_T,
  TABLE_Y,
  canvasTexture,
  lcg,
  type ThemeBuilder,
} from '../stage-kit.ts';

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

export const buildBarTheme: ThemeBuilder = (k) => {
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

  // 조명
  const lights = new Group();
  lights.add(new AmbientLight(0xfff0dc, 0.35));
  lights.add(new HemisphereLight(0xffe8c8, 0x4a3324, 1.0));
  const spot = new SpotLight(0xffd59a, 1500, 0, 0.95, 0.6, 1.2);
  spot.position.set(0, 78, 0);
  spot.target.position.set(0, 0, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0006;
  spot.shadow.camera.near = 20;
  spot.shadow.camera.far = 160;
  lights.add(spot, spot.target);
  const fill = new DirectionalLight(0xc8d2ff, 0.9);
  fill.position.set(-60, 50, 30);
  lights.add(fill);

  // 책상(흔들림 대상): 상판·다리·가로대
  const desk = new Group();
  const woodTop = k.std(0x5a3520, 0.55);
  const top = k.mesh(new BoxGeometry(TABLE_HALF_X * 2, TABLE_TOP_T, TABLE_HALF_Z * 2), woodTop);
  top.position.y = TABLE_Y - TABLE_TOP_T / 2;
  desk.add(top);
  const edgeMat = k.std(0x3f2414, 0.5);
  for (const sz of [1, -1]) {
    const lip = k.mesh(new BoxGeometry(TABLE_HALF_X * 2 + 0.6, 1.2, 1.2), edgeMat);
    lip.position.set(0, TABLE_Y - 0.6, sz * (TABLE_HALF_Z + 0.3));
    desk.add(lip);
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
    desk.add(leg);
  }
  for (const b of [1, -1]) {
    const apron = k.mesh(new BoxGeometry(TABLE_HALF_X * 2 - 10, 6, 2), legMat);
    apron.position.set(0, TABLE_Y - TABLE_TOP_T - 3, b * (TABLE_HALF_Z - 5));
    desk.add(apron);
  }

  return { room, desk, lamp, lights, background: 0x3a2a1f };
};
