// SPDX-License-Identifier: EPL-2.0

/**
 * The C library rand() stream used by sfdp, ported bit-exactly.
 *
 * macOS libc rand() is the Park–Miller minstd LCG:
 *   seed = seed · 16807 mod (2³¹ − 1),   RAND_MAX = 2³¹ − 1
 * (verified empirically on the reference machine:
 *  srand(123) → 2067261, 384717275, 2017463455, 888985702, …).
 * The product never exceeds 16807·2³¹ < 2⁴⁶, so plain double
 * arithmetic is exact.
 *
 * ALL sfdp randomness flows through this ONE stream: drand() position
 * jitter (sparse/general.c:24) and the Fisher–Yates permutation used
 * by multilevel coarsening (util/random.c) — the latter draws BEFORE
 * srand() is called in the embedding, so the stream is global mutable
 * state exactly as in C (unseeded state = srand(1)).
 *
 * @see Apple Libc rand(3) (Park–Miller minstd)
 * @see lib/sparse/general.c:drand (15.0.0)
 * @see lib/util/random.c:gv_random / gv_permutation (15.0.0)
 */

/** RAND_MAX on the reference platform. */
export const C_RAND_MAX = 2147483647;

/** Current stream state; unseeded C rand() behaves as srand(1). */
let state = 1;

/** srand(3). */
export function csrand(seed: number): void {
  state = seed;
}

/** rand(3): minstd step. @see Apple Libc rand */
export function crand(): number {
  state = state * 16807 % 2147483647;
  return state;
}

/** drand: uniform in [0,1]. @see lib/sparse/general.c:drand */
export function cdrand(): number {
  return crand() / C_RAND_MAX;
}

/**
 * Uniform integer in [0, bound) with the discard-threshold rejection
 * of the C helper (bound ≤ RAND_MAX assumed — random_big is not
 * ported; no caller exceeds 2³¹−1).
 * @see lib/util/random.c:random_small / gv_random
 */
export function gvRandom(bound: number): number {
  // discard_threshold = RAND_MAX - ((unsigned)RAND_MAX + 1) % bound,
  // i.e. 2^31 % bound in exact double arithmetic
  const discardThreshold = C_RAND_MAX - (2147483648 % bound);
  let r: number;
  do {
    r = crand();
  } while (r > discardThreshold);
  return r % bound;
}

/**
 * Random permutation of [0, bound) by Fisher–Yates, drawing from the
 * global stream.
 * @see lib/util/random.c:gv_permutation
 */
export function gvPermutation(bound: number): number[] {
  if (bound <= 0) return [];
  const p: number[] = [];
  for (let i = 0; i < bound; i++) p.push(i);
  for (let i = bound - 1; i > 0; --i) {
    const j = gvRandom(i + 1);
    const t = p[i]!;
    p[i] = p[j]!;
    p[j] = t;
  }
  return p;
}
