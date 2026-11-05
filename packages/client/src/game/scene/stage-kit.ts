// 장면 공통 치수·도구와 방 테마 계약. 판·의자는 stage.ts, 테마별 배경·조명·책상은 themes/에 있다.
// 단위 cm. 판 윗면이 월드 Y=0이다. 모두 코드 도형과 canvas 절차 텍스처이며 외부 파일은 쓰지 않는다.
import {
  AdditiveBlending,
  CanvasTexture,
  CatmullRomCurve3,
  Color,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SRGBColorSpace,
  SphereGeometry,
  TubeGeometry,
  type BufferGeometry,
  type Group,
  type Vector3,
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
 * a→b 사이를 `spans`칸으로 나눠 칸마다 처지는 전구 줄 전선을 만들고, 전구 위치를 `bulbs`에 더한다.
 * 줄 하나가 튜브 하나라 칸이 많아도 메시는 하나다.
 */
export function festoon(
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
export function addBulbs(
  k: Kit,
  parent: Group,
  at: Vector3[],
  r: number,
  colors: readonly number[] = [0xffd37a, 0xffc35c, 0xffe7a8, 0xffb070],
) {
  const palette = colors.map((c) => new Color(c));
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

/**
 * 판 겉모양(색·무늬만, DEC-079). 크기·모양·선 위치·진영 색 띠·위쪽 표식은 모든 테마가 같다.
 * 테마가 정하지 않으면 `DEFAULT_BOARD_STYLE`을 쓴다.
 */
export interface BoardStyle {
  /** 윗면 바탕색 */
  base: string;
  /** 나뭇결 선 색(rgb 세 값, 투명도는 무작위) */
  grain: string;
  /** 칸·동심원 선 색 */
  line: string;
  /** 판 몸체 옆면·이음 띠·다리 */
  side: number;
  seam: number;
  leg: number;
  /** 윗면 가장자리를 두르는 테 색. 없으면 테를 두지 않는다 */
  rim?: number;
  /** 가운데 점 대신 별 무늬, 모서리 장식 */
  star?: string;
}

export const DEFAULT_BOARD_STYLE: BoardStyle = {
  base: '#dcae6b',
  grain: '120,70,20',
  line: 'rgba(60,32,10,0.65)',
  side: 0xc08a4c,
  seam: 0x6e4522,
  leg: 0x8a5a2c,
};

/**
 * 방 테마 한 개가 만드는 환경(DEC-050: 배경·조명·책상을 바꾼다. DEC-079로 판 겉모양도 고를 수 있다.
 * 판 크기·알·의자·캐릭터는 공통).
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
  /** 판 겉모양. 없으면 기본 */
  board?: BoardStyle;
}

export type ThemeBuilder = (k: Kit) => ThemeEnv;
