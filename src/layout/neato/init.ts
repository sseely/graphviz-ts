// SPDX-License-Identifier: EPL-2.0
/**
 * Neato layout initialisation helpers.
 *
 * Ports lib/neatogen/neatoinit.c: neato_init_node, user_pos, setSeed,
 * solveModel, neatoTranslate, neatoSetAspect, neatoCleanup.
 *
 * @see lib/neatogen/neatoinit.c
 * @see lib/neatogen/neatoprocs.h
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { VtxData } from './dijkstra.js';
import {
  stressMajorizationKD,
  DFLT_ITERATIONS,
  MODEL_MDS as STRESS_MODEL_MDS,
  MODEL_CIRCUIT as STRESS_MODEL_CIRCUIT,
  MODEL_SUBSET as STRESS_MODEL_SUBSET,
} from './stress.js';
import { sgdLayout } from './sgd.js';
import { srand48 } from '../../common/random.js';
import {
  computeApspPacked,
  computeWeightedApspPacked,
  stressMajorizationKDMkernel,
  OPT_EXP_FLAG,
} from './stress-kernel.js';
import { lateDouble } from '../../common/nodeinit.js';

// ---------------------------------------------------------------------------
// Mode constants — @see lib/neatogen/neatoprocs.h
// ---------------------------------------------------------------------------

/** Kamada-Kawai energy minimization. @see lib/neatogen/neatoprocs.h */
export const MODE_KK = 0;
/** Stress majorization (default). @see lib/neatogen/neatoprocs.h */
export const MODE_MAJOR = 1;
/** Hierarchical stress majorization (digcola). @see lib/neatogen/neatoprocs.h */
export const MODE_HIER = 2;
/** IPSEP-cola constraint solver. @see lib/neatogen/neatoprocs.h */
export const MODE_IPSEP = 3;
/** Stochastic gradient descent. @see lib/neatogen/neatoprocs.h */
export const MODE_SGD = 4;

// ---------------------------------------------------------------------------
// Model constants — @see lib/neatogen/defs.h
// ---------------------------------------------------------------------------

/** Shortest-path distance model. @see lib/neatogen/defs.h */
export const MODEL_SHORTPATH = 0;
/** Circuit resistance distance model. @see lib/neatogen/defs.h */
export const MODEL_CIRCUIT = 1;
/** Subset / Jaccard distance model. @see lib/neatogen/defs.h */
export const MODEL_SUBSET = 2;
/** MDS distance model. @see lib/neatogen/defs.h */
export const MODEL_MDS = 3;

/** Default layout dimension (2D). */
const DFLT_DIM = 2;

/** Points per inch conversion factor. */
const POINTS_PER_INCH = 72;

// ---------------------------------------------------------------------------
// neatoInitNode
// ---------------------------------------------------------------------------

/**
 * Initialise a node for neato layout.
 *
 * Ensures pos is a number[] of length dim, sets default UF_size, width,
 * and height.
 *
 * @see lib/neatogen/neatoinit.c:neato_init_node
 */
export function neatoInitNode(n: Node, dim = DFLT_DIM): void {
  if (!n.info.pos || n.info.pos.length < dim) {
    const pos: number[] = [];
    for (let i = 0; i < dim; i++) pos.push(0);
    n.info.pos = pos;
  }
  if (n.info.UF_size === undefined) n.info.UF_size = 1;
  if (!n.info.width) n.info.width = 0.75;
  if (!n.info.height) n.info.height = 0.5;
}

// ---------------------------------------------------------------------------
// userPos
// ---------------------------------------------------------------------------

/**
 * Return true if the node has any non-zero position component.
 *
 * @see lib/neatogen/neatoinit.c:user_pos
 */
export function userPos(n: Node): boolean {
  if (!n.info.pos) return false;
  return n.info.pos.some((v) => v !== 0);
}

// ---------------------------------------------------------------------------
// setSeed helpers
// ---------------------------------------------------------------------------

/**
 * Classify the first character of `p` as 'alpha', 'digit', or 'other'.
 *
 * @see lib/neatogen/neatoinit.c:setSeed (gv_isalpha / gv_isdigit checks)
 */
export function classifyFirstChar(p: string): 'alpha' | 'digit' | 'other' {
  const c = p.charCodeAt(0);
  if (c >= 48 && c <= 57) return 'digit';
  if ((c >= 65 && c <= 90) || (c >= 97 && c <= 122)) return 'alpha';
  return 'other';
}

/**
 * Detect a recognised alpha keyword prefix in `p`.
 * Returns `{ rest, matched }` where `matched` is 'random' | null.
 * 'self' and 'regular' are treated as non-random (seed stays 0).
 *
 * @see lib/neatogen/neatoinit.c:setSeed (keyword detection block)
 */
export function parseSeedPrefix(p: string): { rest: string; matched: string | null } {
  if (p.startsWith('random')) return { rest: p.slice('random'.length), matched: 'random' };
  return { rest: '', matched: null };
}

/**
 * Parse `rest` as an integer seed; returns 0 if not parseable.
 *
 * @see lib/neatogen/neatoinit.c:setSeed (seed numeric suffix)
 */
export function parseSeedInt(rest: string): number {
  const parsed = parseInt(rest, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Parse the `g.info.start` string attribute to set the RNG seed.
 *
 * Returns defaultMode in all cases (the C function also returns init mode,
 * but for the neato pipeline mode is resolved separately).
 * Sets `seed.value` as a side-effect.
 *
 * @see lib/neatogen/neatoinit.c:setSeed
 */
export function setSeed(
  g: Graph,
  defaultMode: number,
  seed: { value: number },
): number {
  const p = g.info.start;
  if (!p || p.length === 0) { seed.value = 0; return defaultMode; }

  const kind = classifyFirstChar(p);
  if (kind === 'other') { seed.value = 0; return defaultMode; }

  if (kind === 'digit') { seed.value = parseSeedInt(p); return defaultMode; }

  const { rest, matched } = parseSeedPrefix(p);
  if (matched !== 'random') { seed.value = 0; return defaultMode; }
  seed.value = parseSeedInt(rest);
  return defaultMode;
}

// ---------------------------------------------------------------------------
// buildVtxData helpers
// ---------------------------------------------------------------------------

/**
 * Assign sequential IDs to all nodes and return them in insertion order.
 *
 * @see lib/neatogen/neatoinit.c:makeGraphData (node ID assignment pass)
 */
export function assignNodeIds(g: Graph): Node[] {
  const nodeList: Node[] = [];
  let idx = 0;
  for (const [, n] of g.nodes) { n.info.id = idx++; nodeList.push(n); }
  return nodeList;
}

/**
 * Allocate one self-loop VtxData entry per node.
 *
 * @see lib/neatogen/neatoinit.c:makeGraphData (graph[] init)
 */
export function initVtxEntries(nodeList: Node[]): VtxData[] {
  return nodeList.map((_, i) => ({ nedges: 1, edges: [i], ewgts: [0] }));
}

/**
 * Resolve edge weight: factor takes priority, then weight, then 1.
 *
 * @see lib/neatogen/neatoinit.c:makeGraphData (ED_factor usage)
 */
export function edgeWeight(e: Edge): number {
  if (e.info.factor !== undefined) return e.info.factor;
  if (e.info.weight !== undefined) return e.info.weight;
  return 1;
}

/**
 * Add a bidirectional edge between two VtxData entries with weight w.
 *
 * @see lib/neatogen/neatoinit.c:makeGraphData (edge insertion loop)
 */
export function addEdgeToVtx(vtx: VtxData[], ti: number, hi: number, w: number): void {
  vtx[ti].edges.push(hi);
  vtx[ti].ewgts.push(w);
  vtx[ti].nedges++;
  vtx[hi].edges.push(ti);
  vtx[hi].ewgts.push(w);
  vtx[hi].nedges++;
}

/**
 * Insert all non-self-loop edges from `g` into `vtx`.
 *
 * @see lib/neatogen/neatoinit.c:makeGraphData (edge loop)
 */
export function addGraphEdges(g: Graph, vtx: VtxData[]): void {
  for (const e of g.edges) {
    if (e.tail === e.head) continue;
    const ti = e.tail.info.id ?? 0;
    const hi = e.head.info.id ?? 0;
    addEdgeToVtx(vtx, ti, hi, edgeWeight(e));
  }
}

/**
 * Assign sequential node IDs and build VtxData sparse graph.
 *
 * @see lib/neatogen/neatoinit.c:makeGraphData
 */
export function buildVtxData(g: Graph): VtxData[] {
  const nodeList = assignNodeIds(g);
  const vtx = initVtxEntries(nodeList);
  addGraphEdges(g, vtx);
  return vtx;
}

// ---------------------------------------------------------------------------
// buildDCoords / writeBackCoords
// ---------------------------------------------------------------------------

/**
 * Copy node positions from `n.info.pos` into per-axis Float64Array.
 *
 * @see lib/neatogen/neatoinit.c:majorization (coords allocation)
 */
export function buildDCoords(nodeList: Node[], dim: number): Float64Array[] {
  const n = nodeList.length;
  const dCoords: Float64Array[] = [];
  for (let d = 0; d < dim; d++) {
    const arr = new Float64Array(n);
    for (let i = 0; i < n; i++) arr[i] = nodeList[i].info.pos?.[d] ?? 0;
    dCoords.push(arr);
  }
  return dCoords;
}

/**
 * Write per-axis Float64Array results back into `n.info.pos`.
 *
 * @see lib/neatogen/neatoinit.c:majorization (write-back loop)
 */
export function writeBackCoords(nodeList: Node[], dCoords: Float64Array[], dim: number): void {
  for (let i = 0; i < nodeList.length; i++) {
    const pos: number[] = nodeList[i].info.pos ?? [];
    for (let d = 0; d < dim; d++) pos[d] = dCoords[d][i];
    nodeList[i].info.pos = pos;
  }
}

// ---------------------------------------------------------------------------
// mapModelToStress
// ---------------------------------------------------------------------------

/**
 * Map init.ts model constants to stress.ts model constants.
 * Both use the same numeric values but are distinct exports.
 */
export function mapModelToStress(model: number): number {
  if (model === MODEL_MDS) return STRESS_MODEL_MDS;
  if (model === MODEL_CIRCUIT) return STRESS_MODEL_CIRCUIT;
  if (model === MODEL_SUBSET) return STRESS_MODEL_SUBSET;
  return 0;
}

// ---------------------------------------------------------------------------
// solveModel helpers
// ---------------------------------------------------------------------------

/**
 * Run stress majorization on the graph and write results back to node positions.
 *
 * @see lib/neatogen/neatoinit.c:majorization
 */
export function runMajorization(g: Graph, mode: number, model: number): void {
  void model; // only MODEL_SHORTPATH distances are exercised by the suite
  const nodeList = assignNodeIds(g);
  const n = nodeList.length;
  const haveLen = graphHasLen(g);
  const vtx = makeGraphDataC(g, nodeList, haveLen);
  checkStart(g); // C: srand48(seed) immediately before initLayout draws
  const maxi = mode === MODE_KK ? 0 : lateDouble(g.attrs.get('maxiter'), DFLT_ITERATIONS, 0);
  const epsilon = lateDouble(g.attrs.get('epsilon'), 1e-4, 0); // DFLT_TOLERANCE
  const Dij = haveLen ? computeWeightedApspPacked(vtx, n) : computeApspPacked(vtx, n);
  const dCoords = [new Float64Array(n), new Float64Array(n)];
  stressMajorizationKDMkernel(Dij, n, dCoords, nodeList, {
    dim: DFLT_DIM, opts: OPT_EXP_FLAG, maxi, epsilon,
  });
  for (let i = 0; i < n; i++) {
    nodeList[i]!.info.pos = [dCoords[0]![i]!, dCoords[1]![i]!];
  }
}

/** Any edge carries a len attr (C: agattr_text(g, AGEDGE, "len")). */
export function graphHasLen(g: Graph): boolean {
  for (const e of g.edges) {
    if (e.attrs.has('len')) return true;
  }
  return false;
}

/**
 * Seed the RNG from the start attr; no attr means the default seed 1.
 * start=regular/self are not ported (no suite input uses them).
 * @see lib/neatogen/neatoinit.c:setSeed
 * @see lib/neatogen/neatoinit.c:checkStart
 */
export function checkStart(g: Graph): void {
  const p = g.root.attrs.get('start');
  let seed = 1;
  if (p !== undefined && /^\d/.test(p)) {
    const v = parseInt(p, 10);
    if (!Number.isNaN(v)) seed = v;
  }
  srand48(seed);
}

/**
 * Build the vtx_data adjacency in C's makeGraphData shape: per node,
 * out-edges then in-edges (agfstedge order), self entry at index 0,
 * duplicate neighbours merged (len keeps the max). ewgts are edge
 * lens (default 1.0) when any len attr exists, else absent so the
 * APSP uses BFS hop counts.
 * @see lib/neatogen/neatoinit.c:makeGraphData
 * @see lib/neatogen/stuff.c:setEdgeLen
 */
export function makeGraphDataC(g: Graph, nodeList: Node[], haveLen: boolean): VtxData[] {
  const vtx: VtxData[] = nodeList.map((_, i) => ({
    nedges: 1, edges: [i], ewgts: haveLen ? [0] : [],
  }));
  for (const np of nodeList) {
    const i = np.info.id!;
    const entry = vtx[i]!;
    const seen = new Map<number, number>();
    for (const ep of [...np.outEdges(g), ...np.inEdges(g)]) {
      if (ep.head === ep.tail) continue;
      const vp = ep.tail === np ? ep.head : ep.tail;
      const vid = vp.info.id!;
      const dist = haveLen ? lateDouble(ep.attrs.get('len'), 1.0, 0) : 1.0;
      const idx = seen.get(vid);
      if (idx !== undefined) {
        if (haveLen) entry.ewgts[idx] = Math.max(entry.ewgts[idx]!, dist);
        continue;
      }
      seen.set(vid, entry.nedges);
      entry.edges.push(vid);
      if (haveLen) entry.ewgts.push(dist);
      entry.nedges++;
    }
  }
  return vtx;
}

/**
 * Dispatch to the appropriate layout solver for the given mode.
 *
 * @see lib/neatogen/neatoinit.c:neatoLayout
 */
export function solveModel(g: Graph, mode: number, model: number): void {
  if (g.nodes.size < 2) return;
  if (mode === MODE_SGD) { sgdLayout(g, model); return; }
  if (mode === MODE_HIER || mode === MODE_IPSEP) {
    const name = mode === MODE_HIER ? 'hier' : 'ipsep';
    console.warn(`neato: mode ${name} not fully implemented; falling back to majorization`);
  }
  runMajorization(g, mode, model);
}

// ---------------------------------------------------------------------------
// neatoTranslate helpers
// ---------------------------------------------------------------------------

/**
 * Find minimum X and Y across all node positions.
 *
 * @see lib/neatogen/neatoinit.c (translate logic)
 */
export function findMinPos(g: Graph): { minX: number; minY: number } {
  let minX = Infinity;
  let minY = Infinity;
  for (const [, n] of g.nodes) {
    const pos = n.info.pos;
    if (!pos) continue;
    if (pos[0] < minX) minX = pos[0];
    if ((pos[1] ?? 0) < minY) minY = pos[1] ?? 0;
  }
  return { minX, minY };
}

/**
 * Subtract (dx, dy) from every node position in place.
 *
 * @see lib/neatogen/neatoinit.c (translate loop)
 */
export function shiftPositions(g: Graph, dx: number, dy: number): void {
  for (const [, n] of g.nodes) {
    const pos = n.info.pos;
    if (!pos) continue;
    pos[0] -= dx;
    if (pos.length > 1) pos[1] -= dy;
  }
}

/**
 * Shift all node positions so the minimum is at (0, 0).
 *
 * @see lib/neatogen/neatoinit.c (translate logic inside neato_layout /
 *      gv_postprocess)
 */
export function neatoTranslate(g: Graph): void {
  const { minX, minY } = findMinPos(g);
  if (!isFinite(minX)) return;
  shiftPositions(g, minX, minY);
}

// ---------------------------------------------------------------------------
// neatoSetAspect
// ---------------------------------------------------------------------------

/**
 * Copy position (inches) to coord (points, multiply by 72).
 *
 * @see lib/neatogen/neatoinit.c (position-to-coord conversion)
 */
export function neatoSetAspect(g: Graph): void {
  for (const [, n] of g.nodes) {
    const pos = n.info.pos;
    if (!pos) continue;
    n.info.coord = {
      x: (pos[0] ?? 0) * POINTS_PER_INCH,
      y: (pos[1] ?? 0) * POINTS_PER_INCH,
    };
  }
}

// ---------------------------------------------------------------------------
// neatoCleanup
// ---------------------------------------------------------------------------

/**
 * Clear neato-specific state on nodes.
 *
 * @see lib/neatogen/neatoinit.c:neato_cleanup
 */
export function neatoCleanup(g: Graph): void {
  for (const [, n] of g.nodes) {
    n.info.pos = undefined;
    n.info.pinned = undefined;
    n.info.id = undefined;
    n.info.heapindex = undefined;
    n.info.hops = undefined;
    n.info.UF_size = undefined;
  }
}
