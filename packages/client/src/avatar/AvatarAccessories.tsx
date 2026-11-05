// 사람 아바타 2D 안경·모자(SVG, DEC-078). 얼굴 좌표(머리 반지름 50, 정수리 y = -50)로 그린다.
// 안경 알 모양은 shared의 부품 경로를 3D 얼굴 텍스처(face-paint.ts)와 같이 쓴다. 모자는 2D 전용 경로이며
// 3D 모자(avatar-hat.ts)와 같은 종류·색을 쓴다.
import type { GlassesPart, HatPart, OutfitPart, ResolvedAvatar } from '@alkkagi/shared';

/** 안경(눈 위, 눈썹 아래 순서로 그린다) */
export function GlassesArt({
  glasses,
  eyes,
}: {
  glasses: GlassesPart;
  eyes: ResolvedAvatar['eyes'];
}) {
  if (!glasses.d) return null;
  const inner = eyes.x - glasses.halfW;
  return (
    <g>
      {[-1, 1].map((sx) => (
        <g key={sx} transform={`translate(${sx * eyes.x} ${eyes.y}) scale(${sx} 1)`}>
          <path
            d={glasses.d ?? ''}
            fill={glasses.lens ?? 'none'}
            fillOpacity={glasses.lensOpacity}
            stroke={glasses.frame}
            strokeWidth={glasses.frameWidth}
            strokeLinejoin="round"
          />
        </g>
      ))}
      <path
        d={`M${-inner} ${eyes.y - 1} Q0 ${eyes.y - 4} ${inner} ${eyes.y - 1}`}
        fill="none"
        stroke={glasses.frame}
        strokeWidth={glasses.frameWidth}
        strokeLinecap="round"
      />
    </g>
  );
}

/** 모자(머리카락 위에 그린다). 부모가 두상 배율 변환을 건다 */
export function HatArt({ hat }: { hat: HatPart }) {
  const { color, accent } = hat;
  switch (hat.kind) {
    case 'none':
      return null;
    case 'cap':
      return (
        <g>
          <path
            d="M-52 -10 C-58 -50 -30 -66 0 -66 C30 -66 58 -50 52 -10 Q0 -38 -52 -10 Z"
            fill={color}
          />
          <circle cx={0} cy={-66} r={4} fill={accent} />
          <path
            d="M-30 -26 Q0 -33 30 -26 Q38 -17 26 -15 Q0 -23 -26 -15 Q-38 -17 -30 -26 Z"
            fill={accent}
          />
        </g>
      );
    case 'beanie':
      return (
        <g>
          <path
            d="M-52 -10 C-58 -54 -28 -70 0 -70 C28 -70 58 -54 52 -10 Q0 -38 -52 -10 Z"
            fill={color}
          />
          <path d="M-53 -18 Q0 -42 53 -18 L52 -8 Q0 -32 -52 -8 Z" fill={accent} />
          <circle cx={0} cy={-74} r={8} fill={accent} />
        </g>
      );
    case 'straw':
      return (
        <g>
          <path d="M-70 -26 C-40 -36 40 -36 70 -26 C52 -20 -52 -20 -70 -26 Z" fill={color} />
          <path d="M-40 -28 C-44 -62 -22 -72 0 -72 C22 -72 44 -62 40 -28 Z" fill={color} />
          <path d="M-41 -36 H41 L40 -28 H-40 Z" fill={accent} />
        </g>
      );
    case 'wizard':
      return (
        <g>
          <path d="M-68 -28 C-40 -38 40 -38 68 -28 C50 -22 -50 -22 -68 -28 Z" fill={color} />
          <path
            d="M-34 -30 C-24 -50 -10 -70 -4 -86 Q2 -92 8 -84 C14 -66 26 -48 34 -30 Z"
            fill={color}
          />
          <path d="M-35 -34 H35 L33 -28 H-33 Z" fill={accent} />
        </g>
      );
  }
}

const TEE_PATH =
  'M18 14 L26 10 Q32 16 38 10 L46 14 L56 26 L47 32 L44 28 L44 54 L20 54 L20 28 L17 32 L8 26 Z';

/** 꾸미기 창의 옷 선택지 그림. 옷은 2D 얼굴에 보이지 않으므로 옷 모양을 작게 그린다(DEC-078) */
export function OutfitSwatch({ outfit, size = 64 }: { outfit: OutfitPart; size?: number }) {
  const base = outfit.color ?? '#e2452c';
  const id = `outfit-clip-${outfit.kind}`;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <clipPath id={id}>
          <path d={TEE_PATH} />
        </clipPath>
      </defs>
      <path d={TEE_PATH} fill={base} />
      <g clipPath={`url(#${id})`}>
        {outfit.kind === 'stripe' &&
          [20, 30, 40, 50].map((y) => (
            <rect key={y} x={4} y={y} width={56} height={5} fill={outfit.accent} />
          ))}
        {outfit.kind === 'hoodie' && (
          <>
            <path d="M24 10 Q32 24 40 10 L40 14 Q32 28 24 14 Z" fill={outfit.accent} />
            <rect x={25} y={40} width={14} height={9} rx={3} fill={outfit.accent} />
          </>
        )}
        {outfit.kind === 'shirt' && (
          <>
            <path
              d="M32 18 L27 10 L24 14 Z M32 18 L37 10 L40 14 Z"
              fill="#ffffff"
              stroke="#c9c5b8"
            />
            <path d="M30 20 H34 L35 24 L33 44 H31 L29 24 Z" fill={outfit.accent} />
          </>
        )}
        {outfit.kind === 'robe' && (
          <>
            <rect x={8} y={44} width={48} height={4} fill={outfit.accent} />
            <circle cx={28} cy={26} r={2.2} fill={outfit.accent} />
            <circle cx={38} cy={32} r={2.2} fill={outfit.accent} />
            <circle cx={30} cy={37} r={1.6} fill={outfit.accent} />
          </>
        )}
      </g>
      <path d={TEE_PATH} fill="none" stroke="#00000033" strokeWidth={1.2} />
    </svg>
  );
}
