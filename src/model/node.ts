// SPDX-License-Identifier: EPL-2.0

/**
 * TypeScript port of Agnode_t from lib/cgraph/cgraph.h.
 *
 * @see lib/cgraph/cgraph.h:Agnode_s
 */

import type { Edge } from './edge.js';
import type { Graph } from './graph.js';
import { type NodeInfo, makeNodeInfo } from './nodeInfo.js';

/**
 * Represents an Agnode_t — a graph node.
 *
 * In the C implementation, Agnode_t embeds Agobj_t (tag + data), holds a
 * pointer to its root graph, and contains an embedded Agsubnode_t for the
 * main graph. Per-graph membership is tracked via Agsubnode_t records in
 * libcdt dicts. Here node identity is object identity (pointer comparison
 * in C maps to reference equality in TypeScript).
 *
 * The `info` field replaces the agbindrec / ND_* mechanism (AD-1).
 *
 * @see lib/cgraph/cgraph.h:Agnode_s
 * @see lib/cgraph/cgraph.h:Agsubnode_s
 */
export class Node {
  /**
   * Unique integer ID per root graph; maps to AGID in the C implementation.
   * @see lib/cgraph/cgraph.h:AGID
   */
  readonly id: number;

  /** Node name; agnameof equivalent. @see lib/cgraph/cgraph.h:agnameof */
  readonly name: string;

  /**
   * String attributes (agget/agset equivalents).
   * @see lib/cgraph/cgraph.h:Agattr_s
   */
  attrs: Map<string, string>;

  /**
   * Layout-engine info; replaces ND_* macros via agbindrec (AD-1).
   * @see lib/cgraph/cgraph.h:agbindrec
   */
  info: NodeInfo;

  /**
   * Root graph that owns this node.
   * @see lib/cgraph/cgraph.h:Agnode_s
   */
  readonly root: Graph;

  /** @see lib/cgraph/node.c:agnode */
  constructor(id: number, name: string, root: Graph) {
    this.id = id;
    this.name = name;
    this.attrs = new Map();
    this.info = makeNodeInfo();
    this.root = root;
  }

  /**
   * Returns out-edges of this node in graph g (where this node is the tail).
   *
   * ORDER: cgraph's per-node out-edge dict sorts by the SEQ of the edge's
   * out-half node — the HEAD — then by edge seq (edge.c:agedgeseqcmpf,
   * Ag_mainedge_seq_disc). Iteration is therefore by (head creation order,
   * edge creation order), NOT by plain edge insertion order. This ordering
   * is load-bearing for emission order and for force-accumulation order in
   * the iterative engines.
   *
   * INVARIANT: In the C cgraph library, the adjacency list for a node begins
   * with the node's own self-loop (index 0), and neighbor traversal MUST start
   * at index 1. This convention originates from lib/cgraph/edge.c and
   * agfstedge/agnxtedge. In this TypeScript implementation, self-loops are
   * included in outEdges() but are excluded from inEdges() — matching the
   * agnxtedge behavior that skips self-loops as in-edges. Callers iterating
   * over neighbors must account for self-loop edges appearing in outEdges().
   *
   * @see lib/cgraph/edge.c:agfstout
   * @see lib/cgraph/edge.c:agnxtout
   * @see lib/cgraph/edge.c:agedgeseqcmpf
   */
  outEdges(g: Graph): Edge[] {
    return g.edges
      .filter((e) => e.tail === this)
      .sort((a, b) => (a.head.id - b.head.id) || (a.seq - b.seq));
  }

  /**
   * Returns in-edges of this node in graph g (where this node is the head).
   * Self-loops are excluded per C agnxtedge semantics. Ordered by the SEQ
   * of the in-half node — the TAIL — then edge seq (agedgeseqcmpf).
   *
   * @see lib/cgraph/edge.c:agfstin
   * @see lib/cgraph/edge.c:agnxtin
   * @see lib/cgraph/edge.c:agnxtedge (skips self-loops as in-edges)
   * @see lib/cgraph/edge.c:agedgeseqcmpf
   */
  inEdges(g: Graph): Edge[] {
    return g.edges
      .filter((e) => e.head === this && e.tail !== this)
      .sort((a, b) => (a.tail.id - b.tail.id) || (a.seq - b.seq));
  }
}
