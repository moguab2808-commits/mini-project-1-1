// 해변 테마(DEC-052): 노을 하늘과 바다, 모래섬, 야자수, 주황 석양 조명, 나무 피크닉 테이블.
// 하늘·바다는 조명을 받지 않는 canvas 그림이고, 판 위는 따뜻한 흰빛 주 조명으로 알 색이 읽히게 한다.
import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DodecahedronGeometry,
  Group,
  HemisphereLight,
  MeshBasicMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  RingGeometry,
  SphereGeometry,
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
  type ThemeBuilder,
} from '../stage-kit.ts';

/** 바다 수면 높이: 모래 바닥보다 조금 낮다 */
const SEA_Y = FLOOR_Y - 3;
/** 하늘 구 반경. 바다 원판 가장자리가 하늘 적도와 맞물려 수평선이 된다 */
const SKY_R = 430;
/** 모래섬 반경 */
const SAND_R = 190;
/** 해가 지는 방향(-Z 쪽, 약간 왼쪽). 하늘 그림·석양 조명·바다 반사가 이 각도를 따른다 */
const SUN_AZ = -Math.PI / 2 - 0.18;

/** 하늘(등장방형): 위는 보라, 수평선은 주황·분홍, 해 쪽은 금빛. 아래 절반은 바다색으로 채운다 */
function createSkyTexture(): Texture {
  return canvasTextureWH(2048, 1024, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h / 2);
    sky.addColorStop(0, '#2a2350');
    sky.addColorStop(0.45, '#6b3f7a');
    sky.addColorStop(0.72, '#d9667a');
    sky.addColorStop(0.9, '#f59a5c');
    sky.addColorStop(1, '#ffc27a');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h / 2);
    g.fillStyle = '#3b3560';
    g.fillRect(0, h / 2, w, h / 2);

    // SphereGeometry의 u: 0=-X, 0.25=+Z, 0.5=+X, 0.75=-Z
    const sunU = (((Math.atan2(Math.sin(SUN_AZ), -Math.cos(SUN_AZ)) / (2 * Math.PI)) % 1) + 1) % 1;
    const sx = sunU * w;
    const sy = h / 2 - 22;
    // 해 둘레 빛무리: 수평으로 넓게(가장자리 반복을 위해 좌우로 한 번 더 그린다)
    for (const ox of [-w, 0, w]) {
      g.save();
      g.translate(sx + ox, h / 2);
      g.scale(3.2, 1);
      const glow = g.createRadialGradient(0, 0, 0, 0, 0, 170);
      glow.addColorStop(0, 'rgba(255,214,140,0.95)');
      glow.addColorStop(0.4, 'rgba(255,160,90,0.5)');
      glow.addColorStop(1, 'rgba(255,120,90,0)');
      g.fillStyle = glow;
      g.fillRect(-170, -170, 340, 170);
      g.restore();
    }

    // 길게 누운 구름: 아래쪽이 노을빛으로 물든다
    const rnd = lcg(52);
    for (let i = 0; i < 26; i++) {
      const cx = rnd() * w;
      const cy = h * (0.3 + rnd() * 0.17);
      const cw = 120 + rnd() * 260;
      const ch = 6 + rnd() * 10;
      const near = 1 - Math.min(1, Math.abs(((cx - sx + w * 1.5) % w) - w / 2) / (w / 2));
      g.fillStyle = `rgba(${150 + near * 90},${70 + near * 60},${110 - near * 30},0.55)`;
      g.beginPath();
      g.ellipse(cx, cy, cw / 2, ch / 2, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = `rgba(255,${150 + near * 60},${120 - near * 30},${0.25 + near * 0.35})`;
      g.beginPath();
      g.ellipse(cx, cy + ch * 0.3, cw * 0.42, ch * 0.22, 0, 0, Math.PI * 2);
      g.fill();
    }

    // 반쯤 잠긴 해
    g.save();
    g.beginPath();
    g.rect(0, 0, w, h / 2);
    g.clip();
    g.fillStyle = '#fff0c0';
    g.beginPath();
    g.arc(sx, sy + 14, 30, 0, Math.PI * 2);
    g.fill();
    g.restore();
  });
}

/** 바다(위에서 본 원판): 먼 곳은 노을을 비추고, 해 쪽으로 금빛 물결 기둥이 뻗는다 */
function createSeaTexture(): Texture {
  return canvasTexture(1024, (g, s) => {
    const c = s / 2;
    const base = g.createRadialGradient(c, c, s * 0.18, c, c, s / 2);
    base.addColorStop(0, '#1f5a73');
    base.addColorStop(0.45, '#3a4f7a');
    base.addColorStop(0.8, '#9a5a7e');
    base.addColorStop(1, '#e48a6a');
    g.fillStyle = base;
    g.fillRect(0, 0, s, s);

    // 해 방향 반사 기둥. 캔버스 위쪽(행 0)이 월드 -Z, 오른쪽이 +X다
    const dx = Math.cos(SUN_AZ);
    const dz = Math.sin(SUN_AZ);
    const rnd = lcg(7);
    for (let i = 0; i < 260; i++) {
      const t = 0.2 + rnd() * 0.8;
      const spread = (rnd() - 0.5) * (0.04 + t * 0.12) * s;
      const px = c + dx * t * c - dz * spread;
      const py = c + dz * t * c + dx * spread;
      const a = 0.25 + t * 0.6;
      g.fillStyle = `rgba(255,${190 + rnd() * 50},${120 + rnd() * 40},${a})`;
      g.fillRect(px - 6 - rnd() * 10, py, 12 + rnd() * 20, 2);
    }
    // 잔물결
    for (let i = 0; i < 900; i++) {
      const px = rnd() * s;
      const py = rnd() * s;
      g.fillStyle = `rgba(255,220,200,${0.05 + rnd() * 0.1})`;
      g.fillRect(px, py, 6 + rnd() * 14, 1.5);
    }
  });
}

/** 모래: 밝은 살구빛 바탕에 알갱이 점 */
function createSandTexture(): Texture {
  const tex = canvasTexture(512, (g, s) => {
    g.fillStyle = '#e8c79a';
    g.fillRect(0, 0, s, s);
    const rnd = lcg(31);
    for (let i = 0; i < 5000; i++) {
      const l = rnd();
      g.fillStyle = l < 0.5 ? 'rgba(150,110,70,0.25)' : 'rgba(255,245,225,0.35)';
      g.fillRect(rnd() * s, rnd() * s, 2, 2);
    }
    // 바람 자국
    g.strokeStyle = 'rgba(170,130,85,0.18)';
    g.lineWidth = 3;
    for (let i = 0; i < 14; i++) {
      const y = rnd() * s;
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(s * 0.3, y + 10, s * 0.6, y - 10, s, y);
      g.stroke();
    }
  });
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

/** 볕에 바랜 나무 널판 */
function createWeatheredPlankTexture(): Texture {
  return canvasTexture(256, (g, s) => {
    g.fillStyle = '#b98a5e';
    g.fillRect(0, 0, s, s);
    const rnd = lcg(19);
    for (let i = 0; i < 40; i++) {
      const y = rnd() * s;
      g.fillStyle = `rgba(${rnd() < 0.5 ? '90,60,35' : '235,205,165'},${0.12 + rnd() * 0.15})`;
      g.fillRect(0, y, s, 1 + rnd() * 2);
    }
  });
}

export const buildBeachTheme: ThemeBuilder = (k) => {
  const room = new Group();

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
  const sky = k.mesh(new SphereGeometry(SKY_R, 48, 24), skyMat, false, false);
  sky.position.y = SEA_Y;
  room.add(sky);

  // 바다
  const seaTex = createSeaTexture();
  k.texs.push(seaTex);
  const seaMat = new MeshBasicMaterial({ map: seaTex, toneMapped: false });
  k.mats.push(seaMat);
  const sea = k.mesh(new CircleGeometry(SKY_R - 2, 64), seaMat, false, false);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = SEA_Y;
  room.add(sea);

  // 모래섬: 윗면은 바닥 높이, 가장자리는 완만한 경사로 물속에 잠긴다
  const sandTex = createSandTexture();
  k.texs.push(sandTex);
  const sandMat = new MeshStandardMaterial({ map: sandTex, roughness: 0.95 });
  k.mats.push(sandMat);
  const sand = k.mesh(new CircleGeometry(SAND_R, 48), sandMat, false, true);
  sand.rotation.x = -Math.PI / 2;
  sand.position.y = FLOOR_Y;
  room.add(sand);
  const shoreMat = k.std(0xc9a77c, 1);
  const shore = k.mesh(
    new CylinderGeometry(SAND_R, SAND_R + 14, 4, 48, 1, true),
    shoreMat,
    false,
    true,
  );
  shore.position.y = FLOOR_Y - 2;
  room.add(shore);
  // 물가 거품
  const foamMat = new MeshBasicMaterial({
    color: 0xffe6d6,
    transparent: true,
    opacity: 0.55,
    toneMapped: false,
  });
  k.mats.push(foamMat);
  const foam = k.mesh(new RingGeometry(SAND_R + 12, SAND_R + 19, 64), foamMat, false, false);
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = SEA_Y + 0.2;
  room.add(foam);

  // 야자수: 두 좌석 시점 모두 뒤편에 하나 이상 보이도록 대각선으로 둔다
  const trunkMat = k.std(0x7a5534, 0.9);
  const leafMat = k.std(0x2f6b3a, 0.8);
  const coconutMat = k.std(0x4a3020, 0.7);
  const palms: [number, number, number, number][] = [
    [-125, -120, 1.0, 0.5],
    [140, -95, 0.85, -0.6],
    [120, 125, 1.0, 2.6],
    [-145, 100, 0.9, -2.3],
  ];
  for (const [px, pz, sc, lean] of palms) {
    const palm = new Group();
    palm.position.set(px, FLOOR_Y, pz);
    palm.rotation.y = lean;
    palm.scale.setScalar(sc);
    room.add(palm);
    // 휘어진 줄기: 마디 다섯 개를 조금씩 기울여 쌓는다
    let y = 0;
    let x = 0;
    const segH = 26;
    for (let i = 0; i < 5; i++) {
      const tilt = 0.08 + i * 0.05;
      const seg = k.mesh(new CylinderGeometry(4.2 - i * 0.45, 5 - i * 0.45, segH, 7), trunkMat);
      seg.position.set(x + Math.sin(tilt) * (segH / 2), y + Math.cos(tilt) * (segH / 2), 0);
      seg.rotation.z = -tilt;
      palm.add(seg);
      x += Math.sin(tilt) * segH;
      y += Math.cos(tilt) * segH;
    }
    const crown = new Group();
    crown.position.set(x, y, 0);
    palm.add(crown);
    for (let i = 0; i < 7; i++) {
      const leaf = k.mesh(new ConeGeometry(7, 46, 4), leafMat);
      leaf.scale.z = 0.25;
      const a = (i / 7) * Math.PI * 2;
      const pivot = new Group();
      pivot.rotation.y = a;
      crown.add(pivot);
      leaf.rotation.z = -Math.PI / 2 - 0.45;
      leaf.position.set(20, -6, 0);
      pivot.add(leaf);
    }
    for (let i = 0; i < 3; i++) {
      const nut = k.mesh(new SphereGeometry(3, 8, 6), coconutMat);
      const a = (i / 3) * Math.PI * 2;
      nut.position.set(Math.cos(a) * 3.5, -4, Math.sin(a) * 3.5);
      crown.add(nut);
    }
  }

  // 바위 몇 개와 파라솔 하나(판 위 공간을 피해 옆쪽에 둔다)
  const rockMat = k.std(0x6d6070, 0.9);
  const rocks: [number, number, number][] = [
    [-170, -40, 12],
    [175, 30, 9],
    [60, -175, 10],
    [-50, 178, 11],
  ];
  for (const [rx, rz, r] of rocks) {
    const rock = k.mesh(new DodecahedronGeometry(r, 0), rockMat);
    rock.position.set(rx, FLOOR_Y + r * 0.3, rz);
    rock.scale.y = 0.6;
    rock.rotation.y = rx;
    room.add(rock);
  }
  const umbrella = new Group();
  umbrella.position.set(-115, FLOOR_Y, 30);
  umbrella.rotation.z = 0.12;
  room.add(umbrella);
  const pole = k.mesh(new CylinderGeometry(1, 1, 110, 6), k.std(0xe8e0d0, 0.5));
  pole.position.y = 55;
  umbrella.add(pole);
  const canopyA = k.mesh(new ConeGeometry(48, 16, 8, 1, true), k.std(0xe0533f, 0.7));
  canopyA.position.y = 110;
  umbrella.add(canopyA);
  const canopyB = k.mesh(
    new ConeGeometry(48.2, 16, 8, 1, true, 0, Math.PI / 4),
    k.std(0xf6efe0, 0.7),
  );
  canopyB.position.y = 110;
  for (let i = 0; i < 4; i++) {
    const strip = i === 0 ? canopyB : canopyB.clone();
    strip.rotation.y = (i * Math.PI) / 2;
    umbrella.add(strip);
  }

  // 조명: 머리 위 따뜻한 흰빛이 그림자를 드리우고, 낮은 석양빛이 주황 윤곽을 더한다
  const lights = new Group();
  lights.add(new AmbientLight(0xffe2cc, 0.35));
  lights.add(new HemisphereLight(0xffd2b0, 0x5a4a6e, 0.9));
  // 주 조명은 거의 머리 위에서(옆으로 살짝) 비춰 상대 캐릭터 그림자가 판을 덮지 않게 한다
  const main = new DirectionalLight(0xfff0dc, 2.3);
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
  const sunset = new DirectionalLight(0xff8a4a, 1.2);
  sunset.position.set(Math.cos(SUN_AZ) * 200, 25, Math.sin(SUN_AZ) * 200);
  lights.add(sunset);
  const dusk = new DirectionalLight(0xb8a8ff, 0.6);
  dusk.position.set(-Math.cos(SUN_AZ) * 100, 60, -Math.sin(SUN_AZ) * 100);
  lights.add(dusk);

  // 책상(흔들림 대상): 널판 상판, 아래 가로 받침, A자 다리, 가운데 지지대. 벤치는 좌석과 겹치므로 두지 않는다
  const desk = new Group();
  const plankTex = createWeatheredPlankTexture();
  k.texs.push(plankTex);
  const plankMat = new MeshStandardMaterial({ map: plankTex, roughness: 0.8 });
  k.mats.push(plankMat);
  const planks = 5;
  const gap = 0.7;
  const pw = (TABLE_HALF_Z * 2 - gap * (planks - 1)) / planks;
  for (let i = 0; i < planks; i++) {
    const p = k.mesh(new BoxGeometry(TABLE_HALF_X * 2 + 4, TABLE_TOP_T, pw), plankMat);
    p.position.set(
      (i % 2) * 0.8 - 0.4,
      TABLE_Y - TABLE_TOP_T / 2,
      -TABLE_HALF_Z + pw / 2 + i * (pw + gap),
    );
    desk.add(p);
  }
  // 널판 틈 아래로 비치는 바닥 대신 어두운 받침판
  const underMat = k.std(0x5a3d26, 0.9);
  const under = k.mesh(new BoxGeometry(TABLE_HALF_X * 2 - 2, 0.6, TABLE_HALF_Z * 2 - 2), underMat);
  under.position.y = TABLE_Y - TABLE_TOP_T - 0.3;
  desk.add(under);

  const frameMat = k.std(0x8a5f3c, 0.8);
  const legH = TABLE_Y - TABLE_TOP_T - FLOOR_Y;
  const topZ = 7;
  const footZ = TABLE_HALF_Z - 2;
  const legLen = Math.hypot(legH, footZ - topZ);
  const legTilt = Math.atan2(footZ - topZ, legH);
  for (const sx of [1, -1]) {
    const lx = sx * (TABLE_HALF_X - 9);
    const cleat = k.mesh(new BoxGeometry(5, 4, TABLE_HALF_Z * 2 - 1), frameMat);
    cleat.position.set(lx, TABLE_Y - TABLE_TOP_T - 2.6, 0);
    desk.add(cleat);
    for (const sz of [1, -1]) {
      const leg = k.mesh(new BoxGeometry(4.5, legLen, 7), frameMat);
      leg.position.set(lx, FLOOR_Y + legH / 2, sz * ((topZ + footZ) / 2));
      leg.rotation.x = -sz * legTilt;
      desk.add(leg);
    }
    const brace = k.mesh(new BoxGeometry(4, 4, footZ + topZ + 4), frameMat);
    brace.position.set(lx, FLOOR_Y + legH * 0.42, 0);
    desk.add(brace);
  }
  // 가운데 지지대: 양쪽 가로대에서 상판 아래 중앙으로 비스듬히 오른다
  const bx0 = TABLE_HALF_X - 9;
  const by0 = FLOOR_Y + legH * 0.42;
  const by1 = TABLE_Y - TABLE_TOP_T - 1;
  const strutLen = Math.hypot(bx0, by1 - by0);
  const strutTilt = Math.atan2(by1 - by0, bx0);
  for (const sx of [1, -1]) {
    const strut = k.mesh(new BoxGeometry(strutLen, 3, 3.5), frameMat);
    strut.position.set((sx * bx0) / 2, (by0 + by1) / 2, 0);
    strut.rotation.z = -sx * strutTilt;
    desk.add(strut);
  }

  return { room, desk, lamp: new Group(), lights, background: 0x3b3560 };
};
