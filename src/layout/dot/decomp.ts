// SPDX-License-Identifier: EPL-2.0
/** @see lib/dotgen/decomp.c  @see lib/common/utils.c (UF_*) */
import type { Node } from '../../model/node.js';
import type { Graph } from '../../model/graph.js';
import type { EdgeList } from '../../model/nodeInfo.js';

// ---------------------------------------------------------------------------
// AGSEQ-order node iteration (agfstnode/agnxtnode mirror)
// ---------------------------------------------------------------------------

/**
 * Return `g`'s member nodes in AGSEQ order (global, root-graph-wide creation
 * order), mirroring `agfstnode(g)`/`agnxtnode(g,n)` — NOT the subgraph-local
 * first-insertion order that `g.nodes` (a `Map`) iterates by default.
 *
 * C's `agfstnode` walks a dict ordered by `agsubnodeseqcmpf`
 * (`AGSEQ(node)`, assigned once at node creation and never touched by later
 * `agsubnode` membership calls), independent of which subgraph a node was
 * textually declared in. `Node.id` mirrors AGSEQ (assigned once at first
 * global creation by `NodeRegistry.ensure`/`agnode`'s `freshNodeId`), so a
 * `.id`-ascending sort reproduces C's order for any (sub)graph.
 *
 * Every C function that iterates a subgraph via `agfstnode`/`agnxtnode` must
 * use this helper instead of `g.nodes.values()` directly — see F7's audit
 * table in `.agent-notes/path-structure-xns-residuals.md` for the site list.
 *
 * @see lib/cgraph/node.c:43 (agfstnode), :50 (agnxtnode)
 * @see lib/cgraph/node.c:283-290 (agsubnodeseqcmpf, AGSEQ comparator)
 * @see lib/cgraph/node.c:162 (agnextseq(g,AGNODE), AGSEQ assignment at creation)
 */
export function nodesInSeq(g: Graph): Node[] {
  return [...g.nodes.values()].sort((a, b) => a.id - b.id);
}

// ---------------------------------------------------------------------------
// Union-Find exports
// ---------------------------------------------------------------------------

/** @see lib/common/utils.c:UF_find */
export function ufFind(n: Node): Node {
  while (n.info.UF_parent !== undefined && n.info.UF_parent !== n) {
    const gp = n.info.UF_parent.info.UF_parent;
    if (gp !== undefined) n.info.UF_parent = gp;
    n = n.info.UF_parent;
  }
  return n;
}

/**
 * Union two UF sets. Inlines ufRoot (init + find).
 *
 * C's tie-break reads `ND_id(u) > ND_id(v)` — but `ND_id` is a distinct,
 * dotgen-only `Agnodeinfo_t.id` field (lib/common/types.h:432, guarded by
 * `#ifndef DOT_ONLY`) that is NEVER assigned anywhere in the `dot` layout
 * engine's source (only neatogen/fdpgen/sfdpgen/sparse — unrelated engines —
 * write it). It is therefore always 0 for both real and virtual nodes under
 * `dot`, so `ND_id(u) > ND_id(v)` is always false and C always takes the
 * `else` branch: the first argument's resolved root unconditionally wins.
 * This is NOT the same field as AGID (cgraph's unique per-node id, exposed
 * here as `Node.id`) — using `.id` for this comparison would introduce
 * spurious branching C never performs, since AGID differs between every
 * pair of real nodes.
 * @see lib/common/utils.c:UF_union
 */
export function ufUnion(u: Node, v: Node): Node {
  if (u === v) return u;
  if (u.info.UF_parent === undefined) { u.info.UF_parent = u; u.info.UF_size = 1; }
  else u = ufFind(u);
  if (v.info.UF_parent === undefined) { v.info.UF_parent = v; v.info.UF_size = 1; }
  else v = ufFind(v);
  if (u === v) return u;
  const us = u.info.UF_size ?? 0;
  const vs = v.info.UF_size ?? 0;
  v.info.UF_parent = u; u.info.UF_size = us + vs; return u;
}

/** @see lib/common/utils.c:UF_singleton */
export function ufSingleton(u: Node): void {
  u.info.UF_size = 1; u.info.UF_parent = undefined; u.info.ranktype = 0;
}

/** @see lib/common/utils.c:UF_setname */
export function ufSetname(u: Node, v: Node): void {
  u.info.UF_parent = v;
  v.info.UF_size = (v.info.UF_size ?? 0) + (u.info.UF_size ?? 0);
}

// ---------------------------------------------------------------------------
// Component building — helpers exported to keep each function standalone
// (Lizard absorbs consecutive private functions; exports break the chain)
// ---------------------------------------------------------------------------

/**
 * Push unvisited UF-root neighbors onto the BFS stack.
 * @see lib/dotgen/decomp.c (inlined in searchComponent)
 */
export function decompPushNeighbors(
  stk: Node[], el: EdgeList | undefined, n: Node, cmark: number
): void {
  if (!el || el.size === 0) return;
  for (let i = el.size - 1; i >= 0; i--) {
    const e = el.list[i];
    const other = e.head === n ? e.tail : e.head;
    if (other.info.mark !== cmark && other === ufFind(other)) {
      other.info.mark = cmark + 1; stk.push(other);
    }
  }
}

/**
 * BFS over one component; builds g.info.nlist linked list (prev/next).
 * Clears g.info.nlist before traversal.
 * @see lib/dotgen/decomp.c:beginComponent  @see lib/dotgen/decomp.c:searchComponent
 */
export function decompSearch(g: Graph, start: Node, cmark: number): void {
  const stk: Node[] = [];
  let lastNode: Node | undefined;
  start.info.mark = cmark + 1; stk.push(start);
  g.info.nlist = undefined;
  let top: Node | undefined;
  while ((top = stk.pop()) !== undefined) {
    if (top.info.mark === cmark) continue;
    top.info.mark = cmark;
    if (lastNode !== undefined) {
      top.info.prev = lastNode; lastNode.info.next = top;
    } else {
      top.info.prev = undefined; g.info.nlist = top;
    }
    lastNode = top; top.info.next = undefined;
    decompPushNeighbors(stk, top.info.flat_in, top, cmark);
    decompPushNeighbors(stk, top.info.flat_out, top, cmark);
    decompPushNeighbors(stk, top.info.in, top, cmark);
    decompPushNeighbors(stk, top.info.out, top, cmark);
  }
}

// Cmark as const-object property avoids module-level let that confuses Lizard.
const _dc = { cmark: 0 };

// ONE private function immediately before decompose — the acyclic.ts pattern.
function resolveNode(n: Node, pass: 0 | 1): Node | undefined {
  if (pass > 0) {
    const subg = n.info.clust;
    if (subg) return subg.info.rankleader?.[n.info.rank ?? 0];
  }
  return n === ufFind(n) ? n : undefined;
}

/**
 * Find connected components and store in `g.info.comp`.
 * pass=0: real nodes. pass=1: cluster skeleton leaders.
 * @see lib/dotgen/decomp.c:decompose
 */
export function decompose(g: Graph, pass: 0 | 1): void {
  if (++_dc.cmark === 0) _dc.cmark = 1;
  const cmark = _dc.cmark;
  g.info.comp = [];
  for (const n of nodesInSeq(g)) {
    const v = resolveNode(n, pass);
    if (v !== undefined && v.info.mark !== cmark) {
      decompSearch(g, v, cmark);
      g.info.comp.push(g.info.nlist!);
    }
  }
}
