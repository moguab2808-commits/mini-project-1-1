// 소리 엔진(DEC-084). Web Audio 하나에 배경음악·배경 소리·효과음 세 갈래 음량을 두고,
// 모든 소리는 코드 합성으로 먼저 낸다. 녹음 음원(CC0)을 고르면 `files.ts`에 주소만 적으면 그 파일로 바뀐다.
// 브라우저는 사용자 입력 전에는 소리를 막으므로 첫 클릭·키 입력 때 열고, 그 전에 요청된 음악·배경 소리는 그때 시작한다.
// AudioContext가 없는 환경(테스트·옛 브라우저)에서는 아무것도 하지 않는다.
import type { ThemeId } from '@alkkagi/shared';
import { loadSoundOn, loadVolumeOf, type VolumeKind } from '../app/settings.ts';
import { startAmbience, type AmbienceHandle } from './ambience.ts';
import { SOUND_FILES, fileGain } from './files.ts';
import { startMusic, type MusicHandle, type TrackId } from './music.ts';
import { SFX, SFX_LOOPS, type SfxId, type SfxOptions } from './sfx.ts';

export type { SfxId } from './sfx.ts';
export type { TrackId } from './music.ts';

/** 음량 0~100을 귀에 고르게 들리도록 제곱 곡선으로 바꾼다 */
export function volumeToGain(v: number): number {
  const x = Math.min(100, Math.max(0, v)) / 100;
  return x * x;
}

interface Request<T> {
  id: number;
  value: T;
  priority: number;
}

/** 여러 화면이 동시에 요청해도 우선순위가 높은(같으면 나중) 것 하나만 고른다 */
export class RequestStack<T> {
  private items: Request<T>[] = [];
  private seq = 0;
  push(value: T, priority: number): number {
    const id = ++this.seq;
    this.items.push({ id, value, priority });
    return id;
  }
  remove(id: number) {
    this.items = this.items.filter((r) => r.id !== id);
  }
  top(): T | null {
    let best: Request<T> | null = null;
    for (const r of this.items) if (!best || r.priority >= best.priority) best = r;
    return best ? best.value : null;
  }
}

/** 효과음 파일을 받지 못했을 때 다시 받기까지 기다리는 시간 */
const SFX_RETRY_MS = 10_000;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private buses: Partial<Record<VolumeKind, GainNode>> = {};
  private readonly buffers = new Map<string, AudioBuffer | 'loading' | 'failed'>();
  private readonly musicReq = new RequestStack<TrackId>();
  private readonly ambReq = new RequestStack<ThemeId>();
  private music: { id: TrackId; h: MusicHandle } | null = null;
  private amb: { id: ThemeId; h: AmbienceHandle } | null = null;
  private installed = false;
  private readonly listeners = new Set<() => void>();

  /** 소리가 열렸는가(첫 사용자 입력 뒤 true) */
  get unlocked(): boolean {
    return this.ctx?.state === 'running';
  }

  /** 열림·설정 변화를 듣는다(소리 버튼 표시용) */
  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private emit() {
    for (const fn of this.listeners) fn();
  }

  /** 첫 사용자 입력에 소리를 열고, 버튼 누름에 클릭 소리를 낸다. 여러 번 불러도 한 번만 건다 */
  install() {
    if (this.installed || typeof window === 'undefined') return;
    this.installed = true;
    const unlock = () => this.unlock();
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    window.addEventListener(
      'click',
      (e) => {
        const el = e.target instanceof Element ? e.target.closest('button, [role="button"]') : null;
        if (el && !(el as HTMLButtonElement).disabled) this.sfx('click');
      },
      true,
    );
  }

  unlock() {
    if (typeof AudioContext === 'undefined') return;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      const master = this.ctx.createDynamicsCompressor();
      master.threshold.value = -12;
      master.ratio.value = 4;
      master.connect(this.ctx.destination);
      for (const kind of ['music', 'ambience', 'sfx'] as const) {
        const g = this.ctx.createGain();
        g.gain.value = loadSoundOn(kind) ? volumeToGain(loadVolumeOf(kind)) : 0;
        g.connect(master);
        this.buses[kind] = g;
      }
    }
    const ctx = this.ctx;
    void ctx
      .resume()
      .then(() => {
        // 효과음 녹음 파일은 작아서(모두 합쳐 약 120KB) 처음 열 때 미리 받는다
        for (const key of Object.keys(SOUND_FILES))
          if (!key.includes(':')) this.fileBuffer(ctx, key);
        this.refresh();
      })
      .catch(() => {});
  }

  private ready(): AudioContext | null {
    return this.ctx && this.ctx.state === 'running' ? this.ctx : null;
  }

  /** 저장된 음량·켜기 설정을 다시 읽어 적용한다(설정 창에서 바꾼 뒤 부른다) */
  applySettings(kind: VolumeKind) {
    const g = this.buses[kind];
    if (!g || !this.ctx) {
      this.emit();
      return;
    }
    const v = loadSoundOn(kind) ? volumeToGain(loadVolumeOf(kind)) : 0;
    g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    this.emit();
  }

  /** 효과음 하나. 녹음 파일이 등록돼 있고 받아 두었으면 파일, 아니면 합성 */
  sfx(id: SfxId, o: SfxOptions = {}) {
    const ctx = this.ready();
    const bus = this.buses.sfx;
    if (!ctx || !bus) return;
    const out = this.panned(ctx, bus, o.pan ?? 0, o.gain ?? 1);
    const buf = this.fileBuffer(ctx, id);
    if (buf) {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = o.rate ?? 1;
      const fg = ctx.createGain();
      fg.gain.value = fileGain(id);
      src.connect(fg).connect(out);
      src.start();
      src.onended = () => out.disconnect();
      return;
    }
    SFX[id](ctx, out, ctx.currentTime + 0.005, o);
    // 합성 소리는 길어야 3초다. 그 뒤 연결을 정리한다
    window.setTimeout(() => out.disconnect(), 4000);
  }

  /** 끌 때까지 이어지는 효과음(물총 물줄기 등). 끄는 함수를 돌려준다 */
  loop(id: 'spray', o: SfxOptions = {}): () => void {
    const ctx = this.ready();
    const bus = this.buses.sfx;
    if (!ctx || !bus) return () => {};
    const out = this.panned(ctx, bus, o.pan ?? 0, o.gain ?? 1);
    const stop = SFX_LOOPS[id](ctx, out);
    return () => {
      stop();
      window.setTimeout(() => out.disconnect(), 600);
    };
  }

  /** 배경음악 요청. 돌려준 함수로 요청을 거둔다(화면이 사라질 때) */
  requestMusic(track: TrackId, priority = 0): () => void {
    const id = this.musicReq.push(track, priority);
    this.refresh();
    return () => {
      this.musicReq.remove(id);
      this.refresh();
    };
  }

  requestAmbience(theme: ThemeId, priority = 0): () => void {
    const id = this.ambReq.push(theme, priority);
    this.refresh();
    return () => {
      this.ambReq.remove(id);
      this.refresh();
    };
  }

  /** 배경음악을 잠시 줄인다(결과 팡파레 등). 0~1 */
  duckMusic(level: number, seconds = 0.4) {
    this.music?.h.duck(level, seconds);
  }

  private refresh() {
    const ctx = this.ready();
    if (!ctx) return;
    const wantMusic = this.musicReq.top();
    if (wantMusic !== (this.music?.id ?? null)) {
      this.music?.h.stop(1.2);
      this.music = null;
      const bus = this.buses.music;
      if (wantMusic && bus) {
        this.music = {
          id: wantMusic,
          h: startMusic(ctx, bus, wantMusic, this.fileFor(ctx, `music:${wantMusic}`)),
        };
      }
    }
    const wantAmb = this.ambReq.top();
    if (wantAmb !== (this.amb?.id ?? null)) {
      this.amb?.h.stop(1.5);
      this.amb = null;
      const bus = this.buses.ambience;
      if (wantAmb && bus) {
        this.amb = {
          id: wantAmb,
          h: startAmbience(ctx, bus, wantAmb, this.fileFor(ctx, `ambience:${wantAmb}`)),
        };
      }
    }
  }

  private panned(ctx: AudioContext, bus: AudioNode, pan: number, gain: number): AudioNode {
    const g = ctx.createGain();
    g.gain.value = gain;
    if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p).connect(bus);
      return g;
    }
    g.connect(bus);
    return g;
  }

  /** 등록된 녹음 파일을 받아 둔 상태면 돌려주고, 처음이면 받기 시작한다 */
  private fileBuffer(ctx: AudioContext, key: string): AudioBuffer | null {
    const url = SOUND_FILES[key];
    if (!url) return null;
    const got = this.buffers.get(key);
    if (got instanceof AudioBuffer) return got;
    if (!got) {
      this.buffers.set(key, 'loading');
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status} ${url}`);
          return r.arrayBuffer();
        })
        .then((a) => ctx.decodeAudioData(a))
        .then((b) => this.buffers.set(key, b))
        .catch(() => {
          // 실패하면 잠시 합성으로 내다가 다시 받는다(음악·배경 소리처럼). 자주 나는 소리라 바로 재시도하지 않는다.
          this.buffers.set(key, 'failed');
          setTimeout(() => this.buffers.delete(key), SFX_RETRY_MS);
        });
    }
    return null;
  }

  /** 음악·배경 소리용: 파일 주소가 있으면 받아 두는 약속(없으면 null) */
  private readonly loading = new Map<string, Promise<AudioBuffer>>();
  /** 음악·배경 소리 파일. 한 번 받은 곡은 다시 받지 않는다 */
  private fileFor(
    ctx: AudioContext,
    key: string,
  ): { buf: Promise<AudioBuffer>; gain: number } | null {
    const url = SOUND_FILES[key];
    if (!url) return null;
    let p = this.loading.get(key);
    if (!p) {
      p = fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status} ${url}`);
          return r.arrayBuffer();
        })
        .then((a) => ctx.decodeAudioData(a));
      // 실패하면 다음 요청 때 다시 받는다(그동안은 합성으로 낸다)
      p.catch(() => this.loading.delete(key));
      this.loading.set(key, p);
    }
    return { buf: p, gain: fileGain(key) };
  }
}

/** 앱 전체에서 하나만 쓴다 */
export const audio = new AudioEngine();
