// SPDX-License-Identifier: EPL-2.0

/**
 * Regression tests for class2 back-edge handling — the 2-cycle double-count fix.
 *
 * A 2-cycle (mutual edges a→b and b→a) must merge into a single fast edge, as
 * native dot does. The bug was that `handleBackEdge` searched the fast graph
 * (n.info.out) for the opposite forward edge instead of the original cgraph
 * out-edges, so the opposite was a fast edge (to_virt undefined), which tripped
 * `tryOppEdge`'s makeChain guard and built a redundant second chain. That stray
 * aux edge perturbed the x-coordinate network simplex, shifting node positions.
 *
 * Node positions oracle-verified against dot 15.1.0 -Tsvg.
 * @see lib/dotgen/class2.c:259 (backward-edge block iterates agfstout)
 */

import { describe, it, expect } from 'vitest';
import { renderSvg } from '../../index.js';

/** Map node title → ellipse centre (SVG frame) from rendered output. */
function nodeCenters(svg: string): Map<string, { cx: string; cy: string }> {
  const m = new Map<string, { cx: string; cy: string }>();
  const re = /<g id="node\d+"[^>]*>([\s\S]*?)<\/g>/g;
  let g: RegExpExecArray | null;
  while ((g = re.exec(svg)) !== null) {
    const t = /<title>([^<]*)<\/title>/.exec(g[1]);
    const el = /<ellipse[^>]*\scx="(-?[\d.]+)"[^>]*\scy="(-?[\d.]+)"/.exec(g[1]);
    if (t && el) m.set(t[1], { cx: el[1], cy: el[2] });
  }
  return m;
}

describe('class2 2-cycle back-edge merge (oracle: dot 15.1.0 -Tsvg)', () => {
  it('2-cycle with siblings lays out exactly as native (fix-sensitive)', () => {
    // Without the fix the stray aux edge shifts nodes by up to 20pt vs native.
    const c = nodeCenters(renderSvg('digraph{a->b;b->a;c->a;c->b;a->d;b->e;d->f;e->f}', 'dot'));
    expect(c.get('a')).toEqual({ cx: '63', cy: '-234' });
    expect(c.get('b')).toEqual({ cx: '35', cy: '-162' });
    expect(c.get('c')).toEqual({ cx: '35', cy: '-306' });
    expect(c.get('d')).toEqual({ cx: '99', cy: '-90' });
    expect(c.get('e')).toEqual({ cx: '27', cy: '-90' });
    expect(c.get('f')).toEqual({ cx: '63', cy: '-18' });
  });

  it('a longer cycle (a->b->c->a) matches native (non-2-cycle back edge)', () => {
    // Sanity: the closing back edge c→a is a genuine virtual chain (b is pushed
    // left of a/c by it), and must still match native exactly.
    const c = nodeCenters(renderSvg('digraph{a->b;b->c;c->a}', 'dot'));
    expect(c.get('a')).toEqual({ cx: '54', cy: '-162' });
    expect(c.get('b')).toEqual({ cx: '27', cy: '-90' });
    expect(c.get('c')).toEqual({ cx: '54', cy: '-18' });
  });
});
