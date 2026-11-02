import type { Socket } from 'socket.io-client';

/** ack가 늦어도 실패로 단정하지 않는다. 연결 종료·세션 정리 때만 대기를 끝낸다. */
export class SocketRequests {
  private readonly pending = new Set<() => void>();
  private closed = false;

  constructor(private readonly socket: Socket) {}

  send<T>(event: string, payload: unknown, unavailable: T): Promise<T> {
    if (this.closed || !this.socket.connected) return Promise.resolve(unavailable);
    return new Promise<T>((resolve) => {
      const cancel = () => finish(unavailable);
      const finish = (result: T) => {
        if (!this.pending.delete(cancel)) return;
        resolve(result);
      };
      this.pending.add(cancel);
      this.socket.emit(event, payload, finish);
    });
  }

  close(): void {
    this.closed = true;
    for (const cancel of this.pending) cancel();
  }
}
