import type { Socket } from 'socket.io';

export const SESSION_REPLACED = 'session:replaced';

/**
 * 사용자당 하나의 Socket.IO 연결을 관리한다(AUTH 중복 접속). 같은 계정의 새 연결이 생기면
 * 기존 연결에 session:replaced를 보내고 끊는다. 기권 명령으로의 변환은 경기 서버(IMPL-009)가 한다.
 */
export class ConnectionRegistry {
  readonly #byUser = new Map<number, Socket>();

  /** 새 연결을 등록한다. 같은 사용자의 기존 연결이 있으면 알리고 끊은 뒤 그 연결을 돌려준다. */
  register(userId: number, socket: Socket): Socket | undefined {
    const previous = this.#byUser.get(userId);
    this.#byUser.set(userId, socket);
    if (previous && previous !== socket) this.#replace(previous);
    return previous;
  }

  /** 연결이 끊기면 자기 자신일 때만 등록을 지운다(대체된 옛 연결이 새 연결을 지우지 않게 한다). */
  unregister(userId: number, socket: Socket): void {
    if (this.#byUser.get(userId) === socket) this.#byUser.delete(userId);
  }

  get(userId: number): Socket | undefined {
    return this.#byUser.get(userId);
  }

  /** 비밀번호 변경: 현재 세션이 아닌 연결이면 session:replaced와 같은 흐름으로 끊는다. */
  replaceIfNotSession(userId: number, currentSid: string): boolean {
    const socket = this.#byUser.get(userId);
    if (!socket || socket.data.sid === currentSid) return false;
    this.#byUser.delete(userId);
    this.#replace(socket);
    return true;
  }

  /** 로그아웃: 그 세션으로 연결된 소켓을 알림 없이 끊는다. */
  disconnectSession(userId: number, sid: string): void {
    const socket = this.#byUser.get(userId);
    if (!socket || socket.data.sid !== sid) return;
    this.#byUser.delete(userId);
    socket.disconnect(true);
  }

  #replace(socket: Socket): void {
    socket.emit(SESSION_REPLACED);
    socket.disconnect(true);
  }
}
