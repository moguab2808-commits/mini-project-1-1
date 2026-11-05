// 방해요소 아이콘 19종과 에어컨 아이콘. 직접 작성한 SVG다.
// 장난감 왕국 화풍(DEC-081): 짙은 갈색 굵은 외곽선, 진한 원색 면, 흰 광택 하이라이트. 장면 속 모양(해골 폭탄·보라 소용돌이 자석·
// 별빛 우물 구멍·초록 슬라임·주황 장난감 벽돌·장난감 물총 등)과 같게 그린다.
import type { ReactElement } from 'react';
import type { HazardKind } from '@alkkagi/shared';

const INK = '#4a2a14';
const BLACK = '#1d1626';
const CREAM = '#fff7ea';
const GOLD = '#ffc21a';
const ORANGE = '#ff7a1a';
const BRICK = '#ec5a1c';
const BLUE = '#1f84ea';
const SKY = '#5ac8ff';
const VIOLET = '#8a3ae0';
const PINK = '#e03aaa';
const GREEN = '#4ed414';

const line = {
  stroke: INK,
  strokeWidth: 2.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

/** 흰 광택 줄(면 왼쪽 위에 얹는다) */
const shine = {
  fill: 'none',
  stroke: '#ffffff',
  strokeOpacity: 0.75,
  strokeWidth: 2.5,
  strokeLinecap: 'round' as const,
};

/** 네 꼭지 반짝임 */
function Sparkle({
  x,
  y,
  r,
  color = '#ffffff',
}: {
  x: number;
  y: number;
  r: number;
  color?: string;
}) {
  return (
    <path
      d={`M${x} ${y - r}Q${x} ${y} ${x + r} ${y}Q${x} ${y} ${x} ${y + r}Q${x} ${y} ${x - r} ${y}Q${x} ${y} ${x} ${y - r}z`}
      fill={color}
    />
  );
}

/** 주황 장난감 벽돌 기둥 하나(윗면 금빛 돌기) */
function Bricks({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const rows = Math.max(2, Math.round(h / 8));
  const rh = h / rows;
  const studs = Math.max(1, Math.round(w / 8));
  return (
    <>
      {Array.from({ length: studs }, (_, i) => (
        <rect
          key={i}
          x={x + (w / studs) * (i + 0.5) - 2}
          y={y - 3.5}
          width="4"
          height="4"
          rx="1"
          fill={GOLD}
          {...line}
          strokeWidth={1.5}
        />
      ))}
      <rect x={x} y={y} width={w} height={h} rx="2.5" fill={BRICK} {...line} />
      {Array.from({ length: rows - 1 }, (_, i) => (
        <path key={i} d={`M${x} ${y + rh * (i + 1)}h${w}`} {...line} strokeWidth={1.5} />
      ))}
      {Array.from({ length: rows }, (_, i) => (
        <path
          key={`v${i}`}
          d={`M${x + (i % 2 ? w * 0.33 : w * 0.66)} ${y + rh * i}v${rh}`}
          {...line}
          strokeWidth={1.5}
        />
      ))}
      <path d={`M${x + 3} ${y + 3}h${Math.max(2, w * 0.35)}`} {...shine} strokeWidth={2} />
    </>
  );
}

const SHAPES: Record<HazardKind | 'aircon', ReactElement> = {
  board_spin: (
    <>
      <rect x="12" y="12" width="24" height="24" rx="3" fill={GOLD} {...line} />
      <path d="M17 18l14 0M17 24h14M17 30h14" stroke="#c07a10" strokeWidth="1.5" />
      <circle cx="24" cy="24" r="4" fill={VIOLET} {...line} />
      <path d="M8 18a17 17 0 0 1 12-10" fill="none" {...line} stroke={VIOLET} strokeWidth={3} />
      <path d="M21 4l-1 4-4 1" fill="none" {...line} stroke={VIOLET} strokeWidth={3} />
      <path d="M40 30a17 17 0 0 1-12 10" fill="none" {...line} stroke={VIOLET} strokeWidth={3} />
      <path d="M27 44l1-4 4-1" fill="none" {...line} stroke={VIOLET} strokeWidth={3} />
      <path d="M15 15h6" {...shine} />
    </>
  ),
  flashlight: (
    <>
      <path d="M2 14l18 7v6L2 34z" fill={GOLD} opacity="0.55" />
      <rect x="24" y="19" width="17" height="10" rx="3" fill="#e2302a" {...line} />
      <path d="M24 17h-4v14h4z" fill={GOLD} {...line} />
      <circle cx="34" cy="17" r="1.8" fill={GOLD} {...line} strokeWidth={1.5} />
      <path d="M27 22h9" {...shine} />
      <Sparkle x={8} y={24} r={5} />
      <Sparkle x={14} y={15} r={3} color="#fff0a0" />
    </>
  ),
  water_gun: (
    <>
      <circle cx="22" cy="12" r="6" fill={SKY} {...line} />
      <path d="M8 18h26q4 0 4 4v3H8q-3 0-3-3.5T8 18z" fill={BLUE} {...line} />
      <rect x="38" y="19.5" width="6" height="4.5" rx="1.5" fill={GOLD} {...line} />
      <rect x="18" y="25" width="12" height="4" rx="2" fill={ORANGE} {...line} />
      <path d="M10 25l-2 12h7l3-12z" fill={BLUE} {...line} />
      <path d="M10 21h14M19 9.5a3 3 0 0 1 3-1.5" {...shine} />
      <path d="M44 32c-2 3-2 5 0 6 2-1 2-3 0-6z" fill={SKY} {...line} strokeWidth={1.8} />
      <Sparkle x={38} y={36} r={3} />
    </>
  ),
  desk_shake: (
    <>
      <rect x="10" y="16" width="28" height="8" rx="3" fill={ORANGE} {...line} />
      <path d="M14 24v14M34 24v14" fill="none" {...line} strokeWidth={3.5} />
      <circle cx="19" cy="12" r="3" fill={CREAM} {...line} />
      <circle cx="29" cy="12" r="3" fill={BLACK} {...line} />
      <path d="M4 20l-2 4 2 4M44 20l2 4-2 4" fill="none" {...line} stroke={VIOLET} />
      <path d="M13 19h8" {...shine} />
    </>
  ),
  wall: <Bricks x={6} y={14} w={36} h={26} />,
  sticky: (
    <>
      <path
        d="M8 26c0-9 7-15 16-15s16 6 16 15c0 5-3 6-5 6-2 0-2 6-5 6s-3-5-6-5-3 7-6 7-3-6-5-6c-3 0-5-2-5-8z"
        fill={GREEN}
        {...line}
      />
      <circle cx="20" cy="24" r="3" fill="#b0ff6a" stroke="#ffffff" strokeWidth="1" />
      <circle cx="30" cy="22" r="2" fill="#b0ff6a" stroke="#ffffff" strokeWidth="1" />
      <path d="M14 20q3-5 9-6" {...shine} strokeWidth={3} />
    </>
  ),
  stun: (
    <>
      <path d="M24 5l5 11 12 1-9 8 3 12-11-6-11 6 3-12-9-8 12-1z" fill={GOLD} {...line} />
      <path d="M19 22h3M27 22h3M20 29q4 3 8 0" fill="none" {...line} />
      <path d="M17 18l4-1" {...shine} />
      <Sparkle x={42} y={8} r={4} color={GOLD} />
    </>
  ),
  bar_speed: (
    <>
      <rect x="6" y="19" width="36" height="10" rx="5" fill={CREAM} {...line} />
      <rect x="9" y="22" width="18" height="4" rx="2" fill={ORANGE} />
      <path
        d="M30 12l6 5-6 5M30 32l6 5-6 5"
        fill="none"
        {...line}
        stroke={VIOLET}
        strokeWidth={3}
      />
      <path d="M11 21h8" {...shine} strokeWidth={1.5} />
    </>
  ),
  wind: (
    <>
      <path d="M6 18h22a5 5 0 1 0-5-5" fill="none" {...line} strokeWidth={5.5} />
      <path d="M6 26h32a5 5 0 1 1-5 5" fill="none" {...line} strokeWidth={5.5} />
      <path d="M6 34h14a4 4 0 1 1-4 4" fill="none" {...line} strokeWidth={5.5} />
      <path d="M6 18h22a5 5 0 1 0-5-5" fill="none" {...line} stroke={SKY} strokeWidth={2.5} />
      <path d="M6 26h32a5 5 0 1 1-5 5" fill="none" {...line} stroke={SKY} strokeWidth={2.5} />
      <path d="M6 34h14a4 4 0 1 1-4 4" fill="none" {...line} stroke={SKY} strokeWidth={2.5} />
    </>
  ),
  magnet: (
    <>
      <circle cx="24" cy="24" r="19" fill={VIOLET} {...line} />
      <path
        d="M24 9a15 15 0 0 1 14 12M39 27a15 15 0 0 1-12 12M21 39A15 15 0 0 1 9 27M9 21A15 15 0 0 1 21 9"
        fill="none"
        stroke="#c89aff"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M24 15a9 9 0 0 1 9 9M33 24a9 9 0 0 1-9 9M15 24a9 9 0 0 1 9-9"
        fill="none"
        stroke={SKY}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="24" cy="24" r="5" fill={BLACK} stroke="#e0c8ff" strokeWidth="2" />
      <Sparkle x={36} y={12} r={3.5} />
      <Sparkle x={12} y={35} r={2.5} />
    </>
  ),
  gravity_zone: (
    <>
      <rect x="7" y="7" width="34" height="34" rx="3" fill={BLUE} {...line} />
      <rect
        x="11"
        y="11"
        width="26"
        height="26"
        rx="2"
        fill="none"
        stroke={SKY}
        strokeWidth="1.5"
      />
      <path
        d="M16 18l8 8 8-8M16 26l8 8 8-8"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 11l4-4M41 11l-4-4M7 37l4 4M41 37l-4 4"
        stroke={GOLD}
        strokeWidth="3"
        strokeLinecap="round"
      />
    </>
  ),
  ice_floor: (
    <>
      <ellipse cx="24" cy="30" rx="19" ry="11" fill={SKY} {...line} />
      <ellipse cx="22" cy="28" rx="11" ry="5" fill="#d8f6ff" />
      <path d="M12 27q5-4 12-4" {...shine} />
      <path
        d="M24 4v14M18 7l12 8M30 7l-12 8"
        fill="none"
        stroke={BLUE}
        strokeWidth="3"
        strokeLinecap="round"
      />
      <Sparkle x={36} y={30} r={3} />
    </>
  ),
  decoy: (
    <>
      <circle
        cx="13"
        cy="29"
        r="8"
        fill="#e8dcff"
        fillOpacity="0.6"
        stroke={VIOLET}
        strokeWidth="2.5"
        strokeDasharray="3 3"
      />
      <circle
        cx="35"
        cy="29"
        r="8"
        fill="#e8dcff"
        fillOpacity="0.6"
        stroke={VIOLET}
        strokeWidth="2.5"
        strokeDasharray="3 3"
      />
      <circle cx="24" cy="19" r="9" fill={BLACK} {...line} />
      <path d="M19 15q2-3 6-3" {...shine} />
      <Sparkle x={40} y={14} r={3.5} color="#e0c8ff" />
      <Sparkle x={7} y={16} r={2.5} color="#e0c8ff" />
    </>
  ),
  fake_wall: (
    <>
      <Bricks x={4} y={16} w={11} h={24} />
      <Bricks x={19} y={16} w={11} h={24} />
      <Bricks x={34} y={16} w={11} h={24} />
      <path d="M21 5q3-3 6 0t-3 5v1" fill="none" {...line} stroke={VIOLET} strokeWidth={3} />
    </>
  ),
  heavy_stones: (
    <>
      <path d="M10 40l5-22h18l5 22z" fill={BLACK} {...line} />
      <circle cx="24" cy="12" r="5" fill="none" {...line} stroke={GOLD} strokeWidth={3} />
      <path d="M18 32h12" fill="none" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
      <path d="M17 22l-1.5 7" {...shine} />
    </>
  ),
  reverse_zone: (
    <>
      <circle cx="24" cy="24" r="19" fill={PINK} {...line} />
      <circle
        cx="24"
        cy="24"
        r="14"
        fill="none"
        stroke="#ffc8f0"
        strokeWidth="1.5"
        strokeDasharray="2 3"
      />
      <path
        d="M14 20h18l-5-5M34 28H16l5 5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Sparkle x={38} y={9} r={3.5} />
    </>
  ),
  mine: (
    <>
      <circle cx="22" cy="28" r="13" fill={BLACK} {...line} />
      <rect x="18" y="12" width="8" height="4" rx="1" fill={GOLD} {...line} strokeWidth={1.8} />
      <path
        d="M22 12V9q0-4 5-4h3"
        fill="none"
        stroke="#d8b07a"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="22" cy="27" r="5" fill={CREAM} />
      <rect x="19" y="30" width="6" height="4" rx="1" fill={CREAM} />
      <circle cx="20" cy="27" r="1.4" fill={BLACK} />
      <circle cx="24" cy="27" r="1.4" fill={BLACK} />
      <path d="M13 22q2-4 6-5" {...shine} />
      <Sparkle x={34} y={5} r={5} color={ORANGE} />
      <Sparkle x={34} y={5} r={2.5} color="#fff0a0" />
    </>
  ),
  pit: (
    <>
      <path
        d="M5 30l4-7 6 1 3-5 6 2 5-3 5 4 6-1 3 6-3 6-6 1-4 4-6-2-6 3-4-4-7-1z"
        fill="#8a3a10"
        {...line}
      />
      <ellipse cx="24" cy="29" rx="13" ry="6.5" fill="#2a1080" stroke={VIOLET} strokeWidth="2" />
      <circle cx="19" cy="28" r="0.9" fill="#ffffff" />
      <circle cx="27" cy="31" r="0.8" fill="#ffffff" />
      <circle cx="30" cy="27" r="0.7" fill="#ffffff" />
      <path d="M24 3v11M19 9l5 5 5-5" fill="none" {...line} stroke={VIOLET} strokeWidth={3} />
    </>
  ),
  moving_wall: (
    <>
      <Bricks x={17} y={12} w={14} h={28} />
      <path
        d="M12 26H3M7 22l-4 4 4 4M36 26h9M41 22l4 4-4 4"
        fill="none"
        {...line}
        stroke={VIOLET}
        strokeWidth={3}
      />
    </>
  ),
  aircon: (
    <>
      <rect x="5" y="10" width="38" height="16" rx="4" fill={CREAM} {...line} />
      <path d="M10 22h28" fill="none" {...line} />
      <circle cx="37" cy="16" r="1.8" fill={BLUE} />
      <path d="M9 14h10" {...shine} stroke={SKY} />
      <path
        d="M13 31v5M24 31v8M35 31v5"
        fill="none"
        stroke={SKY}
        strokeWidth="3"
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
