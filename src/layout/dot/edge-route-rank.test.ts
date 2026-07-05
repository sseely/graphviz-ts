// SPDX-License-Identifier: EPL-2.0

/**
 * T17 (2646) — getSplineBounds/resetSplineBounds must mirror C's
 * `spline_info_t sd`: computed ONCE per `dot_splines_` pass and threaded
 * through the rest of that pass, immune to recoverSlack/resizeVn vnode
 * mutations from earlier edges in the same pass.
 *
 * Root cause: computeLeftBound/computeRightBound were previously called
 * fresh at every routing call site (chainBboxCtx, flatBboxCtx,
 * routeRegularEdgeFaithful's ctx, rankEdgeInfoOf), so an edge routed later
 * in a pass saw a corridor narrowed by earlier edges' vnode-resize side
 * effects — measured on 2646: 6002 of the pass's bound reads drifted 26pt
 * narrower per side vs C's frozen value. The very first, pre-mutation
 * computeLeftBound/computeRightBound call was already byte-identical to
 * C's one-time value, so the formula is faithful; only the call timing
 * drifted. (2646's residual 3-edge Δ42.09 divergence proved to be a
 * separate mechanism, unaffected by the drift.)
 *
 * @see plans/structural-match-endgame/analysis/2646-recordport.md
 * @see lib/dotgen/dotsplines.c:dot_splines_ (`spline_info_t sd = {0};`,
 *   the one-time LeftBound/RightBound loop at 270-282)
 */

import { describe, it, expect } from 'vitest';
import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { makeNodeInfo } from '../../model/nodeInfo.js';
import type { RankEntry } from '../../model/rankEntry.js';
import {
  computeLeftBound, computeRightBound, getSplineBounds, resetSplineBounds,
} from './edge-route-rank.js';

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function makeRankEntry(nodes: Node[]): RankEntry {
  return {
    n: nodes.length, v: [...nodes], an: 0, av: [],
    ht1: 0, ht2: 0, pht1: 0, pht2: 0,
    candidate: false, valid: false, cache_nc: 0,
  };
}

function makeNode(id: number, name: string, g: Graph, x: number): Node {
  const n = new Node(id, name, g);
  n.info = makeNodeInfo();
  n.info.coord = { x, y: 0 };
  n.info.lw = 36;
  n.info.rw = 36;
  g.nodes.set(name, n);
  return n;
}

/** Two ranks, one node each, mirroring the minimal shape computeLeftBound/
 *  computeRightBound scan (`g.info.rank[i].v[0]` / `v[n-1]`). */
function makeTwoRankGraph(): { g: Graph; n0: Node; n1: Node } {
  const g = new Graph('g', 'directed');
  const n0 = makeNode(0, 'n0', g, 0);
  const n1 = makeNode(1, 'n1', g, 0);
  g.info.rank = [makeRankEntry([n0]), makeRankEntry([n1])];
  g.info.minrank = 0;
  g.info.maxrank = 1;
  return { g, n0, n1 };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getSplineBounds / resetSplineBounds (spline_info_t sd parity)', () => {
  it('first access matches a direct computeLeftBound/computeRightBound call', () => {
    const { g } = makeTwoRankGraph();
    const direct = { leftBound: computeLeftBound(g), rightBound: computeRightBound(g) };
    expect(getSplineBounds(g)).toEqual(direct);
  });

  it('is immune to vnode mutation within the same pass (no reset)', () => {
    const { g, n0, n1 } = makeTwoRankGraph();
    const before = getSplineBounds(g);

    // Simulate recoverSlack/resizeVn narrowing the corridor 26pt per side
    // after earlier edges in the pass have routed (the diagnosed mechanism).
    n0.info.lw -= 26;
    n0.info.coord.x += 26;
    n1.info.rw -= 26;
    n1.info.coord.x -= 26;

    const after = getSplineBounds(g);
    expect(after).toEqual(before);
    expect(after).not.toEqual({
      leftBound: computeLeftBound(g),
      rightBound: computeRightBound(g),
    });
  });

  it('resetSplineBounds forces the next access to recompute fresh', () => {
    const { g, n0, n1 } = makeTwoRankGraph();
    getSplineBounds(g); // prime the cache for this "pass"

    n0.info.lw -= 26;
    n0.info.coord.x += 26;
    n1.info.rw -= 26;
    n1.info.coord.x -= 26;

    resetSplineBounds(g); // start of the NEXT dot_splines_ pass
    const fresh = getSplineBounds(g);
    expect(fresh).toEqual({
      leftBound: computeLeftBound(g),
      rightBound: computeRightBound(g),
    });
  });

  it('different graph instances (e.g. aux graphs) never share a cached snapshot', () => {
    const a = makeTwoRankGraph();
    const b = makeTwoRankGraph();
    b.n0.info.coord.x = -1000;
    b.n1.info.coord.x = 1000;

    const boundsA = getSplineBounds(a.g);
    const boundsB = getSplineBounds(b.g);
    expect(boundsB).not.toEqual(boundsA);
  });
});
