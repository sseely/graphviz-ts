// SPDX-License-Identifier: EPL-2.0

/**
 * Edge routing order for dot, matching C `dot_splines_`.
 *
 * C routes edges from a list built rank-major (`GD_rank[i].v[j]` out-edges of
 * NORMAL / splineMerge nodes) then `qsort`-ed by `edgecmp`. Because
 * `recover_slack` re-centres shared virtual nodes that other edges read as
 * `maximal_bbox` neighbours, corridor geometry is routing-order-dependent — so
 * the port must route in C's order, not `g.nodes.values()` insertion order.
 *
 * The port iterates the ORIGINAL edges directly (real tails), so `edgecmp`'s
 * `getmainedge` mapping is the identity here and the rank/coord keys read the
 * original endpoints. `AGSEQ` (the port's `Edge.seq`) is unique, making the
 * comparator a total order — a stable `Array.sort` over any collection order
 * reproduces C's `qsort` result (edgecmp-equal originals never occur, and C
 * batches genuinely-equivalent edges via the cnt-loop, so their relative
 * routing order is immaterial).
 *
 * @see lib/dotgen/dotsplines.c:dot_splines_ (edges list build + sort)
 * @see lib/dotgen/dotsplines.c:edgecmp
 */

import type { Edge } from '../../model/edge.js';
import { FLATEDGE, REGULAREDGE } from '../../common/splines-constants.js';

/**
 * Edge-type key: same-rank ⇒ FLATEDGE, else REGULAREDGE — mirrors C `setflags`
 * (regular out-edges REGULAREDGE, flat_out FLATEDGE).
 * @see lib/dotgen/dotsplines.c:dot_splines_ (setflags REGULAREDGE/FLATEDGE)
 */
function edgeTypeKey(e: Edge): number {
  return e.tail.info.rank === e.head.info.rank ? FLATEDGE : REGULAREDGE;
}

/**
 * Lexicographic sort key for one edge, mirroring `edgecmp`. Each entry is
 * compared ascending, so the edge-type term is negated (C orders type
 * descending: FLATEDGE before REGULAREDGE). `AGSEQ` (`Edge.seq`) is unique, so
 * the key tuple is a total order. @see lib/dotgen/dotsplines.c:edgecmp
 */
function edgeRouteKey(e: Edge): number[] {
  return [
    -edgeTypeKey(e),
    Math.abs((e.tail.info.rank ?? 0) - (e.head.info.rank ?? 0)),
    Math.abs((e.tail.info.coord?.x ?? 0) - (e.head.info.coord?.x ?? 0)),
    e.seq,
  ];
}

/**
 * Compare two original edges in C `dot_splines_` routing order via their
 * lexicographic `edgecmp` keys. @see lib/dotgen/dotsplines.c:edgecmp
 */
export function edgeRouteCmp(a: Edge, b: Edge): number {
  const ka = edgeRouteKey(a);
  const kb = edgeRouteKey(b);
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return ka[i] - kb[i];
  }
  return 0;
}
