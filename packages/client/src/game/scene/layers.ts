// 알·설치물·조준 표시를 담는 three 객체 묶음. 객체는 한 번 만들어 재사용하고 프레임마다 값만 바꾼다.
// 이 묶음들은 "최신 스냅샷 좌표계"를 담는 회전 그룹 안에 들어가므로 위치는 서버 좌표(X=x, Z=-y)를 쓴다.
import { HAZARD_TUNING, PHYSICS, type Seat } from '@alkkagi/shared';
import {
  BoxGeometry,
  CircleGeometry,
  ConeGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import type { AimRenderState, PlacementRenderState } from './scene-contract.ts';
import { fallScale, type FallState } from './fall.ts';
import { powerColor, STONE_FLATNESS } from './scene-math.ts';
import type { SampledStone } from './snapshot-buffer.ts';
import type { StoneKit } from './stage.ts';

const R = PHYSICS.stoneRadius;
/** 판 위에 놓인 알 중심 높이 */
export const STONE_REST_Y = R * STONE_FLATNESS;

interface StoneSlot {
  group: Group;
  body: Mesh;
  decal: Mesh;
  /** 이 프레임에 쓰였는가 */
  used: boolean;
  id: number;
}

export class StoneLayer {
  readonly group = new Group();
  private readonly slots: StoneSlot[] = [];
  private readonly byId = new Map<number, StoneSlot>();
  private readonly ring: Mesh;
  private readonly ringGeo: RingGeometry;
  private readonly ringMat: MeshBasicMaterial;

  constructor(
    private readonly kit: StoneKit,
    capacity: number,
  ) {
    for (let i = 0; i < capacity; i++) this.slots.push(this.createSlot());
    this.ringGeo = new RingGeometry(R * 1.25, R * 1.7, 32);
    this.ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new MeshBasicMaterial({
      color: 0xffe14d,
      transparent: true,
      opacity: 0.95,
      depthTest: false,
    });
    this.ring = new Mesh(this.ringGeo, this.ringMat);
    this.ring.renderOrder = 5;
    this.ring.visible = false;
    this.group.add(this.ring);
  }

  private createSlot(): StoneSlot {
    const group = new Group();
    const body = new Mesh(this.kit.bodyGeo, this.kit.bodyMine);
    body.scale.y = STONE_FLATNESS;
    body.castShadow = true;
    body.receiveShadow = true;
    const decal = new Mesh(this.kit.decalGeo, this.kit.decalMine);
    decal.position.y = R * STONE_FLATNESS + 0.01;
    decal.scale.y = 1;
    group.add(body, decal);
    group.visible = false;
    this.group.add(group);
    return { group, body, decal, used: false, id: -1 };
  }

  private acquire(id: number, owner: Seat, mySeat: Seat): StoneSlot | null {
    let slot = this.byId.get(id);
    if (!slot) {
      slot = this.slots.find((s) => !s.used && !s.group.visible) ?? this.slots.find((s) => !s.used);
      if (!slot) {
        slot = this.createSlot();
        this.slots.push(slot);
      }
      this.byId.set(id, slot);
      slot.id = id;
    }
    slot.used = true;
    const mine = owner === mySeat;
    slot.body.material = mine ? this.kit.bodyMine : this.kit.bodyOpp;
    slot.decal.material = mine ? this.kit.decalMine : this.kit.decalOpp;
    return slot;
  }

  update(
    samples: readonly SampledStone[],
    count: number,
    falls: readonly FallState[],
    mySeat: Seat,
    selectedId: number | null,
  ) {
    for (const s of this.slots) s.used = false;
    this.ring.visible = false;
    for (let i = 0; i < count; i++) {
      const st = samples[i];
      if (!st) continue;
      const slot = this.acquire(st.id, st.owner, mySeat);
      if (!slot) continue;
      const g = slot.group;
      g.visible = true;
      g.position.set(st.x, STONE_REST_Y + st.h, -st.y);
      g.rotation.set(0, 0, 0);
      g.scale.setScalar(1);
      if (st.id === selectedId) {
        this.ring.visible = true;
        this.ring.position.set(st.x, STONE_REST_Y * 0.4, -st.y);
      }
    }
    for (const f of falls) {
      const slot = this.acquire(f.id, f.owner, mySeat);
      if (!slot) continue;
      const g = slot.group;
      g.visible = true;
      g.position.set(f.x, STONE_REST_Y + f.z, -f.y);
      g.rotation.set(f.rotX, 0, f.rotZ);
      g.scale.setScalar(fallScale(f));
    }
    for (const s of this.slots) {
      if (!s.used) {
        s.group.visible = false;
        if (this.byId.get(s.id) === s) this.byId.delete(s.id);
      }
    }
  }

  dispose() {
    this.ringGeo.dispose();
    this.ringMat.dispose();
  }
}

/** 설치물(벽·끈끈이) 그리기에 필요한 값 */
export interface HazardDraw {
  kind: 'wall' | 'sticky';
  x: number;
  y: number;
  /** 서버 좌표계 라디안(반시계). 끈끈이는 무시 */
  angle: number;
}

const WALL_H = 1.8;

export class HazardLayer {
  readonly group = new Group();
  private readonly walls: Mesh[] = [];
  private readonly stickies: Mesh[] = [];
  private readonly wallGeo = new BoxGeometry(
    HAZARD_TUNING.wallLength,
    WALL_H,
    HAZARD_TUNING.wallThickness,
  );
  private readonly stickyGeo = new CircleGeometry(HAZARD_TUNING.stickyDiameter / 2, 40);
  private readonly wallMat = new MeshStandardMaterial({
    color: 0x8a8f99,
    roughness: 0.45,
    metalness: 0.3,
  });
  private readonly stickyMat = new MeshStandardMaterial({
    color: 0xe8a21c,
    roughness: 0.15,
    transparent: true,
    opacity: 0.78,
    emissive: 0x3a2200,
  });

  constructor() {
    this.stickyGeo.rotateX(-Math.PI / 2);
  }

  private pool(list: Mesh[], geo: BufferGeometry, mat: Material, n: number) {
    while (list.length < n) {
      const m = new Mesh(geo, mat);
      m.castShadow = geo === this.wallGeo;
      m.receiveShadow = true;
      m.visible = false;
      this.group.add(m);
      list.push(m);
    }
  }

  update(items: readonly HazardDraw[], count: number) {
    let w = 0;
    let s = 0;
    for (let i = 0; i < count; i++) {
      const it = items[i];
      if (!it) continue;
      if (it.kind === 'wall') {
        this.pool(this.walls, this.wallGeo, this.wallMat, w + 1);
        const m = this.walls[w++];
        if (!m) continue;
        m.visible = true;
        m.position.set(it.x, WALL_H / 2, -it.y);
        m.rotation.y = it.angle;
      } else {
        this.pool(this.stickies, this.stickyGeo, this.stickyMat, s + 1);
        const m = this.stickies[s++];
        if (!m) continue;
        m.visible = true;
        m.position.set(it.x, 0.04, -it.y);
      }
    }
    for (let i = w; i < this.walls.length; i++) {
      const m = this.walls[i];
      if (m) m.visible = false;
    }
    for (let i = s; i < this.stickies.length; i++) {
      const m = this.stickies[i];
      if (m) m.visible = false;
    }
  }

  dispose() {
    this.wallGeo.dispose();
    this.stickyGeo.dispose();
    this.wallMat.dispose();
    this.stickyMat.dispose();
  }
}

const AIM_LEN = 32;
const BAR_H = 11;
const BAR_W = 1.5;

/** 조준선·세기 막대·배치 미리보기 */
export class AimLayer {
  readonly group = new Group();
  private readonly line: Mesh;
  private readonly tip: Mesh;
  private readonly bar = new Group();
  private readonly barBg: Mesh;
  private readonly barFill: Mesh;
  private readonly previewWall: Mesh;
  private readonly previewSticky: Mesh;
  private readonly previewMat = new MeshBasicMaterial({
    color: 0x35d06a,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  private readonly lineMat = new MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.8,
    depthTest: false,
  });
  private readonly barBgMat = new MeshBasicMaterial({
    color: 0x10131a,
    transparent: true,
    opacity: 0.6,
    depthTest: false,
  });
  private readonly barFillMat = new MeshBasicMaterial({
    color: 0x50dc3c,
    transparent: true,
    depthTest: false,
  });
  private readonly geos: BufferGeometry[] = [];

  constructor() {
    const g = <T extends BufferGeometry>(geo: T): T => {
      this.geos.push(geo);
      return geo;
    };
    this.line = new Mesh(g(new BoxGeometry(AIM_LEN, 0.12, 0.28)), this.lineMat);
    this.line.renderOrder = 6;
    this.tip = new Mesh(g(new ConeGeometry(0.9, 2.2, 3)), this.lineMat);
    this.tip.renderOrder = 6;
    this.tip.rotation.z = -Math.PI / 2;
    const bgGeo = g(new PlaneGeometry(BAR_W + 0.5, BAR_H + 0.5));
    this.barBg = new Mesh(bgGeo, this.barBgMat);
    this.barBg.position.y = BAR_H / 2;
    this.barBg.renderOrder = 7;
    // 채움은 바닥 기준으로 늘어나도록 지오메트리 원점을 아래로 옮긴다
    const fillGeo = g(new PlaneGeometry(BAR_W, BAR_H));
    fillGeo.translate(0, BAR_H / 2, 0);
    this.barFill = new Mesh(fillGeo, this.barFillMat);
    this.barFill.position.z = 0.02;
    this.barFill.renderOrder = 8;
    this.bar.add(this.barBg, this.barFill);

    this.previewWall = new Mesh(
      g(new BoxGeometry(HAZARD_TUNING.wallLength, WALL_H, HAZARD_TUNING.wallThickness)),
      this.previewMat,
    );
    const stickyGeo = g(new CircleGeometry(HAZARD_TUNING.stickyDiameter / 2, 40));
    stickyGeo.rotateX(-Math.PI / 2);
    this.previewSticky = new Mesh(stickyGeo, this.previewMat);
    this.previewWall.renderOrder = 4;
    this.previewSticky.renderOrder = 4;
    this.group.add(this.line, this.tip, this.bar, this.previewWall, this.previewSticky);
    this.hideAll();
  }

  private hideAll() {
    this.line.visible = false;
    this.tip.visible = false;
    this.bar.visible = false;
    this.previewWall.visible = false;
    this.previewSticky.visible = false;
  }

  /**
   * @param stone 조준 중인 알의 현재 표시 위치(서버 좌표계). 없으면 조준 표시를 숨긴다
   * @param counterYaw 회전 그룹의 회전을 상쇄해 막대가 카메라를 향하게 하는 각(라디안)
   */
  update(
    aim: AimRenderState | null,
    stone: { x: number; y: number; h: number } | null,
    placement: PlacementRenderState | null,
    mySeat: Seat,
    counterYaw: number,
  ) {
    this.hideAll();
    if (aim && stone) {
      const y0 = STONE_REST_Y + stone.h;
      this.line.visible = true;
      this.line.position.set(
        stone.x + Math.cos(aim.angle) * (R + AIM_LEN / 2),
        y0,
        -(stone.y + Math.sin(aim.angle) * (R + AIM_LEN / 2)),
      );
      this.line.rotation.y = aim.angle;
      this.tip.visible = true;
      this.tip.position.set(
        stone.x + Math.cos(aim.angle) * (R + AIM_LEN + 1),
        y0,
        -(stone.y + Math.sin(aim.angle) * (R + AIM_LEN + 1)),
      );
      this.tip.rotation.y = aim.angle;
      // 세기 막대: 화면 기준으로 알의 오른쪽에 세운다. 후공 화면은 180도 돌았으므로 X 부호가 반대다.
      const side = mySeat === 0 ? 1 : -1;
      this.bar.visible = true;
      this.bar.position.set(stone.x + side * (R + 2.6), y0 - 0.3, -stone.y);
      this.bar.rotation.set(0, (mySeat === 0 ? 0 : Math.PI) - counterYaw, 0);
      const p = Math.min(100, Math.max(0, aim.power)) / 100;
      this.barFill.scale.y = Math.max(0.0001, p);
      this.barFill.visible = p > 0;
      this.barFillMat.color.setHex(aim.charging ? powerColor(aim.power) : 0x8fa3c4);
    }
    if (placement) {
      this.previewMat.color.setHex(placement.valid ? 0x35d06a : 0xe0463c);
      if (placement.kind === 'wall') {
        this.previewWall.visible = true;
        this.previewWall.position.set(placement.x, WALL_H / 2, -placement.y);
        this.previewWall.rotation.y = placement.orientation === 'horizontal' ? 0 : Math.PI / 2;
      } else {
        this.previewSticky.visible = true;
        this.previewSticky.position.set(placement.x, 0.08, -placement.y);
      }
    }
  }

  dispose() {
    for (const g of this.geos) g.dispose();
    for (const m of [this.previewMat, this.lineMat, this.barBgMat, this.barFillMat]) m.dispose();
  }
}
