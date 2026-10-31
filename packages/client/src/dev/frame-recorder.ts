// 개발용 프레임 시간 기록 (VAL-002). 판정식과 기준은 docs/ENGINEERING-VALIDATION.md의 "fps 측정 절차".
// 이 모듈은 DOM·React·Three.js를 참조하지 않는다. 호출하는 쪽이 시각(ms, 단조 시계)을 넘긴다.
// 개발 환경에서만 켜는 책임은 호출하는 쪽에 있다: 게임 화면은 `import.meta.env.DEV`일 때만 이 모듈을 동적 import한다.

/** 프레임 간격이 이 값(ms) 이상이면 멈춤으로 센다. */
export const STALL_MS = 100;
/** "60fps에 가깝게" 합격선 (DEC-034). */
export const AVG_FPS_TARGET = 55;
/** 하위 5% 구간 합격선. 프레임 시간 95백분위의 fps 환산값이다. */
export const LOW5_FPS_TARGET = 30;

export interface FrameMark {
  label: string;
  /** 측정 시작 후 초 */
  atSec: number;
}

export interface FrameStall {
  /** 측정 시작 후 초 (멈춤이 끝난 프레임 시각) */
  atSec: number;
  intervalMs: number;
}

export interface FrameReport {
  frames: number;
  durationSec: number;
  /** 프레임 수 ÷ 측정 시간. 프레임이 없으면 null */
  avgFps: number | null;
  /** 프레임 시간 95백분위(nearest-rank, ms) */
  p95FrameMs: number | null;
  /** 1000 ÷ p95FrameMs */
  low5Fps: number | null;
  stalls: FrameStall[];
  marks: FrameMark[];
  meetsAvgFps: boolean | null;
  meetsLow5Fps: boolean | null;
  /** 프레임 간격 원자료(ms) */
  intervalsMs: number[];
}

/** nearest-rank 백분위. sorted는 오름차순, p는 0 초과 100 이하. */
export function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1] ?? null;
}

export class FrameRecorder {
  private startMs: number | null = null;
  private lastMs = 0;
  private intervals: number[] = [];
  private stalls: FrameStall[] = [];
  private marks: FrameMark[] = [];

  get isRecording(): boolean {
    return this.startMs !== null;
  }

  /** 게임 화면 진입(판 시작) 때 호출한다. 이전 기록은 버린다. */
  start(nowMs: number): void {
    this.startMs = nowMs;
    this.lastMs = nowMs;
    this.intervals = [];
    this.stalls = [];
    this.marks = [];
  }

  /** 프레임마다 호출한다. 시작 전이거나 시각이 거꾸로 가면 무시한다. */
  frame(nowMs: number): void {
    if (this.startMs === null || nowMs < this.lastMs) return;
    const intervalMs = nowMs - this.lastMs;
    this.lastMs = nowMs;
    this.intervals.push(intervalMs);
    if (intervalMs >= STALL_MS) {
      this.stalls.push({ atSec: (nowMs - this.startMs) / 1000, intervalMs });
    }
  }

  /** 알 충돌·방해요소 효과 구간 같은 관찰 지점을 남긴다. */
  mark(label: string, nowMs: number): void {
    if (this.startMs === null) return;
    this.marks.push({ label, atSec: (nowMs - this.startMs) / 1000 });
  }

  /** 결과 화면이 뜨기 직전에 호출한다. 기록을 끝내고 요약을 돌려준다. */
  stop(): FrameReport {
    const report = this.report();
    this.startMs = null;
    return report;
  }

  /** 기록을 끝내지 않고 지금까지의 요약을 계산한다. */
  report(): FrameReport {
    const frames = this.intervals.length;
    const durationSec = this.startMs === null ? 0 : (this.lastMs - this.startMs) / 1000;
    const sorted = [...this.intervals].sort((a, b) => a - b);
    const p95FrameMs = percentile(sorted, 95);
    const avgFps = frames > 0 && durationSec > 0 ? frames / durationSec : null;
    const low5Fps = p95FrameMs !== null && p95FrameMs > 0 ? 1000 / p95FrameMs : null;
    return {
      frames,
      durationSec,
      avgFps,
      p95FrameMs,
      low5Fps,
      stalls: [...this.stalls],
      marks: [...this.marks],
      meetsAvgFps: avgFps === null ? null : avgFps >= AVG_FPS_TARGET,
      meetsLow5Fps: low5Fps === null ? null : low5Fps >= LOW5_FPS_TARGET,
      intervalsMs: [...this.intervals],
    };
  }
}

/** worklog에 연결할 원자료 파일 내용. 요약과 원자료를 한 JSON에 담는다. */
export function reportToJson(report: FrameReport): string {
  return JSON.stringify(report, null, 2);
}

/** requestAnimationFrame 같은 함수를 주입받아 프레임마다 recorder.frame을 부른다. 중지 함수를 돌려준다. */
export function sampleFrames(
  recorder: FrameRecorder,
  raf: (cb: (nowMs: number) => void) => number,
  caf: (id: number) => void,
): () => void {
  let id = 0;
  let stopped = false;
  const tick = (nowMs: number) => {
    if (stopped) return;
    recorder.frame(nowMs);
    id = raf(tick);
  };
  id = raf(tick);
  return () => {
    stopped = true;
    caf(id);
  };
}
