// SPDX-License-Identifier: EPL-2.0
/**
 * Neato layout engine entry point.
 *
 * Wires together neatoInitNode, setSeed, solveModel, removeOverlap,
 * splineEdges, neatoTranslate, and neatoSetAspect into the full neato
 * layout pipeline, and exports NEATO_LAYOUT_ENGINE for registration with
 * GvcContext.
 *
 * @see lib/neatogen/neatoinit.c:neato_layout
 * @see lib/neatogen/neatoprocs.h
 */

import type { Graph } from '../../model/graph.js';
import type { LayoutEngine } from '../../gvc/context.js';
import {
  neatoInitNode,
  setSeed,
  solveModel,
  neatoTranslate,
  neatoSetAspect,
  neatoCleanup,
  MODE_KK,
  MODE_MAJOR,
  MODE_HIER,
  MODE_IPSEP,
  MODE_SGD,
  MODEL_SHORTPATH,
  MODEL_CIRCUIT,
  MODEL_SUBSET,
  MODEL_MDS,
} from './init.js';
import { removeOverlap } from './overlap.js';
import { splineEdges } from './splines.js';

// Re-export constants for downstream consumers
export {
  MODE_KK, MODE_MAJOR, MODE_HIER, MODE_IPSEP, MODE_SGD,
  MODEL_SHORTPATH, MODEL_CIRCUIT, MODEL_SUBSET, MODEL_MDS,
  neatoInitNode, setSeed, solveModel,
  neatoTranslate, neatoSetAspect, neatoCleanup,
} from './init.js';

// ---------------------------------------------------------------------------
// Mode parsing
// ---------------------------------------------------------------------------

/** Map from mode string to numeric constant. @see lib/neatogen/neato.h */
const MODE_MAP: Record<string, number> = {
  KK: MODE_KK,
  major: MODE_MAJOR,
  hier: MODE_HIER,
  ipsep: MODE_IPSEP,
  sgd: MODE_SGD,
};

/**
 * Parse `g.info.mode` string into a numeric mode constant.
 * Defaults to MODE_MAJOR when unset or unrecognised.
 *
 * @see lib/neatogen/neato.h:neatoMode
 */
export function parseMode(g: Graph): number {
  const s = g.info.mode;
  if (!s) return MODE_MAJOR;
  return MODE_MAP[s] ?? MODE_MAJOR;
}

// ---------------------------------------------------------------------------
// Model parsing
// ---------------------------------------------------------------------------

/** Map from model string to numeric constant. @see lib/neatogen/defs.h */
const MODEL_MAP: Record<string, number> = {
  shortpath: MODEL_SHORTPATH,
  circuit: MODEL_CIRCUIT,
  subset: MODEL_SUBSET,
  mds: MODEL_MDS,
};

/**
 * Parse `g.info.model` string into a numeric model constant.
 * Defaults to MODEL_SHORTPATH when unset or unrecognised.
 *
 * @see lib/neatogen/neato.h:neatoModel
 */
export function parseModel(g: Graph): number {
  // model is not a GraphInfo field yet; read via attrs map as fallback
  const s = g.attrs.get('model');
  if (!s) return MODEL_SHORTPATH;
  return MODEL_MAP[s] ?? MODEL_SHORTPATH;
}

// ---------------------------------------------------------------------------
// Overlap removal
// ---------------------------------------------------------------------------

/**
 * Apply VPSC overlap removal unless `g.info.overlap === 'false'`.
 *
 * @see lib/neatogen/neatoinit.c:neato_layout (removeOverlapWith call)
 */
export function maybeRemoveOverlap(g: Graph): void {
  if (g.info.overlap === 'false') return;
  const nodes = Array.from(g.nodes.values());
  const nodesep = (g.info.nodesep ?? 18) / 72; // points → inches
  removeOverlap(nodes, { x: nodesep / 2, y: nodesep / 2 });
}

// ---------------------------------------------------------------------------
// neatoLayout
// ---------------------------------------------------------------------------

/**
 * Full neato layout pipeline for a single graph.
 *
 * Pipeline (matches neato_layout in C):
 * 1. Init each node (pos, UF_size, default width/height)
 * 2. Parse mode and seed from graph attributes
 * 3. Solve the layout (SGD, stress majorization, or KK)
 * 4. Optionally remove overlaps via VPSC
 * 5. Route edges as splines
 * 6. Translate so minimum position is (0,0)
 * 7. Convert inches → points into coord
 *
 * @see lib/neatogen/neatoinit.c:neato_layout
 */
export function neatoLayout(g: Graph): void {
  for (const [, n] of g.nodes) neatoInitNode(n);

  const mode = parseMode(g);
  const model = parseModel(g);
  const seedRef = { value: g.info.seed ?? 0 };
  setSeed(g, mode, seedRef);
  g.info.seed = seedRef.value;

  solveModel(g, mode, model);
  maybeRemoveOverlap(g);
  splineEdges(g);
  neatoTranslate(g);
  neatoSetAspect(g);
}

// ---------------------------------------------------------------------------
// NEATO_LAYOUT_ENGINE
// ---------------------------------------------------------------------------

/**
 * LayoutEngine descriptor for registration with GvcContext.
 *
 * @see lib/gvc/gvplugin.h:gvlayout_engine_s
 * @see lib/neatogen/neatoprocs.h
 */
export const NEATO_LAYOUT_ENGINE: LayoutEngine = {
  type: 'neato',
  layout: neatoLayout,
  cleanup: neatoCleanup,
};
