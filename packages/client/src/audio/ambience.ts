// 테마별 배경 소리(DEC-084). 녹음 음원(CC0)을 고르기 전까지 잡음·발진기로 흉내 낸다.
// 바: 장난감 가게 실내 웅웅거림 + 시계 째깍 + 가끔 오르골. 밤 옥상: 밤바람 + 풀벌레 + 가끔 먼 종.
// 교실: 낮 실내 + 창밖 새소리. 해변: 밀려왔다 빠지는 파도 + 갈매기.
// `files.ts`에 `ambience:<테마>` 파일이 있으면 그 파일을 반복 재생한다.
import type { ThemeId } from '@alkkagi/shared';
import { bell, hz, loopBuffer, noise, noiseBuffer, tone } from './sfx.ts';

export interface AmbienceHandle {
  stop: (fadeSeconds?: number) => void;
}

type Ctx = BaseAudioContext;

/** 끝없이 도는 잡음 바탕(필터·크기 지정). 크기는 느린 LFO로 출렁일 수 있다 */
function bed(
  ctx: Ctx,
  out: AudioNode,
  o: {
    type: BiquadFilterType;
    freq: number;
    q?: number;
    gain: number;
    swell?: { rate: number; depth: number };
  },
): () => void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = o.type;
  f.frequency.value = o.freq;
  f.Q.value = o.q ?? 0.7;
  const g = ctx.createGain();
  g.gain.value = o.gain;
  src.connect(f).connect(g).connect(out);
  let lfo: OscillatorNode | null = null;
  if (o.swell) {
    lfo = ctx.createOscillator();
    lfo.frequency.value = o.swell.rate;
    const lg = ctx.createGain();
    lg.gain.value = o.gain * o.swell.depth;
    lfo.connect(lg).connect(g.gain);
    const lf = ctx.createGain();
    lf.gain.value = o.freq * 0.4;
    lfo.connect(lf).connect(f.frequency);
    lfo.start();
  }
  src.start(0, Math.random() * 1.5);
  return () => {
    src.stop();
    lfo?.stop();
  };
}

/** 사이사이 무작위 소리(새·갈매기·풀벌레 등). 다음 간격(초)과 소리 함수를 받는다 */
function every(ctx: Ctx, min: number, max: number, play: (t: number) => void): () => void {
  let alive = true;
  let id: ReturnType<typeof setTimeout>;
  const next = () => {
    if (!alive) return;
    id = setTimeout(
      () => {
        if (!alive) return;
        play(ctx.currentTime + 0.05);
        next();
      },
      (min + Math.random() * (max - min)) * 1000,
    );
  };
  next();
  return () => {
    alive = false;
    clearTimeout(id);
  };
}

const THEMES: Record<ThemeId, (ctx: Ctx, out: AudioNode) => (() => void)[]> = {
  bar: (ctx, out) => [
    bed(ctx, out, { type: 'lowpass', freq: 260, gain: 0.2 }),
    every(ctx, 0.95, 1.05, (t) => noise(ctx, out, t, 0.02, { freq: 2600, q: 12, peak: 0.025 })),
    every(ctx, 9, 16, (t) => {
      const notes = [15, 19, 22, 27, 22];
      notes.forEach((n, i) => bell(ctx, out, t + i * 0.22, hz(n), 0.035, 1.2));
    }),
  ],
  rooftop: (ctx, out) => [
    bed(ctx, out, {
      type: 'bandpass',
      freq: 420,
      q: 0.6,
      gain: 0.16,
      swell: { rate: 0.09, depth: 0.6 },
    }),
    every(ctx, 0.6, 2.2, (t) => {
      for (let i = 0; i < 3; i++) tone(ctx, out, t + i * 0.07, 4400, 0.035, { peak: 0.02 });
    }),
    every(ctx, 14, 24, (t) => bell(ctx, out, t, hz(-2), 0.03, 2.5)),
  ],
  classroom: (ctx, out) => [
    bed(ctx, out, { type: 'lowpass', freq: 400, gain: 0.12 }),
    every(ctx, 1.5, 5, (t) => {
      const base = 2400 + Math.random() * 1200;
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++)
        tone(ctx, out, t + i * 0.11, base, 0.07, {
          peak: 0.06,
          to: base * (1.2 + Math.random() * 0.3),
        });
    }),
  ],
  beach: (ctx, out) => [
    bed(ctx, out, { type: 'lowpass', freq: 900, gain: 0.2, swell: { rate: 0.13, depth: 0.85 } }),
    bed(ctx, out, { type: 'highpass', freq: 5000, gain: 0.025, swell: { rate: 0.13, depth: 0.9 } }),
    every(ctx, 7, 15, (t) => {
      for (let i = 0; i < 2; i++)
        tone(ctx, out, t + i * 0.35, 1500, 0.28, { peak: 0.025, to: 1050, type: 'triangle' });
    }),
  ],
};

export function startAmbience(
  ctx: Ctx,
  bus: AudioNode,
  theme: ThemeId,
  file: { buf: Promise<AudioBuffer>; gain: number } | null,
): AmbienceHandle {
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.0001, ctx.currentTime);
  out.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 2);
  out.connect(bus);
  let stops: (() => void)[] = [];
  let stopped = false;
  if (file) {
    file.buf.then(
      (buf) => {
        if (stopped) return;
        const fg = ctx.createGain();
        fg.gain.value = file.gain;
        fg.connect(out);
        stops = [loopBuffer(ctx, buf, fg, 3)];
      },
      () => {
        if (!stopped) stops = THEMES[theme](ctx, out);
      },
    );
  } else {
    stops = THEMES[theme](ctx, out);
  }
  return {
    stop: (fade = 1.5) => {
      stopped = true;
      const now = ctx.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), now);
      out.gain.exponentialRampToValueAtTime(0.0001, now + fade);
      setTimeout(
        () => {
          for (const s of stops) s();
          out.disconnect();
        },
        (fade + 0.2) * 1000,
      );
    },
  };
}
