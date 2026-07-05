// SPDX-License-Identifier: EPL-2.0

/**
 * Regression test for T16 (analysis/1453-curved.md): `dedupByOrig` must push
 * the RESOLVED original edge, not the raw group member. A raw member can be a
 * swapped internal proxy (e.g. a same-rank flat edge whose canonical
 * orientation is tail/head-swapped, or an opposing-pair duplicate) whose
 * `to_orig` points back to the real rendered edge. Passing the raw proxy on
 * to `makeStraightEdges`/`routeParallelEdgeGroup` clips/installs the spline
 * against the proxy's endpoints instead of the real edge's, leaving the real
 * edge's geometry unset (or stale) and diverging from the C oracle.
 *
 * @see src/layout/dot/splines-groups.ts:dedupByOrig
 * @see plans/structural-match-endgame/analysis/1453-curved.md
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import { makeEdgeInfo, makePort } from '../../model/edgeInfo.js';
import { dedupByOrig } from './splines-groups.js';

/** Minimal graph + node builders — `dedupByOrig` only touches `Edge.info.to_orig`
 * (via `resolveOrigEdge`), so no rank/order/coord fixture state is needed. */
function makeTestGraph(): Graph {
  return new Graph('g', 'directed');
}

function makeTestNode(id: number, name: string, g: Graph): Node {
  return new Node(id, name, g);
}

function makeTestEdge(tail: Node, head: Node): Edge {
  const e = new Edge(tail, head, '');
  e.info = makeEdgeInfo(makePort(), makePort());
  return e;
}

/** A raw internal proxy edge whose tail/head are swapped vs. `orig`, linked
 * back to it via `to_orig` — mirrors the flat/opposing-pair group members
 * `dedupByOrig` must resolve away from. */
function makeSwappedProxy(orig: Edge): Edge {
  const proxy = makeTestEdge(orig.head, orig.tail);
  proxy.info.to_orig = orig;
  return proxy;
}

describe('dedupByOrig (T16 regression)', () => {
  it('resolves a single swapped proxy to its real original', () => {
    const g = makeTestGraph();
    const a = makeTestNode(1, 'a', g);
    const b = makeTestNode(2, 'b', g);
    const orig = makeTestEdge(a, b);
    const proxy = makeSwappedProxy(orig);

    const out = dedupByOrig([proxy]);

    expect(out).toEqual([orig]);
    expect(out[0]).not.toBe(proxy);
  });

  it('keeps the real original when it is already un-proxied', () => {
    const g = makeTestGraph();
    const a = makeTestNode(1, 'a', g);
    const b = makeTestNode(2, 'b', g);
    const orig = makeTestEdge(a, b);

    expect(dedupByOrig([orig])).toEqual([orig]);
  });

  it('collapses an opposing-pair duplicate (3 entries, 2 originals) to the resolved originals only', () => {
    const g = makeTestGraph();
    const a = makeTestNode(1, 'a', g);
    const b = makeTestNode(2, 'b', g);
    const ab = makeTestEdge(a, b); // a -> b
    const ba = makeTestEdge(b, a); // b -> a
    // Duplicate proxy view of `ab`, as C's ND_other collection can produce
    // for a same-rank opposing pair.
    const abProxy = makeSwappedProxy(ab);

    const out = dedupByOrig([ab, ba, abProxy]);

    expect(out).toHaveLength(2);
    expect(out).toContain(ab);
    expect(out).toContain(ba);
    expect(out).not.toContain(abProxy);
  });
});
