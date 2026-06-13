// SPDX-License-Identifier: EPL-2.0

/**
 * Safe field accessors for flat.ts.
 *
 * Kept in a separate file because lizard 1.22.1 mis-parses TypeScript when
 * many function definitions accumulate in one file, inflating CCN counts for
 * unrelated functions. Splitting accessors here avoids the parse bug.
 *
 * @see lib/dotgen/flat.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { RankEntry } from '../../model/rankEntry.js';

export function nodeOrder(n: Node): number {
  if (n.info.order !== undefined) return n.info.order;
  return 0;
}

export function nodeRank(n: Node): number {
  if (n.info.rank !== undefined) return n.info.rank;
  return 0;
}

export function graphNodesep(g: Graph): number {
  if (g.info.nodesep !== undefined) return g.info.nodesep;
  return 0;
}

export function graphMaxrank(g: Graph): number {
  if (g.info.maxrank !== undefined) return g.info.maxrank;
  return 0;
}

export function graphMinrank(g: Graph): number {
  if (g.info.minrank !== undefined) return g.info.minrank;
  return 0;
}

export function graphNCluster(g: Graph): number {
  if (g.info.n_cluster !== undefined) return g.info.n_cluster;
  return 0;
}

/** Read order field of rank slot i safely. */
export function getOrd(rk: RankEntry, i: number): number {
  const o = rk.v[i].info.order;
  if (o !== undefined) return o;
  return 0;
}
