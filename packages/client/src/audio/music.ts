// 배경음악(DEC-084). 녹음 곡(CC0)을 고르기 전까지 코드로 작곡한 장난감 왕국 음악을 낸다.
// 곡마다 조·빠르기·화음 진행·악기(오르골·실로폰·첼레스타·우쿨렐레풍·스틸드럼풍)를 달리하고,
// 정해진 씨앗으로 16마디 선율을 한 번 만들어 되풀이한다. `files.ts`에 `music:<곡>` 파일이 있으면 그 파일을 반복 재생한다.
import { bell, hz, loopBuffer, mallet, noise, tone } from './sfx.ts';

export type TrackId = 'lobby' | 'bar' | 'rooftop' | 'classroom' | 'beach';

export interface MusicHandle {
  stop: (fadeSeconds?: number) => void;
  duck: (level: number, seconds?: number) => void;
}

type Ctx = BaseAudioContext;
type Instrument = (
  ctx: Ctx,
  out: AudioNode,
  t: number,
  freq: number,
  dur: number,
  vel: number,
) => void;

const INSTRUMENTS: Record<string, Instrument> = {
  musicbox: (ctx, out, t, f, _d, v) => bell(ctx, out, t, f, 0.16 * v, 1.0),
  celesta: (ctx, out, t, f, d, v) => {
    tone(ctx, out, t, f, Math.max(0.6, d * 2), { peak: 0.14 * v });
    tone(ctx, out, t, f * 2, Math.max(0.3, d), { peak: 0.05 * v });
  },
  marimba: (ctx, out, t, f, _d, v) => mallet(ctx, out, t, f, 0.18 * v, 0.45),
  pluck: (ctx, out, t, f, _d, v) => {
    tone(ctx, out, t, f, 0.35, { peak: 0.14 * v, type: 'triangle' });
    tone(ctx, out, t, f * 2, 0.15, { peak: 0.05 * v, type: 'triangle' });
  },
  steeldrum: (ctx, out, t, f, _d, v) => {
    tone(ctx, out, t, f, 0.6, { peak: 0.13 * v });
    tone(ctx, out, t, f * 1.5, 0.35, { peak: 0.05 * v });
    tone(ctx, out, t, f * 2.02, 0.4, { peak: 0.06 * v });
  },
  bass: (ctx, out, t, f, d, v) =>
    tone(ctx, out, t, f, Math.max(0.25, d * 0.9), { peak: 0.2 * v, type: 'triangle' }),
};

interface TrackDef {
  bpm: number;
  /** 으뜸음(A4에서 반음 수) */
  root: number;
  /** 음계(으뜸음에서 반음 수) */
  scale: number[];
  /** 4마디 화음 진행(음계 도수, 0부터) */
  chords: number[];
  lead: string;
  bassInst: string;
  /** 반주 패턴: 'waltz' 3박, 'bounce' 4박 */
  feel: 'waltz' | 'bounce' | 'calm';
  shaker: boolean;
  seed: number;
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

export const TRACKS: Record<TrackId, TrackDef> = {
  lobby: {
    bpm: 96,
    root: 3,
    scale: MAJOR,
    chords: [0, 5, 3, 4],
    lead: 'musicbox',
    bassInst: 'bass',
    feel: 'bounce',
    shaker: false,
    seed: 11,
  },
  bar: {
    bpm: 108,
    root: 8,
    scale: MAJOR,
    chords: [0, 3, 4, 0],
    lead: 'musicbox',
    bassInst: 'bass',
    feel: 'waltz',
    shaker: true,
    seed: 23,
  },
  rooftop: {
    bpm: 76,
    root: 0,
    scale: MINOR,
    chords: [0, 5, 2, 6],
    lead: 'celesta',
    bassInst: 'bass',
    feel: 'calm',
    shaker: false,
    seed: 37,
  },
  classroom: {
    bpm: 116,
    root: 10,
    scale: MAJOR,
    chords: [0, 4, 5, 3],
    lead: 'marimba',
    bassInst: 'pluck',
    feel: 'bounce',
    shaker: false,
    seed: 41,
  },
  beach: {
    bpm: 100,
    root: 5,
    scale: MAJOR,
    chords: [0, 3, 4, 3],
    lead: 'steeldrum',
    bassInst: 'pluck',
    feel: 'bounce',
    shaker: true,
    seed: 53,
  },
};

/** 한 음: 시작(박, 마디 안 8분음표 칸 단위), 길이(칸), 음높이(A4에서 반음) */
export interface Note {
  step: number;
  len: number;
  pitch: number;
  vel: number;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 음계 도수(옥타브 넘어도 됨) → 반음 */
function degree(def: TrackDef, d: number): number {
  const n = def.scale.length;
  const oct = Math.floor(d / n);
  const idx = ((d % n) + n) % n;
  return def.root + oct * 12 + (def.scale[idx] ?? 0);
}

/** 박자 칸 수(8분음표): 왈츠 6, 나머지 8 */
export function stepsPerBar(def: TrackDef): number {
  return def.feel === 'waltz' ? 6 : 8;
}

const RHYTHMS: Record<'waltz' | 'four', number[][]> = {
  // 칸 안에서 음이 시작하는 자리(길이는 다음 시작까지)
  waltz: [
    [0, 2, 4],
    [0, 3, 4],
    [0, 1, 2, 4],
    [0, 2, 3, 4],
  ],
  four: [
    [0, 2, 4, 6],
    [0, 3, 4, 6],
    [0, 2, 3, 4, 6],
    [0, 1, 2, 4, 6],
    [0, 4],
    [0, 2, 4, 5, 6],
  ],
};

/**
 * 16마디 선율을 만든다(결정적). 4마디 동기 A를 만들어 A·A'(끝을 바꿈)·B·A로 엮어 되풀이감을 준다.
 * 화음 구성음에 강박을 두고, 사이는 이웃 음으로 잇는다.
 */
export function composeMelody(def: TrackDef): Note[] {
  const r = rng(def.seed);
  const spb = stepsPerBar(def);
  const pool = def.feel === 'waltz' ? RHYTHMS.waltz : RHYTHMS.four;
  const phrase = (variant: number): Note[] => {
    const notes: Note[] = [];
    let cur = 7 + Math.floor(r() * 3); // 가운데 음역(도수)
    for (let bar = 0; bar < 4; bar++) {
      const chord = def.chords[bar % def.chords.length] ?? 0;
      const pat = pool[Math.floor(r() * pool.length)] ?? pool[0]!;
      const last = bar === 3;
      pat.forEach((st, i) => {
        const next = pat[i + 1] ?? spb;
        const strong = st === 0 || (def.feel !== 'waltz' && st === 4);
        if (strong) {
          // 가장 가까운 화음 구성음(1·3·5도)
          const tones = [chord, chord + 2, chord + 4, chord + 7, chord + 9, chord + 11];
          cur = tones.reduce((a, b) => (Math.abs(b - cur) < Math.abs(a - cur) ? b : a), tones[0]!);
        } else {
          cur += r() < 0.5 ? 1 : -1;
          if (r() < 0.2) cur += r() < 0.5 ? 2 : -2;
        }
        cur = Math.max(5, Math.min(13, cur));
        // 마지막 마디는 변주에 따라 으뜸·딸림으로 맺는다
        const pitchDeg = last && i === pat.length - 1 ? (variant === 1 ? 7 : 11) : cur;
        notes.push({
          step: bar * spb + st,
          len: next - st,
          pitch: degree(def, pitchDeg),
          vel: strong ? 1 : 0.75,
        });
      });
    }
    return notes;
  };
  const a = phrase(1);
  // A': 앞 3마디는 A 그대로, 마지막 마디만 다르게 맺는다
  const tail = phrase(2).filter((n) => n.step >= 3 * spb);
  const a2 = [...a.filter((n) => n.step < 3 * spb), ...tail];
  const b = phrase(3);
  const all: Note[] = [];
  [a, a2, b, a].forEach((p, k) => {
    for (const n of p) all.push({ ...n, step: n.step + k * 4 * spb });
  });
  return all;
}

/** 반주(베이스·화음 종소리)를 마디마다 만든다 */
function accompaniment(def: TrackDef, bar: number): Note[] {
  const spb = stepsPerBar(def);
  const chord = def.chords[bar % def.chords.length] ?? 0;
  const rootP = degree(def, chord) - 24;
  const fifth = degree(def, chord + 4) - 24;
  const third = degree(def, chord + 2) - 12;
  const base = bar * spb;
  if (def.feel === 'waltz') {
    return [
      { step: base, len: 2, pitch: rootP, vel: 1 },
      { step: base + 2, len: 2, pitch: third, vel: 0.5 },
      { step: base + 4, len: 2, pitch: fifth + 12, vel: 0.5 },
    ];
  }
  if (def.feel === 'calm') {
    return [
      { step: base, len: 4, pitch: rootP, vel: 0.9 },
      { step: base + 4, len: 4, pitch: fifth, vel: 0.7 },
    ];
  }
  return [
    { step: base, len: 2, pitch: rootP, vel: 1 },
    { step: base + 2, len: 2, pitch: fifth, vel: 0.6 },
    { step: base + 4, len: 2, pitch: rootP + 12, vel: 0.8 },
    { step: base + 6, len: 2, pitch: fifth, vel: 0.6 },
  ];
}

export function startMusic(
  ctx: Ctx,
  bus: AudioNode,
  id: TrackId,
  file: { buf: Promise<AudioBuffer>; gain: number } | null,
): MusicHandle {
  const out = ctx.createGain();
  const duck = ctx.createGain();
  out.gain.setValueAtTime(0.0001, ctx.currentTime);
  out.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 1.5);
  out.connect(duck).connect(bus);
  let stopped = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopFile: (() => void) | null = null;

  const def = TRACKS[id];
  const spb = stepsPerBar(def);
  const melody = composeMelody(def);
  const totalSteps = 16 * spb;
  const stepSec = 60 / def.bpm / 2;
  const lead = INSTRUMENTS[def.lead] ?? INSTRUMENTS.musicbox!;
  const bassI = INSTRUMENTS[def.bassInst] ?? INSTRUMENTS.bass!;
  let nextStep = 0;
  let nextTime = ctx.currentTime + 0.1;

  const schedule = () => {
    if (stopped) return;
    while (nextTime < ctx.currentTime + 0.25) {
      const s = nextStep % totalSteps;
      for (const n of melody)
        if (n.step === s) lead(ctx, out, nextTime, hz(n.pitch), n.len * stepSec, n.vel);
      if (s % spb === 0) {
        const bar = Math.floor(s / spb);
        for (const n of accompaniment(def, bar))
          bassI(
            ctx,
            out,
            nextTime + (n.step - bar * spb) * stepSec,
            hz(n.pitch),
            n.len * stepSec,
            n.vel * 0.8,
          );
      }
      if (def.shaker && s % 2 === 1)
        noise(ctx, out, nextTime, 0.04, { type: 'highpass', freq: 6000, peak: 0.03 });
      nextStep++;
      nextTime += stepSec;
    }
  };

  const startSynth = () => {
    schedule();
    timer = setInterval(schedule, 60);
  };

  if (file) {
    file.buf.then(
      (buf) => {
        if (stopped) return;
        const fg = ctx.createGain();
        fg.gain.value = file.gain;
        fg.connect(out);
        stopFile = loopBuffer(ctx, buf, fg, 2.5);
      },
      () => {
        if (!stopped) startSynth();
      },
    );
  } else {
    startSynth();
  }

  return {
    stop: (fade = 1) => {
      stopped = true;
      if (timer) clearInterval(timer);
      const now = ctx.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(Math.max(0.0001, out.gain.value), now);
      out.gain.exponentialRampToValueAtTime(0.0001, now + fade);
      setTimeout(
        () => {
          stopFile?.();
          out.disconnect();
        },
        (fade + 0.2) * 1000,
      );
    },
    duck: (level, seconds = 0.4) => {
      duck.gain.setTargetAtTime(Math.max(0.0001, level), ctx.currentTime, seconds / 3);
    },
  };
}
