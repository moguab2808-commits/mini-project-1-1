// 사람 아바타 옷 3D 장식(DEC-078). 몸통 원기둥과 같은 위치·기울기·납작함의 그룹(trunkFrame) 안에 붙인다.
// 전신(avatar-figure.ts)과 인게임 상반신(game/scene/characters.ts)이 같이 쓴다. 몸통·팔 색은 호출 쪽이 정한다.
import type { OutfitPart } from '@alkkagi/shared';
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three';

export interface OutfitTrunk {
  /** 몸통 원기둥 높이·위쪽 반지름·아래쪽 반지름(CylinderGeometry와 같은 뜻) */
  height: number;
  rTop: number;
  rBottom: number;
}

export interface OutfitBuilder {
  /** 몸통과 같은 변환(위치·기울기·scale.z)을 가진 그룹. 장식은 이 그룹 안에 만든다 */
  frame: Group;
  trunk: OutfitTrunk;
  /** 색으로 재질을 만든다(호출 쪽이 투명도 조절·dispose 목록에 올린다) */
  material: (color: string) => Material;
  /** 지오메트리를 등록하며 메시를 만든다(dispose 목록에 올린다) */
  mesh: (geo: BufferGeometry, mat: Material, parent: Group) => Mesh;
}

/** 옷 종류별 장식을 붙인다. 기본 티(tee)는 장식이 없다 */
export function addOutfitDetails(outfit: OutfitPart, b: OutfitBuilder) {
  const { height: h, rTop, rBottom } = b.trunk;
  /** 몸통 로컬 y(−h/2~h/2)에서의 반지름 */
  const radiusAt = (y: number) => rBottom + ((rTop - rBottom) * (y + h / 2)) / h;
  const accent = b.material(outfit.accent);
  const thin = rTop * 0.07;
  switch (outfit.kind) {
    case 'tee':
      return;
    case 'stripe': {
      for (const f of [0.18, 0.38, 0.58, 0.78]) {
        const y = -h / 2 + f * h;
        const band = h * 0.07;
        const ring = new CylinderGeometry(
          radiusAt(y + band / 2) + thin,
          radiusAt(y - band / 2) + thin,
          band,
          20,
        );
        b.mesh(ring, accent, b.frame).position.y = y;
      }
      return;
    }
    case 'hoodie': {
      // 앞주머니와 목 뒤로 늘어진 후드
      const y = -h * 0.2;
      const pocket = b.mesh(new BoxGeometry(rTop * 1.2, h * 0.2, thin), accent, b.frame);
      pocket.position.set(0, y, radiusAt(y) + thin * 0.5);
      const hood = b.mesh(new SphereGeometry(rTop * 0.62, 14, 10), accent, b.frame);
      hood.scale.set(1.2, 0.8, 0.8);
      hood.position.set(0, h / 2 - rTop * 0.1, -radiusAt(h / 2) * 0.95);
      return;
    }
    case 'shirt': {
      // 넥타이: 가슴 앞 긴 판 + 매듭
      const y = h * 0.14;
      const tie = b.mesh(new BoxGeometry(rTop * 0.3, h * 0.46, thin), accent, b.frame);
      tie.position.set(0, y, radiusAt(y) + thin * 0.5);
      const ky = h * 0.4;
      const knot = b.mesh(new BoxGeometry(rTop * 0.4, h * 0.07, thin * 1.3), accent, b.frame);
      knot.position.set(0, ky, radiusAt(ky) + thin * 0.6);
      return;
    }
    case 'robe': {
      // 금색 허리띠와 별 장식 세 개
      const by = -h * 0.12;
      const belt = new CylinderGeometry(
        radiusAt(by + h * 0.03) + thin,
        radiusAt(by - h * 0.03) + thin,
        h * 0.06,
        20,
      );
      b.mesh(belt, accent, b.frame).position.y = by;
      const stars: [number, number][] = [
        [-0.3, 0.3],
        [0.3, 0.18],
        [-0.12, 0.05],
      ];
      for (const [fx, fy] of stars) {
        const y = h * fy;
        const star = b.mesh(new SphereGeometry(rTop * 0.12, 8, 6), accent, b.frame);
        star.position.set(fx * rTop, y, radiusAt(y) + thin * 0.3);
      }
      return;
    }
  }
}
