// 추가 방해요소 10종의 판 위 표시(자석·중력 구역·미끄럼 장판·방향 반전·폭탄·구멍·이동 장애물 경로·분신술 허상).
// 파일 에셋 없이 코드 도형만 쓴다. 객체는 종류별로 한 번 만들어 재사용하고 프레임마다 값만 바꾼다.
// 회전 그룹 안에 들어가므로 위치는 서버 좌표(X=x, Z=-y)이고 rotation.y는 서버 좌표계 각(반시계)이다.
// 이동 장애물 본체는 `HazardLayer`의 벽으로 그린다(GameScene이 `movingWallAt`으로 위치를 계산).
import { HAZARD_TUNING, PHYSICS } from '@alkkagi/shared';
import {
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import { flatArrowGeometry } from './arrow-geometry.ts';
import { STONE_REST_Y } from './layers.ts';

export type ZoneKind =
  | 'magnet'
  | 'gravity_zone'
  | 'ice_floor'
  | 'reverse_zone'
  | 'mine'
  | 'pit'
  | 'moving_track'
  | 'decoy';

export interface ZoneDraw {
  kind: ZoneKind;
  x: number;
  y: number;
  /** 중력 구역: 정사각형 각, 이동 장애물 경로: 벽 각(라디안) */
  angle: number;
  /** 중력 구역 방향(라디안) */
  dir: number;
  /** 설치 후 경과(초) */
  age: number;
}

const T = HAZARD_TUNING;
const R = PHYSICS.stoneRadius;
/** 판 윗면 바로 위(끈끈이 원판 0.25 아래) */
const FLOOR_Y = 0.06;

interface Pool {
  make: () => Group;
  items: Group[];
  used: number;
}

/** 0→1 등장 */
function grow(age: number, sec = 0.35): number {
  return Math.min(1, Math.max(0.01, age / sec));
}

export class ZoneLayer {
  readonly group = new Group();
  private readonly geos: BufferGeometry[] = [];
  private readonly mats: Material[] = [];
  private readonly pools = new Map<ZoneKind, Pool>();

  constructor() {
    const g = <G extends BufferGeometry>(geo: G): G => {
      this.geos.push(geo);
      return geo;
    };
    const m = <M extends Material>(mat: M): M => {
      this.mats.push(mat);
      return mat;
    };
    const flat = (geo: BufferGeometry) => {
      geo.rotateX(-Math.PI / 2);
      return geo;
    };
    const translucent = (color: number, opacity: number) =>
      m(new MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));

    // 자석: 붉은 영향 원 + 테두리 + 가운데 말굽 자석 덩어리
    const magnetDisc = g(flat(new CircleGeometry(T.magnetRadius, 48)));
    const magnetRing = g(flat(new RingGeometry(T.magnetRadius - 0.35, T.magnetRadius, 48)));
    const magnetCore = g(new CylinderGeometry(1.4, 1.6, 1.4, 20));
    const magnetDiscMat = translucent(0xd9694f, 0.16);
    const magnetRingMat = translucent(0xd9694f, 0.7);
    const magnetCoreMat = m(
      new MeshStandardMaterial({ color: 0xc43b2c, roughness: 0.35, metalness: 0.4 }),
    );
    this.pool('magnet', () => {
      const grp = new Group();
      const disc = new Mesh(magnetDisc, magnetDiscMat);
      disc.position.y = FLOOR_Y;
      const ring = new Mesh(magnetRing, magnetRingMat);
      ring.position.y = FLOOR_Y + 0.01;
      ring.name = 'pulse';
      const core = new Mesh(magnetCore, magnetCoreMat);
      core.position.y = 0.7;
      core.castShadow = true;
      grp.add(disc, ring, core);
      return grp;
    });

    // 중력 구역: 푸른 정사각형 + 판 평면에 눕힌 큰 화살표 1개와 흐르는 작은 화살표 2개(DEC-071 ①)
    const half = T.gravityZoneSize / 2;
    const zoneGeo = g(flat(new PlaneGeometry(T.gravityZoneSize, T.gravityZoneSize)));
    const zoneEdge = g(flat(new RingGeometry(half * 1.38, half * 1.414, 4, 1, Math.PI / 4)));
    const bigArrow = g(flatArrowGeometry(T.gravityZoneSize * 0.62, T.gravityZoneSize * 0.36));
    const smallArrow = g(flatArrowGeometry(2.6, 1.6));
    const zoneMat = translucent(0x6fb3d9, 0.18);
    const zoneEdgeMat = translucent(0x6fb3d9, 0.65);
    const bigArrowMat = translucent(0xeaf6ff, 0.85);
    const smallArrowMat = translucent(0xeaf6ff, 0.55);
    this.pool('gravity_zone', () => {
      const grp = new Group();
      const plane = new Mesh(zoneGeo, zoneMat);
      plane.position.y = FLOOR_Y;
      const edge = new Mesh(zoneEdge, zoneEdgeMat);
      edge.position.y = FLOOR_Y + 0.01;
      edge.name = 'square';
      plane.name = 'squarePlane';
      const dir = new Group();
      dir.name = 'dir';
      const big = new Mesh(bigArrow, bigArrowMat);
      big.position.y = FLOOR_Y + 0.02;
      const flow = new Group();
      flow.name = 'flow';
      for (const side of [1, -1]) {
        const c = new Mesh(smallArrow, smallArrowMat);
        c.position.set(0, FLOOR_Y + 0.03, side * half * 0.62);
        flow.add(c);
      }
      dir.add(big, flow);
      grp.add(plane, edge, dir);
      return grp;
    });

    // 미끄럼 장판: 얼음빛 원 + 테두리 + 반짝이는 줄(DEC-071 ②, 끈끈이 지름의 2배)
    const iceR = T.iceFloorDiameter / 2;
    const iceDisc = g(flat(new CircleGeometry(iceR, 64)));
    const iceRing = g(flat(new RingGeometry(iceR - 0.4, iceR, 64)));
    const iceGlint = g(flat(new PlaneGeometry(iceR * 1.1, 0.35)));
    const iceMat = translucent(0xbfe8ff, 0.3);
    const iceRingMat = translucent(0xe6f7ff, 0.8);
    const iceGlintMat = translucent(0xffffff, 0.5);
    this.pool('ice_floor', () => {
      const grp = new Group();
      const disc = new Mesh(iceDisc, iceMat);
      disc.position.y = FLOOR_Y - 0.02;
      disc.name = 'disc';
      const ring = new Mesh(iceRing, iceRingMat);
      ring.position.y = FLOOR_Y - 0.01;
      const glints = new Group();
      glints.name = 'glints';
      for (const [gx, gz, rot] of [
        [-iceR * 0.2, -iceR * 0.35, 0.6],
        [iceR * 0.25, iceR * 0.2, 0.6],
        [-iceR * 0.05, iceR * 0.5, 0.6],
      ] as const) {
        const gl = new Mesh(iceGlint, iceGlintMat);
        gl.position.set(gx, FLOOR_Y, gz);
        gl.rotation.y = rot;
        gl.scale.x = 0.5 + Math.abs(gx / iceR);
        glints.add(gl);
      }
      grp.add(disc, ring, glints);
      return grp;
    });

    // 방향 반전: 보라 원 + 서로 반대 방향 화살표 둘이 도는 모양
    const revR = T.reverseZoneDiameter / 2;
    const revDisc = g(flat(new CircleGeometry(revR, 40)));
    const revRing = g(flat(new RingGeometry(revR - 0.3, revR, 40)));
    const revArrow = g(flat(new ConeGeometry(0.9, 1.8, 3)));
    const revMat = translucent(0x9b6fd9, 0.2);
    const revRingMat = translucent(0x9b6fd9, 0.75);
    this.pool('reverse_zone', () => {
      const grp = new Group();
      const disc = new Mesh(revDisc, revMat);
      disc.position.y = FLOOR_Y;
      const ring = new Mesh(revRing, revRingMat);
      ring.position.y = FLOOR_Y + 0.01;
      const spin = new Group();
      spin.name = 'spin';
      for (const s of [1, -1]) {
        const a = new Mesh(revArrow, revRingMat);
        a.position.set(s * revR * 0.55, FLOOR_Y + 0.02, 0);
        a.rotation.y = s > 0 ? 0 : Math.PI;
        spin.add(a);
      }
      grp.add(disc, ring, spin);
      return grp;
    });

    // 폭탄: 검은 공 + 깜빡이는 붉은 불빛
    const mineBody = g(new SphereGeometry(T.mineRadius, 16, 12));
    const mineLight = g(new SphereGeometry(0.35, 8, 6));
    const mineBodyMat = m(
      new MeshStandardMaterial({ color: 0x22201f, roughness: 0.5, metalness: 0.3 }),
    );
    const mineLightMat = m(new MeshBasicMaterial({ color: 0xff4a2e, transparent: true }));
    this.pool('mine', () => {
      const grp = new Group();
      const body = new Mesh(mineBody, mineBodyMat);
      body.position.y = T.mineRadius * 0.7;
      body.scale.y = 0.7;
      body.castShadow = true;
      const light = new Mesh(mineLight, mineLightMat);
      light.position.y = T.mineRadius * 1.25;
      light.name = 'light';
      grp.add(body, light);
      return grp;
    });

    // 구멍: 짙은 원 + 안쪽으로 갈수록 어두운 테
    const pitR = T.pitDiameter / 2;
    const pitHole = g(flat(new CircleGeometry(pitR, 40)));
    const pitRim = g(flat(new RingGeometry(pitR, pitR + 0.5, 40)));
    const pitMat = m(new MeshBasicMaterial({ color: 0x050505 }));
    const pitRimMat = translucent(0x3a2a1c, 0.8);
    this.pool('pit', () => {
      const grp = new Group();
      const hole = new Mesh(pitHole, pitMat);
      hole.position.y = FLOOR_Y + 0.015;
      const rim = new Mesh(pitRim, pitRimMat);
      rim.position.y = FLOOR_Y + 0.01;
      grp.add(hole, rim);
      return grp;
    });

    // 이동 장애물 경로: 벽이 쓸고 지나가는 직사각형을 옅게
    const track = g(
      flat(new PlaneGeometry(2 * T.movingWallAmplitude + T.wallThickness, T.wallLength)),
    );
    const trackMat = translucent(0xd9694f, 0.12);
    this.pool('moving_track', () => {
      const grp = new Group();
      const plane = new Mesh(track, trackMat);
      plane.position.y = FLOOR_Y;
      grp.add(plane);
      return grp;
    });

    // 분신술 허상(시전자 화면): 반투명 알. 상대 화면에서는 일반 알로 그려진다
    const ghost = g(new CylinderGeometry(R, R, R * 0.9, 24));
    const ghostMat = m(
      new MeshStandardMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    this.pool('decoy', () => {
      const grp = new Group();
      const body = new Mesh(ghost, ghostMat);
      body.position.y = STONE_REST_Y;
      grp.add(body);
      return grp;
    });
  }

  private pool(kind: ZoneKind, make: () => Group): void {
    this.pools.set(kind, { make, items: [], used: 0 });
  }

  private take(kind: ZoneKind): Group {
    const p = this.pools.get(kind)!;
    let grp = p.items[p.used];
    if (!grp) {
      grp = p.make();
      p.items.push(grp);
      this.group.add(grp);
    }
    p.used++;
    grp.visible = true;
    return grp;
  }

  /**
   * @param timeSec 화면 시각(초). 깜빡임·흐름 애니메이션에 쓴다
   */
  update(items: readonly ZoneDraw[], count: number, timeSec: number) {
    for (const p of this.pools.values()) p.used = 0;
    for (let i = 0; i < count; i++) {
      const it = items[i];
      if (!it) continue;
      const grp = this.take(it.kind);
      grp.position.set(it.x, 0, -it.y);
      const s = grow(it.age);
      switch (it.kind) {
        case 'magnet': {
          grp.scale.set(s, 1, s);
          const pulse = grp.getObjectByName('pulse');
          if (pulse) {
            const q = 1 - ((timeSec * 0.8) % 1) * 0.5;
            pulse.scale.set(q, 1, q);
          }
          break;
        }
        case 'gravity_zone': {
          grp.scale.set(s, 1, s);
          for (const name of ['square', 'squarePlane']) {
            const o = grp.getObjectByName(name);
            if (o) o.rotation.y = it.angle;
          }
          const dir = grp.getObjectByName('dir');
          if (dir) dir.rotation.y = it.dir;
          const flow = grp.getObjectByName('flow');
          if (flow) {
            // 작은 화살표가 방향을 따라 흐른다(구역 안에서 되풀이)
            const half = T.gravityZoneSize / 2 - 1.6;
            flow.position.x = (((timeSec * 0.6) % 1) * 2 - 1) * half;
          }
          break;
        }
        case 'ice_floor': {
          grp.scale.set(s, 1, s);
          const disc = grp.getObjectByName('disc') as Mesh | undefined;
          const mat = disc?.material as MeshBasicMaterial | undefined;
          if (mat) mat.opacity = 0.28 + Math.sin(timeSec * 2) * 0.05;
          const glints = grp.getObjectByName('glints');
          if (glints) glints.rotation.y = Math.sin(timeSec * 0.5) * 0.08;
          break;
        }
        case 'reverse_zone': {
          grp.scale.set(s, 1, s);
          const spin = grp.getObjectByName('spin');
          if (spin) spin.rotation.y = timeSec * 2;
          break;
        }
        case 'mine': {
          grp.scale.setScalar(s);
          const light = grp.getObjectByName('light') as Mesh | undefined;
          const mat = light?.material as MeshBasicMaterial | undefined;
          if (mat) mat.opacity = 0.35 + 0.65 * (Math.sin(timeSec * 8) > 0 ? 1 : 0);
          break;
        }
        case 'pit':
          grp.scale.set(s, 1, s);
          break;
        case 'moving_track':
          // 경로 직사각형의 긴 변이 왕복 축(벽에 수직)이다
          grp.rotation.y = it.angle + Math.PI / 2;
          break;
        case 'decoy':
          break;
      }
    }
    for (const p of this.pools.values()) {
      for (let i = p.used; i < p.items.length; i++) {
        const grp = p.items[i];
        if (grp) grp.visible = false;
      }
    }
  }

  dispose() {
    for (const geo of this.geos) geo.dispose();
    for (const mat of this.mats) mat.dispose();
  }
}
