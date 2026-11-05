// 녹음 음원(CC0) 등록부(DEC-084·DEC-086). 키는 효과음 id(`SfxId`), `music:<곡>`, `ambience:<테마>`이고 값은 `public/` 기준 주소다.
// 여기에 없는 소리는 코드 합성으로 낸다. 출처·이용 조건·가공 내용은 docs/CREDITS.md에 있다.
// 효과음 파일은 소리를 처음 열 때 미리 받고, 음악·배경 소리는 그 화면이 처음 요청할 때 받는다.
export const SOUND_FILES: Partial<Record<string, string>> = {
  // 감정표현 목소리
  emote_laugh: '/audio/sfx/emote_laugh.mp3',
  emote_yawn: '/audio/sfx/emote_yawn.mp3',
  emote_surprise: '/audio/sfx/emote_surprise.mp3',
  emote_taunt: '/audio/sfx/emote_taunt.mp3',
  emote_doze: '/audio/sfx/emote_doze.mp3',
  emote_gg: '/audio/sfx/emote_gg.mp3',
  // 알 소리
  clack: '/audio/sfx/clack.mp3',
  land: '/audio/sfx/land.mp3',
  // 배경음악
  'music:lobby': '/audio/music/lobby.mp3',
  'music:bar': '/audio/music/bar.mp3',
  'music:rooftop': '/audio/music/rooftop.mp3',
  'music:classroom': '/audio/music/classroom.mp3',
  'music:beach': '/audio/music/beach.mp3',
  // 테마 배경 소리
  'ambience:bar': '/audio/ambience/bar.mp3',
  'ambience:rooftop': '/audio/ambience/rooftop.mp3',
  'ambience:classroom': '/audio/ambience/classroom.mp3',
  'ambience:beach': '/audio/ambience/beach.mp3',
};

/**
 * 파일마다 곱하는 크기. 파일은 최대 −3dB·음악 −18LUFS·배경 소리 −24~−30LUFS로 맞춰 두었고,
 * 합성 소리와 비슷한 크기로 들리도록 여기서 줄인다(측정값 기준, 사용자 청취로 조정).
 */
const GAIN_OVERRIDE: Partial<Record<string, number>> = {
  // 측정한 평균 크기(RMS)가 다른 것과 비슷해지도록 조정
  'ambience:bar': 1.0,
  'ambience:rooftop': 0.3,
  emote_surprise: 0.28,
  emote_taunt: 0.35,
  emote_gg: 0.8,
};

export function fileGain(key: string): number {
  const o = GAIN_OVERRIDE[key];
  if (o !== undefined) return o;
  if (key.startsWith('music:')) return 0.35;
  if (key.startsWith('ambience:')) return 0.6;
  if (key.startsWith('emote_')) return 0.45;
  return 0.55;
}
