// SharedWorker 진입점. 같은 출처의 `/local` 창들이 이 워커 하나를 공유해 경기를 진행한다.
// 시계는 epoch 기준 단조 시각이다(RuntimeClock 계약).
/// <reference lib="webworker" />
import { LocalAuthority, type PortLike } from './local-authority.ts';

const scope = self as unknown as SharedWorkerGlobalScope;

const authority = new LocalAuthority({
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
    console.error('[local-authority]', error);
  },
});

scope.onconnect = (event) => {
  const port = event.ports[0];
  if (port) authority.attach(port as unknown as PortLike);
};
