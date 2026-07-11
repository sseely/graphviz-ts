// SPDX-License-Identifier: EPL-2.0
/**
 * C-printf-compatible decimal rounding.
 *
 * `Number.prototype.toFixed` and `Number.prototype.toPrecision` round exact
 * binary-decimal ties (e.g. 1399.25 at 5 significant digits, 34.125 at 2
 * fixed decimals — both exactly representable in float64) half-away-from-
 * zero. C's snprintf ("%.Nf", "%.Ng") rounds exact ties half-to-even under
 * the default FE_TONEAREST rounding mode, so a value that lands exactly on
 * a tie diverges from native dot's DOT/xdot attribute output.
 *
 * Every finite float64 has an EXACT, finite decimal expansion (its
 * denominator is a power of two, which always divides some power of ten).
 * These functions decompose the IEEE-754 bit pattern into an exact integer
 * mantissa and binary exponent, convert to an exact decimal digit string via
 * BigInt scaling (multiply by 5^k to trade a factor of 2^k for 10^k), and
 * round that EXACT digit string half-to-even at the target position. This
 * never approximates with epsilon-based tie detection — the tie predicate
 * (`remainder === half`) is computed on exact integers.
 *
 * @see lib/gvc/gvdevice.c:gvprintdouble (%.2f) · lib/common/output.c
 *   (agxbprint "%.5g")
 */

/** Decompose a non-negative finite float64 into an exact integer mantissa
 * and binary exponent such that `v === mantissa * 2**binExp`. */
function decomposeFloat64(v: number): { mantissa: bigint; binExp: number } {
  const buf = new DataView(new ArrayBuffer(8));
  buf.setFloat64(0, v, false);
  const hi = buf.getUint32(0, false);
  const lo = buf.getUint32(4, false);
  const expBits = (hi >>> 20) & 0x7ff;
  const mantHi = BigInt(hi & 0xfffff);
  const mantLo = BigInt(lo >>> 0);
  let mantissa = (mantHi << 32n) | mantLo;
  let binExp: number;
  if (expBits === 0) {
    // Subnormal: no implicit leading 1, exponent fixed at 2^-1074.
    binExp = -1074;
  } else {
    mantissa |= 1n << 52n; // implicit leading 1
    binExp = expBits - 1075; // bias 1023 + 52 mantissa bits
  }
  return { mantissa, binExp };
}

/**
 * Exact canonical decimal digits of a non-negative finite float64: returns
 * `digits` (a BigInt with no trailing zero digit, i.e. `digits % 10n !== 0n`
 * unless `digits === 0n`) and `exponent10` such that
 * `v === Number(digits) * 10**exponent10`.
 */
function exactDecimalDigits(v: number): { digits: bigint; exponent10: number } {
  const { mantissa, binExp } = decomposeFloat64(v);
  let digits: bigint;
  let exponent10: number;
  if (binExp >= 0) {
    digits = mantissa << BigInt(binExp);
    exponent10 = 0;
  } else {
    // mantissa * 2**binExp === mantissa * 5**(-binExp) * 10**binExp
    digits = mantissa * 5n ** BigInt(-binExp);
    exponent10 = binExp;
  }
  while (digits !== 0n && digits % 10n === 0n) {
    digits /= 10n;
    exponent10 += 1;
  }
  return { digits, exponent10 };
}

/** Round a non-negative BigInt to the nearest multiple of `10**dropCount`
 * (dropCount >= 1), ties to even, returning the quotient. */
function roundHalfEvenDrop(value: bigint, dropCount: number): bigint {
  const divisor = 10n ** BigInt(dropCount);
  const q = value / divisor;
  const r = value % divisor;
  const half = divisor / 2n; // exact: divisor is a power of ten >= 10, always even
  if (r > half || (r === half && q % 2n === 1n)) return q + 1n;
  return q;
}

/**
 * Format `v` as C's `%.<decimals>f` would (fixed decimal places, rounded
 * half-to-even on exact ties). Mirrors `Number.prototype.toFixed(decimals)`
 * byte-for-byte on every non-tie input; only exact-tie inputs differ.
 *
 * @see lib/gvc/gvdevice.c:gvprintdouble
 */
export function printfFixed(v: number, decimals: number): string {
  if (v === 0) return decimals > 0 ? '0.' + '0'.repeat(decimals) : '0';
  const sign = v < 0 ? '-' : '';
  const { digits, exponent10 } = exactDecimalDigits(Math.abs(v));
  // scaled = round(|v| * 10**decimals), computed exactly.
  const shift = exponent10 + decimals;
  const scaled = shift >= 0
    ? digits * 10n ** BigInt(shift)
    : roundHalfEvenDrop(digits, -shift);
  if (decimals === 0) return sign + scaled.toString();
  let s = scaled.toString();
  if (s.length <= decimals) s = '0'.repeat(decimals - s.length + 1) + s;
  const intPart = s.slice(0, s.length - decimals);
  const fracPart = s.slice(s.length - decimals);
  return sign + intPart + '.' + fracPart;
}

/**
 * Format `v` with `sig` significant digits, using the same notational
 * contract as `Number.prototype.toPrecision(sig)` — fixed form when the
 * decimal exponent `e` (0-indexed power of ten of the leading digit)
 * satisfies `-6 <= e < sig`, otherwise exponential form
 * `d.ddd...e±N` (unpadded exponent, sign always present). Exact ties round
 * half-to-even; every other input is byte-identical to `toPrecision(sig)`.
 * Callers that need C's `%g` exponent threshold (`e < -4 || e >= precision`)
 * or trailing-zero trimming apply that on top of this — unchanged from the
 * pre-existing `toPrecision`-based behavior.
 *
 * @see lib/common/output.c:71 (agxbprint "%.5g")
 */
export function printfSig(v: number, sig: number): string {
  if (v === 0) return sig > 1 ? '0.' + '0'.repeat(sig - 1) : '0';
  const sign = v < 0 ? '-' : '';
  const { digits, exponent10 } = exactDecimalDigits(Math.abs(v));
  const digitsStr0 = digits.toString();
  const len = digitsStr0.length;
  const decExp0 = len + exponent10; // value == 0.digitsStr0 * 10**decExp0
  let digitsStr: string;
  let decExp = decExp0;
  if (len <= sig) {
    digitsStr = digitsStr0 + '0'.repeat(sig - len);
  } else {
    const q = roundHalfEvenDrop(digits, len - sig);
    let qStr = q.toString();
    if (qStr.length > sig) {
      // Carry overflow (e.g. 999 -> 1000): qStr is exactly "1" + sig zeros.
      qStr = qStr.slice(0, sig);
      decExp += 1;
    }
    digitsStr = qStr;
  }
  const e = decExp - 1;
  if (e < -6 || e >= sig) {
    const mantissa = sig > 1 ? digitsStr[0] + '.' + digitsStr.slice(1) : digitsStr[0];
    return sign + mantissa + 'e' + (e >= 0 ? '+' : '-') + String(Math.abs(e));
  }
  if (e >= 0) {
    const intPart = digitsStr.slice(0, e + 1);
    const fracPart = digitsStr.slice(e + 1);
    return sign + intPart + (fracPart.length > 0 ? '.' + fracPart : '');
  }
  return sign + '0.' + '0'.repeat(-(e + 1)) + digitsStr;
}
