// SPDX-License-Identifier: EPL-2.0

/**
 * cloneNode / cloneEdge for the flat-adj recursive pipeline.
 *
 * @see lib/dotgen/dotsplines.c:cloneNode, cloneEdge, cleanupCloneGraph
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import { Node as NodeClass } from '../../model/node.js';
import { Edge as EdgeClass } from '../../model/edge.js';
import { makePort } from '../../model/edgeInfo.js';

// ---------------------------------------------------------------------------
// cloneNode
// @see lib/dotgen/dotsplines.c:cloneNode
// ---------------------------------------------------------------------------

/**
 * Create a copy of orign in graph g, carrying geometry from NodeInfo.
 * @see lib/dotgen/dotsplines.c:cloneNode
 */
export function cloneNode(g: Graph, orign: Node): Node {
  const n = new NodeClass(orign.id, orign.name, g);
  n.info.coord = { x: orign.info.coord.x, y: orign.info.coord.y };
  n.info.lw = orign.info.lw;
  n.info.rw = orign.info.rw;
  n.info.ht = orign.info.ht;
  n.info.width = orign.info.width;
  n.info.height = orign.info.height;
  // Copy string attrs
  for (const [k, v] of orign.attrs) n.attrs.set(k, v);
  g.nodes.set(n.name, n);
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
