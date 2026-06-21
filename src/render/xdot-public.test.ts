// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for the structured xdot draw-op exposure ({@link getDrawOps}).
 *
 * These assert the draw ops the xdot renderer currently emits and that
 * survive the typed round-trip: node shape ops (ellipse), text/label ops,
 * font ops, and color ops. Edge draw ops and custom-color application are a
 * documented xdot-renderer limitation (see the module JSDoc) and are not
 * asserted here.
 */

import { describe, it, expect } from 'vitest';
import { parse } from '../parser/index.js';
import { getDrawOps } from './xdot-public.js';
import type { XdotOp } from '../xdot/index.js';

/** Lay out and collect draw ops for a DOT source. */
function opsFor(src: string): XdotOp[] {
  return getDrawOps(parse(src));
}

/** All `kind` discriminators present in an op list. */
function kindsOf(ops: XdotOp[]): string[] {
  return ops.map((o) => o.kind);
}

/** Label strings from every text op. */
function textsOf(ops: XdotOp[]): string[] {
  const out: string[] = [];
  for (const o of ops) if (o.kind === 'text') out.push(o.text.text);
  return out;
}

describe('getDrawOps — node shape ops', () => {
  it('emits an ellipse op for each default (ellipse-shaped) node', () => {
    const kinds = kindsOf(opsFor('digraph { a -> b }'));
    const ellipses = kinds.filter(
      (k) => k === 'filled_ellipse' || k === 'unfilled_ellipse',
    );
    expect(ellipses.length).toBe(2);
  });
});

describe('getDrawOps — text/label ops', () => {
  it('emits a text op carrying each node label string', () => {
    const texts = textsOf(opsFor('digraph { a -> b }'));
    expect(texts).toContain('a');
    expect(texts).toContain('b');
  });
});

describe('getDrawOps — font and color ops', () => {
  it('emits font ops for the labels', () => {
    const kinds = kindsOf(opsFor('digraph { a -> b }'));
    expect(kinds).toContain('font');
  });

  it('emits a pen-color op (color string present)', () => {
    const ops = opsFor('digraph { a -> b }');
    const colorOp = ops.find(
      (o) => o.kind === 'pen_color' || o.kind === 'fill_color',
    );
    expect(colorOp).toBeDefined();
    if (colorOp && (colorOp.kind === 'pen_color' || colorOp.kind === 'fill_color')) {
      expect(typeof colorOp.color).toBe('string');
      expect(colorOp.color.length).toBeGreaterThan(0);
    }
  });
});

describe('getDrawOps — typed discrimination', () => {
  it('returns a typed XdotOp[] consumers can switch on by kind', () => {
    const ops = opsFor('digraph { a }');
    expect(ops.length).toBeGreaterThan(0);
    // Every op carries a string `kind` discriminator.
    expect(ops.every((o) => typeof o.kind === 'string')).toBe(true);
  });
});
