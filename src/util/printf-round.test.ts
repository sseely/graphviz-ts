// SPDX-License-Identifier: EPL-2.0
import { describe, it, expect } from 'vitest';
import { printfFixed, printfSig } from './printf-round.js';

// ---------------------------------------------------------------------------
// Proven divergence cases (from .agent-notes/circo-edge-tail-rca.md and
// .agent-notes/printdouble-tie-rounding-2026-06.md)
// ---------------------------------------------------------------------------

describe('printfSig — proven ties', () => {
  it('1399.25 @ 5 sig figs rounds half-even to 1399.2 (graphs-b786, circo)', () => {
    expect(printfSig(1399.25, 5)).toBe('1399.2');
    // Number.prototype.toPrecision rounds the same exact tie half-away.
    expect((1399.25).toPrecision(5)).toBe('1399.3');
  });
});

describe('printfFixed — proven ties', () => {
  it('34.125 @ 2 dp rounds half-even to 34.12', () => {
    expect(printfFixed(34.125, 2)).toBe('34.12');
    expect((34.125).toFixed(2)).toBe('34.13');
  });

  it('45.375 @ 2 dp rounds half-even to 45.38 (odd kept digit rounds up either way)', () => {
    expect(printfFixed(45.375, 2)).toBe('45.38');
    expect((45.375).toFixed(2)).toBe('45.38');
  });
});

// ---------------------------------------------------------------------------
// Additional tie coverage
// ---------------------------------------------------------------------------

describe('printfFixed — additional exact ties', () => {
  it.each<[number, number, string]>([
    [34.125, 2, '34.12'],
    [-34.125, 2, '-34.12'],
    [45.375, 2, '45.38'],
    [0.625, 2, '0.62'],
    [0.875, 2, '0.88'],
    [-0.375, 2, '-0.38'],
    [2.5, 2, '2.50'],
  ])('printfFixed(%f, %i) => %s', (v, decimals, expected) => {
    expect(printfFixed(v, decimals)).toBe(expected);
  });

  it('0 and -0 format as zero-padded, sign-suppressed', () => {
    expect(printfFixed(0, 2)).toBe('0.00');
    expect(printfFixed(-0, 2)).toBe('0.00');
  });

  it('0.195 is NOT an exact tie at 2dp (rounds via the true stored double)', () => {
    expect(printfFixed(0.195, 2)).toBe((0.195).toFixed(2));
  });
});

describe('printfSig — additional exact ties', () => {
  it('999.5 @ 3 sig figs carries to 1.00e+3', () => {
    expect(printfSig(999.5, 3)).toBe('1.00e+3');
  });

  it('0 formats as fixed zero padded to the requested precision', () => {
    expect(printfSig(0, 5)).toBe('0.0000');
    expect(printfSig(0, 1)).toBe('0');
  });
});

// ---------------------------------------------------------------------------
// Notation/threshold parity with toPrecision for non-tie magnitudes
// ---------------------------------------------------------------------------

describe('printfSig — notation matches toPrecision', () => {
  it.each<[number, number]>([
    [1e21, 5],
    [1e-7, 5],
    [123456789, 5],
    [9.9999, 3],
    [0.001234, 4],
    [7, 5],
  ])('printfSig(%f, %i) matches toPrecision', (v, sig) => {
    expect(printfSig(v, sig)).toBe(v.toPrecision(sig));
  });
});

// ---------------------------------------------------------------------------
// Broad random non-tie regression: printfFixed/printfSig must be
// byte-identical to Number.prototype.toFixed/toPrecision whenever the value
// is not an exact binary tie at the target precision.
// ---------------------------------------------------------------------------

describe('printfFixed — random non-tie regression', () => {
  it('matches toFixed across a broad random sample', () => {
    let checked = 0;
    for (let i = 0; i < 20000; i++) {
      const v = (Math.random() - 0.5) * 10 ** (Math.random() * 12 - 4);
      const decimals = Math.floor(Math.random() * 6);
      expect(printfFixed(v, decimals)).toBe(v.toFixed(decimals));
      checked++;
    }
    expect(checked).toBe(20000);
  });
});

describe('printfSig — random non-tie regression', () => {
  it('matches toPrecision across a broad random sample', () => {
    let checked = 0;
    for (let i = 0; i < 20000; i++) {
      const v = (Math.random() - 0.5) * 10 ** (Math.random() * 12 - 4);
      const sig = 1 + Math.floor(Math.random() * 10);
      expect(printfSig(v, sig)).toBe(v.toPrecision(sig));
      checked++;
    }
    expect(checked).toBe(20000);
  });
});
