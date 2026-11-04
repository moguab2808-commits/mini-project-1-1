// 로비 방 목록 지역 열의 머리 그림. 방 테마(바·밤 옥상·교실·해변)마다 코드로 그린 인라인 SVG다(DEC-072 ⑥, 파일 에셋 없음).
// 도형은 디자인 캔버스 UiL-Lobby 보드의 지역 그림을 옮긴 것이다.
import type { ThemeId } from '@alkkagi/shared';

/** 지역 열의 포인트 색(열 위 테두리). 시안 값 */
export const REGION_COLOR: Record<ThemeId, string> = {
  bar: '#f07a1a',
  rooftop: '#7a5ae0',
  classroom: '#2e9a5a',
  beach: '#2a8ad0',
};

const SKY: Record<ThemeId, string> = {
  bar: '#f6a25a',
  rooftop: '#3a2e8a',
  classroom: '#f2d6a8',
  beach: '#8ad8f6',
};

function BarScene() {
  return (
    <g>
      <circle cx="230" cy="30" r="16" fill="#fff0b0" opacity=".9" />
      <path d="M0 22 Q70 44 140 22 T280 22" fill="none" stroke="#5a2408" strokeWidth="1.5" />
      <g fill="#ffe08a">
        {[20, 50, 80, 110, 170, 200, 250].map((cx, i) => (
          <circle key={cx} cx={cx} cy={[27, 34, 36, 31, 31, 36, 28][i]} r="3.5" />
        ))}
      </g>
      <rect x="0" y="94" width="280" height="24" fill="#c9783a" />
      <rect x="20" y="58" width="50" height="40" fill="#e8945a" />
      <path d="M14 60 l31 -24 31 24z" fill="#b8501f" />
      <rect x="34" y="68" width="12" height="12" fill="#fff3b0" />
      <rect x="90" y="66" width="44" height="32" fill="#f2a86a" />
      <path d="M84 68 l28 -20 28 20z" fill="#9a4018" />
      <rect x="104" y="74" width="10" height="10" fill="#fff3b0" />
      <rect x="160" y="54" width="54" height="44" fill="#e8945a" />
      <path d="M154 56 l33 -26 33 26z" fill="#b8501f" />
      <rect x="170" y="64" width="12" height="12" fill="#fff3b0" />
      <rect x="192" y="64" width="12" height="12" fill="#fff3b0" />
    </g>
  );
}

function RooftopScene() {
  return (
    <g>
      <circle cx="220" cy="32" r="18" fill="#fff6c8" />
      <circle cx="228" cy="26" r="16" fill={SKY.rooftop} />
      <g fill="#fff3b0">
        <circle cx="40" cy="20" r="1.6" />
        <circle cx="90" cy="34" r="1.4" />
        <circle cx="140" cy="16" r="1.8" />
        <circle cx="180" cy="44" r="1.4" />
        <circle cx="260" cy="60" r="1.6" />
        <path d="M70 14 l2 5 5 1 -4 3 1 5 -4 -2 -4 2 1 -5 -4 -3 5 -1z" />
      </g>
      <g fill="#2a2068">
        <rect x="10" y="60" width="40" height="58" />
        <rect x="56" y="44" width="36" height="74" />
        <rect x="98" y="70" width="44" height="48" />
        <rect x="150" y="52" width="34" height="66" />
        <rect x="190" y="74" width="50" height="44" />
        <rect x="246" y="58" width="34" height="60" />
      </g>
      <g fill="#ffe08a">
        <rect x="18" y="70" width="5" height="5" />
        <rect x="30" y="84" width="5" height="5" />
        <rect x="64" y="56" width="5" height="5" />
        <rect x="76" y="72" width="5" height="5" />
        <rect x="160" y="62" width="5" height="5" />
        <rect x="200" y="84" width="5" height="5" />
        <rect x="256" y="70" width="5" height="5" />
      </g>
    </g>
  );
}

function ClassroomScene() {
  return (
    <g>
      <rect
        x="20"
        y="14"
        width="240"
        height="84"
        rx="4"
        fill="#2a5a3a"
        stroke="#c98a4a"
        strokeWidth="7"
      />
      <g fill="none" stroke="#eef6e6" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="70" cy="56" r="12" />
        <circle cx="120" cy="50" r="12" />
        <path d="M136 50 l40 -10 M168 34 l10 6 -8 8" />
        <path d="M196 70 h40 M196 80 h28" />
      </g>
      <circle cx="70" cy="56" r="10" fill="#eef6e6" opacity=".25" />
      <rect x="40" y="96" width="200" height="6" fill="#a8683a" />
      <rect x="60" y="92" width="18" height="4" fill="#fff" />
    </g>
  );
}

function BeachScene() {
  return (
    <g>
      <circle cx="60" cy="34" r="16" fill="#fff3a0" />
      <rect x="0" y="62" width="280" height="22" fill="#2aa0e0" />
      <path
        d="M0 64 q14 -6 28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0 t28 0"
        fill="none"
        stroke="#e6faff"
        strokeWidth="2.4"
      />
      <path d="M0 84 Q140 70 280 84 L280 118 L0 118 Z" fill="#f8dc98" />
      <path d="M226 104 q6 -36 0 -62" stroke="#8a5a2a" strokeWidth="6" fill="none" />
      <path
        d="M226 44 q-24 -8 -36 6 M226 44 q24 -10 36 4 M226 44 q-8 -22 -24 -22 M226 44 q12 -22 28 -18"
        stroke="#3aa85a"
        strokeWidth="7"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

const SCENE: Record<ThemeId, () => React.JSX.Element> = {
  bar: BarScene,
  rooftop: RooftopScene,
  classroom: ClassroomScene,
  beach: BeachScene,
};

export function RegionArt({ theme }: { theme: ThemeId }) {
  const Scene = SCENE[theme];
  return (
    <svg
      className="region-art"
      aria-hidden="true"
      width="100%"
      height="100%"
      viewBox="0 0 280 118"
      preserveAspectRatio="xMidYMid slice"
    >
      <rect width="280" height="118" fill={SKY[theme]} />
      <Scene />
    </svg>
  );
}
