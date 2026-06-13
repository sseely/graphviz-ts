// SPDX-License-Identifier: EPL-2.0
/**
 * Stochastic Gradient Descent (SGD) layout engine for neato.
 * Ported from lib/neatogen/sgd.c.
 *
 * @see lib/neatogen/sgd.c
 * @see lib/neatogen/sgd.h
 */

import type { Graph } from '../../model/graph.js';
import type { TermSgd } from './dijkstra.js';
import { dijkstraSgd } from './dijkstra.js';
import { rkNewState, rkSeed, rkInterval } from '../../util/mt19937.js';
import type { RkState } from '../../util/mt19937.js';

// ---------------------------------------------------------------------------
// Model constants — @see lib/neatogen/defs.h
// ---------------------------------------------------------------------------

/** Shortest-path distance model. @see lib/neatogen/defs.h */
export const MODEL_SHORTPATH = 0;
/** Circuit resistance distance model (falls back to MODEL_SHORTPATH). */
export const MODEL_CIRCUIT = 1;
/** Subset / Jaccard distance model. @see lib/neatogen/defs.h */
export const MODEL_SUBSET = 2;
/** MDS distance model (falls back to MODEL_SHORTPATH). */
export const MODEL_MDS = 3;

/** Default tolerance (Epsilon in neato). @see lib/neatogen/sgd.c */
const DFLT_TOLERANCE = 1e-4;

/** Default maximum number of SGD iterations. @see lib/neatogen/neato.h */
const MAX_ITER = 30;

// ---------------------------------------------------------------------------
// GraphSgd — CSR sparse-graph for Dijkstra
// @see lib/neatogen/sgd.h:graph_sgd
// ---------------------------------------------------------------------------

/**
 * Compressed-sparse-row adjacency structure for the SGD Dijkstra pass.
 * `pinneds[i]` is true if node i is position-fixed.
 *
 * @see lib/neatogen/sgd.h:graph_sgd
 */
export interface GraphSgd {
  n: number;
  /** CSR row pointers, length n+1. */
  sources: number[];
  /** CSR column indices. */
  targets: number[];
  weights: Float32Array;
  /** true if node is position-fixed. */
  pinneds: boolean[];
}

// ---------------------------------------------------------------------------
// extractAdjacency helpers
// ---------------------------------------------------------------------------

/**
 * Assign sequential `info.id` to all nodes and count non-self-loop edge ends.
 * @internal
 * @see lib/neatogen/sgd.c:extract_adjacency (first pass)
 */
export function assignNodeIds(g: Graph): { nNodes: number; nEdges: number } {
  let nNodes = 0;
  let nEdges = 0;
  for (const [, node] of g.nodes) {
    node.info.id = nNodes++;
    for (const e of g.edges) {
      if ((e.tail === node || e.head === node) && e.tail !== e.head) {
        nEdges++;
      }
    }
  }
  return { nNodes, nEdges };
}

/**
 * Append CSR entries for all non-self-loop edges incident on node `np`.
 * Returns the number of edges appended.
 * @internal
 */
export function fillNodeEdges(
  np: import('../../model/node.js').Node,
  g: Graph,
  graph: GraphSgd,
  edgeOffset: number,
): number {
  let nEdges = edgeOffset;
  for (const ep of g.edges) {
    if (ep.tail === np && ep.head !== np) {
      graph.targets[nEdges] = ep.head.info.id ?? 0;
      graph.weights[nEdges] = ep.info.dist ?? 1;
      nEdges++;
    } else if (ep.head === np && ep.tail !== np) {
      graph.targets[nEdges] = ep.tail.info.id ?? 0;
      graph.weights[nEdges] = ep.info.dist ?? 1;
      nEdges++;
    }
  }
  return nEdges;
}

/**
 * Populate the CSR sources/targets/weights/pinneds arrays.
 * @internal
 * @see lib/neatogen/sgd.c:extract_adjacency (second pass)
 */
export function fillCsrEdges(g: Graph, graph: GraphSgd): void {
  let nNodes = 0;
  let nEdges = 0;
  for (const [, np] of g.nodes) {
    graph.sources[nNodes] = nEdges;
    graph.pinneds[nNodes] = np.info.pinned === true;
    nEdges = fillNodeEdges(np, g, graph, nEdges);
    nNodes++;
  }
  graph.sources[nNodes] = nEdges;
}

// ---------------------------------------------------------------------------
// applySubsetWeights helpers
// ---------------------------------------------------------------------------

/**
 * Compute degree of node `j` and its intersection with neighbour-set `nI`.
 * Populates scratch array `nJ` (reset on return).
 * Returns `{ degJ, intersect }`.
 * @internal
 */
export function subsetDegreeJ(
  graph: GraphSgd,
  j: number,
  nI: Uint8Array,
  nJ: Uint8Array,
): { degJ: number; intersect: number } {
  let degJ = 0;
  let intersect = 0;
  for (let y = graph.sources[j]; y < graph.sources[j + 1]; y++) {
    const k = graph.targets[y];
    if (!nJ[k]) { nJ[k] = 1; degJ++; if (nI[k]) intersect++; }
  }
  for (let y = graph.sources[j]; y < graph.sources[j + 1]; y++) {
    nJ[graph.targets[y]] = 0;
  }
  return { degJ, intersect };
}

/**
 * Process all edges from node `i` in the subset model, updating weights.
 * @internal
 */
export function subsetNodeWeights(
  graph: GraphSgd,
  i: number,
  nI: Uint8Array,
  nJ: Uint8Array,
): void {
  let degI = 0;
  for (let x = graph.sources[i]; x < graph.sources[i + 1]; x++) {
    if (!nI[graph.targets[x]]) { nI[graph.targets[x]] = 1; degI++; }
  }
  for (let x = graph.sources[i]; x < graph.sources[i + 1]; x++) {
    const j = graph.targets[x];
    const { degJ, intersect } = subsetDegreeJ(graph, j, nI, nJ);
    graph.weights[x] = degI + degJ - 2 * intersect;
  }
  for (let x = graph.sources[i]; x < graph.sources[i + 1]; x++) {
    nI[graph.targets[x]] = 0;
  }
}

/**
 * Recompute CSR edge weights using the Jaccard (subset) model.
 * @internal
 * @see lib/neatogen/sgd.c:extract_adjacency (MODEL_SUBSET block)
 */
export function applySubsetWeights(graph: GraphSgd): void {
  const nI = new Uint8Array(graph.n);
  const nJ = new Uint8Array(graph.n);
  for (let i = 0; i < graph.n; i++) {
    subsetNodeWeights(graph, i, nI, nJ);
  }
}

/**
 * Build a GraphSgd CSR structure from the graph.
 * Self-loops are skipped. For MODEL_SUBSET, edge weights are recomputed.
 *
 * @see lib/neatogen/sgd.c:extract_adjacency
 */
export function extractAdjacency(g: Graph, model: number): GraphSgd {
  const { nNodes, nEdges } = assignNodeIds(g);
  const graph: GraphSgd = {
    n: nNodes,
    sources: new Array<number>(nNodes + 1).fill(0),
    targets: new Array<number>(nEdges).fill(0),
    weights: new Float32Array(nEdges).fill(1),
    pinneds: new Array<boolean>(nNodes).fill(false),
  };
  fillCsrEdges(g, graph);
  if (model === MODEL_SUBSET) {
    applySubsetWeights(graph);
  }
  return graph;
}

// ---------------------------------------------------------------------------
// sgdBuildTerms
// ---------------------------------------------------------------------------

/**
 * Run Dijkstra from each unfixed node and accumulate SGD terms.
 * Matches the term-building loop in sgd.c.
 *
 * @see lib/neatogen/sgd.c:sgd (term-building loop)
 */
export function sgdBuildTerms(graph: GraphSgd): TermSgd[] {
  const termBuf: TermSgd[] = [];
  for (let i = 0; i < graph.n; i++) {
    if (graph.pinneds[i]) continue;
    const chunk: TermSgd[] = [];
    const written = dijkstraSgd(graph, i, chunk);
    for (let k = 0; k < written; k++) {
      termBuf.push(chunk[k]);
    }
  }
  return termBuf;
}

// ---------------------------------------------------------------------------
// Fisher-Yates shuffle
// ---------------------------------------------------------------------------

/**
 * In-place Fisher-Yates shuffle of a TermSgd array using MT19937.
 *
 * @see lib/neatogen/sgd.c:fisheryates_shuffle
 */
export function fisheryatesShuffle(terms: TermSgd[], state: RkState): void {
  for (let i = terms.length - 1; i >= 1; i--) {
    const j = rkInterval(i, state);
    const tmp = terms[i];
    terms[i] = terms[j];
    terms[j] = tmp;
  }
}

// ---------------------------------------------------------------------------
// Initial positions
// ---------------------------------------------------------------------------

/**
 * Assign random initial positions to unpinned nodes with no position set.
 * Uses MT19937 for deterministic, seed-controlled output.
 *
 * @see lib/neatogen/stuff.c:initial_positions
 * @see lib/neatogen/stuff.c:randompos
 */
export function initialPositions(g: Graph, state: RkState): void {
  for (const [, np] of g.nodes) {
    if (np.info.pinned === true) continue;
    if (np.info.pos != null) continue;
    np.info.pos = [
      rkInterval(0xffff, state) / 0x10000,
      rkInterval(0xffff, state) / 0x10000,
    ];
  }
}

// ---------------------------------------------------------------------------
// SGD step-size schedule
// ---------------------------------------------------------------------------

/**
 * Compute the annealing schedule parameters from the term weights.
 *
 * eta_max = 1/w_min; eta_min = DFLT_TOLERANCE/w_max
 * lambda  = log(eta_max/eta_min) / (maxIter - 1)
 *
 * @see lib/neatogen/sgd.c:sgd (initialise annealing schedule)
 */
export function computeSchedule(
  terms: TermSgd[],
  maxIter: number,
): { etaMax: number; lambda: number } {
  let wMin = terms[0].w;
  let wMax = terms[0].w;
  for (let ij = 1; ij < terms.length; ij++) {
    if (terms[ij].w < wMin) wMin = terms[ij].w;
    if (terms[ij].w > wMax) wMax = terms[ij].w;
  }
  const etaMax = 1 / wMin;
  const etaMin = DFLT_TOLERANCE / wMax;
  const lambda = Math.log(etaMax / etaMin) / (maxIter - 1);
  return { etaMax, lambda };
}

// ---------------------------------------------------------------------------
// SGD inner iteration
// ---------------------------------------------------------------------------

/**
 * Apply one SGD sweep over all terms at step size `eta`.
 *
 * @see lib/neatogen/sgd.c:sgd (inner ij-loop)
 */
export function sgdIteration(
  pos: Float64Array,
  terms: TermSgd[],
  unfixed: boolean[],
  eta: number,
): void {
  for (let ij = 0; ij < terms.length; ij++) {
    const t = terms[ij];
    const mu = Math.min(eta * t.w, 1);
    const dx = pos[2 * t.i] - pos[2 * t.j];
    const dy = pos[2 * t.i + 1] - pos[2 * t.j + 1];
    const mag = Math.hypot(dx, dy);
    if (mag === 0) continue;
    const r = (mu * (mag - t.d)) / (2 * mag);
    const rx = r * dx;
    const ry = r * dy;
    if (unfixed[t.i]) { pos[2 * t.i] -= rx; pos[2 * t.i + 1] -= ry; }
    if (unfixed[t.j]) { pos[2 * t.j] += rx; pos[2 * t.j + 1] += ry; }
  }
}

// ---------------------------------------------------------------------------
// Position array helpers
// ---------------------------------------------------------------------------

/**
 * Copy node positions from graph into a flat Float64Array (x, y interleaved).
 * @internal
 * @see lib/neatogen/sgd.c:sgd (copy initial positions into pos[])
 */
export function posToArray(g: Graph, n: number): Float64Array {
  const pos = new Float64Array(2 * n);
  let i = 0;
  for (const [, node] of g.nodes) {
    const p = node.info.pos;
    pos[2 * i] = p ? p[0] : 0;
    pos[2 * i + 1] = p ? p[1] : 0;
    i++;
  }
  return pos;
}

/**
 * Write positions from flat Float64Array back into graph node info.
 * @internal
 * @see lib/neatogen/sgd.c:sgd (copy temporary positions back into graph_t)
 */
export function posFromArray(g: Graph, pos: Float64Array): void {
  let i = 0;
  for (const [, node] of g.nodes) {
    if (!node.info.pos) node.info.pos = [0, 0];
    node.info.pos[0] = pos[2 * i];
    node.info.pos[1] = pos[2 * i + 1];
    i++;
  }
}

/**
 * Build the `unfixed` boolean array (true = node may be moved).
 * @internal
 * @see lib/neatogen/sgd.c:sgd (unfixed[] array setup)
 */
export function buildUnfixed(g: Graph, n: number): boolean[] {
  const unfixed: boolean[] = new Array<boolean>(n);
  let i = 0;
  for (const [, node] of g.nodes) {
    unfixed[i++] = node.info.pinned !== true;
  }
  return unfixed;
}

// ---------------------------------------------------------------------------
// sgdLayout helpers
// ---------------------------------------------------------------------------

/**
 * Normalise the model constant, falling back unsupported models to
 * MODEL_SHORTPATH with a warning.
 *
 * @see lib/neatogen/sgd.c:sgd (model fallback block)
 */
export function resolveModel(model: number): number {
  if (model === MODEL_CIRCUIT) {
    console.warn(
      'circuit model not yet supported in Gmode=sgd, reverting to shortpath model',
    );
    return MODEL_SHORTPATH;
  }
  if (model === MODEL_MDS) {
    console.warn(
      'mds model not yet supported in Gmode=sgd, reverting to shortpath model',
    );
    return MODEL_SHORTPATH;
  }
  return model;
}

/** Optimisation loop: shuffle and step for MAX_ITER iterations. @see lib/neatogen/sgd.c:sgd */
export function runSgdLoop(
  pos: Float64Array,
  terms: TermSgd[],
  unfixed: boolean[],
  sched: { etaMax: number; lambda: number },
  state: RkState,
): void {
  for (let t = 0; t < MAX_ITER; t++) {
    fisheryatesShuffle(terms, state);
    const eta = sched.etaMax * Math.exp(-sched.lambda * t);
    sgdIteration(pos, terms, unfixed, eta);
  }
}

// ---------------------------------------------------------------------------
// sgdLayout — main entry point
// ---------------------------------------------------------------------------

/**
 * Run the SGD layout algorithm on graph `g`.
 *
 * MODEL_CIRCUIT and MODEL_MDS are not yet supported and fall back to
 * MODEL_SHORTPATH with a console.warn (matching agwarningf in C).
 *
 * Node positions are written to `node.info.pos` ([x, y]).
 * Nodes with `node.info.pinned === true` are not moved.
 * `g.info.seed` controls the MT19937 seed (default 0).
 *
 * @see lib/neatogen/sgd.c:sgd
 */
export function sgdLayout(g: Graph, model: number): void {
  const resolvedModel = resolveModel(model);
  const n = g.nodes.size;
  if (n === 0) return;

  const state = rkNewState();
  rkSeed(g.info.seed ?? 0, state);

  let idx = 0;
  for (const [, node] of g.nodes) { node.info.id = idx++; }

  initialPositions(g, state);

  const graph = extractAdjacency(g, resolvedModel);
  const terms = sgdBuildTerms(graph);
  if (terms.length === 0) return;

  const { etaMax, lambda } = computeSchedule(terms, MAX_ITER);
  const pos = posToArray(g, n);
  const unfixed = buildUnfixed(g, n);

  runSgdLoop(pos, terms, unfixed, { etaMax, lambda }, state);
  posFromArray(g, pos);
}
