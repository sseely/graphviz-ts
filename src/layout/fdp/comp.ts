// SPDX-License-Identifier: EPL-2.0

/**
 * Generalized connected components of a derived graph: all port nodes
 * and pinned nodes are merged into the first component.
 *
 * Components are Graph instances parented to the derived graph (so
 * attribute lookups fall through, as C subgraphs resolve to the dg
 * root). Their node maps are populated in ascending derived-node id —
 * cgraph subgraph iteration is id-ordered, not DFS-ordered (mission 5
 * finding) — and edges are node-induced in dg edge order.
 *
 * Spec read at the 15.0.0 tag.
 *
 * @see lib/fdpgen/comp.c (15.0.0)
 */

import { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import { dndata, gdata, P_PIN } from './fdp-model.js';

/** All edges of n in g: out-edges then in-edges (agfstedge order). */
function allEdges(g: Graph, n: Node): Edge[] {
  return [...n.outEdges(g), ...n.inEdges(g)];
}

/**
 * Depth-first traversal collecting reachable nodes into `out`.
 * @see lib/fdpgen/comp.c:dfs
 */
function dfs(g: Graph, n: Node, out: Node[], marks: boolean[]): void {
  marks[n.id] = true;
  out.push(n);
  for (const e of allEdges(g, n)) {
    const other = e.tail === n ? e.head : e.tail;
    if (!marks[other.id]) dfs(g, other, out, marks);
  }
}

/** Build one component subgraph from its node list. */
function buildComponent(dg: Graph, name: string, nodes: Node[]): Graph {
  const subg = new Graph(name, dg.kind);
  subg.parent = dg;
  gdata(subg);
  // cgraph subgraph node dicts iterate in id (seq) order
  const sorted = [...nodes].sort((a, b) => a.id - b.id);
  for (const n of sorted) subg.nodes.set(n.name, n);
  // node-induced edges, in dg edge order
  // @see lib/cgraph/node.c:graphviz_node_induce
  for (const e of dg.edges) {
    if (subg.nodes.has(e.tail.name) && subg.nodes.has(e.head.name)) {
      subg.edges.push(e);
    }
  }
  return subg;
}

/**
 * Find the generalized connected components of derived graph dg.
 * Ports and pinned nodes all land in the first component.
 *
 * @returns components plus whether pinned nodes exist
 * @see lib/fdpgen/comp.c:findCComp
 */
export function findCComp(
  dg: Graph,
  counter: { value: number },
): { comps: Graph[]; pinned: boolean } {
  const st: CompState = {
    dg,
    marks: new Array<boolean>(dg.nodes.size).fill(false),
    comps: [],
    cCnt: 0,
    counter,
  };

  const pinned = collectPortPinnedComponent(st);
  collectRemainingComponents(st);
  counter.value += st.cCnt;

  return { comps: st.comps, pinned };
}

/** Shared traversal state for one findCComp run. */
interface CompState {
  dg: Graph;
  marks: boolean[];
  comps: Graph[];
  cCnt: number;
  counter: { value: number };
}

/**
 * Build the merged port/pinned first component, if any.
 * @see lib/fdpgen/comp.c:findCComp (port and pinned blocks)
 */
function collectPortPinnedComponent(st: CompState): boolean {
  const { dg, marks } = st;

  /* Component based on port nodes */
  let first: { name: string; nodes: Node[] } | null = null;
  const ports = gdata(dg).ports;
  if (ports !== null) {
    first = newFirst(st);
    for (const pp of ports) {
      if (marks[pp.n.id]) continue;
      dfs(dg, pp.n, first.nodes, marks);
    }
  }

  /* Extend component based on pinned nodes (ports cannot be pinned) */
  let pinflag = false;
  for (const n of dg.nodes.values()) {
    if (marks[n.id]) continue;
    if (dndata(n).pinned !== P_PIN) continue;
    if (first === null) first = newFirst(st);
    pinflag = true;
    dfs(dg, n, first.nodes, marks);
  }
  if (first !== null) installFirst(st, first, ports);
  return pinflag;
}

/** Name and start the merged first component. */
function newFirst(st: CompState): { name: string; nodes: Node[] } {
  return {
    name: `cc${st.dg.name}_${st.cCnt++ + st.counter.value}`,
    nodes: [],
  };
}

/** Materialize the first component, attaching the dg ports. */
function installFirst(
  st: CompState,
  first: { name: string; nodes: Node[] },
  ports: ReturnType<typeof gdata>['ports'],
): void {
  const subg = buildComponent(st.dg, first.name, first.nodes);
  if (ports !== null) {
    gdata(subg).ports = ports;
    gdata(subg).nports = gdata(st.dg).nports;
  }
  st.comps.push(subg);
}

/**
 * Pick up the ordinary connected components.
 * @see lib/fdpgen/comp.c:findCComp (remaining-components loop)
 */
function collectRemainingComponents(st: CompState): void {
  const { dg, marks } = st;
  for (const n of dg.nodes.values()) {
    if (marks[n.id]) continue;
    const nodes: Node[] = [];
    dfs(dg, n, nodes, marks);
    st.comps.push(
      buildComponent(dg, `cc${dg.name}+${st.cCnt++ + st.counter.value}`, nodes));
  }
}
