import { hash, verify, type Algorithm } from '@node-rs/argon2';

// OWASP 최소 권장(메모리 19 MiB, 반복 2, 병렬 1)으로 시작한다. 배포 환경의 해시 시간을 측정해 조정한다(AUTH).
// Algorithm은 const enum이라 isolatedModules에서 값으로 가져올 수 없어 Argon2id의 값 2를 쓴다.
export const ARGON2_OPTIONS = {
  algorithm: 2 as Algorithm,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export type HashTimingSink = (line: string) => void;

const stdoutSink: HashTimingSink = (line) => {
  console.log(line);
};

/**
 * 해시 시간 로그(OPERATIONS "서버 로그"): DB 조회와 분리해 argon2id 계산 시간만 잰다.
 * 허용 키(ts·event·op·ms)만 내보내며 비밀번호·해시·닉네임은 담지 않는다.
 */
async function timed<T>(
  op: 'hash' | 'verify',
  sink: HashTimingSink,
  run: () => Promise<T>,
): Promise<T> {
  const start = performance.now();
  try {
    return await run();
  } finally {
    const ms = Math.round((performance.now() - start) * 10) / 10;
    sink(JSON.stringify({ ts: new Date().toISOString(), event: 'argon2_timing', op, ms }));
  }
}

export function hashPassword(password: string, sink: HashTimingSink = stdoutSink): Promise<string> {
  return timed('hash', sink, () => hash(password, ARGON2_OPTIONS));
}

export function verifyPassword(
  passwordHash: string,
  password: string,
  sink: HashTimingSink = stdoutSink,
): Promise<boolean> {
  return timed('verify', sink, () => verify(passwordHash, password));
}

let dummyHash: Promise<string> | undefined;

/**
 * 없는 닉네임으로 로그인할 때도 해시 검증 비용을 똑같이 치르게 하는 더미 해시다.
 * 닉네임 없음과 비밀번호 틀림을 응답 시간으로 구분하지 못하게 한다.
 */
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword('dummy-password-for-timing-equalization', () => {});
  return dummyHash;
}
