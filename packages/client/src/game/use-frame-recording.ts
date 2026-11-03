// 개발용 프레임 기록 연결(VAL-002). `import.meta.env.DEV`일 때만 기록 모듈을 동적 import하므로
// 운영 빌드에는 기록 코드가 들어가지 않는다. 판 시작부터 결과 직전까지의 프레임 간격을 기록한다.
import { useEffect } from 'react';
import type { GameClientState } from './game-store.ts';

declare global {
  interface Window {
    /** 개발 전용: 마지막 판의 프레임 기록 요약(원자료 포함) */
    __alkkagiFrameReport?: unknown;
    /** 개발 전용: 마지막 기록을 JSON 파일로 내려받는다 */
    __alkkagiDownloadFrameReport?: () => void;
  }
}

export function useFrameRecording(state: Pick<GameClientState, 'start' | 'result'>): void {
  const gameId = state.start?.gameId ?? null;
  const finished = state.result !== null;

  useEffect(() => {
    if (!import.meta.env.DEV || gameId === null || finished) return;
    let disposed = false;
    let stopSampling: (() => void) | null = null;
    let finish: (() => void) | null = null;
    void import('../dev/frame-recorder.ts').then(
      ({ FrameRecorder, reportToJson, sampleFrames }) => {
        if (disposed) return;
        const recorder = new FrameRecorder();
        recorder.start(performance.now());
        stopSampling = sampleFrames(
          recorder,
          (cb) => requestAnimationFrame(cb),
          (id) => cancelAnimationFrame(id),
        );
        finish = () => {
          stopSampling?.();
          stopSampling = null;
          if (!recorder.isRecording) return;
          const report = recorder.stop(performance.now());
          window.__alkkagiFrameReport = report;
          window.__alkkagiDownloadFrameReport = () => {
            const url = URL.createObjectURL(
              new Blob([reportToJson(report)], { type: 'application/json' }),
            );
            const a = document.createElement('a');
            a.href = url;
            a.download = `frame-report-${gameId}.json`;
            a.click();
            URL.revokeObjectURL(url);
          };
          console.info(
            `[frame-recorder] ${report.frames}프레임, 평균 ${report.avgFps?.toFixed(1) ?? '-'}fps, ` +
              `하위5% ${report.low5Fps?.toFixed(1) ?? '-'}fps, 100ms 이상 멈춤 ${report.stalls.length}회. ` +
              'window.__alkkagiDownloadFrameReport()로 내려받을 수 있다.',
          );
        };
      },
    );
    return () => {
      disposed = true;
      // 결과가 오기 전에 화면이 닫히거나 경기가 바뀌면 지금까지의 기록을 마무리한다
      finish?.();
      stopSampling?.();
    };
  }, [gameId, finished]);
}
