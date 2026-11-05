// 사람 아바타 외형과 부품 정의. docs/design/API.md의 `Appearance`와 docs/PRD.md 캐릭터 변경(DEC-054·DEC-059)을 옮긴 것이다.
// 선택지 번호 → 부품 모양은 이 파일 한 곳에 두고 2D SVG 얼굴과 3D 상반신(캔버스 텍스처)이 같이 쓴다.
//
// 얼굴 좌표계: 머리 중심이 (0, 0), 기본 머리 반지름이 50, y는 아래쪽(+)이다(SVG·캔버스와 같음).
// 경로 문자열은 SVG path 문법이며 캔버스는 Path2D로 같은 문자열을 그린다. 좌우 한 쌍인 부품(눈·눈썹)은
// 보는 사람 기준 오른쪽(+x) 하나를 정의하고 반대쪽은 좌우 반전한다.
import { z } from 'zod';

export const APPEARANCE_KEYS = [
  'headShape',
  'hair',
  'eyebrows',
  'eyes',
  'nose',
  'lips',
  'skinTone',
  'glasses',
  'hat',
  'outfit',
] as const;
export type AppearanceKey = (typeof APPEARANCE_KEYS)[number];

/** 항목마다 선택지 수(DEC-054) */
export const APPEARANCE_CHOICES = 5;

const choice = z
  .number()
  .int()
  .min(0)
  .max(APPEARANCE_CHOICES - 1);

/** 요청 검사용: 10항목(DEC-078 안경·모자·옷 포함) 모두 정수 0~4, 여분 필드 거부 */
export const AppearanceSchema = z.strictObject({
  headShape: choice,
  hair: choice,
  eyebrows: choice,
  eyes: choice,
  nose: choice,
  lips: choice,
  skinTone: choice,
  glasses: choice,
  hat: choice,
  outfit: choice,
});
export type Appearance = z.infer<typeof AppearanceSchema>;

/** 고정 기본 외형: 모든 항목의 첫 선택지(DEC-059) */
export const DEFAULT_APPEARANCE: Readonly<Appearance> = Object.freeze({
  headShape: 0,
  hair: 0,
  eyebrows: 0,
  eyes: 0,
  nose: 0,
  lips: 0,
  skinTone: 0,
  glasses: 0,
  hat: 0,
  outfit: 0,
});

// ───────── 부품 정의 ─────────

/** 두상. 3D·2D 모두 머리 윤곽에 같은 변형(가로·세로 배율, 아래쪽 턱 좁힘)을 쓴다 */
export interface HeadShapePart {
  /** 가로(3D는 앞뒤 포함) 배율 */
  sx: number;
  /** 세로 배율 */
  sy: number;
  /** 아래 반쪽을 좁히는 정도 0~0.4. 턱 끝으로 갈수록 강해진다 */
  jaw: number;
}

export interface SkinTonePart {
  base: string;
  /** 귀 안쪽·코 선 등 그늘 */
  shade: string;
  blush: string;
}

/** 머리 모양 종류. 3D 도형은 클라이언트가 종류별로 만든다 */
export type HairStyle = 'bald' | 'crop' | 'bob' | 'spiky' | 'long';

export interface HairPart {
  style: HairStyle;
  color: string;
  /** 가르마·결 표시용 어두운 색 */
  shade: string;
  /** 2D 정면 실루엣: 머리 뒤에 그릴 경로(없으면 null). 두상 배율을 적용하기 전 좌표 */
  back: string | null;
  /** 2D 정면 실루엣: 얼굴 위에 그릴 경로(없으면 null) */
  front: string | null;
}

export interface BrowPart {
  /** 오른쪽(+x) 눈썹 경로. 눈썹 중심 기준 좌표. null이면 눈썹 없음 */
  d: string | null;
  /** 눈썹 중심 x(오른쪽), y */
  x: number;
  y: number;
  width: number;
  color: string;
}

export interface EyePart {
  /** 눈 중심 x(오른쪽), y */
  x: number;
  y: number;
  rx: number;
  ry: number;
  color: string;
  /** 위 속눈썹 선 */
  lash: boolean;
}

export interface NosePart {
  /** 코 경로(얼굴 좌표). 선으로 그린다 */
  d: string;
  width: number;
}

export interface LipPart {
  /** 기본 표정(살짝 웃음) 입 경로(얼굴 좌표) */
  d: string;
  width: number;
  color: string;
  /** 입 너비 절반(표정 입 모양 크기 기준) */
  halfW: number;
  /** 입 중심 y */
  y: number;
}

/** 안경 모양(DEC-078). none이면 쓰지 않는다 */
export type GlassesShape = 'none' | 'round' | 'square' | 'sun' | 'heart';

export interface GlassesPart {
  shape: GlassesShape;
  /** 오른쪽(+x) 알 경로. 알 중심 기준 좌표. shape가 none이면 null */
  d: string | null;
  /** 알 중심은 눈 중심(`EyePart` x, y)이다. 알 너비 절반 */
  halfW: number;
  frame: string;
  /** 알 색. 선글라스는 거의 불투명, 맑은 안경은 옅게 비친다. null이면 칠하지 않는다 */
  lens: string | null;
  lensOpacity: number;
  frameWidth: number;
}

/** 모자 종류(DEC-078). none이면 쓰지 않는다 */
export type HatKind = 'none' | 'cap' | 'beanie' | 'straw' | 'wizard';

export interface HatPart {
  kind: HatKind;
  color: string;
  /** 챙·띠·방울 등 포인트 색 */
  accent: string;
}

/** 옷 종류(DEC-078). tee가 기본이며 color가 null이면 호출 쪽(게임은 좌석, 전신은 기본)이 몸통 색을 정한다 */
export type OutfitKind = 'tee' | 'hoodie' | 'shirt' | 'stripe' | 'robe';

export interface OutfitPart {
  kind: OutfitKind;
  color: string | null;
  accent: string;
}

// 항목마다 5개(DEC-054). 순서가 저장값이므로 바꾸지 않는다(새 선택지는 뒤에 더하고 APPEARANCE_CHOICES를 늘린다).
// 2026-11-03 시험용 머리(이목구비 0번·머리카락 0~2번)로 화풍을 사용자에게 확인받은 뒤 나머지를 같은 화풍으로 만들었다.
const HEAD_SHAPES: HeadShapePart[] = [
  { sx: 1, sy: 1.02, jaw: 0.18 }, // 둥근 얼굴
  { sx: 0.92, sy: 1.1, jaw: 0.24 }, // 긴 얼굴
  { sx: 1.1, sy: 0.97, jaw: 0.08 }, // 넓은 얼굴
  { sx: 0.97, sy: 1.06, jaw: 0.38 }, // 갸름한 턱
  { sx: 0.9, sy: 0.94, jaw: 0.14 }, // 작은 얼굴
];

const SKIN_TONES: SkinTonePart[] = [
  { base: '#f6d2b0', shade: '#d9a27c', blush: '#f2a08a' },
  { base: '#eab88f', shade: '#c98d62', blush: '#e68f78' },
  { base: '#d39a6a', shade: '#a8703f', blush: '#d77a62' },
  { base: '#a8693f', shade: '#7c4a28', blush: '#b85a48' },
  { base: '#6f4228', shade: '#4a2a18', blush: '#8f4636' },
];

const HAIRS: HairPart[] = [
  {
    style: 'crop',
    color: '#3b2a20',
    shade: '#24180f',
    back: null,
    front:
      'M-53 6 C-56 -30 -34 -56 0 -56 C34 -56 56 -30 53 6 C50 -8 46 -18 40 -24 ' +
      'C30 -20 18 -23 10 -28 C2 -21 -14 -19 -26 -22 C-34 -18 -42 -14 -47 -8 C-50 -4 -52 0 -53 6 Z',
  },
  {
    style: 'bob',
    color: '#1e1a1d',
    shade: '#0e0b0d',
    back: 'M-60 -6 C-62 -44 -34 -62 0 -62 C34 -62 62 -44 60 -6 L58 36 C46 42 -46 42 -58 36 Z',
    front:
      'M-58 30 C-62 -30 -36 -60 0 -60 C36 -60 62 -30 58 30 C52 32 48 28 46 22 ' +
      'C46 4 44 -10 40 -16 L-40 -16 C-44 -10 -46 4 -46 22 C-48 28 -52 32 -58 30 Z',
  },
  { style: 'bald', color: '#3b2a20', shade: '#24180f', back: null, front: null },
  {
    style: 'spiky',
    color: '#8a4b26',
    shade: '#5e3017',
    back: null,
    front:
      'M-53 2 C-56 -22 -50 -38 -44 -46 L-46 -60 L-32 -54 L-26 -70 L-14 -58 L-4 -74 L6 -58 ' +
      'L18 -70 L24 -54 L38 -62 L40 -46 C50 -38 56 -22 53 2 C50 -10 44 -20 36 -26 ' +
      'C24 -22 10 -26 0 -28 C-10 -24 -26 -22 -36 -26 C-44 -20 -50 -10 -53 2 Z',
  },
  {
    style: 'long',
    color: '#6b4226',
    shade: '#472a16',
    back: 'M-62 -4 C-64 -46 -34 -64 0 -64 C34 -64 64 -46 62 -4 L64 66 C40 72 -40 72 -64 66 Z',
    front:
      'M-58 40 C-64 -30 -36 -60 0 -60 C36 -60 64 -30 58 40 C52 42 48 36 47 26 ' +
      'C47 0 42 -20 30 -32 C20 -38 8 -40 2 -46 C-4 -40 -20 -38 -30 -32 ' +
      'C-42 -20 -47 0 -47 26 C-48 36 -52 42 -58 40 Z',
  },
];

const BROWS: BrowPart[] = [
  { d: 'M-7 2 C-4 -2 3 -3 7 0', x: 17, y: -14, width: 3.2, color: '#3b2a20' }, // 부드러운 아치
  { d: 'M-7 0.5 L7 -0.5', x: 17, y: -13, width: 4.4, color: '#2c201a' }, // 굵은 일자
  { d: 'M-7 3 C-3 -4 3 -4 7 1', x: 17, y: -17, width: 2.2, color: '#4a3426' }, // 가늘고 높은 아치
  { d: 'M-3.5 0.5 L3.5 -0.5', x: 16, y: -13, width: 4.8, color: '#2c201a' }, // 짧고 굵게
  { d: null, x: 17, y: -14, width: 0, color: '#3b2a20' }, // 눈썹 없음
];

const EYES: EyePart[] = [
  { x: 17, y: 2, rx: 4.6, ry: 6, color: '#2a1d16', lash: false }, // 세로 타원
  { x: 17, y: 3, rx: 3.4, ry: 3.6, color: '#2a1d16', lash: false }, // 작은 점
  { x: 17, y: 2, rx: 5.4, ry: 6.8, color: '#2b2238', lash: true }, // 크고 속눈썹
  { x: 19, y: 3, rx: 5.2, ry: 3.8, color: '#2a1d16', lash: false }, // 가로로 긴 눈
  { x: 14.5, y: 2, rx: 4, ry: 6.4, color: '#1f2a33', lash: true }, // 가운데로 모인 눈
];

const NOSES: NosePart[] = [
  { d: 'M-1 13 C0 17 3 18.5 4 17', width: 2.2 }, // 갈고리
  { d: 'M-2.6 16.5 L-2.5 16.5 M2.5 16.5 L2.6 16.5', width: 2.8 }, // 콧구멍 점
  { d: 'M-4 15 C-2 19 2 19 4 15', width: 2.2 }, // 둥근 코끝
  { d: 'M0.5 5 L2 15 C1.6 17 -1 17.6 -2.2 16.4', width: 2 }, // 긴 콧대
  { d: 'M-1.6 16.4 C0 17.8 1.6 16.4 1.6 16.4', width: 2.2 }, // 아주 작은 코
];

const LIPS: LipPart[] = [
  { d: 'M-7 28 C-3 32 3 32 7 28', width: 2.8, color: '#b85a52', halfW: 7, y: 29 }, // 살짝 웃음
  { d: 'M-4.5 28.5 C-2 31 2 31 4.5 28.5', width: 2.8, color: '#d0606a', halfW: 4.5, y: 29 }, // 작은 입
  { d: 'M-10 27 C-4 33.5 4 33.5 10 27', width: 2.8, color: '#a8524c', halfW: 10, y: 29 }, // 큰 웃음
  { d: 'M-6 28.5 C-2 31.5 2 31.5 6 28.5', width: 4.4, color: '#c4505a', halfW: 6, y: 29 }, // 도톰한 입술
  {
    d: 'M-6.5 28 C-5 31 -1.6 31 0 28.4 C1.6 31 5 31 6.5 28',
    width: 2.6,
    color: '#9c4a46',
    halfW: 6.5,
    y: 29,
  }, // 고양이 입
];

// 안경·모자·옷(DEC-078). 0번은 없음·기본 티다. 순서가 저장값이다.
const GLASSES: GlassesPart[] = [
  {
    shape: 'none',
    d: null,
    halfW: 0,
    frame: '#000000',
    lens: null,
    lensOpacity: 0,
    frameWidth: 0,
  },
  {
    shape: 'round',
    d: 'M-10 0 A10 10 0 1 0 10 0 A10 10 0 1 0 -10 0 Z',
    halfW: 10,
    frame: '#2b2430',
    lens: '#dff3ff',
    lensOpacity: 0.22,
    frameWidth: 2.2,
  },
  {
    shape: 'square',
    d: 'M-10 -7 H10 Q12 -7 12 -5 V5 Q12 7 10 7 H-10 Q-12 7 -12 5 V-5 Q-12 -7 -10 -7 Z',
    halfW: 12,
    frame: '#8a4b26',
    lens: '#dff3ff',
    lensOpacity: 0.22,
    frameWidth: 2.4,
  },
  {
    shape: 'sun',
    d: 'M-12 -7 H12 V3 Q12 9 6 9 H-6 Q-12 9 -12 3 Z',
    halfW: 12,
    frame: '#15121a',
    lens: '#1a1620',
    lensOpacity: 0.94,
    frameWidth: 2.4,
  },
  {
    shape: 'heart',
    d: 'M0 9 C-14 -1 -12 -9 -6 -9 C-3 -9 0 -7 0 -4.5 C0 -7 3 -9 6 -9 C12 -9 14 -1 0 9 Z',
    halfW: 13,
    frame: '#c0306a',
    lens: '#ff7fb0',
    lensOpacity: 0.85,
    frameWidth: 2.2,
  },
];

const HATS: HatPart[] = [
  { kind: 'none', color: '#000000', accent: '#000000' },
  { kind: 'cap', color: '#d6453a', accent: '#8f2a22' },
  { kind: 'beanie', color: '#3d7fc4', accent: '#f2f0e6' },
  { kind: 'straw', color: '#e6c86e', accent: '#b4482e' },
  { kind: 'wizard', color: '#4b2c82', accent: '#f2c14e' },
];

const OUTFITS: OutfitPart[] = [
  { kind: 'tee', color: null, accent: '#ffffff' },
  { kind: 'hoodie', color: '#8c96a6', accent: '#5f6978' },
  { kind: 'shirt', color: '#f1efe8', accent: '#c4352f' },
  { kind: 'stripe', color: '#d8483a', accent: '#f6f2ea' },
  { kind: 'robe', color: '#5a3a96', accent: '#f2c14e' },
];

/** 모자가 머리카락을 가리는 정도: 모자를 쓰면 짧은 머리·뾰족머리는 통째로 숨기고, 단발·긴 머리는 옆·뒤 머리만 모자 아래로 보인다(DEC-078) */
export function hairHiddenByHat(hair: HairPart, hat: HatPart): boolean {
  return hat.kind !== 'none' && (hair.style === 'crop' || hair.style === 'spiky');
}

export const AVATAR_PARTS = {
  headShape: HEAD_SHAPES,
  hair: HAIRS,
  eyebrows: BROWS,
  eyes: EYES,
  nose: NOSES,
  lips: LIPS,
  skinTone: SKIN_TONES,
  glasses: GLASSES,
  hat: HATS,
  outfit: OUTFITS,
} as const;

export interface ResolvedAvatar {
  headShape: HeadShapePart;
  hair: HairPart;
  eyebrows: BrowPart;
  eyes: EyePart;
  nose: NosePart;
  lips: LipPart;
  skinTone: SkinTonePart;
  glasses: GlassesPart;
  hat: HatPart;
  outfit: OutfitPart;
}

/** 외형 번호를 부품으로 바꾼다. 정의가 없는 번호는 첫 선택지로 읽는다(저장값은 normalizeAppearance로 0~4) */
export function resolveAvatar(a: Appearance): ResolvedAvatar {
  const pick = <T>(list: readonly T[], i: number): T => list[i] ?? (list[0] as T);
  return {
    headShape: pick(HEAD_SHAPES, a.headShape),
    hair: pick(HAIRS, a.hair),
    eyebrows: pick(BROWS, a.eyebrows),
    eyes: pick(EYES, a.eyes),
    nose: pick(NOSES, a.nose),
    lips: pick(LIPS, a.lips),
    skinTone: pick(SKIN_TONES, a.skinTone),
    glasses: pick(GLASSES, a.glasses),
    hat: pick(HATS, a.hat),
    outfit: pick(OUTFITS, a.outfit),
  };
}

/**
 * 턱 좁힘 배율. yDown은 머리 중심 기준 아래쪽 거리를 반지름으로 나눈 값(−1~1).
 * 아래 반쪽(yDown > 0)에서만 가로를 좁힌다. 2D 윤곽과 3D 정점이 같은 식을 쓴다.
 */
export function jawScale(yDown: number, jaw: number): number {
  if (yDown <= 0) return 1;
  return 1 - jaw * yDown * yDown;
}

/** 2D 머리 윤곽 경로(얼굴 좌표, 반지름 50 기준) */
export function headOutlinePath(shape: HeadShapePart, samples = 48): string {
  const pts: string[] = [];
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    const yd = Math.sin(a);
    const x = Math.cos(a) * 50 * shape.sx * jawScale(yd, shape.jaw);
    const y = yd * 50 * shape.sy;
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return `${pts.join(' ')} Z`;
}

/**
 * 저장된 값을 외형으로 읽는다. 없는 필드·범위 밖 값은 0으로 읽는다(항목이 늘어도 예전 행을 읽을 수 있게).
 * 요청 검사에는 쓰지 않는다(요청은 AppearanceSchema로 거부한다).
 */
export function normalizeAppearance(raw: unknown): Appearance {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_APPEARANCE };
  for (const k of APPEARANCE_KEYS) {
    const v = src[k];
    if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < APPEARANCE_CHOICES)
      out[k] = v;
  }
  return out;
}

/** 무작위 외형(AI 상대). rand는 [0, 1) 난수 */
export function randomAppearance(rand: () => number = Math.random): Appearance {
  const out = { ...DEFAULT_APPEARANCE };
  for (const k of APPEARANCE_KEYS)
    out[k] = Math.min(APPEARANCE_CHOICES - 1, Math.floor(rand() * APPEARANCE_CHOICES));
  return out;
}
