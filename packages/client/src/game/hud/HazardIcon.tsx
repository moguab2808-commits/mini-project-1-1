// 방해요소 아이콘 9종과 에어컨 아이콘. 직접 작성한 SVG이며 한 스타일(굵은 갈색 외곽선, 둥근 끝, 따뜻한 면 색)을 쓴다.
import type { ReactElement } from 'react';
import type { HazardKind } from '@alkkagi/shared';

const INK = '#2b1d14';
const AMBER = '#f0b553';
const CREAM = '#faf3e4';
const BLUE = '#6fb3d9';
const RED = '#d9694f';
const GREEN = '#7fb069';

const line = {
  stroke: INK,
  strokeWidth: 2.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const SHAPES: Record<HazardKind | 'aircon', ReactElement> = {
  board_spin: (
    <>
      <rect x="12" y="12" width="24" height="24" rx="3" fill={AMBER} {...line} />
      <circle cx="24" cy="24" r="4" fill={CREAM} {...line} />
      <path d="M8 18a17 17 0 0 1 12-10" fill="none" {...line} />
      <path d="M21 4l-1 4-4 1" fill="none" {...line} />
      <path d="M40 30a17 17 0 0 1-12 10" fill="none" {...line} />
      <path d="M27 44l1-4 4-1" fill="none" {...line} />
    </>
  ),
  flashlight: (
    <>
      <path d="M8 18l16 4v4l-16 4z" fill={CREAM} {...line} />
      <rect x="24" y="19" width="16" height="10" rx="2" fill={AMBER} {...line} />
      <path d="M40 22l5-3v10l-5-3z" fill={INK} {...line} />
      <path d="M4 14l-1-4M4 24H1M4 34l-1 4" fill="none" {...line} />
    </>
  ),
  water_gun: (
    <>
      <path d="M10 18h22l4-4h6v8h-6l-2 4v8l-4 4h-6l-2-8h-6l-6-4z" fill={BLUE} {...line} />
      <circle cx="11" cy="31" r="1.6" fill={INK} />
      <path d="M44 28c-2 3-2 5 0 6 2-1 2-3 0-6z" fill={CREAM} {...line} />
      <path d="M44 38c-1.5 2-1.5 3.5 0 4.5 1.5-1 1.5-2.5 0-4.5z" fill={CREAM} {...line} />
    </>
  ),
  desk_shake: (
    <>
      <rect x="10" y="16" width="28" height="8" rx="2" fill={AMBER} {...line} />
      <path d="M14 24v14M34 24v14" fill="none" {...line} />
      <circle cx="19" cy="12" r="3" fill={CREAM} {...line} />
      <circle cx="29" cy="12" r="3" fill={INK} {...line} />
      <path d="M4 20l-2 4 2 4M44 20l2 4-2 4" fill="none" {...line} />
    </>
  ),
  wall: (
    <>
      <rect x="6" y="10" width="36" height="28" rx="2" fill={RED} {...line} />
      <path
        d="M6 19.5h36M6 29h36M18 10v9.5M30 19.5V29M18 29v9M36 29v9M12 19.5V29"
        fill="none"
        {...line}
      />
    </>
  ),
  sticky: (
    <>
      <path
        d="M8 26c0-9 7-15 16-15s16 6 16 15c0 5-3 6-5 6-2 0-2 6-5 6s-3-5-6-5-3 7-6 7-3-6-5-6c-3 0-5-2-5-8z"
        fill={GREEN}
        {...line}
      />
      <circle cx="18" cy="22" r="2" fill={CREAM} />
      <circle cx="29" cy="20" r="2.6" fill={CREAM} />
    </>
  ),
  stun: (
    <>
      <path d="M24 5l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" fill={AMBER} {...line} />
      <path d="M19 22h3M27 22h3M20 29q4 3 8 0" fill="none" {...line} />
    </>
  ),
  bar_speed: (
    <>
      <rect x="6" y="19" width="36" height="10" rx="5" fill={CREAM} {...line} />
      <rect x="9" y="22" width="16" height="4" rx="2" fill={AMBER} />
      <path d="M30 12l6 5-6 5M30 32l6 5-6 5" fill="none" {...line} />
    </>
  ),
  wind: (
    <>
      <path d="M6 18h22a5 5 0 1 0-5-5" fill="none" {...line} />
      <path d="M6 26h32a5 5 0 1 1-5 5" fill="none" {...line} />
      <path d="M6 34h14a4 4 0 1 1-4 4" fill="none" {...line} />
    </>
  ),
  aircon: (
    <>
      <rect x="5" y="10" width="38" height="16" rx="4" fill={CREAM} {...line} />
      <path d="M10 22h28" fill="none" {...line} />
      <circle cx="37" cy="16" r="1.8" fill={BLUE} />
      <path
        d="M13 31v5M24 31v8M35 31v5"
        fill="none"
        stroke={BLUE}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </>
  ),
};

export interface HazardIconProps {
  kind: HazardKind | 'aircon';
  size?: number;
}

export function HazardIcon({ kind, size = 44 }: HazardIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      {SHAPES[kind]}
    </svg>
  );
}
