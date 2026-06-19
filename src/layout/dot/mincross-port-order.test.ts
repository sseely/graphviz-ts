// SPDX-License-Identifier: EPL-2.0

/**
 * G2 — compass-port mincross tiebreak. When a node has multiple compass-ported
 * out-edges, C `in_cross`/`out_cross` (`lib/dotgen/mincross.c:593,611`) order the
 * successor rank by `ND_order`, breaking equal-order ties by the geometric port
 * `p.x`. The port previously broke ties by the angular `port.order` (via `val`),
 * swapping the two compass-ported successors and mispositioning the tail node.
 *
 * Oracle: locally built dot 15.0.0. Coords are byte-exact integers, so these
 * pins assert exact values (no tolerance).
 *
 * @see lib/dotgen/mincross.c:in_cross, out_cross
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

/** Map of node name → ellipse center x from a rendered dot SVG. */
function nodeCx(dot: string): Map<string, number> {
  const svg = renderSvg(dot, 'dot');
  const re = /<title>([A-Za-z0-9]+)<\/title>\s*<ellipse[^>]*\bcx="(-?[0-9.]+)"/g;
  const out = new Map<string, number>();
  for (let m = re.exec(svg); m !== null; m = re.exec(svg)) out.set(m[1], Number(m[2]));
  return out;
}

/** Rank-1 node names ordered left-to-right by cx. */
function orderByCx(cx: Map<string, number>, names: string[]): string[] {
  return [...names].sort((a, b) => (cx.get(a) ?? 0) - (cx.get(b) ?? 0));
}

describe('G2 — compass-port mincross tiebreak (vs dot 15.0.0)', () => {
  it('digraph{a:e->b; a:w->c; a->d}: rank-1 order is [c,d,b], a.cx == 99', () => {
    const cx = nodeCx('digraph{a:e->b; a:w->c; a->d}');
    // Oracle: c@27, d@99, b@171 → west-port c left, plain d center, east-port b right.
    expect(orderByCx(cx, ['b', 'c', 'd'])).toEqual(['c', 'd', 'b']);
    expect(cx.get('c')).toBe(27);
    expect(cx.get('d')).toBe(99);
    expect(cx.get('b')).toBe(171);
    expect(cx.get('a')).toBe(99);
  });

  it('plain digraph{a->b; a->c; a->d} is unchanged: rank-1 stays [b,c,d]', () => {
    // No ports → every in-edge has p.x == 0, so the tiebreak is a no-op and the
    // build order is preserved. Oracle: b@27, c@99, d@171, a@99.
    const cx = nodeCx('digraph{a->b; a->c; a->d}');
    expect(orderByCx(cx, ['b', 'c', 'd'])).toEqual(['b', 'c', 'd']);
    expect(cx.get('b')).toBe(27);
    expect(cx.get('c')).toBe(99);
    expect(cx.get('d')).toBe(171);
    expect(cx.get('a')).toBe(99);
  });
});
