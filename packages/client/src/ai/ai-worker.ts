// AI 대전 전용 Web Worker 진입점. 창 하나가 이 워커 하나를 쓰고, 창을 닫으면 경기도 사라진다.
// 시계는 epoch 기준 단조 시각이다(RuntimeClock 계약).
/// <reference lib="webworker" />
import type { PortLike } from '../local/local-authority.ts';
import { AiAuthority } from './ai-authority.ts';

const scope = self as unknown as DedicatedWorkerGlobalScope;

const authority = new AiAuthority({
  clock: {
    now: () => Math.round(performance.timeOrigin + performance.now()),
    setTimer: (callback, delayMs) => {
      const id = setTimeout(callback, delayMs);
      return () => {
        clearTimeout(id);
      };
    },
  },
  onError: (error) => {
    console.error('[ai-authority]', error);
  },
});

const port: PortLike = {
  postMessage: (message) => {
    scope.postMessage(message);
  },
  onmessage: null,
};
scope.onmessage = (event) => {
  port.onmessage?.({ data: event.data });
};
authority.attach(port);
