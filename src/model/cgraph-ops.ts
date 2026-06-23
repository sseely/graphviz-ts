// SPDX-License-Identifier: EPL-2.0

/**
 * Faithful TypeScript port of the cgraph subgraph/node operations needed by
 * later layout passes (e.g. dot's newrank fill_ranks, which creates a
 * `_new_rank` subgraph and adds anonymous placeholder nodes).
 *
 * Nodes are owned by the root graph and keyed by name in each graph's
 * `nodes` Map; subgraph membership is presence in that subgraph's `nodes`
 * Map. A node in a subgraph is a member of every enclosing graph up to and
 * including root (Subgraph Ownership Semantics).
 *
 * @see lib/cgraph/node.c
 * @see lib/cgraph/subg.c
 */

import type { Graph } from './graph.js';
import { Graph as GraphClass } from './graph.js';
import { Node } from './node.js';

/**
 * The C anonymous-name prefix LOCALNAMEPREFIX ('%'); an object with no
 * external name has `agnameof` synthesize "%<id>".
 * @see lib/cgraph/cghdr.h:LOCALNAMEPREFIX
 * @see lib/cgraph/id.c:aginternalmapprint
 */
const LOCALNAMEPREFIX = '%';

/**
 * Allocate a fresh node id unique within `root.nodes`. Mirrors C's
 * agnextseq/agmapnametoid id reservation: at layout time the per-parse
 * NodeRegistry counter is unavailable, so derive (max existing root id) + 1.
 * @see lib/cgraph/node.c:agnextseq
 */
function freshNodeId(root: Graph): number {
  let max = -1;
  for (const n of root.nodes.values()) {
    if (n.id > max) max = n.id;
  }
  return max + 1;
}

/**
 * Create-or-get a node by name on the root graph. When `name` is null/empty,
 * mint a fresh anonymous node with a unique id and unique "%<id>" name. When
 * `create` is false and a named node is absent, returns null.
 *
 * Unlike the C agnode (which keys by id), this port keys nodes by name in
 * `Graph.nodes`; node creation always installs into the root graph.
 *
 * @see lib/cgraph/node.c:agnode
 */
export function agnode(
  g: Graph,
  name: string | null,
  create: boolean,
): Node | null {
  const root = g.root;
  if (name !== null && name !== '') {
    const existing = root.nodes.get(name);
    if (existing !== undefined) return existing;
    if (!create) return null;
    const node = new Node(freshNodeId(root), name, root);
    root.nodes.set(name, node);
    return node;
  }
  if (!create) return null;
  const id = freshNodeId(root);
  const anonName = LOCALNAMEPREFIX + String(id);
  const node = new Node(id, anonName, root);
  root.nodes.set(anonName, node);
  return node;
}

/**
 * Assign a subgraph its AGSEQ from the root-level counter, mirroring
 * `agnextseq(par, AGRAPH)` in agopen: pre-increment `clos->seq[AGRAPH]` (stored
 * on the root as `subgSeqCounter`) and record it on the subgraph. Call once,
 * only when the subgraph is first created.
 *
 * @see lib/cgraph/graph.c:agopen (AGSEQ(g) = agnextseq(par, AGRAPH))
 * @see lib/cgraph/graph.c:agnextseq
 */
export function assignSubgSeq(parent: Graph, sg: Graph): void {
  sg.seq = ++parent.root.subgSeqCounter;
}

/**
 * Create-or-get a named subgraph under `parent`. On create, sets the new
 * graph's `parent`/`root`, assigns its AGSEQ, and registers it in
 * `parent.subgraphs`. Returns null when `create` is false and the subgraph is
 * absent.
 *
 * @see lib/cgraph/subg.c:agsubg
 */
export function agsubg(
  parent: Graph,
  name: string,
  create: boolean,
): Graph | null {
  const existing = parent.subgraphs.get(name);
  if (existing !== undefined) return existing;
  if (!create) return null;
  const subg = new GraphClass(name, parent.kind);
  subg.parent = parent;
  subg.root = parent.root;
  assignSubgSeq(parent, subg);
  parent.subgraphs.set(name, subg);
  return subg;
}

/**
 * Lookup or insert node `n` in subgraph `g`, recursively installing it into
 * every enclosing graph up to and including root. Returns null if `n` does
 * not belong to `g`'s root. Mirrors the parser's enclosing-graph membership
 * loop (builder.ts processNodeStmt).
 *
 * @see lib/cgraph/node.c:agsubnode
 */
export function agsubnode(g: Graph, n: Node, create: boolean): Node | null {
  if (g.root !== n.root) return null;
  const existing = g.nodes.get(n.name);
  if (existing !== undefined) return existing;
  if (!create) return null;
  const par = g.parent;
  if (par !== null) {
    agsubnode(par, n, create);
  }
  g.nodes.set(n.name, n);
  return n;
}

/**
 * Remove node `n` from graph `g` and every enclosing graph up to and
 * including root (its member graphs). Mirrors agdelnode's image removal
 * applied across the graph and its ancestors.
 *
 * @see lib/cgraph/node.c:agdelnode
 */
export function agdelnode(g: Graph, n: Node): void {
  for (let cur: Graph | null = g; cur !== null; cur = cur.parent) {
    cur.nodes.delete(n.name);
  }
}

/**
 * Remove subgraph `sg` from `parent.subgraphs`. Mirrors agdelsubg, which
 * only deletes the entry in the parent's subgraph dict.
 *
 * @see lib/cgraph/subg.c:agdelsubg
 */
export function agdelsubg(parent: Graph, sg: Graph): void {
  parent.subgraphs.delete(sg.name);
}
