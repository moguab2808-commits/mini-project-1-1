// 캐릭터 얼굴 간단 SVG. 실제 3D 캐릭터 에셋 전까지 쓰는 자리표시용 그림이다.
import type { ReactElement } from 'react';
import type { GameStart } from '@alkkagi/shared';

type CharacterId = GameStart['players'][number]['characterId'];

const INK = '#2b1d14';

const FACES: Record<CharacterId, { fur: string; ears: ReactElement; extra?: ReactElement }> = {
  bear: {
    fur: '#a9743f',
    ears: (
      <>
        <circle cx="14" cy="14" r="7" fill="#a9743f" stroke={INK} strokeWidth="2.5" />
        <circle cx="50" cy="14" r="7" fill="#a9743f" stroke={INK} strokeWidth="2.5" />
      </>
    ),
    extra: <ellipse cx="32" cy="40" rx="9" ry="7" fill="#e8cfa6" />,
  },
  cat: {
    fur: '#e0a15a',
    ears: (
      <>
        <path
          d="M10 26L12 6l14 10z"
          fill="#e0a15a"
          stroke={INK}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M54 26L52 6 38 16z"
          fill="#e0a15a"
          stroke={INK}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </>
    ),
    extra: (
      <path
        d="M14 40h8M42 40h8M14 44l8-1M42 43l8 1"
        stroke={INK}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    ),
  },
  fox: {
    fur: '#d9703a',
    ears: (
      <>
        <path
          d="M8 28L14 4l16 14z"
          fill="#d9703a"
          stroke={INK}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M56 28L50 4 34 18z"
          fill="#d9703a"
          stroke={INK}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </>
    ),
    extra: <path d="M32 48l-14-10q14 4 28 0z" fill="#faf3e4" />,
  },
  rabbit: {
    fur: '#f2e8da',
    ears: (
      <>
        <ellipse cx="22" cy="10" rx="6" ry="14" fill="#f2e8da" stroke={INK} strokeWidth="2.5" />
        <ellipse cx="42" cy="10" rx="6" ry="14" fill="#f2e8da" stroke={INK} strokeWidth="2.5" />
      </>
    ),
    extra: <circle cx="22" cy="10" r="2.5" fill="#f0a0a0" />,
  },
  owl: {
    fur: '#8c6b4a',
    ears: (
      <>
        <path
          d="M12 22L10 6l14 8z"
          fill="#8c6b4a"
          stroke={INK}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M52 22L54 6 40 14z"
          fill="#8c6b4a"
          stroke={INK}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
      </>
    ),
    extra: (
      <>
        <circle cx="23" cy="30" r="9" fill="#faf3e4" />
        <circle cx="41" cy="30" r="9" fill="#faf3e4" />
      </>
    ),
  },
  frog: {
    fur: '#7fb069',
    ears: (
      <>
        <circle cx="18" cy="16" r="8" fill="#7fb069" stroke={INK} strokeWidth="2.5" />
        <circle cx="46" cy="16" r="8" fill="#7fb069" stroke={INK} strokeWidth="2.5" />
      </>
    ),
  },
};

export function CharacterFace({
  characterId,
  size = 56,
}: {
  characterId: CharacterId;
  size?: number;
}) {
  const face = FACES[characterId];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {face.ears}
      <circle cx="32" cy="35" r="22" fill={face.fur} stroke={INK} strokeWidth="2.5" />
      {face.extra}
      <circle cx="23" cy="31" r="3" fill={INK} />
      <circle cx="41" cy="31" r="3" fill={INK} />
      <path d="M27 42q5 4 10 0" fill="none" stroke={INK} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
