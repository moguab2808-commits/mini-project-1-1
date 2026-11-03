// 밤 옥상 테마(DEC-053): 초록 방수 바닥·난간벽, 밤하늘·달·도시 불빛 배경, 전구 줄과 달빛 조명, 야외용 나무 평상 책상.
import {
  AdditiveBlending,
  AmbientLight,
  BackSide,
  BoxGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  RepeatWrapping,
  SphereGeometry,
  SpotLight,
  TubeGeometry,
  Vector3,
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

/** 옥상 바닥 안쪽 반폭. 난간벽이 이 선에 선다 */
const ROOF_HALF = 200;
const PARAPET_H = 40;
/** 난간 윗대 높이 */
const RAIL_Y = FLOOR_Y + 100;
/** 도시 띠 아랫단 */
const CITY_BOTTOM = -520;
const SKY_R = 820;

/** 초록 우레탄 방수 바닥: 얼룩과 이음선 */
function createFloorTexture(): Texture {
  const tex = canvasTexture(512, (g, s) => {
    const rnd = lcg(23);
    g.fillStyle = '#3f6a52';
    g.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = `rgba(${rnd() < 0.5 ? '20,40,30' : '120,150,130'},${0.04 + rnd() * 0.06})`;
      const r = 4 + rnd() * 26;
      g.beginPath();
      g.arc(rnd() * s, rnd() * s, r, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, 0, s, 3);
    g.fillRect(0, 0, 3, s);
  });
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

/** 하늘 구(등장방형): 위는 짙은 남색, 지평선은 도시 불빛에 물든 보랏빛, 별 */
function createSkyTexture(): Texture {
  return canvasTextureWH(2048, 1024, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#04060f');
    grad.addColorStop(0.3, '#0a1230');
    grad.addColorStop(0.45, '#1f2350');
    grad.addColorStop(0.5, '#47355e');
    grad.addColorStop(0.53, '#2a2340');
    grad.addColorStop(1, '#0c0b14');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    const rnd = lcg(5);
    for (let i = 0; i < 700; i++) {
      const y = Math.pow(rnd(), 1.3) * h * 0.46;
      const a = 0.35 + rnd() * 0.65;
      g.fillStyle = `rgba(255,${235 + rnd() * 20},${210 + rnd() * 45},${a})`;
      const r = rnd() < 0.06 ? 2.2 : 0.8 + rnd() * 0.9;
      g.beginPath();
      g.arc(rnd() * w, y, r, 0, Math.PI * 2);
      g.fill();
    }
  });
}

/** 도시 실루엣 띠: 위쪽은 투명, 건물마다 불 켜진 창 */
function createCityTexture(seed: number, base: string, windows: number): Texture {
  const tex = canvasTextureWH(4096, 512, (g, w, h) => {
    const rnd = lcg(seed);
    let x = 0;
    while (x < w) {
      const bw = 40 + rnd() * 120;
      const top = h * (0.08 + rnd() * 0.42);
      g.fillStyle = base;
      g.fillRect(x, top, bw + 1, h - top);
      // 옥상 위 작은 탑·안테나
      if (rnd() < 0.25) {
        g.fillRect(x + bw * 0.4, top - 18, bw * 0.2, 18);
        g.fillStyle = 'rgba(255,60,50,0.95)';
        g.fillRect(x + bw * 0.5 - 2, top - 24, 4, 4);
      }
      const cw = 6;
      const ch = 8;
      for (let wy = top + 8; wy < h - 6; wy += ch + 6) {
        for (let wx = x + 6; wx < x + bw - cw - 4; wx += cw + 6) {
          if (rnd() > windows) continue;
          const warm = rnd() < 0.75;
          g.fillStyle = warm
            ? `rgba(255,${200 + rnd() * 40},${120 + rnd() * 50},${0.6 + rnd() * 0.4})`
            : `rgba(170,215,255,${0.5 + rnd() * 0.4})`;
          g.fillRect(wx, wy, cw, ch);
        }
      }
      x += bw + rnd() * 6;
    }
  });
  tex.wrapS = RepeatWrapping;
  return tex;
}

/**
 * a→b 사이를 `spans`칸으로 나눠 칸마다 처지는 전구 줄 전선을 만들고, 전구 위치를 `bulbs`에 더한다.
 * 줄 하나가 튜브 하나라 칸이 많아도 메시는 하나다.
 */
function festoon(
  a: Vector3,
  b: Vector3,
  spans: number,
  sag: number,
  perSpan: number,
  bulbs: Vector3[],
): TubeGeometry {
  const at = (t: number) => {
    const p = a.clone().lerp(b, t);
    const u = (t * spans) % 1;
    p.y -= sag * 4 * u * (1 - u);
    return p;
  };
  const steps = spans * 8;
  const pts = Array.from({ length: steps + 1 }, (_, i) => at(i / steps));
  for (let s = 0; s < spans; s++) {
    for (let i = 1; i <= perSpan; i++) {
      const p = at((s + i / (perSpan + 1)) / spans);
      p.y -= 2.4;
      bulbs.push(p);
    }
  }
  return new TubeGeometry(new CatmullRomCurve3(pts), steps * 2, 0.25, 4);
}

/** 전구 위치마다 빛나는 알과 은은한 번짐을 인스턴스 두 개로 그린다(그리기 호출 2회) */
function addBulbs(k: Kit, parent: Group, at: Vector3[], r: number) {
  const palette = [0xffd37a, 0xffc35c, 0xffe7a8, 0xffb070].map((c) => new Color(c));
  const coreGeo = new SphereGeometry(r, 8, 6);
  const haloGeo = new SphereGeometry(r * 2.6, 8, 6);
  k.geos.push(coreGeo, haloGeo);
  const coreMat = new MeshBasicMaterial({ color: 0xffffff, fog: false });
  const haloMat = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.22,
    blending: AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  k.mats.push(coreMat, haloMat);
  const core = new InstancedMesh(coreGeo, coreMat, at.length);
  const halo = new InstancedMesh(haloGeo, haloMat, at.length);
  const m = new Matrix4();
  at.forEach((p, i) => {
    m.makeTranslation(p.x, p.y, p.z);
    const c = palette[i % palette.length] ?? new Color(0xffd37a);
    core.setMatrixAt(i, m);
    core.setColorAt(i, c);
    halo.setMatrixAt(i, m);
    halo.setColorAt(i, c);
  });
  parent.add(core, halo);
}

export const buildRooftopTheme: ThemeBuilder = (k) => {
  const room = new Group();

  // 하늘·달
  const skyTex = createSkyTexture();
  k.texs.push(skyTex);
  const skyMat = new MeshBasicMaterial({ map: skyTex, side: BackSide, fog: false });
  k.mats.push(skyMat);
  const sky = k.mesh(new SphereGeometry(SKY_R, 32, 16), skyMat, false, false);
  room.add(sky);
  const moonDir = new Vector3(-0.42, 0.42, -0.8).normalize();
  const moonMat = new MeshBasicMaterial({ color: 0xfff6dc, fog: false });
  const haloMat = new MeshBasicMaterial({
    color: 0x9fb2ff,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    fog: false,
  });
  k.mats.push(moonMat, haloMat);
  const moon = k.mesh(new CircleGeometry(26, 32), moonMat, false, false);
  moon.position.copy(moonDir).multiplyScalar(SKY_R - 40);
  moon.lookAt(0, 0, 0);
  room.add(moon);
  const halo = k.mesh(new CircleGeometry(60, 32), haloMat, false, false);
  halo.position.copy(moonDir).multiplyScalar(SKY_R - 42);
  halo.lookAt(0, 0, 0);
  room.add(halo);

  // 도시 불빛: 먼 층(어두운 실루엣)과 가까운 층(창 불빛) 두 겹의 원통 띠
  const cityLayers = [
    { r: 720, seed: 31, base: '#161830', win: 0.2, bottom: CITY_BOTTOM, top: 120 },
    { r: 560, seed: 47, base: '#0b0c16', win: 0.34, bottom: CITY_BOTTOM, top: 10 },
  ];
  for (const c of cityLayers) {
    const tex = createCityTexture(c.seed, c.base, c.win);
    tex.repeat.set(2, 1);
    k.texs.push(tex);
    const mat = new MeshBasicMaterial({ map: tex, side: BackSide, alphaTest: 0.5, fog: false });
    k.mats.push(mat);
    const h = c.top - c.bottom;
    const band = k.mesh(new CylinderGeometry(c.r, c.r, h, 48, 1, true), mat, false, false);
    band.position.y = (c.top + c.bottom) / 2;
    room.add(band);
  }

  // 바닥·난간벽
  const floorTex = createFloorTexture();
  k.texs.push(floorTex);
  const floorMat = new MeshStandardMaterial({ map: floorTex, roughness: 0.8 });
  k.mats.push(floorMat);
  const floor = k.mesh(new PlaneGeometry(ROOF_HALF * 2, ROOF_HALF * 2), floorMat, false, true);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  room.add(floor);
  // 낮은 난간벽 + 철제 난간: 앉은 시점에서 내려다봐도 너머의 도시 불빛이 보이게 벽은 낮게 둔다
  const wallMat = k.std(0x5f5c58, 0.95);
  const capMat = k.std(0x7d7a74, 0.85);
  const railMat = k.std(0x23252a, 0.5, 0.6);
  const along = ROOF_HALF * 2 + 20;
  for (const [sx, sz] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    const w = sx !== 0 ? 10 : along;
    const d = sz !== 0 ? 10 : along;
    const ox = sx * (ROOF_HALF + 5);
    const oz = sz * (ROOF_HALF + 5);
    const wall = k.mesh(new BoxGeometry(w, PARAPET_H, d), wallMat, false, true);
    wall.position.set(ox, FLOOR_Y + PARAPET_H / 2, oz);
    room.add(wall);
    const cap = k.mesh(new BoxGeometry(w + 3, 3, d + 3), capMat, false, true);
    cap.position.set(ox, FLOOR_Y + PARAPET_H + 1.5, oz);
    room.add(cap);
    for (const ry of [RAIL_Y, (RAIL_Y + FLOOR_Y + PARAPET_H) / 2]) {
      const bar = k.mesh(
        new BoxGeometry(sx !== 0 ? 2 : along, 2, sz !== 0 ? 2 : along),
        railMat,
        false,
      );
      bar.position.set(ox, ry, oz);
      room.add(bar);
    }
    for (let i = 0; i <= 12; i++) {
      const t = -along / 2 + (i * along) / 12;
      const post = k.mesh(new BoxGeometry(2, RAIL_Y - FLOOR_Y - PARAPET_H, 2), railMat, false);
      post.position.set(sx !== 0 ? ox : t, (RAIL_Y + FLOOR_Y + PARAPET_H) / 2, sz !== 0 ? oz : t);
      room.add(post);
    }
  }
  // 도시 띠 아래가 비치지 않게 어두운 바닥 덮개
  const underMat = new MeshBasicMaterial({ color: 0x07070d, fog: false });
  k.mats.push(underMat);
  const under = k.mesh(new PlaneGeometry(SKY_R * 2, SKY_R * 2), underMat, false, false);
  under.rotation.x = -Math.PI / 2;
  under.position.y = CITY_BOTTOM - 5;
  room.add(under);

  // 옥상 소품: 물탱크(뒤쪽 구석), 실외기, 화분
  const tankMat = k.std(0x4f7fa8, 0.6, 0.2);
  const tank = k.mesh(new CylinderGeometry(20, 20, 50, 16), tankMat);
  tank.position.set(-172, FLOOR_Y + 33, -172);
  room.add(tank);
  const tankLid = k.mesh(new CylinderGeometry(15, 21, 7, 16), tankMat);
  tankLid.position.set(-172, FLOOR_Y + 61.5, -172);
  room.add(tankLid);
  const ironMat = k.std(0x2b2d31, 0.5, 0.6);
  const standTop = k.mesh(new BoxGeometry(46, 4, 46), ironMat);
  standTop.position.set(-172, FLOOR_Y + 6, -172);
  room.add(standTop);
  const acMat = k.std(0xc9c6bf, 0.6, 0.1);
  const grillMat = k.std(0x2a2b2f, 0.7);
  for (const [ax, az, ry] of [
    [150, 170, Math.PI],
    [112, 172, Math.PI],
    [172, -120, -Math.PI / 2],
  ] as const) {
    // 앞면(로컬 +Z)이 옥상 안쪽을 보게 돌린다
    const ac = k.mesh(new BoxGeometry(34, 30, 14), acMat);
    ac.position.set(ax, FLOOR_Y + 15, az);
    ac.rotation.y = ry;
    room.add(ac);
    const fan = k.mesh(new CylinderGeometry(9, 9, 1, 14), grillMat, false);
    fan.rotation.x = Math.PI / 2;
    fan.position.set(-4, 0, 7.2);
    ac.add(fan);
  }
  const potMat = k.std(0x8a4a2c, 0.8);
  const leafMat = k.std(0x2f6b35, 0.8);
  for (const [px, pz, s] of [
    [-165, 120, 1.1],
    [-130, 168, 0.85],
    [170, -40, 1],
    [60, -172, 0.9],
  ] as const) {
    const pot = k.mesh(new CylinderGeometry(10 * s, 7.5 * s, 18 * s, 10), potMat);
    pot.position.set(px, FLOOR_Y + 9 * s, pz);
    room.add(pot);
    const bush = k.mesh(new SphereGeometry(13 * s, 10, 8), leafMat);
    bush.position.set(px, FLOOR_Y + 26 * s, pz);
    bush.scale.y = 1.2;
    room.add(bush);
  }

  // 전구 줄: 난간을 따라 늘어진 줄(배경, 앉은 시점에서 도시 불빛 앞에 보인다)과
  // 모서리 기둥에서 판 위 고리로 모이는 줄(lamp, 카메라가 높아지면 숨긴다)
  const lamp = new Group();
  room.add(lamp);
  const wireMat = k.std(0x15161a, 0.6);
  const railBulbs: Vector3[] = [];
  const edge = ROOF_HALF + 2;
  const railCorners = [
    new Vector3(edge, RAIL_Y - 1, edge),
    new Vector3(-edge, RAIL_Y - 1, edge),
    new Vector3(-edge, RAIL_Y - 1, -edge),
    new Vector3(edge, RAIL_Y - 1, -edge),
  ];
  for (let i = 0; i < 4; i++) {
    const a = railCorners[i];
    const b = railCorners[(i + 1) % 4];
    if (!a || !b) continue;
    room.add(k.mesh(festoon(a, b, 6, 20, 3, railBulbs), wireMat, false, false));
  }
  addBulbs(k, room, railBulbs, 1.9);
  const poleMat = k.std(0x2a2620, 0.7);
  const POLE = 168;
  const POLE_TOP = 120;
  const hub = new Vector3(0, 128, 0);
  const hubBulbs: Vector3[] = [new Vector3(0, 123, 0)];
  for (const [sx, sz] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ] as const) {
    const pole = k.mesh(new CylinderGeometry(1.6, 2.2, POLE_TOP - FLOOR_Y, 8), poleMat);
    pole.position.set(sx * POLE, (POLE_TOP + FLOOR_Y) / 2, sz * POLE);
    room.add(pole);
    const top = new Vector3(sx * POLE, POLE_TOP, sz * POLE);
    lamp.add(k.mesh(festoon(top, hub, 1, 14, 8, hubBulbs), wireMat, false, false));
  }
  addBulbs(k, lamp, hubBulbs, 2);

  // 조명: 달빛(차가운 방향광)·하늘빛 + 판 위 전구 고리의 따뜻한 스포트라이트(그림자) + 둘레 전구 보조광
  const lights = new Group();
  lights.add(new AmbientLight(0xb8c4ff, 0.25));
  lights.add(new HemisphereLight(0x5a6aa8, 0x2c3a30, 0.8));
  const moonLight = new DirectionalLight(0xa8bcff, 0.9);
  moonLight.position.copy(moonDir).multiplyScalar(200);
  lights.add(moonLight);
  const spot = new SpotLight(0xffd8a0, 2600, 0, 0.62, 0.55, 1.2);
  spot.position.set(0, 120, 0);
  spot.target.position.set(0, 0, 0);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0006;
  spot.shadow.camera.near = 40;
  spot.shadow.camera.far = 230;
  lights.add(spot, spot.target);
  for (const sz of [1, -1]) {
    const glow = new PointLight(0xffb866, 900, 0, 1.3);
    glow.position.set(0, 95, sz * POLE);
    lights.add(glow);
  }

  // 책상(흔들림 대상): 야외용 나무 살 상판 + 검은 철제 프레임
  const desk = new Group();
  const slatTex = canvasTextureWH(512, 256, (g, w, h) => {
    const rnd = lcg(19);
    const n = 7;
    for (let i = 0; i < n; i++) {
      g.fillStyle = `hsl(28,${18 + rnd() * 8}%,${36 + rnd() * 7}%)`;
      g.fillRect(0, (i * h) / n, w, h / n);
      for (let j = 0; j < 6; j++) {
        g.strokeStyle = `rgba(90,55,25,${0.12 + rnd() * 0.12})`;
        g.lineWidth = 1;
        const y = (i * h) / n + 3 + rnd() * (h / n - 6);
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(w, y + (rnd() - 0.5) * 4);
        g.stroke();
      }
      g.fillStyle = 'rgba(20,12,6,0.85)';
      g.fillRect(0, (i * h) / n, w, 3);
    }
  });
  k.texs.push(slatTex);
  const topMat = new MeshStandardMaterial({ map: slatTex, roughness: 0.75 });
  k.mats.push(topMat);
  const top = k.mesh(new BoxGeometry(TABLE_HALF_X * 2, TABLE_TOP_T, TABLE_HALF_Z * 2), topMat);
  top.position.y = TABLE_Y - TABLE_TOP_T / 2;
  desk.add(top);
  const frameMat = k.std(0x1d1f22, 0.45, 0.7);
  for (const sz of [1, -1]) {
    const rail = k.mesh(new BoxGeometry(TABLE_HALF_X * 2 + 0.8, 2.4, 1.4), frameMat);
    rail.position.set(0, TABLE_Y - 1.2, sz * (TABLE_HALF_Z + 0.4));
    desk.add(rail);
  }
  for (const sx of [1, -1]) {
    const rail = k.mesh(new BoxGeometry(1.4, 2.4, TABLE_HALF_Z * 2 + 0.8), frameMat);
    rail.position.set(sx * (TABLE_HALF_X + 0.4), TABLE_Y - 1.2, 0);
    desk.add(rail);
  }
  // A자 다리: 좌우 끝마다 두 다리를 바닥에서 벌려 세우고 가로대로 잇는다
  const legTopY = TABLE_Y - TABLE_TOP_T;
  const legH = legTopY - FLOOR_Y;
  const spread = TABLE_HALF_Z - 6;
  const legLen = Math.hypot(legH, spread - 6);
  const tilt = Math.atan2(spread - 6, legH);
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      const leg = k.mesh(new CylinderGeometry(1.3, 1.3, legLen, 8), frameMat);
      leg.position.set(sx * (TABLE_HALF_X - 6), FLOOR_Y + legH / 2, (sz * (spread + 6)) / 2);
      leg.rotation.x = -sz * tilt;
      desk.add(leg);
    }
    const brace = k.mesh(new CylinderGeometry(1, 1, spread * 1.4, 8), frameMat);
    brace.rotation.x = Math.PI / 2;
    brace.position.set(sx * (TABLE_HALF_X - 6), FLOOR_Y + legH * 0.3, 0);
    desk.add(brace);
  }
  const stretcher = k.mesh(new CylinderGeometry(1, 1, TABLE_HALF_X * 2 - 12, 8), frameMat);
  stretcher.rotation.z = Math.PI / 2;
  stretcher.position.set(0, FLOOR_Y + legH * 0.3, 0);
  desk.add(stretcher);

  return { room, desk, lamp, lights, background: 0x0a0d1c };
};
