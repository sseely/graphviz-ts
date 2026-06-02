// SPDX-License-Identifier: EPL-2.0

/**
 * Initialization and cleanup for the fdp layout engine.
 *
 * Ports fdp_init_node_edge (fdpinit.c), fdp_initParams (tlayout.c),
 * and fdp_cleanup (fdpinit.c).
 *
 * @see lib/fdpgen/fdpinit.c
 * @see lib/fdpgen/tlayout.c:fdp_initParams
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';

// ---------------------------------------------------------------------------
// FdpParams — runtime parameter bundle
// ---------------------------------------------------------------------------

/**
 * Runtime parameters for the fdp force-directed layout algorithm.
 *
 * Equivalent to the parms_t struct in lib/fdpgen/tlayout.c.
 *
 * @see lib/fdpgen/tlayout.c:parms_t
 */
export interface FdpParams {
  /** Ideal spring constant / ideal node separation distance. */
  K: number;
  /**
   * Initial temperature. -1 means "compute automatically from graph size".
   * @see lib/fdpgen/tlayout.c:init_params (T_T0 == -1.0 branch)
   */
  T0: number;
  /** Total number of layout iterations. */
  maxIter: number;
  /**
   * Use Hooke spring model for attractive forces (true) or simpler
   * proportional model (false).
   * @see lib/fdpgen/tlayout.c:T_useNew
   */
  useNew: boolean;
  /** Temperature scale factor applied when T0 is auto-computed. */
  Tfact: number;
  /** Percentage of iterations used in unscaled pass 1. */
  unscaled: number;
  /** Use grid acceleration for repulsion (true = faster for large graphs). */
  useGrid: boolean;
}

// ---------------------------------------------------------------------------
// Defaults — from tlayout.c #define constants
// ---------------------------------------------------------------------------

const DFLT_K = 0.3;
const DFLT_MAX_ITER = 600;
const DFLT_TFACT = 1.0;
const DFLT_UNSCALED = 0;

// ---------------------------------------------------------------------------
// Attribute parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parses a positive-finite double from a graph attribute string.
 * Returns fallback when the attribute is absent or unparseable.
 *
 * @see lib/fdpgen/tlayout.c:fdp_initParams (K and T0 parsing)
 */
export function parsePositiveAttr(
  g: Graph,
  name: string,
  fallback: number,
): number {
  const raw = g.attrs.get(name);
  if (raw === undefined) return fallback;
  const v = parseFloat(raw);
  return isFinite(v) && v > 0 ? v : fallback;
}

/**
 * Parses the T0 attribute which may be -1 (auto-compute sentinel).
 * Returns -1.0 when absent or non-finite.
 *
 * @see lib/fdpgen/tlayout.c:fdp_initParams (T0 branch)
 */
export function parseT0Attr(g: Graph): number {
  const raw = g.attrs.get('T0');
  if (raw === undefined) return -1.0;
  const v = parseFloat(raw);
  return isFinite(v) ? v : -1.0;
}

/**
 * Parses a positive integer from a graph attribute string.
 * Returns fallback when the attribute is absent or unparseable.
 *
 * @see lib/fdpgen/tlayout.c:fdp_initParams (maxiter parsing)
 */
export function parseIntAttr(
  g: Graph,
  name: string,
  fallback: number,
): number {
  const raw = g.attrs.get(name);
  if (raw === undefined) return fallback;
  const v = parseInt(raw, 10);
  return isFinite(v) && v > 0 ? v : fallback;
}

// ---------------------------------------------------------------------------
// fdpInitParams
// ---------------------------------------------------------------------------

/**
 * Reads graph attributes and constructs an FdpParams bundle for layout.
 *
 * Attribute parsing mirrors fdp_initParams in lib/fdpgen/tlayout.c:
 * - "K"       → spring constant (default 0.3)
 * - "maxiter" → iteration limit (default 600)
 * - "T0"      → initial temperature (-1 = auto)
 *
 * @see lib/fdpgen/tlayout.c:fdp_initParams
 */
export function fdpInitParams(g: Graph): FdpParams {
  return {
    K: parsePositiveAttr(g, 'K', DFLT_K),
    T0: parseT0Attr(g),
    maxIter: parseIntAttr(g, 'maxiter', DFLT_MAX_ITER),
    useNew: false,
    Tfact: DFLT_TFACT,
    unscaled: DFLT_UNSCALED,
    useGrid: true,
  };
}

// ---------------------------------------------------------------------------
// Node and edge initialization helpers
// ---------------------------------------------------------------------------

/**
 * Parses "x,y" or "x,y!" from a pos attribute string.
 * Returns null when the string is absent or unparseable.
 *
 * @see lib/fdpgen/fdpinit.c:initialPositions (sscanf branch)
 */
export function parsePosAttr(
  raw: string,
): { x: number; y: number; pinned: boolean } | null {
  const pinned = raw.endsWith('!');
  const cleaned = pinned ? raw.slice(0, -1) : raw;
  const parts = cleaned.split(',');
  const x = parseFloat(parts[0] ?? '');
  const y = parseFloat(parts[1] ?? '');
  if (!isFinite(x) || !isFinite(y)) return null;
  return { x, y, pinned };
}

/**
 * Initialises a single node for fdp layout.
 *
 * Ensures info.pos is allocated as a 2-element array. If the node already
 * has a pos attribute set, parses it; otherwise leaves pos at [0,0] so that
 * the caller (fdpTLayout initPositions) can randomise it.
 *
 * @see lib/fdpgen/fdpinit.c:init_node
 * @see lib/fdpgen/fdpinit.c:initialPositions
 */
export function initNode(n: Node): void {
  if (!n.info.pos) n.info.pos = [0, 0];
  const raw = n.attrs.get('pos');
  if (!raw) return;
  const parsed = parsePosAttr(raw);
  if (!parsed) return;
  n.info.pos[0] = parsed.x;
  n.info.pos[1] = parsed.y;
  n.info.pinned = parsed.pinned;
}

/**
 * Initialises a single edge for fdp layout.
 *
 * Reads the optional "weight" attribute (ED_factor) and "len" attribute
 * (ED_dist, ideal edge length). Defaults: weight=1.0, len=K.
 *
 * @see lib/fdpgen/fdpinit.c:init_edge
 */
export function initEdge(e: Edge, K: number): void {
  const weightAttr = e.attrs.get('weight');
  const weight = weightAttr !== undefined ? parseFloat(weightAttr) : 1.0;
  e.info.factor = isFinite(weight) && weight > 0 ? weight : 1.0;

  const lenAttr = e.attrs.get('len');
  const len = lenAttr !== undefined ? parseFloat(lenAttr) : K;
  e.info.dist = isFinite(len) && len > 0 ? len : K;
}

// ---------------------------------------------------------------------------
// fdpInitNodeEdge — public init entry point
// ---------------------------------------------------------------------------

/**
 * Initialises all nodes and edges in g for fdp layout.
 *
 * Assigns integer IDs (ND_id) to nodes, initialises positions, and sets
 * edge weight/length attributes.
 *
 * @see lib/fdpgen/fdpinit.c:fdp_init_node_edge
 */
export function fdpInitNodeEdge(g: Graph): void {
  const params = fdpInitParams(g);
  let id = 0;
  for (const n of g.nodes.values()) {
    n.info.id = id++;
    initNode(n);
  }
  for (const e of g.edges) {
    initEdge(e, params.K);
  }
}

// ---------------------------------------------------------------------------
// fdpCleanup — release engine state
// ---------------------------------------------------------------------------

/**
 * Releases fdp-specific layout state from all nodes and edges in g.
 *
 * @see lib/fdpgen/fdpinit.c:fdp_cleanup
 */
export function fdpCleanup(g: Graph): void {
  for (const n of g.nodes.values()) {
    n.info.alg = undefined;
  }
  for (const e of g.edges) {
    e.info.alg = undefined;
  }
}
