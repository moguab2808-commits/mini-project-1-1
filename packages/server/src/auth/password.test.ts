import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.ts';

describe('해시 시간 로그', () => {
  it('hash·verify마다 허용된 키만 담은 JSON 한 줄을 남긴다', async () => {
    const lines: string[] = [];
    const sink = (line: string) => lines.push(line);
    const secret = 'correct-horse-battery';

    const passwordHash = await hashPassword(secret, sink);
    expect(await verifyPassword(passwordHash, secret, sink)).toBe(true);
    expect(await verifyPassword(passwordHash, 'wrong-password', sink)).toBe(false);

    expect(lines).toHaveLength(3);
    const parsed = lines.map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(parsed.map((p) => p.op)).toEqual(['hash', 'verify', 'verify']);
    for (const entry of parsed) {
      expect(Object.keys(entry).sort()).toEqual(['event', 'ms', 'op', 'ts']);
      expect(entry.event).toBe('argon2_timing');
      expect(typeof entry.ms).toBe('number');
    }
    for (const line of lines) {
      expect(line).not.toContain(secret);
      expect(line).not.toContain(passwordHash);
    }
  });
});
