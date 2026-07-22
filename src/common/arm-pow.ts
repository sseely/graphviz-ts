// SPDX-License-Identifier: EPL-2.0

/**
 * Double-precision pow(x, y) ported from ARM optimized-routines
 * (math/pow.c, the HAVE_FAST_FMA + TOINT_INTRINSICS aarch64 config),
 * which is permissively licensed and EPL-2.0-compatible:
 *
 *   Copyright (c) 2018-2026, Arm Limited.
 *   SPDX-License-Identifier: MIT OR Apache-2.0 WITH LLVM-exception
 *
 * Source: https://github.com/ARM-software/optimized-routines
 * (math/pow.c, math/pow_log_data.c, math/exp_data.c). The data
 * tables are in arm-pow-data.ts, extracted from that MIT source.
 *
 * Why a hand-rolled pow: graphviz sfdp's repulsive force calls
 * pow(dist, 1−p) with a RUNTIME exponent, so the reference binary
 * issues real libm calls whose ~0.5-ULP rounding is chaotically
 * amplified by the force loop. V8's Math.pow and x·x diverge from
 * any libm; this ~0.54-ULP implementation is the closest portable,
 * legally clean match. (It is NOT bit-identical to Apple's libm,
 * which generated the macOS golden refs — see the mission journal.)
 *
 * Only the normal-finite fast path sfdp exercises is ported; special
 * cases (0, inf, nan, negative base, over/underflow) throw.
 *
 * @see ARM optimized-routines math/pow.c (log_inline, exp_inline, pow)
 */

import { fma } from './fma.js';
import { cround } from './arith.js';
import {
  ARM_LN2HI,
  ARM_LN2LO,
  ARM_LOG_POLY,
  ARM_LOG_TAB,
  ARM_INVLN2N,
  ARM_NEGLN2HIN,
  ARM_NEGLN2LON,
  ARM_EXP_POLY,
  ARM_EXP_TAB,
} from './arm-pow-data.js';

const BUF = new ArrayBuffer(8);
const F64 = new Float64Array(BUF);
const U32 = new Uint32Array(BUF);

/** asdouble: reconstruct a double from a BigInt bit pattern. */
function asDoubleBig(bits: bigint): number {
  U32[0] = Number(bits & 0xffffffffn);
  U32[1] = Number((bits >> 32n) & 0xffffffffn);
  return F64[0]!;
}

/** asuint64: a double's bits as a BigInt. */
function asUint64(x: number): bigint {
  F64[0] = x;
  return (BigInt(U32[1]! >>> 0) << 32n) | BigInt(U32[0]! >>> 0);
}

/** Bits [hi32, lo32] → double. */
function fromPair(p: number[]): number {
  U32[1] = p[0]!;
  U32[0] = p[1]!;
  return F64[0]!;
}

/** top12(x): top 12 bits of the double (sign + 11 exponent bits). */
function top12(x: number): number {
  F64[0] = x;
  return (U32[1]! >>> 20) & 0xfff;
}

const LN2HI = fromPair(ARM_LN2HI);
const LN2LO = fromPair(ARM_LN2LO);
const A: number[] = [];
for (let i = 0; i < 7; i++) A.push(fromPair([ARM_LOG_POLY[2 * i]!, ARM_LOG_POLY[2 * i + 1]!]));

const INVLN2N = fromPair(ARM_INVLN2N);
const NEGLN2HIN = fromPair(ARM_NEGLN2HIN);
const NEGLN2LON = fromPair(ARM_NEGLN2LON);
const EC: number[] = [];
for (let i = 0; i < 6; i++) EC.push(fromPair([ARM_EXP_POLY[2 * i]!, ARM_EXP_POLY[2 * i + 1]!]));

const POW_LOG_TABLE_BITS = 7;
const N_LOG = 1 << POW_LOG_TABLE_BITS;
const EXP_TABLE_BITS = 7;
const N_EXP = 1 << EXP_TABLE_BITS;
const OFF = 0x3fe6955500000000n;

/** Bit patterns and sign bias for the pow special-case branch. */
const INF_BITS = 0x7ff0000000000000n;
const ONE_BITS = 0x3ff0000000000000n; // asuint64(1.0)
/** SIGN_BIAS = 0x800 << EXP_TABLE_BITS. @see ARM pow.c */
const SIGN_BIAS = 0x800 << EXP_TABLE_BITS;

/** Exp poly constants C2..C5 (poly[5−ORDER+i], ORDER = 5). */
const C2 = EC[0]!;
const C3 = EC[1]!;
const C4 = EC[2]!;
const C5 = EC[3]!;

/** Log table accessors (triples invc, logc, logctail). */
function logInvc(i: number): number { return fromPair([ARM_LOG_TAB[6 * i]!, ARM_LOG_TAB[6 * i + 1]!]); }
function logLogc(i: number): number { return fromPair([ARM_LOG_TAB[6 * i + 2]!, ARM_LOG_TAB[6 * i + 3]!]); }
function logTail(i: number): number { return fromPair([ARM_LOG_TAB[6 * i + 4]!, ARM_LOG_TAB[6 * i + 5]!]); }

/** Exp table entry (uint64) as a BigInt. */
function expTab(idx: number): bigint {
  return (BigInt(ARM_EXP_TAB[2 * idx]! >>> 0) << 32n) | BigInt(ARM_EXP_TAB[2 * idx + 1]! >>> 0);
}

const MASK64 = (1n << 64n) - 1n;

/** Result of log_inline: y plus a tail term. */
interface LogResult {
  y: number;
  tail: number;
}

/**
 * y + tail = log(x) with ~15 extra bits, ix being the bits of x.
 * @see ARM optimized-routines math/pow.c:log_inline (HAVE_FAST_FMA)
 */
function logInline(ix: bigint): LogResult {
  const tmp = (ix - OFF) & MASK64;
  const i = Number((tmp >> BigInt(52 - POW_LOG_TABLE_BITS)) % BigInt(N_LOG));
  const k = Number(BigInt.asIntN(64, tmp) >> 52n); /* arithmetic shift */
  const iz = (ix - (tmp & (0xfffn << 52n))) & MASK64;
  const z = asDoubleBig(iz);
  const kd = k;

  const invc = logInvc(i);
  const logc = logLogc(i);
  const logctail = logTail(i);

  const r = fma(z, invc, -1.0);

  const t1 = kd * LN2HI + logc;
  const t2 = t1 + r;
  const lo1 = kd * LN2LO + logctail;
  const lo2 = t1 - t2 + r;

  const ar = A[0]! * r;
  const ar2 = r * ar;
  const ar3 = r * ar2;
  const hi = t2 + ar2;
  const lo3 = fma(ar, r, -ar2);
  const lo4 = t2 - hi + ar2;
  const p = ar3 * (A[1]! + r * A[2]! + ar2 * (A[3]! + r * A[4]! + ar2 * (A[5]! + r * A[6]!)));
  const lo = lo1 + lo2 + lo3 + lo4 + p;
  const y = hi + lo;
  return { y, tail: hi - y + lo };
}

/**
 * sign·exp(x + xtail). Tiny argument → 1 + x; over/underflow → signed inf/0
 * (via expOverflow, matching libm rather than throwing).
 * @see ARM optimized-routines math/pow.c:exp_inline (TOINT_INTRINSICS)
 */
function expInline(x: number, xtail: number, signBias: number): number {
  const abstop = top12(x) & 0x7ff;
  const band = (abstop - top12(2 ** -54)) >>> 0;
  if (band >= ((top12(512.0) - top12(2 ** -54)) >>> 0)) {
    /* tiny argument: exp(x) ≈ 1 + x. @see pow.c:exp_inline (abstop branch) */
    if (band >= 0x80000000) {
      const one = 1.0 + x;
      return signBias ? -one : one;
    }
    /* large/overflow argument — bounded for sfdp, but return the signed
     * over/underflow instead of crashing on a pathological input. */
    return expOverflow(x, signBias);
  }

  const z = INVLN2N * x;
  const kd = cround(z);                  // roundtoint (round-half-away-from-zero)
  const ki = BigInt(kd);                 // converttoint (in-range)
  const r0 = x + kd * NEGLN2HIN + kd * NEGLN2LON;
  const r = r0 + xtail;

  const idx = 2 * Number(((ki % BigInt(N_EXP)) + BigInt(N_EXP)) % BigInt(N_EXP));
  const top = ((ki + BigInt(signBias)) << BigInt(52 - EXP_TABLE_BITS)) & MASK64;
  const tail = asDoubleBig(expTab(idx));
  const sbits = (expTab(idx + 1) + top) & MASK64;

  const r2 = r * r;
  /* EXP_POLY_ORDER == 5 */
  const tmp = tail + r + r2 * (C2 + r * C3) + r2 * r2 * (C4 + r * C5);
  const scale = asDoubleBig(sbits);
  return scale + scale * tmp;
}

/**
 * Reached only for the exp_inline overflow band (|result| would over/underflow).
 * sfdp's x^y is bounded and never triggers it — but rather than throw, return
 * the correctly-signed over/underflow so a pathological input still renders
 * (matching libm) instead of crashing the layout.
 * @see ARM optimized-routines math/pow.c:exp_inline specialcase
 */
function expOverflow(x: number, signBias: number): number {
  // x is the exp argument; large positive → overflow, large negative → underflow.
  const neg = signBias !== 0;
  if (x > 0) return neg ? -Infinity : Infinity;
  return neg ? -0 : 0;
}

/** unsigned 64-bit wrap. */
function u64(v: bigint): bigint { return v & MASK64; }
const INF2M1 = u64(2n * INF_BITS - 1n);

/**
 * zeroinfnan(i): true when the double with bits i is zero, inf, or nan.
 * @see ARM optimized-routines math/pow.c:zeroinfnan
 */
function zeroinfnan(i: bigint): boolean {
  return u64(2n * i - 1n) >= INF2M1;
}

/**
 * checkint(iy): 0 if y is not an integer, 1 if odd integer, 2 if even integer.
 * @see ARM optimized-routines math/pow.c:checkint
 */
function checkint(iy: bigint): number {
  const e = Number((iy >> 52n) & 0x7ffn);
  if (e < 0x3ff) return 0;
  if (e > 0x3ff + 52) return 2;
  const shift = BigInt(0x3ff + 52 - e);
  if ((iy & ((1n << shift) - 1n)) !== 0n) return 0;
  if ((iy & (1n << shift)) !== 0n) return 1;
  return 2;
}

/**
 * pow(x, y). The normal-finite fast path is the log_inline/exp_inline core;
 * the special-case branch (x or y is 0/inf/nan, negative base, subnormal base,
 * or extreme |y|) is ported faithfully so armPow returns exactly what libm's
 * pow returns — including `pow(NaN, y) = NaN`. This matters for sfdp graphs
 * whose force loop blows up to NaN under a large `repulsiveforce` (e.g. 2556,
 * repulsiveforce=100 → the native oracle itself emits all-`nan` positions):
 * the port must reproduce the same NaN, not throw.
 * @see ARM optimized-routines math/pow.c:pow
 */
export function armPow(x: number, y: number): number {
  let signBias = 0;
  let ix = asUint64(x);
  const iy = asUint64(y);
  let topx = top12(x);
  const topy = top12(y);
  if (
    ((topx - 0x001) >>> 0) >= (0x7ff - 0x001) ||
    ((((topy & 0x7ff) - 0x3be) >>> 0) >= (0x43e - 0x3be))
  ) {
    // Special cases: (x < 0x1p-126 or inf or nan) or (|y| < 0x1p-65 or |y| >= 0x1p63).
    if (zeroinfnan(iy)) {
      if (u64(2n * iy) === 0n) return 1.0;              // pow(x, 0) = 1
      if (ix === ONE_BITS) return 1.0;                  // pow(1, y) = 1
      if (u64(2n * ix) > u64(2n * INF_BITS) || u64(2n * iy) > u64(2n * INF_BITS)) {
        return x + y;                                   // nan operand → nan
      }
      if (u64(2n * ix) === u64(2n * ONE_BITS)) return 1.0; // pow(±1, ±inf) = 1
      // (|x|<1 && y<0) or (|x|>1 && y>=0) → 0, else inf. `yNonNeg` is !(iy>>63).
      const yNonNeg = (iy >> 63n) === 0n;
      if ((u64(2n * ix) < u64(2n * ONE_BITS)) === yNonNeg) return 0.0;
      return y * y;                                     // inf
    }
    if (zeroinfnan(ix)) {
      let x2 = x * x;
      if ((ix >> 63n) === 1n && checkint(iy) === 1) { x2 = -x2; signBias = SIGN_BIAS; }
      if (u64(2n * ix) === 0n && (iy >> 63n) === 1n) return signBias ? -Infinity : Infinity;
      return (iy >> 63n) === 1n ? 1 / x2 : x2;          // pow(NaN, y>0) = NaN
    }
    // Here x and y are non-zero finite.
    if ((ix >> 63n) === 1n) {                           // finite x < 0
      const yint = checkint(iy);
      if (yint === 0) return NaN;                       // pow(neg, non-integer) invalid
      if (yint === 1) signBias = SIGN_BIAS;
      ix = ix & 0x7fffffffffffffffn;
      topx = topx & 0x7ff;
    }
    if ((((topy & 0x7ff) - 0x3be) >>> 0) >= (0x43e - 0x3be)) {
      if (ix === ONE_BITS) return 1.0;
      if ((topy & 0x7ff) < 0x3be) return 1.0;           // |y| tiny → x^y ≈ 1
      // |y| >= 0x1p63 → 0 or inf.
      return ((ix > ONE_BITS) === (topy < 0x800))
        ? (signBias ? -Infinity : Infinity)
        : (signBias ? -0 : 0);
    }
    if (topx === 0) {                                   // normalize subnormal x
      ix = asUint64(x * 2 ** 52) & 0x7fffffffffffffffn;
      ix = ix - (52n << 52n);
    }
  }
  const { y: hi, tail: lo } = logInline(ix);
  const ehi = y * hi;
  const elo = y * lo + fma(y, hi, -ehi);
  return expInline(ehi, elo, signBias);
}
