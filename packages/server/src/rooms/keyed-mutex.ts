/**
 * 키(사용자 번호)별로 작업을 한 줄로 세운다. 한 사용자의 방 명령이 겹쳐 실행되면
 * "이미 방에 있는가" 검사와 쓰기 사이에 다른 명령이 끼어들 수 있어서, 같은 사용자의 명령만 순서대로 처리한다.
 * 서버가 한 프로세스라는 가정이다. 다른 사용자끼리의 경합은 DB의 조건부 갱신과 유니크 제약이 막는다.
 */
export class KeyedMutex<K> {
  readonly #tails = new Map<K, Promise<unknown>>();

  run<T>(key: K, task: () => Promise<T>): Promise<T> {
    const previous = this.#tails.get(key) ?? Promise.resolve();
    const result = previous.then(task, task);
    const tail = result.catch(() => undefined);
    this.#tails.set(key, tail);
    void tail.then(() => {
      if (this.#tails.get(key) === tail) this.#tails.delete(key);
    });
    return result;
  }
}
