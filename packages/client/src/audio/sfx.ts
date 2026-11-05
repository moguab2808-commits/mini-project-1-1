// 코드로 합성한 효과음(DEC-084). 장난감 왕국 톤: 나무·실로폰·종소리·마법 반짝임.
// 각 함수는 (ctx, 출력, 시작 시각, 옵션)을 받아 노드를 만들고 스스로 멈춘다(길어야 3초).
// 사람 목소리(감정표현)는 합성으로는 만화 같은 흉내만 낼 수 있어, 녹음 파일(files.ts)로 바꾸는 자리를 둔다.

export interface SfxOptions {
  /** 크기 배율(기본 1) */
  gain?: number;
  /** 좌우 -1~1 */
  pan?: number;
  /** 파일 재생 속도·합성 음높이 배율 */
  rate?: number;
}

type Ctx = BaseAudioContext;
type Synth = (ctx: Ctx, out: AudioNode, t: number, o: SfxOptions) => void;

// ───────── 기본 부품 ─────────

const noiseCache = new WeakMap<Ctx, AudioBuffer>();
/** 2초짜리 흰 잡음 버퍼(문맥마다 한 번) */
export function noiseBuffer(ctx: Ctx): AudioBuffer {
  let b = noiseCache.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = b.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < d.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      d[i] = (seed / 4294967296) * 2 - 1;
    }
    noiseCache.set(ctx, b);
  }
  return b;
}

/** 빠르게 올라갔다 지수로 사라지는 크기 */
function env(ctx: Ctx, t: number, peak: number, attack: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  return g;
}

/** 음 하나: 파형·주파수(끝 주파수로 미끄러질 수 있음)·크기 곡선 */
export function tone(
  ctx: Ctx,
  out: AudioNode,
  t: number,
  freq: number,
  dur: number,
  o: { type?: OscillatorType; peak?: number; attack?: number; to?: number; detune?: number } = {},
) {
  const osc = ctx.createOscillator();
  osc.type = o.type ?? 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  if (o.detune) osc.detune.value = o.detune;
  const g = env(ctx, t, o.peak ?? 0.3, o.attack ?? 0.005, dur);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + (o.attack ?? 0.005) + dur + 0.05);
}

/** 잡음 한 덩이: 필터 종류·주파수(끝 주파수로 쓸 수 있음) */
export function noise(
  ctx: Ctx,
  out: AudioNode,
  t: number,
  dur: number,
  o: {
    type?: BiquadFilterType;
    freq?: number;
    to?: number;
    q?: number;
    peak?: number;
    attack?: number;
  } = {},
) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = o.type ?? 'bandpass';
  f.frequency.setValueAtTime(o.freq ?? 1000, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
  f.Q.value = o.q ?? 1;
  const g = env(ctx, t, o.peak ?? 0.3, o.attack ?? 0.003, dur);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 1.5);
  src.stop(t + (o.attack ?? 0.003) + dur + 0.05);
}

/** 실로폰·마림바 한 음(배음 하나 + 나무 두드림) */
export function mallet(ctx: Ctx, out: AudioNode, t: number, freq: number, peak = 0.25, dur = 0.5) {
  tone(ctx, out, t, freq, dur, { peak });
  tone(ctx, out, t, freq * 4, dur * 0.25, { peak: peak * 0.25 });
  noise(ctx, out, t, 0.02, { freq: freq * 3, q: 4, peak: peak * 0.3 });
}

/** 종·오르골 한 음 */
export function bell(ctx: Ctx, out: AudioNode, t: number, freq: number, peak = 0.2, dur = 1.1) {
  tone(ctx, out, t, freq, dur, { peak });
  tone(ctx, out, t, freq * 2.01, dur * 0.6, { peak: peak * 0.35 });
  tone(ctx, out, t, freq * 4.2, dur * 0.25, { peak: peak * 0.18 });
}

/** 반짝이는 위로 오르는 종소리 몇 개 */
function sparkle(
  ctx: Ctx,
  out: AudioNode,
  t: number,
  base = 1568,
  n = 5,
  step = 0.05,
  peak = 0.12,
) {
  const ratios = [1, 1.25, 1.5, 2, 2.5, 3];
  for (let i = 0; i < n; i++)
    bell(ctx, out, t + i * step, base * (ratios[i % ratios.length] ?? 1), peak, 0.5);
}

/** 만화 목소리: 톱니파 + 모음 모양 필터 두 개. 모음 [제1, 제2 공명]을 시간에 따라 바꾼다 */
function voice(
  ctx: Ctx,
  out: AudioNode,
  t: number,
  dur: number,
  f0: number,
  f0to: number,
  vowels: [number, number][],
  peak = 0.18,
  vibrato = 0,
) {
  const src = ctx.createOscillator();
  src.type = 'sawtooth';
  src.frequency.setValueAtTime(f0, t);
  src.frequency.exponentialRampToValueAtTime(f0to, t + dur);
  if (vibrato > 0) {
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 6;
    lg.gain.value = vibrato;
    lfo.connect(lg).connect(src.frequency);
    lfo.start(t);
    lfo.stop(t + dur + 0.1);
  }
  const g = env(ctx, t, peak, 0.03, dur);
  for (let k = 0; k < 2; k++) {
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 6;
    vowels.forEach((v, i) => {
      const at = t + (dur * i) / Math.max(1, vowels.length - 1);
      if (i === 0) f.frequency.setValueAtTime(v[k] ?? 800, at);
      else f.frequency.linearRampToValueAtTime(v[k] ?? 800, at);
    });
    src.connect(f).connect(g);
  }
  g.connect(out);
  src.start(t);
  src.stop(t + dur + 0.1);
}

const A: [number, number] = [800, 1200];
const O: [number, number] = [450, 800];
const E: [number, number] = [500, 1800];
const U: [number, number] = [350, 700];

/** 음이름 → 주파수(A4=440, 반음 단위) */
export const hz = (semitonesFromA4: number) => 440 * Math.pow(2, semitonesFromA4 / 12);
const C5 = hz(3);
const E5 = hz(7);
const G5 = hz(10);
const C6 = hz(15);

// ───────── 효과음 ─────────

export const SFX = {
  /** 버튼 누름: 작은 나무 톡 */
  click: (ctx, out, t) => {
    noise(ctx, out, t, 0.03, { freq: 2400, q: 6, peak: 0.12 });
    tone(ctx, out, t, 1200, 0.04, { peak: 0.05 });
  },
  /** 알 튕기기: 손가락 딱 + 알이 미끄러져 나가는 낮은 쿵 */
  shot: (ctx, out, t, o) => {
    const g = o.gain ?? 1;
    noise(ctx, out, t, 0.025, { freq: 3200, q: 3, peak: 0.35 * g });
    tone(ctx, out, t, 2100, 0.05, { peak: 0.12 * g, to: 1600 });
    tone(ctx, out, t + 0.005, 140, 0.12, { peak: 0.25 * g, to: 90 });
  },
  /** 알이 떠오름: 위로 휘익 */
  lift: (ctx, out, t) => {
    noise(ctx, out, t, 0.35, { freq: 500, to: 2600, q: 2, peak: 0.12, attack: 0.05 });
    tone(ctx, out, t, 400, 0.3, { peak: 0.06, to: 900, type: 'triangle' });
  },
  /** 알끼리 부딪힘: 돌 딱 소리. gain으로 세기를 준다 */
  clack: (ctx, out, t, o) => {
    const g = o.gain ?? 1;
    const p = o.rate ?? 1;
    noise(ctx, out, t, 0.03, { freq: 3800 * p, q: 8, peak: 0.45 * g });
    tone(ctx, out, t, 2350 * p, 0.07, { peak: 0.18 * g });
    tone(ctx, out, t, 3150 * p, 0.05, { peak: 0.1 * g });
  },
  /** 떠 있던 알이 판에 내려앉음 */
  land: (ctx, out, t, o) => {
    const g = o.gain ?? 1;
    noise(ctx, out, t, 0.05, { freq: 1500, q: 2, peak: 0.25 * g });
    tone(ctx, out, t, 220, 0.08, { peak: 0.18 * g, to: 150 });
  },
  /** 구멍으로 빠짐: 마법 우물로 빨려 내려가는 소리 */
  pit: (ctx, out, t) => {
    tone(ctx, out, t, 900, 0.7, { peak: 0.12, to: 120, type: 'sine' });
    tone(ctx, out, t, 1350, 0.6, { peak: 0.06, to: 180, type: 'triangle' });
    sparkle(ctx, out, t + 0.05, 2093, 4, 0.06, 0.06);
  },
  /** 내 차례: 실로폰 두 음 위로 */
  my_turn: (ctx, out, t) => {
    mallet(ctx, out, t, G5, 0.22);
    mallet(ctx, out, t + 0.11, C6, 0.24, 0.7);
  },
  /** 상대 차례: 낮은 한 음 */
  opp_turn: (ctx, out, t) => {
    mallet(ctx, out, t, hz(-2), 0.12, 0.4);
  },
  /** 남은 시간 째깍(rate>1이면 마지막 초) */
  tick: (ctx, out, t, o) => {
    const last = (o.rate ?? 1) > 1;
    noise(ctx, out, t, 0.03, { freq: last ? 2600 : 1800, q: 10, peak: 0.3 });
    tone(ctx, out, t, last ? 1320 : 990, 0.06, { peak: 0.1 });
  },
  /** 방해요소 받음: 반짝이 아르페지오 */
  grant: (ctx, out, t) => {
    sparkle(ctx, out, t, C5 * 2, 6, 0.055, 0.12);
    tone(ctx, out, t, C5, 0.6, { peak: 0.06, type: 'triangle' });
  },
  /** 승리: 실로폰 팡파레 */
  win: (ctx, out, t) => {
    [C5, E5, G5, C6].forEach((f, i) => mallet(ctx, out, t + i * 0.12, f, 0.25, 0.4));
    [C5, E5, G5, C6].forEach((f) => bell(ctx, out, t + 0.55, f, 0.12, 1.6));
    sparkle(ctx, out, t + 0.6, 2637, 6, 0.07, 0.07);
  },
  /** 패배: 와-와-와 내려가는 소리 */
  lose: (ctx, out, t) => {
    [hz(-2), hz(-3), hz(-4)].forEach((f, i) =>
      voice(ctx, out, t + i * 0.32, 0.3, f, f * 0.97, [U, O], 0.3),
    );
    voice(ctx, out, t + 0.96, 0.9, hz(-5), hz(-7), [U, O, U], 0.3, 6);
  },
  /** 무승부: 두 음 */
  draw: (ctx, out, t) => {
    mallet(ctx, out, t, E5, 0.2);
    mallet(ctx, out, t + 0.18, E5, 0.2, 0.8);
  },

  // ── 방해요소 ──
  /** 장난감 벽돌: 나무 블록 톡톡톡 */
  brick: (ctx, out, t) => {
    [0, 0.07, 0.13].forEach((d, i) => {
      noise(ctx, out, t + d, 0.04, { freq: 900 + i * 200, q: 6, peak: 0.3 });
      tone(ctx, out, t + d, 520 + i * 90, 0.08, { peak: 0.15, type: 'triangle' });
    });
  },
  /** 슬라임: 철퍽 */
  slime: (ctx, out, t) => {
    noise(ctx, out, t, 0.25, { type: 'lowpass', freq: 1800, to: 250, q: 6, peak: 0.35 });
    tone(ctx, out, t, 300, 0.25, { peak: 0.15, to: 120 });
    tone(ctx, out, t + 0.12, 600, 0.1, { peak: 0.06, to: 900 });
  },
  /** 자석 블랙홀: 휘감는 소용돌이 */
  magnet: (ctx, out, t) => {
    noise(ctx, out, t, 0.9, { freq: 300, to: 1600, q: 3, peak: 0.18, attack: 0.15 });
    tone(ctx, out, t, 110, 1.0, { peak: 0.18, to: 55, attack: 0.1 });
    tone(ctx, out, t, 660, 0.8, { peak: 0.04, to: 1760, type: 'triangle', attack: 0.2 });
  },
  /** 자석에 알이 빨려 듦 */
  magnet_suck: (ctx, out, t) => {
    tone(ctx, out, t, 1400, 0.45, { peak: 0.08, to: 300, type: 'triangle' });
    noise(ctx, out, t, 0.4, { freq: 2000, to: 400, q: 4, peak: 0.08 });
  },
  /** 중력 구역: 깊은 우웅 */
  gravity: (ctx, out, t) => {
    tone(ctx, out, t, 70, 0.9, { peak: 0.3, to: 45, attack: 0.08 });
    noise(ctx, out, t, 0.7, { type: 'lowpass', freq: 600, to: 150, peak: 0.12, attack: 0.1 });
  },
  /** 미끄럼 장판: 얼음 결정 땡그랑 */
  ice: (ctx, out, t) => {
    sparkle(ctx, out, t, 2637, 5, 0.04, 0.09);
    noise(ctx, out, t, 0.3, { type: 'highpass', freq: 5000, peak: 0.08 });
  },
  /** 방향 반전: 되감기 */
  reverse: (ctx, out, t) => {
    tone(ctx, out, t, 300, 0.25, { peak: 0.1, to: 1200, type: 'sawtooth' });
    tone(ctx, out, t + 0.25, 1200, 0.25, { peak: 0.1, to: 300, type: 'sawtooth' });
    sparkle(ctx, out, t + 0.1, 1760, 3, 0.08, 0.06);
  },
  /** 폭탄 놓음: 쇠 딸깍 + 심지 칙 */
  bomb_place: (ctx, out, t) => {
    tone(ctx, out, t, 1800, 0.12, { peak: 0.1, type: 'square' });
    noise(ctx, out, t + 0.05, 0.5, { type: 'highpass', freq: 4000, peak: 0.1, attack: 0.05 });
  },
  /** 폭탄 터짐: 펑 */
  bomb: (ctx, out, t) => {
    tone(ctx, out, t, 150, 0.7, { peak: 0.42, to: 35 });
    noise(ctx, out, t, 0.6, { type: 'lowpass', freq: 3000, to: 200, peak: 0.45 });
    noise(ctx, out, t + 0.05, 0.4, { type: 'highpass', freq: 3000, peak: 0.15 });
    sparkle(ctx, out, t + 0.15, 1568, 4, 0.05, 0.05);
  },
  /** 구멍 열림: 나무 우지끈 + 우물 울림 */
  pit_open: (ctx, out, t) => {
    [0, 0.05, 0.11, 0.18].forEach((d) =>
      noise(ctx, out, t + d, 0.05, { freq: 700, q: 3, peak: 0.25 }),
    );
    tone(ctx, out, t + 0.1, 220, 0.8, { peak: 0.1, to: 110 });
  },
  /** 분신술: 펑 연기 + 반짝 */
  decoy: (ctx, out, t) => {
    noise(ctx, out, t, 0.25, { type: 'lowpass', freq: 2500, to: 400, peak: 0.25 });
    sparkle(ctx, out, t + 0.08, 2093, 4, 0.05, 0.08);
  },
  /** 판 돌리기: 빙글 올라가는 소리 */
  spin: (ctx, out, t) => {
    noise(ctx, out, t, 0.8, { freq: 400, to: 2400, q: 5, peak: 0.15, attack: 0.1 });
    tone(ctx, out, t, 200, 0.8, { peak: 0.08, to: 600, type: 'triangle' });
  },
  /** 책상 흔들기: 덜덜덜 */
  shake: (ctx, out, t) => {
    for (let i = 0; i < 10; i++)
      noise(ctx, out, t + i * 0.045, 0.035, { freq: 500 + (i % 3) * 200, q: 3, peak: 0.7 });
  },
  /** 기절: 빙글빙글 새 지저귐 */
  stun: (ctx, out, t) => {
    for (let i = 0; i < 4; i++) tone(ctx, out, t + i * 0.16, 2200, 0.12, { peak: 0.08, to: 2900 });
    tone(ctx, out, t, 400, 0.8, { peak: 0.08, to: 200, type: 'triangle' });
  },
  /** 후레쉬: 찌잉 빛 */
  flash: (ctx, out, t) => {
    tone(ctx, out, t, 1200, 0.4, { peak: 0.08, to: 3000, type: 'triangle' });
    sparkle(ctx, out, t + 0.05, 2637, 4, 0.04, 0.07);
  },
  /** 물총: 찍 */
  water: (ctx, out, t) => {
    noise(ctx, out, t, 0.25, { type: 'bandpass', freq: 2500, to: 1200, q: 1.5, peak: 0.3 });
    tone(ctx, out, t, 700, 0.1, { peak: 0.08, to: 1200 });
  },
  /** 바람 방향 바뀜: 휘이잉 */
  wind: (ctx, out, t) => {
    noise(ctx, out, t, 0.9, { freq: 600, to: 1400, q: 2, peak: 0.45, attack: 0.25 });
  },
  /** 알 무게 변화: 묵직한 쿵 */
  heavy: (ctx, out, t) => {
    tone(ctx, out, t, 90, 0.35, { peak: 0.45, to: 50 });
    noise(ctx, out, t, 0.1, { type: 'lowpass', freq: 400, peak: 0.3 });
  },
  /** 막대 속도 변화: 쭈욱 */
  speed: (ctx, out, t) => {
    tone(ctx, out, t, 500, 0.3, { peak: 0.1, to: 2000, type: 'square' });
  },
  /** 방해요소 사라짐: 작은 퐁 */
  hazard_end: (ctx, out, t) => {
    tone(ctx, out, t, 880, 0.15, { peak: 0.06, to: 440 });
  },

  // ── 감정표현(합성 흉내. 녹음 파일로 바꿀 자리) ──
  emote_yawn: (ctx, out, t) => voice(ctx, out, t, 1.1, 260, 150, [A, A, O, U], 0.38, 2),
  emote_taunt: (ctx, out, t) => {
    [0, 0.18, 0.36, 0.54].forEach((d, i) =>
      voice(ctx, out, t + d, 0.15, i % 2 ? 330 : 440, i % 2 ? 330 : 440, [E, A], 0.4),
    );
  },
  emote_doze: (ctx, out, t) => {
    noise(ctx, out, t, 0.7, { type: 'lowpass', freq: 500, peak: 0.45, attack: 0.3 });
    noise(ctx, out, t + 0.8, 0.6, { type: 'bandpass', freq: 1800, q: 2, peak: 0.2, attack: 0.25 });
  },
  emote_gg: (ctx, out, t) => {
    for (let i = 0; i < 4; i++)
      noise(ctx, out, t + i * 0.09, 0.05, { freq: 1500, q: 1, peak: 0.25 });
    [C5, E5, G5].forEach((f) => bell(ctx, out, t + 0.4, f, 0.1, 0.9));
  },
  emote_laugh: (ctx, out, t) => {
    [0, 0.14, 0.28, 0.42, 0.56].forEach((d, i) =>
      voice(ctx, out, t + d, 0.11, 420 - i * 25, 380 - i * 25, [A, A], 0.4),
    );
  },
  emote_surprise: (ctx, out, t) => {
    voice(ctx, out, t, 0.5, 300, 650, [U, O, A], 0.36);
    tone(ctx, out, t + 0.05, 200, 0.4, { peak: 0.1, to: 800, type: 'triangle' });
  },
} satisfies Record<string, Synth>;

export type SfxId = keyof typeof SFX;

/** 끌 때까지 이어지는 효과음. 끄는 함수를 돌려준다 */
export const SFX_LOOPS = {
  /** 물총 물줄기: 쏴아 */
  spray: (ctx: Ctx, out: AudioNode) => {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx);
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2200;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.1);
    src.connect(f).connect(g).connect(out);
    src.start(t);
    return () => {
      const now = ctx.currentTime;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
      src.stop(now + 0.3);
    };
  },
};

/**
 * 녹음 파일을 끝없이 되풀이한다. 녹음 끝과 처음이 매끄럽지 않아도 끊기지 않도록 겹쳐(교차 페이드) 잇는다.
 * 끄는 함수를 돌려준다.
 */
export function loopBuffer(
  ctx: BaseAudioContext,
  buf: AudioBuffer,
  out: AudioNode,
  xfade = 2,
): () => void {
  const dur = buf.duration;
  const x = Math.min(xfade, dur / 4);
  let alive = true;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const live: { src: AudioBufferSourceNode; g: GainNode }[] = [];
  const play = (at: number, first: boolean) => {
    if (!alive) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(first ? 1 : 0.0001, at);
    if (!first) g.gain.exponentialRampToValueAtTime(1, at + x);
    g.gain.setValueAtTime(1, at + dur - x);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(g).connect(out);
    src.start(at);
    src.stop(at + dur + 0.05);
    const item = { src, g };
    live.push(item);
    src.onended = () => {
      g.disconnect();
      live.splice(live.indexOf(item), 1);
    };
    const next = at + dur - x;
    timer = setTimeout(() => play(next, false), Math.max(0, (next - ctx.currentTime - 1) * 1000));
  };
  play(ctx.currentTime + 0.02, true);
  return () => {
    alive = false;
    if (timer) clearTimeout(timer);
    for (const { src } of [...live]) {
      try {
        src.stop();
      } catch {
        // 이미 멈췄다
      }
    }
  };
}
