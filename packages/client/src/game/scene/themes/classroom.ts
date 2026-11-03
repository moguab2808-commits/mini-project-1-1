// 교실 테마(DEC-052): 칠판 벽과 창문 벽, 천장 형광등의 하얀 빛, 연한 나무 상판에 쇠 다리를 단 학교 책상.
import {
  AmbientLight,
  BackSide,
  BoxGeometry,
  CircleGeometry,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
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

/** 방 반폭(벽까지 거리)과 천장 높이 */
const ROOM = 200;
const CEIL_Y = FLOOR_Y + 290;

/** 교실 바닥: 차분한 나무 마루(책상과 구분되게 어둡게) */
function createFloorTexture(): Texture {
  const tex = canvasTexture(512, (g, s) => {
    const rnd = lcg(23);
    const rows = 8;
    for (let i = 0; i < rows; i++) {
      const y = (i * s) / rows;
      const off = rnd() * (s / 2);
      for (let j = -1; j < 3; j++) {
        g.fillStyle = `hsl(28,${26 + rnd() * 6}%,${33 + rnd() * 5}%)`;
        g.fillRect(off + (j * s) / 2, y, s / 2, s / rows);
        g.fillStyle = 'rgba(70,40,15,0.35)';
        g.fillRect(off + (j * s) / 2, y, 2, s / rows);
      }
      g.fillStyle = 'rgba(70,40,15,0.4)';
      g.fillRect(0, y, s, 2);
    }
  });
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(5, 5);
  return tex;
}

/** 천장: 흡음 텍스 타일 격자 */
function createCeilingTexture(): Texture {
  const tex = canvasTexture(256, (g, s) => {
    const rnd = lcg(5);
    g.fillStyle = '#e9e6dc';
    g.fillRect(0, 0, s, s);
    g.fillStyle = 'rgba(90,85,70,0.25)';
    for (let i = 0; i < 260; i++) g.fillRect(rnd() * s, rnd() * s, 2, 2);
    g.strokeStyle = 'rgba(120,115,100,0.7)';
    g.lineWidth = 3;
    g.strokeRect(0, 0, s, s);
  });
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(7, 7);
  return tex;
}

/** 칠판: 짙은 녹색 바탕에 지운 자국과 분필 낙서(날짜·도형·식). 글꼴 의존을 줄이려 숫자·라틴 문자만 쓴다 */
function createBlackboardTexture(): Texture {
  return canvasTextureWH(1024, 384, (g, w, h) => {
    const rnd = lcg(31);
    g.fillStyle = '#356650';
    g.fillRect(0, 0, w, h);
    // 지우개로 문지른 흐린 자국
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(230,240,230,${0.03 + rnd() * 0.04})`;
      const x = rnd() * w;
      const y = rnd() * h;
      g.beginPath();
      g.ellipse(x, y, 60 + rnd() * 90, 14 + rnd() * 20, (rnd() - 0.5) * 0.4, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(245,245,235,0.85)';
    g.fillStyle = 'rgba(245,245,235,0.85)';
    g.lineWidth = 4;
    g.lineCap = 'round';
    // 오른쪽 위 날짜 칸
    g.font = 'bold 34px sans-serif';
    g.textBaseline = 'middle';
    g.fillText('11 / 3', w - 190, 48);
    // 왼쪽: 알까기 판 그림과 화살표
    g.strokeRect(70, 90, 190, 190);
    for (const [cx, cy, black] of [
      [110, 250, true],
      [165, 240, true],
      [215, 130, false],
      [130, 120, false],
    ] as const) {
      g.beginPath();
      g.arc(cx, cy, 14, 0, Math.PI * 2);
      if (black) g.stroke();
      else g.fill();
    }
    g.beginPath();
    g.moveTo(165, 240);
    g.lineTo(208, 145);
    g.moveTo(196, 150);
    g.lineTo(208, 145);
    g.lineTo(212, 160);
    g.stroke();
    // 가운데: 포물선 그래프와 수식 비슷한 낙서
    g.beginPath();
    g.moveTo(360, 300);
    g.lineTo(640, 300);
    g.moveTo(380, 320);
    g.lineTo(380, 90);
    g.stroke();
    g.beginPath();
    for (let t = 0; t <= 1; t += 0.05) {
      const x = 400 + t * 220;
      const y = 290 - Math.sin(t * Math.PI) * 170;
      if (t === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    g.font = '30px sans-serif';
    g.fillText('v = d / t', 660, 210);
    g.fillText('F = m a', 660, 260);
    // 분필 별표
    g.beginPath();
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const r = i % 2 === 0 ? 22 : 9;
      const x = 900 + Math.cos(a) * r;
      const y = 300 + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  });
}

/** 창밖: 파란 하늘, 구름, 먼 나무 줄 */
function createSkyTexture(): Texture {
  return canvasTextureWH(1024, 256, (g, w, h) => {
    const rnd = lcg(47);
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#7fb6e6');
    sky.addColorStop(1, '#cfe6f5');
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 9; i++) {
      const x = rnd() * w;
      const y = 30 + rnd() * 90;
      for (let j = 0; j < 4; j++) {
        g.beginPath();
        g.ellipse(
          x + j * 22,
          y + (rnd() - 0.5) * 8,
          26 + rnd() * 14,
          12 + rnd() * 6,
          0,
          0,
          Math.PI * 2,
        );
        g.fill();
      }
    }
    for (let x = 0; x < w; x += 18) {
      g.fillStyle = `hsl(${105 + rnd() * 20},35%,${32 + rnd() * 10}%)`;
      g.beginPath();
      g.arc(x, h - 18 + rnd() * 6, 18 + rnd() * 14, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#5d7a4a';
    g.fillRect(0, h - 14, w, 14);
  });
}

/** 게시판: 코르크 바탕에 색종이 공지 */
function createCorkTexture(): Texture {
  return canvasTextureWH(512, 256, (g, w, h) => {
    const rnd = lcg(59);
    g.fillStyle = '#b98a57';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = `rgba(90,55,25,${rnd() * 0.25})`;
      g.fillRect(rnd() * w, rnd() * h, 2, 2);
    }
    const papers = ['#fdfdf6', '#ffe58a', '#a9d8f5', '#f7b8c8', '#c8eab0'];
    for (let i = 0; i < 9; i++) {
      const pw = 60 + rnd() * 40;
      const ph = 50 + rnd() * 50;
      const x = 20 + (i % 5) * 96 + rnd() * 10;
      const y = 16 + Math.floor(i / 5) * 120 + rnd() * 10;
      g.save();
      g.translate(x + pw / 2, y + ph / 2);
      g.rotate((rnd() - 0.5) * 0.15);
      g.fillStyle = papers[i % papers.length] ?? '#fdfdf6';
      g.fillRect(-pw / 2, -ph / 2, pw, ph);
      g.fillStyle = 'rgba(60,60,80,0.45)';
      for (let l = 0; l < 4; l++) g.fillRect(-pw / 2 + 8, -ph / 2 + 12 + l * 10, pw - 16, 3);
      g.fillStyle = '#d63b3b';
      g.beginPath();
      g.arc(0, -ph / 2 + 5, 4, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  });
}

export const buildClassroomTheme: ThemeBuilder = (k) => {
  const room = new Group();

  // 바닥·벽·천장
  const floorTex = createFloorTexture();
  k.texs.push(floorTex);
  const floorMat = new MeshStandardMaterial({ map: floorTex, roughness: 0.75 });
  k.mats.push(floorMat);
  const floor = k.mesh(new PlaneGeometry(ROOM * 2, ROOM * 2), floorMat, false, true);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = FLOOR_Y;
  room.add(floor);
  // 벽 상단은 미색, 하단은 연두 징두리 판
  const wallMat = new MeshStandardMaterial({ color: 0xf0ead8, roughness: 0.95, side: BackSide });
  k.mats.push(wallMat);
  const walls = k.mesh(
    new BoxGeometry(ROOM * 2, CEIL_Y - FLOOR_Y + 2, ROOM * 2),
    wallMat,
    false,
    true,
  );
  // 상자 밑면이 바닥과 겹쳐 깜박이지 않게 바닥보다 조금 아래로 내린다
  walls.position.y = (CEIL_Y + FLOOR_Y) / 2 - 1;
  room.add(walls);
  const wainMat = new MeshStandardMaterial({ color: 0x9fbf98, roughness: 0.8, side: BackSide });
  k.mats.push(wainMat);
  // 위아래가 뚫린 사각 기둥(밑면이 바닥을 덮지 않게)
  const wainR = (ROOM - 1) * Math.SQRT2;
  const wain = k.mesh(new CylinderGeometry(wainR, wainR, 46, 4, 1, true), wainMat, false, true);
  wain.rotation.y = Math.PI / 4;
  wain.position.y = FLOOR_Y + 23;
  room.add(wain);
  const railMat = k.std(0x6f8f68, 0.6);
  for (const [rx, rz, w, d] of [
    [0, ROOM - 2.5, ROOM * 2, 2],
    [0, -(ROOM - 2.5), ROOM * 2, 2],
    [ROOM - 2.5, 0, 2, ROOM * 2],
    [-(ROOM - 2.5), 0, 2, ROOM * 2],
  ] as const) {
    const rail = k.mesh(new BoxGeometry(w, 3, d), railMat, false, true);
    rail.position.set(rx, FLOOR_Y + 46, rz);
    room.add(rail);
  }
  const ceilTex = createCeilingTexture();
  k.texs.push(ceilTex);
  const ceilMat = new MeshStandardMaterial({ map: ceilTex, roughness: 0.95 });
  k.mats.push(ceilMat);
  const ceil = k.mesh(new PlaneGeometry(ROOM * 2, ROOM * 2), ceilMat, false, false);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = CEIL_Y - 0.5;
  room.add(ceil);

  // 앞벽(-Z): 칠판·분필 받침·시계
  const boardTex = createBlackboardTexture();
  k.texs.push(boardTex);
  const chalkMat = new MeshStandardMaterial({ map: boardTex, roughness: 0.9 });
  k.mats.push(chalkMat);
  const bw = 320;
  const bh = bw * (384 / 1024);
  const bby = 14;
  const blackboard = k.mesh(new PlaneGeometry(bw, bh), chalkMat, false, true);
  blackboard.position.set(0, bby, -ROOM + 2);
  room.add(blackboard);
  const frameMat = k.std(0x8a6a45, 0.6);
  for (const [fx, fy, fw, fh] of [
    [0, bby + bh / 2 + 2, bw + 8, 4],
    [0, bby - bh / 2 - 2, bw + 8, 4],
    [bw / 2 + 2, bby, 4, bh],
    [-bw / 2 - 2, bby, 4, bh],
  ] as const) {
    const f = k.mesh(new BoxGeometry(fw, fh, 3), frameMat, false, true);
    f.position.set(fx, fy, -ROOM + 2.5);
    room.add(f);
  }
  const tray = k.mesh(new BoxGeometry(bw, 1.5, 7), frameMat, false, true);
  tray.position.set(0, bby - bh / 2 - 4, -ROOM + 5);
  room.add(tray);
  const chalkColors = [0xf5f5ee, 0xf2d34f, 0xe8706a];
  for (let i = 0; i < 3; i++) {
    const c = k.mesh(new CylinderGeometry(0.6, 0.6, 7, 6), k.std(chalkColors[i] ?? 0xf5f5ee, 0.9));
    c.rotation.z = Math.PI / 2;
    c.position.set(-60 + i * 14, bby - bh / 2 - 2.6, -ROOM + 5);
    room.add(c);
  }
  // 시계: 흰 판에 시침·분침
  const clockFace = new MeshBasicMaterial({ color: 0xf8f8f2 });
  k.mats.push(clockFace);
  const clock = k.mesh(new CircleGeometry(12, 24), clockFace, false, false);
  clock.position.set(0, bby + bh / 2 + 26, -ROOM + 2);
  room.add(clock);
  const rim = k.mesh(
    new CylinderGeometry(13, 13, 2, 24, 1, true),
    k.std(0x333333, 0.4),
    false,
    false,
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.copy(clock.position);
  room.add(rim);
  const handMat = k.std(0x222222, 0.5);
  for (const [len, ang] of [
    [7, 0.6],
    [10, -1.9],
  ] as const) {
    const hand = k.mesh(new BoxGeometry(1, len, 0.4), handMat, false, false);
    hand.geometry.translate(0, len / 2, 0);
    hand.rotation.z = ang;
    hand.position.set(clock.position.x, clock.position.y, -ROOM + 2.6);
    room.add(hand);
  }

  // 오른벽(+X): 창문 세 짝. 창밖은 빛을 받지 않는 하늘 그림이다
  const skyTex = createSkyTexture();
  k.texs.push(skyTex);
  const skyMat = new MeshBasicMaterial({ map: skyTex });
  k.mats.push(skyMat);
  const winY = 22;
  const winH = 110;
  const sky = k.mesh(new PlaneGeometry(ROOM * 2 - 40, winH), skyMat, false, false);
  sky.rotation.y = -Math.PI / 2;
  sky.position.set(ROOM - 1, winY, 0);
  room.add(sky);
  const sashMat = k.std(0xe4e4e0, 0.5, 0.2);
  const sill = k.mesh(new BoxGeometry(10, 3, ROOM * 2 - 36), sashMat, false, true);
  sill.position.set(ROOM - 5, winY - winH / 2 - 1.5, 0);
  room.add(sill);
  const head = k.mesh(new BoxGeometry(4, 4, ROOM * 2 - 36), sashMat, false, true);
  head.position.set(ROOM - 3, winY + winH / 2 + 2, 0);
  room.add(head);
  const mid = k.mesh(new BoxGeometry(3, 2.5, ROOM * 2 - 36), sashMat, false, false);
  mid.position.set(ROOM - 3, winY + 10, 0);
  room.add(mid);
  for (let i = 0; i <= 6; i++) {
    const z = -(ROOM - 20) + (i * (ROOM * 2 - 40)) / 6;
    const post = k.mesh(new BoxGeometry(4, winH, i % 2 === 0 ? 5 : 2.5), sashMat, false, false);
    post.position.set(ROOM - 3, winY, z);
    room.add(post);
  }
  // 창가 커튼 묶음
  const curtainMat = k.std(0xd9c98f, 0.95);
  for (const z of [-(ROOM - 12), ROOM - 12]) {
    const curtain = k.mesh(new BoxGeometry(6, winH + 20, 16), curtainMat, false, true);
    curtain.position.set(ROOM - 8, winY + 6, z);
    room.add(curtain);
  }

  // 왼벽(-X): 복도 쪽 미닫이문과 높은 창
  const doorMat = k.std(0x9a7650, 0.6);
  for (const z of [-120, 120]) {
    const door = k.mesh(new BoxGeometry(3, 190, 80), doorMat, false, true);
    door.position.set(-ROOM + 1.5, FLOOR_Y + 95, z);
    room.add(door);
    const pane = k.mesh(new PlaneGeometry(30, 50), skyMat, false, false);
    pane.rotation.y = Math.PI / 2;
    pane.position.set(-ROOM + 3.2, FLOOR_Y + 150, z + 18);
    room.add(pane);
  }
  for (let i = 0; i < 4; i++) {
    const hall = k.mesh(new PlaneGeometry(36, 30), skyMat, false, false);
    hall.rotation.y = Math.PI / 2;
    hall.position.set(-ROOM + 1, FLOOR_Y + 225, -60 + i * 40);
    room.add(hall);
  }

  // 뒷벽(+Z): 게시판과 사물함
  const corkTex = createCorkTexture();
  k.texs.push(corkTex);
  const corkMat = new MeshStandardMaterial({ map: corkTex, roughness: 0.95 });
  k.mats.push(corkMat);
  const cork = k.mesh(new PlaneGeometry(200, 100), corkMat, false, true);
  cork.rotation.y = Math.PI;
  cork.position.set(0, 25, ROOM - 2);
  room.add(cork);
  for (const [fx, fy, fw, fh] of [
    [0, 77, 206, 4],
    [0, -27, 206, 4],
    [102, 25, 4, 100],
    [-102, 25, 4, 100],
  ] as const) {
    const f = k.mesh(new BoxGeometry(fw, fh, 3), frameMat, false, false);
    f.position.set(fx, fy, ROOM - 2.5);
    room.add(f);
  }
  const lockerMat = k.std(0x7d9bb5, 0.5, 0.2);
  const lockerLine = k.std(0x4f6578, 0.6);
  const lockerH = 52;
  const lockers = k.mesh(new BoxGeometry(320, lockerH, 20), lockerMat, false, true);
  lockers.position.set(0, FLOOR_Y + lockerH / 2, ROOM - 10);
  room.add(lockers);
  for (let i = 0; i <= 10; i++) {
    const line = k.mesh(new BoxGeometry(0.8, lockerH - 4, 0.6), lockerLine, false, false);
    line.position.set(-160 + i * 32, FLOOR_Y + lockerH / 2, ROOM - 20.2);
    room.add(line);
  }
  const shelfLine = k.mesh(new BoxGeometry(320, 0.8, 0.6), lockerLine, false, false);
  shelfLine.position.set(0, FLOOR_Y + lockerH / 2, ROOM - 20.2);
  room.add(shelfLine);

  // 천장 형광등: 빛을 내는 관(조명 계산 없음)과 쇠 갓
  const tubeMat = new MeshBasicMaterial({ color: 0xf4fbff });
  k.mats.push(tubeMat);
  const housingMat = k.std(0xdedede, 0.5, 0.3);
  for (const x of [-90, 0, 90]) {
    for (const z of [-90, 0, 90]) {
      const housing = k.mesh(new BoxGeometry(14, 3, 124), housingMat, false, false);
      housing.position.set(x, CEIL_Y - 1.5, z);
      room.add(housing);
      for (const dx of [-3, 3]) {
        const tube = k.mesh(new CylinderGeometry(1.4, 1.4, 118, 8), tubeMat, false, false);
        tube.rotation.x = Math.PI / 2;
        tube.position.set(x + dx, CEIL_Y - 4.5, z);
        room.add(tube);
      }
    }
  }
  const lamp = new Group();

  // 조명: 형광등의 고르고 하얀 빛과 창가의 낮 햇빛
  const lights = new Group();
  lights.add(new AmbientLight(0xf4f8ff, 0.35));
  lights.add(new HemisphereLight(0xf8fbff, 0x8a7a60, 0.8));
  const main = new DirectionalLight(0xffffff, 1.4);
  main.position.set(10, 160, 25);
  main.target.position.set(0, 0, 0);
  main.castShadow = true;
  main.shadow.mapSize.set(1024, 1024);
  main.shadow.bias = -0.0006;
  main.shadow.camera.near = 60;
  main.shadow.camera.far = 280;
  main.shadow.camera.left = -60;
  main.shadow.camera.right = 60;
  main.shadow.camera.top = 60;
  main.shadow.camera.bottom = -60;
  lights.add(main, main.target);
  const sun = new DirectionalLight(0xfff2d8, 0.5);
  sun.position.set(150, 80, -30);
  lights.add(sun);

  // 책상(흔들림 대상): 연한 나무 상판, 쇠 테두리와 다리, 상판 아래 서랍 칸
  const desk = new Group();
  const topMat = k.std(0xc08a4e, 0.6);
  const top = k.mesh(new BoxGeometry(TABLE_HALF_X * 2, TABLE_TOP_T, TABLE_HALF_Z * 2), topMat);
  top.position.y = TABLE_Y - TABLE_TOP_T / 2;
  desk.add(top);
  const edgeMat = k.std(0x5e4128, 0.5);
  for (const sz of [1, -1]) {
    const lip = k.mesh(new BoxGeometry(TABLE_HALF_X * 2 + 0.6, TABLE_TOP_T, 0.8), edgeMat);
    lip.position.set(0, TABLE_Y - TABLE_TOP_T / 2, sz * (TABLE_HALF_Z + 0.4));
    desk.add(lip);
  }
  for (const sx of [1, -1]) {
    const lip = k.mesh(new BoxGeometry(0.8, TABLE_TOP_T, TABLE_HALF_Z * 2 + 1.6), edgeMat);
    lip.position.set(sx * (TABLE_HALF_X + 0.4), TABLE_Y - TABLE_TOP_T / 2, 0);
    desk.add(lip);
  }
  const steel = k.std(0x6f7a72, 0.45, 0.6);
  const legH = TABLE_Y - TABLE_TOP_T - FLOOR_Y;
  for (const [a, b] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    const leg = k.mesh(new CylinderGeometry(1.4, 1.4, legH, 8), steel);
    leg.position.set(a * (TABLE_HALF_X - 4), FLOOR_Y + legH / 2, b * (TABLE_HALF_Z - 4));
    desk.add(leg);
    const foot = k.mesh(new CylinderGeometry(2, 2, 1.5, 8), k.std(0x222222, 0.8), false, true);
    foot.position.set(a * (TABLE_HALF_X - 4), FLOOR_Y + 0.75, b * (TABLE_HALF_Z - 4));
    desk.add(foot);
  }
  // 상판 밑 쇠 틀과 다리 사이 가로대
  for (const b of [1, -1]) {
    const frame = k.mesh(new BoxGeometry(TABLE_HALF_X * 2 - 6, 2.5, 1.5), steel);
    frame.position.set(0, TABLE_Y - TABLE_TOP_T - 1.25, b * (TABLE_HALF_Z - 4));
    desk.add(frame);
  }
  for (const a of [1, -1]) {
    const bar = k.mesh(new CylinderGeometry(0.9, 0.9, TABLE_HALF_Z * 2 - 8, 6), steel);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(a * (TABLE_HALF_X - 4), FLOOR_Y + 14, 0);
    desk.add(bar);
  }
  // 서랍 칸: 좌석 쪽 다리 공간을 막지 않게 안쪽으로 얇게 둔다
  const drawer = k.mesh(new BoxGeometry(TABLE_HALF_X * 2 - 14, 1.2, 26), k.std(0x5d6660, 0.6, 0.3));
  drawer.position.set(0, TABLE_Y - TABLE_TOP_T - 9, 0);
  desk.add(drawer);

  return { room, desk, lamp, lights, background: 0xe9e4d6 };
};
