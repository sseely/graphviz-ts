// SPDX-License-Identifier: EPL-2.0

/**
 * Per-connected-component circular layout orchestration.
 *
 * Ports lib/circogen/circular.c (circularLayout) and the derived-graph
 * construction from lib/circogen/circularinit.c (circomps, circoLayout).
 *
 * All functions are exported so lizard counts each one independently.
 *
 * @see lib/circogen/circular.c
 * @see lib/circogen/circularinit.c
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { CircoNData } from './init.js';
import {
  type Block, type SubGraph, type DerivedGraph, type DerivedNode, type DerivedEdge,
  makeCircState, makeCData,
} from './blocks.js';
import { createBlocktree, createOneBlock, freeBlocktree } from './blocktree.js';
import { circPos } from './position.js';
import { ccomps, getPackInfo, packSubgraphs } from '../pack/index.js';
import { PackMode } from '../pack/types.js';

// ---------------------------------------------------------------------------
// Derived-graph construction
// @see lib/circogen/circularinit.c:circomps
// ---------------------------------------------------------------------------

/** Create a DerivedNode from an original graph node. */
export function makeDerivedNode(orig: Node): DerivedNode {
  // Placeholder — cdata.derivedNode set after object construction.
  const dn: DerivedNode = {
    name: orig.name, orig,
    pos: [0, 0],
    cdata: null as unknown as DerivedNode['cdata'],
    lw: orig.info.lw, rw: orig.info.rw, ht: orig.info.ht,
  };
  dn.cdata = makeCData(dn);
  return dn;
}

/** Build strict undirected derived graph from g (drop self-loops). */
export function buildDerivedGraph(g: Graph): DerivedGraph {
  const dg: DerivedGraph = { nodes: new Map(), subgraphs: [], components: [] };
  for (const n of g.nodes.values()) {
    const dn = makeDerivedNode(n);
    dg.nodes.set(n.name, dn);
    n.info.alg = dn.cdata; // link for derivedOf()
  }
  return dg;
}

/** Build derived edges (strict: no self-loops, no duplicates). */
export function buildDerivedEdges(g: Graph, dg: DerivedGraph): DerivedEdge[] {
  const edges: DerivedEdge[] = [];
  const seen = new Set<string>();
  for (const e of g.edges) {
    if (e.tail === e.head) continue; // drop self-loops
    const tail = dg.nodes.get(e.tail.name);
    const head = dg.nodes.get(e.head.name);
    if (!tail || !head) continue;
    const key = [tail.name, head.name].sort().join('\0');
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ tail, head, order: 0, origEdge: e });
  }
  return edges;
}

/** Decompose derived graph into connected components with their edges. */
export function derivedComponents(g: Graph, dg: DerivedGraph, allEdges: DerivedEdge[]): SubGraph[] {
  const comps = ccomps(g, '_cc');
  return comps.map((sg, i) => {
    const nodes: DerivedNode[] = [];
    for (const n of sg.nodes.values()) {
      const dn = dg.nodes.get(n.name);
      if (dn) nodes.push(dn);
    }
    // cgraph subgraph iteration is ID-ordered (root creation order).
    nodes.sort((a, b) => a.orig.id - b.orig.id);
    const ns = new Set(nodes);
    const edges = allEdges.filter((e) => ns.has(e.tail) && ns.has(e.head));
    return { name: `_cc_${i}`, nodes, edges, parent: dg };
  });
}

// ---------------------------------------------------------------------------
// Single-component circular layout
// @see lib/circogen/circular.c:circularLayout
// ---------------------------------------------------------------------------

/** Position a single-node component at origin. */
export function layoutSingleNode(sg: SubGraph): void {
  const dn = sg.nodes[0];
  if (dn) { dn.orig.info.pos = [0, 0]; }
}

/** Read oneblock attribute from the original graph. */
export function isOneblock(realg: Graph): boolean {
  return realg.attrs.get('oneblock') === 'true';
}

/** Read mindist attribute from the original graph (default 1.0). */
export function readMinDist(realg: Graph): number {
  const v = parseFloat(realg.attrs.get('mindist') ?? '');
  return isNaN(v) || v < 0 ? 1.0 : v;
}

/**
 * Lay out one connected component of the derived graph.
 * @see lib/circogen/circular.c:circularLayout
 */
export function circularLayout(sg: SubGraph, realg: Graph, blockCount: number, allEdges: DerivedEdge[]): number {
  if (sg.nodes.length === 1) { layoutSingleNode(sg); return blockCount; }
  const state = makeCircState(blockCount);
  state.minDist = readMinDist(realg);
  state.rootname = realg.attrs.get('root') ?? '';
  let root: Block;
  if (isOneblock(realg)) root = createOneBlock(sg, state);
  else root = createBlocktree(sg, state, allEdges);
  circPos(sg, root, state);
  freeBlocktree(root);
  return state.blockCount;
}

// ---------------------------------------------------------------------------
// Copy positions back to original graph
// @see lib/circogen/circularinit.c:copyPosns
// ---------------------------------------------------------------------------

export function copyPositions(_sg: SubGraph): void {
  // assignPositions writes straight to dn.orig.info.pos (inches), so
  // the C derived->orig copy is already done. coord is synced from pos
  // (x72) later by splineEdgesShifted, exactly like C spline_edges.
}

// ---------------------------------------------------------------------------
// Adjust nodes to remove overlap (stub — neato adjustNodes equivalent)
// @see lib/neatogen/adjust.c:adjustNodes
// ---------------------------------------------------------------------------

/** Minimal overlap adjustment: no-op stub matching adjustNodes signature. */
export function adjustNodes(_sg: SubGraph): void {
  // Full VPSC overlap removal is in the neato module. Circo uses a simpler
  // strategy: the radius formula already spaces nodes by minDist, so no
  // post-layout adjustment is applied here.
}

// ---------------------------------------------------------------------------
// circoLayout — top-level multi-component entry point
// @see lib/circogen/circularinit.c:circoLayout
// ---------------------------------------------------------------------------

export function circoLayout(g: Graph): void {
  if (g.nodes.size === 0) return;
  const dg = buildDerivedGraph(g);
  const allEdges = buildDerivedEdges(g, dg);
  const comps = derivedComponents(g, dg, allEdges);
  dg.components = comps;
  let blockCount = 0;
  if (comps.length === 1) {
    blockCount = circularLayout(comps[0]!, g, blockCount, allEdges);
    copyPositions(comps[0]!);
    adjustNodes(comps[0]!);
  } else {
    layoutMultiComponent(g, dg, comps, allEdges, blockCount);
  }
}

/** Pack and copy positions for multi-component graphs. */
export function layoutMultiComponent(
  g: Graph, _dg: DerivedGraph, comps: SubGraph[], allEdges: DerivedEdge[], blockCount: number,
): void {
  let bc = blockCount;
  for (const sg of comps) { bc = circularLayout(sg, g, bc, allEdges); adjustNodes(sg); }
  // C: getPackInfo(g, l_node, CL_OFFSET) — polyomino node-mode packing.
  const pinfo = { aspect: 1, sz: 0, margin: 8, doSplines: false, mode: PackMode.Node, fixed: null, vals: null, flags: 0 };
  getPackInfo(g, PackMode.Node, 8, pinfo);
  // Build proxy Graph objects for packSubgraphs
  const proxyGraphs = comps.map((sg) => buildProxyGraph(sg, g));
  packSubgraphs(comps.length, proxyGraphs, g, pinfo);
  // Copy packed coords back
  for (let i = 0; i < comps.length; i++) copyPositions(comps[i]!);
}

/** Build a minimal Graph proxy so packSubgraphs can read node coords. */
export function buildProxyGraph(sg: SubGraph, root: Graph): Graph {
  const proxy = new (root.constructor as new (n: string, k: string) => Graph)('_proxy', 'undirected');
  proxy.info.dotroot = root;
  for (const dn of sg.nodes) {
    // Packing reads coord in POINTS; layout pos is in inches.
    const p = dn.orig.info.pos ?? [0, 0];
    dn.orig.info.coord = { x: (p[0] ?? 0) * 72, y: (p[1] ?? 0) * 72 };
    proxy.nodes.set(dn.name, dn.orig);
  }
  return proxy;
}

// ---------------------------------------------------------------------------
// Edge type needed by the model but not part of circogen per se
// ---------------------------------------------------------------------------
void (0 as unknown as Edge); // keep import live for type checking
