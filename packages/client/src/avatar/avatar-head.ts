// 사람 아바타 3D 머리: 코드 도형(두상·귀·머리카락) + 이목구비 캔버스 텍스처(DEC-059).
// 머리 중심이 원점이고 +Z가 얼굴 앞, +Y가 위다. 반지름 r은 두상 배율 적용 전 기준값이다.
// 얼굴 텍스처는 앞쪽 구 조각에 정면 평행 투영 UV로 붙여 2D SVG 얼굴과 같은 배치가 되게 한다.
import {
  hairHiddenByHat,
  jawScale,
  resolveAvatar,
  type Appearance,
  type ResolvedAvatar,
} from '@alkkagi/shared';
import {
  CanvasTexture,
  CylinderGeometry,
  TorusGeometry,
  ConeGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import { NEUTRAL_FACE, paintFace, type FaceExpression } from './face-paint.ts';

const TEX = 512;

export class AvatarHead {
  readonly group = new Group();
  readonly parts: ResolvedAvatar;
  /** 투명도 조절 대상(머리·귀·머리카락·얼굴 텍스처) */
  readonly materials: MeshStandardMaterial[] = [];
  /** 이목구비 텍스처 재질 */
  readonly faceMaterial: MeshStandardMaterial;
  private readonly geos: BufferGeometry[] = [];
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly tex: CanvasTexture;
  private faceKey = '';
  private readonly r: number;

  constructor(appearance: Appearance, r: number) {
    this.r = r;
    this.parts = resolveAvatar(appearance);
    const { headShape: H, skinTone: S, hair } = this.parts;

    const skin = this.mat(S.base, 0.7);
    // 두상
    const head = new SphereGeometry(r, 32, 22);
    this.deform(head, 1);
    this.add(head, skin);

    // 얼굴 텍스처 조각(앞쪽 약 130°)
    this.canvas = document.createElement('canvas');
    this.canvas.width = TEX;
    this.canvas.height = TEX;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    this.ctx = ctx;
    this.tex = new CanvasTexture(this.canvas);
    this.tex.colorSpace = SRGBColorSpace;
    this.tex.anisotropy = 4;
    const faceMat = new MeshStandardMaterial({
      map: this.tex,
      transparent: true,
      roughness: 0.7,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    this.materials.push(faceMat);
    this.faceMaterial = faceMat;
    const cap = new SphereGeometry(r, 32, 22, Math.PI / 2 - 1.15, 2.3, 0.35, 2.45);
    this.deform(cap, 1.006);
    this.planarUV(cap);
    this.add(cap, faceMat).renderOrder = 1;

    // 귀
    const earX = r * H.sx * jawScale(0.08, H.jaw) * 0.96;
    for (const sx of [-1, 1]) {
      const ear = this.add(new SphereGeometry(r * 0.16, 14, 10), skin);
      ear.position.set(sx * earX, -r * 0.06, -r * 0.05);
      ear.scale.set(0.55, 1.15, 0.8);
      const inner = this.add(new SphereGeometry(r * 0.09, 10, 8), this.mat(S.shade, 0.8));
      inner.position.set(sx * (earX + r * 0.05), -r * 0.06, r * 0.0);
      inner.scale.set(0.4, 1.1, 0.7);
    }

    const hatOn = this.parts.hat.kind !== 'none';
    if (!hairHiddenByHat(hair, this.parts.hat))
      this.buildHair(hair.style, this.mat(hair.color, 0.55), hatOn);
    this.buildHat();
    this.setExpression(NEUTRAL_FACE);
  }

  /** 표정을 바꾼다. 같은 표정이면 다시 그리지 않는다(눈썹 값은 0.05 단위로 끊어 다시 그리는 횟수를 줄인다) */
  setExpression(ex: FaceExpression) {
    const q = (v: number) => Math.round(v * 20) / 20;
    const key = `${ex.eyes}|${ex.mouth}|${ex.blink ? 1 : 0}|${q(ex.brow)}|${q(ex.browUp)}|${ex.browAsym ?? 0}`;
    if (key === this.faceKey) return;
    this.faceKey = key;
    paintFace(this.ctx, TEX, this.parts, {
      ...ex,
      brow: q(ex.brow),
      browUp: q(ex.browUp),
    });
    this.tex.needsUpdate = true;
  }

  dispose() {
    for (const g of this.geos) g.dispose();
    for (const m of this.materials) m.dispose();
    this.tex.dispose();
  }

  // ───── 도우미 ─────

  private mat(color: string, roughness: number): MeshStandardMaterial {
    const m = new MeshStandardMaterial({ color, roughness, transparent: true });
    this.materials.push(m);
    return m;
  }

  private add(geo: BufferGeometry, mat: Material, parent: Group = this.group): Mesh {
    this.geos.push(geo);
    const m = new Mesh(geo, mat);
    // 머리는 그림자를 드리우기만 한다. 받게 하면 작은 곡면(특히 양면 머리카락)에 그림자 줄무늬가 생긴다
    m.castShadow = true;
    m.receiveShadow = false;
    parent.add(m);
    return m;
  }

  /** 두상 변형: 가로·앞뒤 sx, 세로 sy, 아래쪽 턱 좁힘. grow로 표면 바깥에 살짝 띄운다 */
  private deform(geo: BufferGeometry, grow: number, front = 0.94) {
    const H = this.parts.headShape;
    const pos = geo.attributes.position;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const j = jawScale(-y / this.r, H.jaw);
      pos.setXYZ(
        i,
        x * H.sx * j * grow,
        y * H.sy * grow,
        z * H.sx * front * (0.5 + 0.5 * j) * grow,
      );
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }

  /** 정면 평행 투영 UV: 얼굴 좌표 [-50, 50]²(= 반지름 r)를 텍스처 전체에 대응 */
  private planarUV(geo: BufferGeometry) {
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    if (!pos || !uv) return;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, 0.5 + pos.getX(i) / (2 * this.r), 0.5 + pos.getY(i) / (2 * this.r));
    }
    uv.needsUpdate = true;
  }

  /**
   * 모자(DEC-078). 두상 배율에 맞춰 머리에 얹는다. 모자 반지름이 머리카락 껍질(1.14)보다 커서 단발·긴 머리는
   * 모자 아래로만 보인다. 야구 모자·비니는 뒤로 기울여 쓰고(앞 가장자리가 눈썹 위), 밀짚·마법사 모자는 챙이 눈썹 위에 뜬다.
   */
  private buildHat() {
    const hat = this.parts.hat;
    if (hat.kind === 'none') return;
    const r = this.r;
    const H = this.parts.headShape;
    const main = this.mat(hat.color, 0.8);
    const accent = this.mat(hat.accent, 0.7);
    main.side = DoubleSide;
    accent.side = DoubleSide;
    const g = new Group();
    const k = 1.16;
    g.scale.set(H.sx * k, H.sy * k, H.sx * k);
    g.position.y = r * 0.1 * H.sy;
    const dome = (radius: number, scaleY = 1) => {
      const geo = new SphereGeometry(radius, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
      const m = this.add(geo, main, g);
      m.scale.y = scaleY;
      return m;
    };
    switch (hat.kind) {
      case 'cap': {
        g.rotation.x = -0.42;
        dome(r);
        // 챙: 앞쪽 반원 판을 살짝 아래로 숙인다
        const bill = this.add(
          new CylinderGeometry(r * 0.82, r * 0.82, r * 0.07, 20, 1, false, -Math.PI / 2, Math.PI),
          accent,
          g,
        );
        bill.position.set(0, r * 0.02, r * 0.6);
        bill.rotation.x = 0.3;
        this.add(new SphereGeometry(r * 0.1, 10, 8), accent, g).position.y = r * 1.0;
        break;
      }
      case 'beanie': {
        g.rotation.x = -0.42;
        dome(r);
        const cuff = this.add(new TorusGeometry(r * 1.0, r * 0.13, 8, 32), accent, g);
        cuff.rotation.x = Math.PI / 2;
        cuff.position.y = r * 0.02;
        this.add(new SphereGeometry(r * 0.3, 12, 10), accent, g).position.y = r * 1.04;
        break;
      }
      case 'straw': {
        g.rotation.x = -0.18;
        g.position.y += r * 0.1;
        const brim = this.add(new CylinderGeometry(r * 1.75, r * 1.75, r * 0.05, 32), main, g);
        brim.position.y = 0;
        dome(r * 0.92, 0.95);
        const band = this.add(new TorusGeometry(r * 0.92, r * 0.07, 8, 32), accent, g);
        band.rotation.x = Math.PI / 2;
        band.position.y = r * 0.1;
        break;
      }
      case 'wizard': {
        g.rotation.x = -0.18;
        g.position.y += r * 0.1;
        const brim = this.add(new CylinderGeometry(r * 1.9, r * 1.9, r * 0.05, 32), main, g);
        brim.position.y = 0;
        const cone = new ConeGeometry(r * 0.95, r * 2.2, 24);
        cone.translate(0, r * 1.1, 0);
        this.add(cone, main, g);
        const band = this.add(new TorusGeometry(r * 0.95, r * 0.08, 8, 32), accent, g);
        band.rotation.x = Math.PI / 2;
        band.position.y = r * 0.1;
        break;
      }
    }
    this.group.add(g);
  }

  /** hatOn이면 모자 아래로 보이는 옆·뒤 머리만 만든다(정수리 덮개를 만들지 않고 껍질을 귀 높이부터 시작한다, DEC-078) */
  private buildHair(
    style: ResolvedAvatar['hair']['style'],
    hairMat: MeshStandardMaterial,
    hatOn = false,
  ) {
    const r = this.r;
    hairMat.side = DoubleSide;
    switch (style) {
      case 'bald':
        return;
      case 'crop': {
        // 정수리 덮개를 뒤로 기울여 앞은 이마 위, 뒤는 목덜미까지 덮는다
        const cap = new SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
        cap.rotateX(-0.42);
        this.deform(cap, 1.07, 0.98);
        this.add(cap, hairMat);
        // 옆으로 넘긴 앞머리: 덮개 하나를 더 기울여 이마 한쪽을 비스듬히 덮는다
        const sweep = new SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.33);
        sweep.rotateX(0.12);
        sweep.rotateZ(0.36);
        this.deform(sweep, 1.075, 0.98);
        this.add(sweep, hairMat);
        return;
      }
      case 'bob': {
        // 옆·뒤를 턱 높이까지 감싸는 껍질(얼굴 앞은 비움) + 일자 앞머리 덮개
        const shell = new SphereGeometry(
          r,
          28,
          18,
          Math.PI / 2 + 0.8,
          Math.PI * 2 - 1.6,
          hatOn ? Math.PI * 0.46 : 0,
          hatOn ? Math.PI * 0.24 : Math.PI * 0.7,
        );
        this.deform(shell, 1.14, 1.02);
        this.add(shell, hairMat);
        const cap = new SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, 1.22);
        this.deform(cap, 1.1, 1);
        if (!hatOn) this.add(cap, hairMat);
        return;
      }
      case 'spiky': {
        // 짧은 덮개 + 위·뒤로 뻗은 뾰족한 머리 뭉치
        const cap = new SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
        cap.rotateX(-0.36);
        this.deform(cap, 1.07, 0.98);
        this.add(cap, hairMat);
        const spikes: [number, number, number][] = [
          // [옆 각도, 앞뒤 기울기, 길이 배율]
          [0, -0.15, 1.1],
          [-0.55, -0.05, 0.95],
          [0.55, -0.05, 0.95],
          [-1.0, 0.25, 0.8],
          [1.0, 0.25, 0.8],
          [-0.3, 0.55, 0.9],
          [0.3, 0.55, 0.9],
          [0, 0.85, 0.8],
        ];
        for (const [side, back, len] of spikes) {
          const cone = new ConeGeometry(r * 0.24, r * 0.62 * len, 10);
          cone.translate(0, r * 0.31 * len, 0);
          const m = this.add(cone, hairMat);
          m.position.set(0, r * 0.82 * this.parts.headShape.sy, 0);
          m.rotation.set(-back, 0, -side * 0.75);
          m.position.x = Math.sin(side * 0.6) * r * 0.45;
          m.position.z = -back * r * 0.45 + r * 0.12;
        }
        return;
      }
      case 'long': {
        // 어깨 아래까지 내려오는 긴 머리: 얼굴 앞을 비운 긴 껍질 + 가르마 덮개
        const shell = new SphereGeometry(
          r,
          28,
          18,
          Math.PI / 2 + 0.7,
          Math.PI * 2 - 1.4,
          hatOn ? Math.PI * 0.46 : 0,
          hatOn ? Math.PI * 0.26 : Math.PI * 0.72,
        );
        this.deform(shell, 1.14, 1.02);
        // 아래쪽을 늘려 어깨까지 내린다
        const pos = shell.attributes.position;
        if (pos) {
          for (let i = 0; i < pos.count; i++) {
            const y = pos.getY(i);
            if (y < 0) pos.setY(i, y * 2.1);
          }
          pos.needsUpdate = true;
          shell.computeVertexNormals();
        }
        this.add(shell, hairMat);
        const cap = new SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, 1.0);
        cap.rotateX(-0.2);
        this.deform(cap, 1.1, 1);
        if (!hatOn) this.add(cap, hairMat);
        return;
      }
    }
  }
}
