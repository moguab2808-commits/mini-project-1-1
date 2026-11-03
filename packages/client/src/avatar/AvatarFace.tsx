// 사람 아바타 2D 얼굴(SVG). 프로필바·방 카드·대기실·결과 화면에 쓴다.
// 3D 머리의 얼굴 텍스처(face-paint.ts)와 같은 부품 정의(`@alkkagi/shared` AVATAR_PARTS)를 쓴다.
import { headOutlinePath, jawScale, resolveAvatar, type Appearance } from '@alkkagi/shared';

export function AvatarFace({
  appearance,
  size = 56,
  title,
}: {
  appearance: Appearance;
  size?: number;
  title?: string;
}) {
  const p = resolveAvatar(appearance);
  const { headShape: H, hair, eyebrows: B, eyes: E, nose: N, lips: L, skinTone: S } = p;
  const hairT = `scale(${H.sx} ${H.sy})`;
  const earX = 50 * H.sx * jawScale(0.08, H.jaw) - 1.5;
  return (
    <svg
      viewBox="-64 -68 128 128"
      width={size}
      height={size}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {hair.back && <path d={hair.back} transform={hairT} fill={hair.color} />}
      {[-1, 1].map((sx) => (
        <g key={sx}>
          <ellipse cx={sx * earX} cy={4} rx={7} ry={9.5} fill={S.base} />
          <ellipse cx={sx * (earX + 1)} cy={4} rx={3.4} ry={5.4} fill={S.shade} opacity={0.6} />
        </g>
      ))}
      <path d={headOutlinePath(H)} fill={S.base} />
      {[-1, 1].map((sx) => (
        <ellipse
          key={sx}
          cx={sx * (E.x + 5)}
          cy={E.y + 13}
          rx={6.5}
          ry={4}
          fill={S.blush}
          opacity={0.35}
        />
      ))}
      {[-1, 1].map((sx) => (
        <g key={sx}>
          <ellipse cx={sx * E.x} cy={E.y} rx={E.rx} ry={E.ry} fill={E.color} />
          <circle cx={sx * E.x + E.rx * 0.32} cy={E.y - E.ry * 0.38} r={E.rx * 0.36} fill="#fff" />
        </g>
      ))}
      {B.d &&
        [-1, 1].map((sx) => (
          <path
            key={sx}
            d={B.d ?? ''}
            transform={`translate(${sx * B.x} ${B.y}) scale(${sx} 1)`}
            fill="none"
            stroke={B.color}
            strokeWidth={B.width}
            strokeLinecap="round"
          />
        ))}
      <path d={N.d} fill="none" stroke={S.shade} strokeWidth={N.width} strokeLinecap="round" />
      <path d={L.d} fill="none" stroke={L.color} strokeWidth={L.width} strokeLinecap="round" />
      {hair.front && <path d={hair.front} transform={hairT} fill={hair.color} />}
    </svg>
  );
}
