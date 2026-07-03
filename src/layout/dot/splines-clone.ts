// SPDX-License-Identifier: EPL-2.0

/**
 * cloneNode / cloneEdge for the flat-adj recursive pipeline.
 *
 * @see lib/dotgen/dotsplines.c:cloneNode, cloneEdge, cleanupCloneGraph
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { Point } from '../../model/geom.js';
import { Edge as EdgeClass } from '../../model/edge.js';
import { makePort } from '../../model/edgeInfo.js';
import { agnode } from '../../model/cgraph-ops.js';

/**
 * Map a point from the flat-adj auxiliary frame back to the original frame:
 * un-rotate when the original graph is flipped, then translate by del.
 * @see lib/dotgen/dotsplines.c:transformf
 */
export function transformf(p: Point, del: Point, flip: boolean): Point {
  const q = flip ? { x: p.y, y: -p.x } : { x: p.x, y: p.y };
  return { x: q.x + del.x, y: q.y + del.y };
}

// ---------------------------------------------------------------------------
// cloneNode
// @see lib/dotgen/dotsplines.c:cloneNode
// ---------------------------------------------------------------------------

/**
 * Create a copy of orign in graph g, carrying geometry from NodeInfo.
 * @see lib/dotgen/dotsplines.c:cloneNode
 */
export function cloneNode(g: Graph, orign: Node): Node {
  // C: `agnode(g, agnameof(orign), 1)` mints a FRESH AGSEQ for the clone,
  // scoped to the aux graph's own creation sequence — it does NOT carry
  // orign's id/AGSEQ across graphs. A prior port carried `orign.id` onto the
  // clone directly, which corrupted `nodesInSeq(auxg)` (F7): the clone's
  // "AGSEQ" borrowed the ORIGINAL graph's id ordering instead of reflecting
  // the aux graph's own auxt/auxh creation order.
  // @see lib/dotgen/dotsplines.c:cloneNode (agnode(g,...,1))
  const n = agnode(g, orign.name, true)!;
  n.info.coord = { x: orign.info.coord.x, y: orign.info.coord.y };
  n.info.lw = orign.info.lw;
  n.info.rw = orign.info.rw;
  n.info.ht = orign.info.ht;
  n.info.width = orign.info.width;
  n.info.height = orign.info.height;
  // Copy string attrs
  for (const [k, v] of orign.attrs) n.attrs.set(k, v);
  // Carry the origin's node-default snapshot so inherited attributes (e.g. a
  // graph-level `node[fontsize=8]` the origin never set explicitly) still
  // resolve in the aux graph, which has no node defaults of its own. C's
  // cloneNode does `agcopyattr`, which materialises the origin's inherited attr
  // values; without this the aux re-sizes an HTML-label node at the built-in
  // fontsize=14 instead of the inherited 8, ballooning the node (#1949: the
  // flat-adj aux nodes grew ~2x, adding 33px of graph height).
  // @see lib/dotgen/dotsplines.c:cloneNode (agcopyattr)
  if (orign.nodeDefaultsSnapshot !== undefined) {
    n.nodeDefaultsSnapshot = new Map(orign.nodeDefaultsSnapshot);
  }
  return n;
}

// ---------------------------------------------------------------------------
// cloneEdge
// @see lib/dotgen/dotsplines.c:cloneEdge
// ---------------------------------------------------------------------------

/**
 * Create a copy of orig between tn→hn in graph g.
 * @see lib/dotgen/dotsplines.c:cloneEdge
 */
export function cloneEdge(g: Graph, tn: Node, hn: Node, orig: Edge): Edge {
  const e = new EdgeClass(tn, hn, orig.name);
  e.info.tail_port = { ...makePort(), ...orig.info.tail_port };
  e.info.head_port = { ...makePort(), ...orig.info.head_port };
  e.info.weight = orig.info.weight;
  e.info.minlen = orig.info.minlen;
  // Copy string attrs
  for (const [k, v] of orig.attrs) e.attrs.set(k, v);
  g.edges.push(e);
  return e;
}

// ---------------------------------------------------------------------------
// cleanupCloneGraph
// @see lib/dotgen/dotsplines.c:cleanupCloneGraph
// ---------------------------------------------------------------------------

/**
 * Release all resources held by the auxiliary clone graph.
 * In the C implementation this restores global Agsyms and calls dot_cleanup.
 * In TypeScript, clearing node and edge collections is sufficient.
 * @see lib/dotgen/dotsplines.c:cleanupCloneGraph
 */
export function cleanupCloneGraph(auxg: Graph): void {
  auxg.nodes.clear();
  auxg.edges.length = 0;
  auxg.subgraphs.clear();
}
