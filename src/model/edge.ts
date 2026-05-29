// SPDX-License-Identifier: EPL-2.0

/**
 * TypeScript port of Agedge_t / Agedgepair_t from lib/cgraph/cgraph.h.
 *
 * @see lib/cgraph/cgraph.h:Agedge_s
 * @see lib/cgraph/cgraph.h:Agedgepair_s
 */

import type { Node } from './node.js';
import { type EdgeInfo, makeEdgeInfo, makePort } from './edgeInfo.js';

/**
 * Represents an abstract edge in the graph, corresponding to Agedgepair_t.
 *
 * IMPORTANT: In Agedgepair_t, the "out" half stores the HEAD node and the
 * "in" half stores the TAIL node. This is counterintuitive but matches C:
 *   out.node == head,  in.node == tail
 * See lib/cgraph/cgraph.h Agedgepair_t and the AGTAIL/AGHEAD macro definitions.
 *
 * From cgraph.md "Edge Direction Semantics":
 *   - tail: source node (arrow comes FROM); AGTAIL(e) = AGMKIN(e)->node = in.node
 *   - head: destination node (arrow goes TO); AGHEAD(e) = AGMKOUT(e)->node = out.node
 *   - out-edge: stored in tail node's out-edge set; out.node == head
 *   - in-edge: stored in head node's in-edge set; in.node == tail
 *
 * The `info` field replaces the agbindrec / ED_* mechanism (AD-1).
 *
 * @see lib/cgraph/cgraph.h:Agedgepair_s
 * @see lib/cgraph/cgraph.h:AGTAIL
 * @see lib/cgraph/cgraph.h:AGHEAD
 * @see lib/cgraph/cgraph.h:AGMKIN
 * @see lib/cgraph/cgraph.h:AGMKOUT
 */
export class Edge {
  /** @see lib/cgraph/cgraph.h:AGSEQ */
  private static _nextSeq = 0;

  /**
   * Monotone sequence number — equivalent to AGSEQ(e) in C.
   * Used by edgeidcmpf for stable sort ordering.
   * @see lib/cgraph/cgraph.h:AGSEQ
   */
  readonly seq: number;

  /**
   * Source node (arrow origin).
   * C: AGTAIL(e) = AGMKIN(e)->node = in.node
   * @see lib/cgraph/cgraph.h:AGTAIL
   */
  readonly tail: Node;

  /**
   * Destination node (arrow target).
   * C: AGHEAD(e) = AGMKOUT(e)->node = out.node
   * @see lib/cgraph/cgraph.h:AGHEAD
   */
  readonly head: Node;

  /**
   * Edge key; empty string for anonymous edges.
   * Corresponds to the `name` argument of agedge().
   * @see lib/cgraph/cgraph.h:agedge
   */
  readonly name: string;

  /**
   * String attributes (agget/agset equivalents).
   * @see lib/cgraph/cgraph.h:Agattr_s
   */
  attrs: Map<string, string>;

  /**
   * Layout-engine info; replaces ED_* macros via agbindrec (AD-1).
   * @see lib/cgraph/cgraph.h:agbindrec
   */
  info: EdgeInfo;

  /** @see lib/cgraph/edge.c:agedge */
  constructor(tail: Node, head: Node, name: string) {
    this.seq = Edge._nextSeq++;
    this.tail = tail;
    this.head = head;
    this.name = name;
    this.attrs = new Map();
    this.info = makeEdgeInfo(makePort(), makePort());
  }
}
