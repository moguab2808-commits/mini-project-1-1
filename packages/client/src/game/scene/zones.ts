// 추가 방해요소 10종의 판 위 표시(자석·중력 구역·방향 반전·폭탄·구멍·이동 장애물 경로·미끄럼 장판·분신술 허상).
// 파일 에셋 없이 코드 도형만 쓴다. 객체는 종류별로 한 번 만들어 재사용하고 프레임마다 값만 바꾼다.
// 회전 그룹 안에 들어가므로 위치는 서버 좌표(X=x, Z=-y)이고 rotation.y는 서버 좌표계 각(반시계)이다.
// 이동 장애물 본체는 `HazardLayer`의 벽으로 그린다(GameScene이 `movingWallAt`으로 위치를 계산).
import { HAZARD_TUNING, PHYSICS, type BoardDefinition } from '@alkkagi/shared';
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
import { STONE_REST_Y } from './layers.ts';

export type ZoneKind =
  'magnet' | 'gravity_zone' | 'reverse_zone' | 'mine' | 'pit' | 'moving_track' | 'decoy';

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
  /** 미끄럼 장판 막: 정사각형 판용과 원형 판용 */
  private readonly iceSquare: Mesh;
  private readonly iceCircle: Mesh;

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

    // 중력 구역: 푸른 정사각형 + 방향 화살표 3개(흐르듯 움직인다)
    const half = T.gravityZoneSize / 2;
    const zoneGeo = g(flat(new PlaneGeometry(T.gravityZoneSize, T.gravityZoneSize)));
    const zoneEdge = g(flat(new RingGeometry(half * 1.38, half * 1.414, 4, 1, Math.PI / 4)));
    const chevron = g(flat(new ConeGeometry(1.6, 2.4, 3)));
    chevron.rotateY(-Math.PI / 2);
    const zoneMat = translucent(0x6fb3d9, 0.18);
    const zoneEdgeMat = translucent(0x6fb3d9, 0.65);
    const chevronMat = translucent(0xeaf6ff, 0.75);
    this.pool('gravity_zone', () => {
      const grp = new Group();
      const plane = new Mesh(zoneGeo, zoneMat);
      plane.position.y = FLOOR_Y;
      const edge = new Mesh(zoneEdge, zoneEdgeMat);
      edge.position.y = FLOOR_Y + 0.01;
      edge.name = 'square';
      plane.name = 'squarePlane';
      const arrows = new Group();
      arrows.name = 'arrows';
      for (let i = 0; i < 3; i++) {
        const c = new Mesh(chevron, chevronMat);
        c.position.y = FLOOR_Y + 0.02;
        arrows.add(c);
      }
      grp.add(plane, edge, arrows);
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

    // 미끄럼 장판: 판 전체를 덮는 얼음빛 막
    const iceMat = translucent(0xbfe8ff, 0.3);
    this.iceSquare = new Mesh(g(flat(new PlaneGeometry(1, 1))), iceMat);
    this.iceCircle = new Mesh(g(flat(new CircleGeometry(0.5, 64))), iceMat);
    for (const ice of [this.iceSquare, this.iceCircle]) {
      ice.position.y = FLOOR_Y - 0.02;
      ice.visible = false;
      this.group.add(ice);
    }
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
   * @param ice 미끄럼 장판이 켜져 있으면 판 정의(덮을 크기), 아니면 null
   * @param timeSec 화면 시각(초). 깜빡임·흐름 애니메이션에 쓴다
   */
  update(items: readonly ZoneDraw[], count: number, ice: BoardDefinition | null, timeSec: number) {
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
          const arrows = grp.getObjectByName('arrows');
          if (arrows) {
            arrows.rotation.y = it.dir;
            const half = T.gravityZoneSize / 2 - 1.5;
            arrows.children.forEach((c, k) => {
              const u = ((timeSec * 0.6 + k / 3) % 1) * 2 - 1;
              c.position.x = u * half;
            });
          }
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
    this.iceSquare.visible = ice?.shape === 'square';
    this.iceCircle.visible = ice?.shape === 'circle';
    if (ice) {
      const mesh = ice.shape === 'square' ? this.iceSquare : this.iceCircle;
      const size = ice.shape === 'square' ? ice.size : ice.diameter;
      mesh.scale.set(size, 1, size);
      (mesh.material as MeshBasicMaterial).opacity = 0.28 + Math.sin(timeSec * 2) * 0.05;
    }
  }

  dispose() {
    for (const geo of this.geos) geo.dispose();
    for (const mat of this.mats) mat.dispose();
  }
}
