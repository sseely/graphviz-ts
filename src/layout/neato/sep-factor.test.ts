// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for sepFactor/esepFactor/parseFactor (neatogen adjust.c port).
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { parseFactor, sepFactor, esepFactor, SEPFACT, DFLT_MARGIN } from './sep-factor.js';

describe('parseFactor', () => {
  it('parses "+x,y" as an additive margin', () => {
    expect(parseFactor('+5,3', 1.0, 0)).toEqual({ x: 5, y: 3, doAdd: true });
  });

  it('duplicates a single value for both axes', () => {
    expect(parseFactor('+4', 1.0, 0)).toEqual({ x: 4, y: 4, doAdd: true });
  });

  it('parses "x,y" as scale factors 1 + v/sepfact', () => {
    const r = parseFactor('0.5,1', 1.0, 0)!;
    expect(r.doAdd).toBe(false);
    expect(r.x).toBeCloseTo(1.5, 15);
    expect(r.y).toBeCloseTo(2.0, 15);
  });

  it('clamps additive values against dflt when sepfact < 1', () => {
    // sepfact = SEPFACT (0.8) < 1 → max(dflt, v/sepfact)
    const r = parseFactor('+1', SEPFACT, DFLT_MARGIN)!;
    expect(r.x).toBe(DFLT_MARGIN);
  });

  it('returns null on garbage', () => {
    expect(parseFactor('frob', 1.0, 0)).toBeNull();
  });
});

describe('sepFactor / esepFactor', () => {
  it('defaults to +4pt node separation', () => {
    const g = new Graph('g', 'undirected');
    expect(sepFactor(g)).toEqual({ x: 4, y: 4, doAdd: true });
  });

  it('defaults to +3.2pt edge separation (SEPFACT × 4)', () => {
    const g = new Graph('g', 'undirected');
    const r = esepFactor(g);
    expect(r.doAdd).toBe(true);
    expect(r.x).toBeCloseTo(3.2, 12);
  });

  it('reads the sep attribute', () => {
    const g = new Graph('g', 'undirected');
    g.attrs.set('sep', '+8,2');
    expect(sepFactor(g)).toEqual({ x: 8, y: 2, doAdd: true });
  });
});
