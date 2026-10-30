// 실행: node --test packages/client/src/dev/frame-recorder.test.ts (Node 24 타입 제거 실행, 의존성 없음)
// IMPL-001에서 Vitest가 들어오면 같은 검증을 Vitest로 옮긴다.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FrameRecorder, percentile, reportToJson, sampleFrames } from './frame-recorder.ts';

function run(intervals: number[], startMs = 1000): FrameRecorder {
  const r = new FrameRecorder();
  r.start(startMs);
  let t = startMs;
  for (const d of intervals) {
    t += d;
    r.frame(t);
  }
  return r;
}

test('60fps 일정: 평균 60·하위 5% 60·멈춤 없음, 두 기준 충족', () => {
  const rep = run(Array(600).fill(1000 / 60)).stop();
  assert.equal(rep.frames, 600);
  assert.ok(Math.abs(rep.durationSec - 10) < 1e-9);
  assert.ok(Math.abs(rep.avgFps! - 60) < 1e-6);
  assert.ok(Math.abs(rep.low5Fps! - 60) < 1e-6);
  assert.equal(rep.stalls.length, 0);
  assert.equal(rep.meetsAvgFps, true);
  assert.equal(rep.meetsLow5Fps, true);
});

test('95백분위(nearest-rank): 느린 프레임이 5개면 p95는 정상 값, 6개면 느린 값', () => {
  const intervals = [...Array(95).fill(16), ...Array(5).fill(50)];
  const rep = run(intervals).report();
  // 정렬 후 95번째 값은 16, 96번째부터 50이다.
  assert.equal(rep.p95FrameMs, 16);
  const intervals6 = [...Array(94).fill(16), ...Array(6).fill(50)];
  assert.equal(run(intervals6).report().p95FrameMs, 50);
  assert.ok(Math.abs(run(intervals6).report().low5Fps! - 20) < 1e-9);
  assert.equal(run(intervals6).report().meetsLow5Fps, false);
});

test('멈춤: 100ms 이상 간격만 시각과 함께 센다(99ms는 제외)', () => {
  const rep = run([16, 99, 100, 16, 250]).stop();
  assert.equal(rep.stalls.length, 2);
  assert.deepEqual(rep.stalls.map((s) => s.intervalMs), [100, 250]);
  assert.ok(Math.abs(rep.stalls[0].atSec - 0.215) < 1e-9);
});

test('평균 fps 55 경계: 55fps는 충족, 54fps는 불충족', () => {
  // 합이 정확히 1000ms가 되는 입력(부동소수 오차 방지): 55프레임 = 54×18 + 28, 54프레임 = 53×18 + 46
  const at55 = run([...Array(54).fill(18), 28]).report();
  assert.equal(at55.avgFps, 55);
  assert.equal(at55.meetsAvgFps, true);
  const at54 = run([...Array(53).fill(18), 46]).report();
  assert.equal(at54.avgFps, 54);
  assert.equal(at54.meetsAvgFps, false);
});

test('시작 전 frame·mark는 무시하고, 시각이 거꾸로 간 프레임은 버린다', () => {
  const r = new FrameRecorder();
  r.frame(10);
  r.mark('x', 10);
  assert.equal(r.report().frames, 0);
  r.start(100);
  r.frame(116);
  r.frame(110);
  r.frame(132);
  assert.equal(r.report().frames, 2);
});

test('프레임이 없으면 판정은 null, stop 뒤에는 기록 중이 아니다', () => {
  const r = new FrameRecorder();
  r.start(0);
  const rep = r.stop();
  assert.equal(rep.avgFps, null);
  assert.equal(rep.p95FrameMs, null);
  assert.equal(rep.meetsAvgFps, null);
  assert.equal(r.isRecording, false);
});

test('구간 표시는 측정 시작 후 초로 남고 start는 이전 기록을 지운다', () => {
  const r = run([16, 16]);
  r.mark('알 충돌', 1500);
  assert.deepEqual(r.report().marks, [{ label: '알 충돌', atSec: 0.5 }]);
  r.start(5000);
  assert.equal(r.report().frames, 0);
  assert.equal(r.report().marks.length, 0);
});

test('percentile과 JSON 내보내기', () => {
  assert.equal(percentile([], 95), null);
  assert.equal(percentile([5], 95), 5);
  const parsed = JSON.parse(reportToJson(run([16, 17]).stop()));
  assert.deepEqual(parsed.intervalsMs, [16, 17]);
});

test('sampleFrames: 주입한 raf로 프레임을 기록하고 중지하면 멈춘다', () => {
  const r = new FrameRecorder();
  r.start(0);
  let cb: ((t: number) => void) | null = null;
  let cancelled = -1;
  const stop = sampleFrames(
    r,
    (c) => {
      cb = c;
      return 7;
    },
    (id) => {
      cancelled = id;
    },
  );
  cb!(16);
  cb!(32);
  stop();
  cb!(48);
  assert.equal(r.report().frames, 2);
  assert.equal(cancelled, 7);
});
