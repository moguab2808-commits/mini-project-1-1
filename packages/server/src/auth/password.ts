import { hash, verify, type Algorithm } from '@node-rs/argon2';

// OWASP 최소 권장(메모리 19 MiB, 반복 2, 병렬 1)으로 시작한다. 배포 환경의 해시 시간을 측정해 조정한다(AUTH).
// Algorithm은 const enum이라 isolatedModules에서 값으로 가져올 수 없어 Argon2id의 값 2를 쓴다.
export const ARGON2_OPTIONS = {
  algorithm: 2 as Algorithm,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password);
}

let dummyHash: Promise<string> | undefined;

/**
 * 없는 닉네임으로 로그인할 때도 해시 검증 비용을 똑같이 치르게 하는 더미 해시다.
 * 닉네임 없음과 비밀번호 틀림을 응답 시간으로 구분하지 못하게 한다.
 */
export function getDummyHash(): Promise<string> {
  dummyHash ??= hashPassword('dummy-password-for-timing-equalization');
  return dummyHash;
}
