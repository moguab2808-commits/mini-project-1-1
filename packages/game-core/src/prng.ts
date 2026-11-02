/** 시드 기반 난수. 상태를 숫자 하나로 복사·비교할 수 있다. */
export class Prng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** [0, 1) */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [0, n) 정수 */
  int(n: number): number {
    return Math.floor(this.next() * n);
  }

  get state(): number {
    return this.s;
  }
}

/** 한 시드에서 이름이 다른 독립 스트림의 시드를 만든다(splitmix32). */
export function deriveSeed(seed: number, label: number): number {
  let z = (seed + Math.imul(label + 1, 0x9e3779b9)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  return (z ^ (z >>> 16)) >>> 0;
}
