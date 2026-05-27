// SPDX-License-Identifier: EPL-2.0

/**
 * TypeScript port of Agraph_t from lib/cgraph/cgraph.h.
 *
 * @see lib/cgraph/cgraph.h:Agraph_s
 * @see lib/cgraph/cgraph.h:Agdesc_s
 */

import type { Edge } from './edge.js';
import type { Node } from './node.js';
import { type GraphInfo, makeGraphInfo } from './graphInfo.js';

/**
 * Describes the kind of graph, corresponding to the Agdesc_t descriptor
 * fields `directed` and `strict` in the C implementation.
 *
 * @see lib/cgraph/cgraph.h:Agdesc_s
 * @see lib/cgraph/graph.c:Agdirected
 * @see lib/cgraph/graph.c:Agstrictdirected
 * @see lib/cgraph/graph.c:Agundirected
 * @see lib/cgraph/graph.c:Agstrictundirected
 */
export type GraphKind =
  | 'directed'
  | 'undirected'
  | 'strict-directed'
  | 'strict-undirected';

/**
 * Represents an Agraph_t — a graph or subgraph.
 *
 * In the C implementation Agraph_t holds n_seq/n_id (node dicts), e_seq/e_id
 * (edge dicts), g_seq/g_id (subgraph dicts), parent, root, and a shared
 * Agclos_t. Here we use native TypeScript collections in place of libcdt
 * Dict_t, and the `info` field replaces the agbindrec / GD_* mechanism (AD-1).
 *
 * Nodes are owned by the root graph. Subgraphs hold references to the same
 * Node instances (Subgraph Ownership Semantics, cgraph.md).
 *
 * @see lib/cgraph/cgraph.h:Agraph_s
 */
export class Graph {
  /** Graph name; agnameof equivalent. @see lib/cgraph/cgraph.h:agnameof */
  readonly name: string;

  /**
   * Directed/strict classification; mirrors Agdesc_t.directed and
   * Agdesc_t.strict. @see lib/cgraph/cgraph.h:Agdesc_s
   */
  readonly kind: GraphKind;

  /**
   * Node set in insertion order, keyed by name.
   * Mirrors Agraph_t.n_seq (sequence dict) merged with n_id access.
   * @see lib/cgraph/cgraph.h:Agraph_s
   */
  nodes: Map<string, Node>;

  /**
   * All edges owned by this graph (root graph only for ownership; subgraphs
   * reference a subset). Mirrors Agraph_t.e_seq.
   * @see lib/cgraph/cgraph.h:Agraph_s
   */
  edges: Edge[];

  /**
   * Named subgraphs, keyed by name. Mirrors Agraph_t.g_seq/g_id.
   * @see lib/cgraph/cgraph.h:Agraph_s
   */
  subgraphs: Map<string, Graph>;

  /**
   * String attributes (agget/agset equivalents).
   * Replaces the Agattr_t / Agsym_t machinery for simple key-value access.
   * @see lib/cgraph/cgraph.h:Agattr_s
   */
  attrs: Map<string, string>;

  /**
   * Layout-engine info; replaces GD_* macros via agbindrec (AD-1).
   * @see lib/cgraph/cgraph.h:agbindrec
   */
  info: GraphInfo;

  /**
   * Immediate parent graph. null for root graphs.
   * @see lib/cgraph/cgraph.h:Agraph_s
   */
  parent: Graph | null;

  /**
   * Root (main) graph. Self-referential for root graphs;
   * points up for subgraphs.
   * @see lib/cgraph/cgraph.h:Agraph_s
   */
  root: Graph;

  /** @see lib/cgraph/graph.c:agopen */
  constructor(name: string, kind: GraphKind) {
    this.name = name;
    this.kind = kind;
    this.nodes = new Map();
    this.edges = [];
    this.subgraphs = new Map();
    this.attrs = new Map();
    this.info = makeGraphInfo();
    this.parent = null;
    this.root = this;
  }
}
