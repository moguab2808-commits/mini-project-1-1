export const JOIN_RATE_LIMIT = { windowMs: 60_000, limit: 30 } as const;

/**
 * `room:join` 빈도 제한: 사용자당 분당 30회(AUTH). 6자리 코드를 대입해 보는 시도를 막는다.
 * 재접속해도 초기화되지 않게 연결이 아니라 사용자 번호를 키로 두며, 메모리 저장이라 서버가 재시작하면 사라진다.
 * 성공·실패와 입력 오류를 모두 센다.
 */
export class JoinRateLimiter {
  readonly #windows = new Map<number, { startedAt: number; count: number }>();

  constructor(
    private readonly now: () => number = Date.now,
    private readonly options: {
      windowMs: number;
      limit: number;
    } = JOIN_RATE_LIMIT,
  ) {}

  /** 이번 호출을 세고, 한도 안이면 true를 돌려준다. */
  tryConsume(userId: number): boolean {
    const now = this.now();
    const current = this.#windows.get(userId);
    if (!current || now - current.startedAt >= this.options.windowMs) {
      this.#windows.set(userId, { startedAt: now, count: 1 });
      this.#prune(now);
      return true;
    }
    current.count += 1;
    return current.count <= this.options.limit;
  }

  /** 지난 창을 지워 사용자가 늘어도 맵이 계속 커지지 않게 한다. */
  #prune(now: number): void {
    for (const [userId, w] of this.#windows) {
      if (now - w.startedAt >= this.options.windowMs) this.#windows.delete(userId);
    }
  }
}
