// SPDX-License-Identifier: EPL-2.0
/**
 * Tests for `cloneNode`'s id assignment (F7 fallout, #1949 flat-adj pipeline).
 *
 * C's `cloneNode` calls `agnode(g, agnameof(orign), 1)`, which mints a FRESH
 * AGSEQ for the clone, scoped to the aux graph's own creation sequence — it
 * does not carry `orign`'s id/AGSEQ across graphs. A prior port copied
 * `orign.id` onto the clone directly, which is only cosmetically harmless
 * until something sorts the aux graph's nodes by `.id` expecting AGSEQ
 * semantics (`nodesInSeq`, F7) — then the clone's "AGSEQ" wrongly reflects
 * the ORIGINAL graph's id ordering instead of the aux graph's own
 * auxt-then-auxh creation order.
 *
 * @see lib/dotgen/dotsplines.c:cloneNode (agnode(g,...,1))
 * @see .agent-notes/path-structure-xns-residuals.md ("## F7 outcome")
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { cloneNode } from './splines-clone.js';
import { nodesInSeq } from './decomp.js';

describe('cloneNode — fresh AGSEQ, not orign.id carried across graphs', () => {
  it('assigns ids in the AUX graph\'s own creation order, even when the '
    + 'originals\' ids are in the opposite order', () => {
    const root = new Graph('root', 'directed');
    // Original graph: `hi` created BEFORE `lo` (hi.id=0 < lo.id=1), but the
    // aux clone pipeline clones `lo` FIRST (mirrors splines-flat.ts's
    // `auxt = cloneNode(auxg, refTn)` / `auxh = cloneNode(auxg, ...)` order,
    // which is independent of the originals' relative id order).
    const hi = new Node(0, 'hi', root);
    const lo = new Node(1, 'lo', root);
    root.nodes.set(hi.name, hi);
    root.nodes.set(lo.name, lo);

    const auxg = new Graph('auxg', 'directed');
    const auxLo = cloneNode(auxg, lo);
    const auxHi = cloneNode(auxg, hi);

    // The clones must NOT carry the originals' ids (1, 0) — that would make
    // nodesInSeq(auxg) sort auxHi before auxLo, inverting the aux graph's
    // actual creation order.
    expect(auxLo.id).not.toBe(lo.id);
    expect(auxHi.id).not.toBe(hi.id);
    expect(nodesInSeq(auxg).map((n) => n.name)).toEqual(['lo', 'hi']);
  });

  it('carries geometry, attrs, and node-defaults snapshot from the original', () => {
    const root = new Graph('root', 'directed');
    const orign = new Node(0, 'n', root);
    orign.info.coord = { x: 5, y: 7 };
    orign.info.lw = 10; orign.info.rw = 11; orign.info.ht = 12;
    orign.attrs.set('label', 'foo');
    orign.nodeDefaultsSnapshot = new Map([['fontsize', '8']]);

    const auxg = new Graph('auxg', 'directed');
    const clone = cloneNode(auxg, orign);

    expect(clone.name).toBe('n');
    expect(clone.info.coord).toEqual({ x: 5, y: 7 });
    expect(clone.info.lw).toBe(10);
    expect(clone.attrs.get('label')).toBe('foo');
    expect(clone.nodeDefaultsSnapshot?.get('fontsize')).toBe('8');
    expect(auxg.nodes.get('n')).toBe(clone);
  });
});
