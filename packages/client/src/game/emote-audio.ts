import type { EmoteId } from '@alkkagi/shared';
import { loadVolume } from '../app/settings.ts';

/** 외부 음원 없이 합성하는 여섯 짧은 효과음. 오디오 권한은 실제 사용자 입력 때 연다. */
export class EmoteAudio {
  private context: AudioContext | null = null;
  unlock = () => {
    if (typeof AudioContext === 'undefined') return;
    this.context ??= new AudioContext();
    void this.context.resume().catch(() => {});
  };
  play(emote: EmoteId) {
    const ctx = this.context;
    const volume = loadVolume() / 100;
    if (!ctx || ctx.state !== 'running' || volume === 0) return;
    const notes: Record<EmoteId, number[]> = {
      yawn: [330, 280, 220],
      taunt: [440, 554, 440],
      doze: [220, 196],
      gg: [523, 659, 784],
      laugh: [660, 660, 784, 784],
      surprise: [330, 880],
    };
    notes[emote].forEach((frequency, i) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + i * 0.1;
      oscillator.type = emote === 'doze' || emote === 'yawn' ? 'sine' : 'triangle';
      oscillator.frequency.setValueAtTime(frequency, at);
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(volume * 0.1, at + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.16);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.17);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }
  dispose() {
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}
