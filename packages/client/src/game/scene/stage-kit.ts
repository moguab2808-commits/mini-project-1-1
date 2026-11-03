// 장면 공통 치수·도구와 방 테마 계약. 판·의자는 stage.ts, 테마별 배경·조명·책상은 themes/에 있다.
// 단위 cm. 판 윗면이 월드 Y=0이다. 모두 코드 도형과 canvas 절차 텍스처이며 외부 파일은 쓰지 않는다.
import {
  CanvasTexture,
  Mesh,
  MeshStandardMaterial,
  SRGBColorSpace,
  type BufferGeometry,
  type Group,
  type Material,
  type Texture,
} from 'three';

export const BOARD_THICKNESS = 6;
export const BOARD_LEG = 3.5;
/** 책상 윗면 높이(판 윗면 기준) */
export const TABLE_Y = -(BOARD_THICKNESS + BOARD_LEG);
export const FLOOR_Y = -84;
/** 책상 반폭(좌우 X)·반깊이(좌석 쪽 Z). 캐릭터 배가 닿지 않게 깊이는 좌석 기준점보다 안쪽이다 */
export const TABLE_HALF_X = 44;
export const TABLE_HALF_Z = 25;
export const TABLE_TOP_T = 3;
/** 의자 방석 윗면 높이 */
export const CHAIR_SEAT_Y = -36.5;

export function canvasTexture(
  size: number,
  draw: (g: CanvasRenderingContext2D, s: number) => void,
) {
  return canvasTextureWH(size, size, draw);
}

export function canvasTextureWH(
  w: number,
  h: number,
  draw: (g: CanvasRenderingContext2D, w: number, h: number) => void,
) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  if (g) draw(g, w, h);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** 간단한 결정적 난수: 텍스처 무늬를 실행마다 같게 한다 */
export function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface Disposables {
  geos: BufferGeometry[];
  mats: Material[];
  texs: Texture[];
}

export interface Kit extends Disposables {
  /** 지오메트리를 정리 목록에 넣고 메시를 만든다. 머티리얼은 직접 만들었다면 `mats`에 넣는다 */
  mesh: (geo: BufferGeometry, mat: Material, cast?: boolean, recv?: boolean) => Mesh;
  /** 정리 목록에 들어가는 표준 머티리얼 */
  std: (color: number, rough?: number, metal?: number) => MeshStandardMaterial;
  dispose: () => void;
}

export function createKit(): Kit {
  const d: Disposables = { geos: [], mats: [], texs: [] };
  return {
    ...d,
    mesh(geo, mat, cast = true, recv = true) {
      d.geos.push(geo);
      const m = new Mesh(geo, mat);
      m.castShadow = cast;
      m.receiveShadow = recv;
      return m;
    },
    std(color, rough = 0.7, metal = 0) {
      const m = new MeshStandardMaterial({ color, roughness: rough, metalness: metal });
      d.mats.push(m);
      return m;
    },
    dispose() {
      for (const g of d.geos) g.dispose();
      for (const m of d.mats) m.dispose();
      for (const t of d.texs) t.dispose();
    },
  };
}

/**
 * 방 테마 한 개가 만드는 환경(DEC-050: 배경·조명·책상만 바꾼다. 판·알·의자·캐릭터는 공통).
 *
 * 지켜야 할 경계
 * - 책상 윗면은 정확히 `TABLE_Y` 높이에 있고 X ±`TABLE_HALF_X`, Z ±`TABLE_HALF_Z` 직사각형을 덮는다.
 *   Z 방향으로 `TABLE_HALF_Z + 1.5`를 넘게 내밀지 않는다(좌석 캐릭터 배와 겹친다). 다리는 `FLOOR_Y`까지.
 * - 바닥은 `FLOOR_Y` 높이. 카메라는 판 위 약 40~140cm·반경 약 150cm 안에서 움직이므로
 *   배경(벽·하늘)은 그보다 바깥(반경 180cm 이상)에 두고 모든 방향에서 빈틈없이 둘러싼다.
 * - 판 위(반경 약 30cm, 높이 0~60cm)는 비워 둔다. 램프처럼 위에서 내려오는 물체는 `lamp`에 넣으면
 *   카메라가 높이 올라갈 때 숨긴다.
 * - 판·알에 그림자를 드리우는 주 조명 하나(`castShadow`, 판 위쪽)를 둔다. 게임 판정 색(내 알 검정·상대 흰색,
 *   방해요소 표시)이 읽히도록 판 위는 충분히 밝게 한다.
 * - 만든 지오메트리·머티리얼·텍스처는 모두 `k`의 정리 목록에 넣는다.
 */
export interface ThemeEnv {
  /** 바닥·벽·하늘·장식 같은 고정 배경 */
  room: Group;
  /** 책상(흔들기 연출 때 판과 함께 흔들린다) */
  desk: Group;
  /** 위에서 내려오는 물체(램프 등). 카메라가 높이 올라가면 숨긴다. 없으면 빈 Group */
  lamp: Group;
  /** 조명 전체. 스포트라이트의 target 객체도 이 안에 넣는다 */
  lights: Group;
  /** 장면 배경색(배경 메시 바깥이 비칠 때) */
  background: number;
}

export type ThemeBuilder = (k: Kit) => ThemeEnv;
