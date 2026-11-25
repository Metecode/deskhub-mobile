import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (s: string) => createHash('sha256').update(s).digest();

/** Compares tokens without leaking where they differ. An empty token never matches. */
export function tokensEqual(given: unknown, expected: string): boolean {
  return typeof given === 'string' && expected !== '' && timingSafeEqual(digest(given), digest(expected));
}
