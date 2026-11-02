// 후레쉬 빛 원뿔과 물총 물줄기. 시전자 손(총구)에서 조준점 방향으로 그리며 양쪽 화면에 똑같이 보인다.
// 원뿔 반각은 서버 판정과 같은 HAZARD_TUNING.blindBeamHalfAngleDeg다. 객체는 한 번 만들고 프레임마다 값만 바꾼다.
import { HAZARD_TUNING } from '@alkkagi/shared';
import {
  AdditiveBlending,
  Color,
  ConeGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  SpotLight,
  Vector3,
} from 'three';
import type { V3 } from './rig-math.ts';

const HALF = (HAZARD_TUNING.blindBeamHalfAngleDeg * Math.PI) / 180;
const DROPS = 72;
const WATER_SPEED = 140;
const UP = new Vector3(0, 1, 0);
const Z = new Vector3(0, 0, 1);

/** 물방울마다 고정된 퍼짐(원뿔 안 위치)과 위상 */
interface Drop {
  u: number;
  a: number;
  r: number;
  size: number;
}

export interface BlindDraw {
  kind: 'flashlight' | 'water_gun';
  /** 빛·물이 나오는 곳(월드) */
  from: V3;
  /** 조준점(월드) */
  to: V3;
  /** 등장·사라짐 세기 0~1 */
  strength: number;
}

class Caster {
  readonly group = new Group();
  private readonly beam: Mesh;
  private readonly core: Mesh;
  private readonly hit: Mesh;
  private readonly water: InstancedMesh;
  private readonly light = new SpotLight(0xfff1c2, 0, 160, HALF * 1.8, 0.5, 1);
  private readonly lightTarget = new Object3D();
  private readonly drops: Drop[] = [];
  private readonly q = new Quaternion();
  private readonly dir = new Vector3();
  private readonly side = new Vector3();
  private readonly side2 = new Vector3();
  private readonly p = new Vector3();
  private readonly s = new Vector3();
  private readonly m = new Matrix4();
  private readonly qi = new Quaternion();

  constructor(
    beamGeo: ConeGeometry,
    coreGeo: ConeGeometry,
    hitGeo: SphereGeometry,
    dropGeo: SphereGeometry,
    private readonly beamMat: MeshBasicMaterial,
    private readonly coreMat: MeshBasicMaterial,
    private readonly hitMat: MeshBasicMaterial,
    dropMat: MeshStandardMaterial,
    seed: number,
  ) {
    this.beam = new Mesh(beamGeo, beamMat);
    this.core = new Mesh(coreGeo, coreMat);
    this.hit = new Mesh(hitGeo, hitMat);
    for (const o of [this.beam, this.core, this.hit]) {
      o.renderOrder = 9;
      o.frustumCulled = false;
    }
    this.water = new InstancedMesh(dropGeo, dropMat, DROPS);
    this.water.frustumCulled = false;
    let r = seed * 9301 + 49297;
    const rnd = () => {
      r = (r * 9301 + 49297) % 233280;
      return r / 233280;
    };
    for (let i = 0; i < DROPS; i++) {
      this.drops.push({
        u: i / DROPS,
        a: rnd() * Math.PI * 2,
        r: Math.sqrt(rnd()),
        size: 0.7 + rnd() * 0.6,
      });
    }
    this.light.castShadow = false;
    this.light.target = this.lightTarget;
    this.group.add(this.beam, this.core, this.hit, this.water, this.light, this.lightTarget);
    this.hide();
  }

  hide() {
    this.beam.visible = false;
    this.core.visible = false;
    this.hit.visible = false;
    this.water.visible = false;
    this.light.intensity = 0;
  }

  update(d: BlindDraw | null, t: number) {
    if (!d || d.strength <= 0.001) {
      this.hide();
      return;
    }
    this.dir.set(d.to.x - d.from.x, d.to.y - d.from.y, d.to.z - d.from.z);
    const dist = Math.max(1, this.dir.length());
    this.dir.divideScalar(dist);
    this.q.setFromUnitVectors(UP, this.dir);
    if (d.kind === 'flashlight') {
      this.water.visible = false;
      const len = Math.min(140, dist * 1.08);
      for (const o of [this.beam, this.core]) {
        o.visible = true;
        o.position.set(d.from.x, d.from.y, d.from.z);
        o.quaternion.copy(this.q);
        o.scale.setScalar(len);
      }
      const flick = 0.92 + Math.sin(t * 31) * 0.04 + Math.sin(t * 13) * 0.04;
      this.beamMat.opacity = 0.2 * d.strength * flick;
      this.coreMat.opacity = 0.32 * d.strength * flick;
      this.hit.visible = true;
      this.hit.position.set(d.to.x, d.to.y, d.to.z);
      this.hit.scale.setScalar(Math.max(1.5, dist * Math.tan(HALF)) * 0.8);
      this.hitMat.opacity = 0.35 * d.strength;
      this.light.position.set(d.from.x, d.from.y, d.from.z);
      this.lightTarget.position.set(d.to.x, d.to.y, d.to.z);
      this.light.intensity = 900 * d.strength;
      return;
    }
    // 물총: 원뿔 안에서 퍼지며 날아가는 물방울. 약간 처지고 끝으로 갈수록 작아진다
    this.beam.visible = false;
    this.core.visible = false;
    this.hit.visible = false;
    this.light.intensity = 0;
    this.water.visible = true;
    // 진행 방향에 수직인 두 축
    this.side.set(0, 1, 0).cross(this.dir);
    if (this.side.lengthSq() < 1e-6) this.side.set(1, 0, 0);
    this.side.normalize();
    this.side2.copy(this.dir).cross(this.side).normalize();
    const len = dist + 6;
    const tanH = Math.tan(HALF) * 0.85;
    for (let i = 0; i < DROPS; i++) {
      const dr = this.drops[i];
      if (!dr) continue;
      const s = (t * WATER_SPEED + dr.u * len) % len;
      const spread = s * tanH * dr.r;
      const droop = 0.0016 * s * s;
      this.p.set(
        d.from.x +
          this.dir.x * s +
          (this.side.x * Math.cos(dr.a) + this.side2.x * Math.sin(dr.a)) * spread,
        d.from.y +
          this.dir.y * s +
          (this.side.y * Math.cos(dr.a) + this.side2.y * Math.sin(dr.a)) * spread -
          droop,
        d.from.z +
          this.dir.z * s +
          (this.side.z * Math.cos(dr.a) + this.side2.z * Math.sin(dr.a)) * spread,
      );
      const k = d.strength * dr.size * (s > dist ? Math.max(0, 1 - (s - dist) / 6) : 1);
      this.s.set(k, k, k * 2.2);
      // 물방울은 진행 방향으로 늘린다
      this.qi.setFromUnitVectors(Z, this.dir);
      this.m.compose(this.p, this.qi, this.s);
      this.water.setMatrixAt(i, this.m);
    }
    this.water.instanceMatrix.needsUpdate = true;
  }
}

export class BlindFxLayer {
  readonly group = new Group();
  private readonly casters: [Caster, Caster];
  private readonly beamGeo: ConeGeometry;
  private readonly coreGeo: ConeGeometry;
  private readonly hitGeo = new SphereGeometry(1, 16, 12);
  private readonly dropGeo = new SphereGeometry(0.45, 6, 4);
  private readonly mats: (MeshBasicMaterial | MeshStandardMaterial)[] = [];

  constructor() {
    // 꼭짓점이 원점, 밑면이 +Y 1에 오는 단위 원뿔(반지름 = tan(반각))
    const mk = (half: number) => {
      const g = new ConeGeometry(Math.tan(half), 1, 32, 1, true);
      g.translate(0, -0.5, 0);
      g.rotateX(Math.PI);
      return g;
    };
    this.beamGeo = mk(HALF);
    this.coreGeo = mk(HALF * 0.45);
    const add = (color: number) => {
      const m = new MeshBasicMaterial({
        color: new Color(color),
        transparent: true,
        opacity: 0.2,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
      });
      this.mats.push(m);
      return m;
    };
    const drop = new MeshStandardMaterial({
      color: 0x9fdcff,
      roughness: 0.05,
      metalness: 0.1,
      transparent: true,
      opacity: 0.85,
      emissive: 0x15405a,
    });
    this.mats.push(drop);
    this.casters = [0, 1].map(
      (i) =>
        new Caster(
          this.beamGeo,
          this.coreGeo,
          this.hitGeo,
          this.dropGeo,
          add(0xffe9a8),
          add(0xfff6d8),
          add(0xfff1c0),
          drop,
          i + 3,
        ),
    ) as [Caster, Caster];
    for (const c of this.casters) this.group.add(c.group);
  }

  /** 시전자 좌석별 그리기 값(없으면 null) */
  update(draws: readonly [BlindDraw | null, BlindDraw | null], timeSec: number) {
    this.casters[0].update(draws[0], timeSec);
    this.casters[1].update(draws[1], timeSec);
  }

  dispose() {
    for (const g of [this.beamGeo, this.coreGeo, this.hitGeo, this.dropGeo]) g.dispose();
    for (const m of this.mats) m.dispose();
  }
}
