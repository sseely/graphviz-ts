// SPDX-License-Identifier: EPL-2.0
/**
 * MT19937 Mersenne Twister — port of Random Kit 1.3.
 *
 * Must produce bit-identical output to the C reference for any seed.
 * All arithmetic is kept in 32-bit unsigned space via >>> 0.
 *
 * @see lib/neatogen/randomkit.c
 * @see lib/neatogen/randomkit.h
 */

/** Number of state words. @see randomkit.h:RK_STATE_LEN */
const RK_STATE_LEN = 624;

/** Twist constants. @see randomkit.c */
const N = 624;
const M = 397;
const MATRIX_A = 0x9908b0df;
const UPPER_MASK = 0x80000000;
const LOWER_MASK = 0x7fffffff;

/** Initialisation multiplier (Knuth PRNG). @see randomkit.c:rk_seed */
const INIT_MULT = 1812433253;

/**
 * Mersenne Twister state.
 * @see randomkit.h:rk_state_
 */
export interface RkState {
  /** 624-element state array (uint32). */
  mt: Uint32Array;
  /** Current position in the state array; RK_STATE_LEN means "needs twist". */
  mti: number;
}

/** Allocate a fresh, uninitialised state. */
export function rkNewState(): RkState {
  return { mt: new Uint32Array(RK_STATE_LEN), mti: RK_STATE_LEN };
}

/**
 * Seed the RNG with a 32-bit unsigned integer.
 * @see randomkit.c:rk_seed
 */
export function rkSeed(seed: number, state: RkState): void {
  let s = (seed >>> 0) & 0xffffffff;
  for (let pos = 0; pos < RK_STATE_LEN; pos++) {
    state.mt[pos] = s;
    s = rkSeedStep(s, pos);
  }
  state.mti = RK_STATE_LEN;
}

/**
 * One step of Knuth's PRNG used during seeding.
 * Kept separate to stay within CCN limit.
 */
function rkSeedStep(s: number, pos: number): number {
  // (1812433253 * (s ^ (s >> 30)) + pos + 1) & 0xffffffff
  const xor = (s ^ (s >>> 30)) >>> 0;
  // multiply as 32-bit: split into hi/lo to avoid float precision loss
  const lo = (INIT_MULT * (xor & 0xffff)) >>> 0;
  const hi = (INIT_MULT * (xor >>> 16)) >>> 0;
  return (lo + ((hi << 16) >>> 0) + pos + 1) >>> 0;
}

/**
 * Generate the next 32-bit pseudo-random value.
 * @see randomkit.c:rk_random
 */
export function rkRandom(state: RkState): number {
  if (state.mti === RK_STATE_LEN) {
    rkTwist(state);
  }
  let y = state.mt[state.mti++];
  y = rkTemper(y);
  return y >>> 0;
}

/**
 * MT19937 twist operation — refill the state array.
 * @see randomkit.c:rk_random (inner if block)
 */
function rkTwist(state: RkState): void {
  const mt = state.mt;
  let i = 0;
  for (; i < N - M; i++) {
    const y = ((mt[i] & UPPER_MASK) | (mt[i + 1] & LOWER_MASK)) >>> 0;
    mt[i] = (mt[i + M] ^ (y >>> 1) ^ ((y & 1) * MATRIX_A)) >>> 0;
  }
  for (; i < N - 1; i++) {
    const y = ((mt[i] & UPPER_MASK) | (mt[i + 1] & LOWER_MASK)) >>> 0;
    mt[i] = (mt[i + (M - N)] ^ (y >>> 1) ^ ((y & 1) * MATRIX_A)) >>> 0;
  }
  const y = ((mt[N - 1] & UPPER_MASK) | (mt[0] & LOWER_MASK)) >>> 0;
  mt[N - 1] = (mt[M - 1] ^ (y >>> 1) ^ ((y & 1) * MATRIX_A)) >>> 0;
  state.mti = 0;
}

/**
 * MT19937 tempering transformation.
 * @see randomkit.c:rk_random (Tempering block)
 */
function rkTemper(y: number): number {
  let v = y >>> 0;
  v ^= v >>> 11;
  v ^= (v << 7) & 0x9d2c5680;
  v ^= (v << 15) & 0xefc60000;
  v ^= v >>> 18;
  return v >>> 0;
}

/**
 * Return a random value in [0, max] inclusive.
 * Uses rejection sampling to avoid modulo bias.
 * On this platform ULONG_MAX == 0xffffffff (32-bit path).
 *
 * @see randomkit.c:rk_interval
 */
export function rkInterval(max: number, state: RkState): number {
  const m = max >>> 0;
  if (m === 0) return 0;
  const mask = buildMask(m);
  let value: number;
  do {
    value = (rkRandom(state) & mask) >>> 0;
  } while (value > m);
  return value;
}

/**
 * Build the smallest all-ones bitmask >= max.
 * @see randomkit.c:rk_interval (mask computation)
 */
function buildMask(max: number): number {
  let mask = max >>> 0;
  mask |= mask >>> 1;
  mask |= mask >>> 2;
  mask |= mask >>> 4;
  mask |= mask >>> 8;
  mask |= mask >>> 16;
  return mask >>> 0;
}
