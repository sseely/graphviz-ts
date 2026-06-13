// SPDX-License-Identifier: EPL-2.0
/**
 * dtStrHash — polynomial rolling hash for null-terminated strings.
 *
 * Exact port of dtstrhash() from lib/cdt/dtstrhash.c (Kiem-Phong Vo, 02/28/03).
 *
 * Algorithm (n <= 0 / string mode):
 *   Advance 2 bytes per step; if the second byte is \0, advance only 1.
 *   h = (h + (s[0] << 8) + s[1]) * DT_PRIME  at each step.
 *   Add string length at the end: (h + n) * DT_PRIME.
 *
 * The unusual 2-byte stepping with the \0 guard is a micro-optimisation in
 * the original C and must be preserved exactly to produce matching hash values.
 *
 * @see lib/cdt/dtstrhash.c:dtstrhash
 */

/** 2#00000001 00000101 00010011 00110011 @see dtstrhash.c:DT_PRIME */
const DT_PRIME = 17109811;

/** Unsigned 32-bit multiply — mirrors C `unsigned` wrap-around. */
function umul32(a: number, b: number): number {
  // Use Math.imul for correct 32-bit integer multiply, then force unsigned.
  return Math.imul(a, b) >>> 0;
}

/**
 * Hash a JavaScript string using the dtstrhash algorithm (n <= 0 / string mode).
 *
 * TypeScript strings are UTF-16; we operate on char codes directly to match
 * the C behaviour of treating each character as one byte (ASCII / Latin-1).
 * Callers using non-ASCII keys must ensure their comparator is consistent.
 *
 * @see lib/cdt/dtstrhash.c:dtstrhash
 */
export function dtStrHash(s: string): number {
  let h = 0;
  let i = 0;
  const len = s.length;

  // for(; *s != 0; s += s[1] ? 2 : 1)
  //   h = (h + ((unsigned)s[0] << 8u) + (unsigned)s[1]) * DT_PRIME;
  while (i < len) {
    const b0 = s.charCodeAt(i) & 0xff;
    const b1 = (i + 1 < len) ? (s.charCodeAt(i + 1) & 0xff) : 0;
    h = umul32((h + (b0 << 8) + b1) >>> 0, DT_PRIME);
    i += b1 !== 0 ? 2 : 1;
  }

  // return (h + (unsigned)n) * DT_PRIME
  return umul32((h + len) >>> 0, DT_PRIME);
}
