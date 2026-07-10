// SPDX-License-Identifier: EPL-2.0

/**
 * adjustNodes overlap-mode dispatch including AM_PRISM — the reference
 * binary is built with GTS+SFDP, so `overlap=false` (or any value that is
 * neither a named mode nor a recognizable boolean) resolves to PRISM, not
 * to a no-op. `overlap=true` (or unset) is AM_NONE.
 *
 * @see lib/neatogen/adjust.c:getAdjustMode / adjustMode table
 * @see lib/neatogen/adjust.c:fdpAdjust / removeOverlapWith / adjustNodes
 */

import type { Graph } from '../../model/graph.js';
import { makeMatrix, getSizes } from '../sfdp/init.js';
import {
  smIsSymmetric, smRemoveDiagonal, smGetRealAdjacencySymmetrized,
  MATRIX_TYPE_REAL,
} from '../sfdp/sparse-matrix.js';
import { removeOverlapPrism } from './overlap-prism.js';
import { adjustNodesScale } from './sc-adjust.js';
import { sepFactor } from './sep-factor.js';
import { lateDouble } from '../../common/nodeinit.js';

/** @see lib/neatogen/adjust.c:DFLT_MARGIN (points) */
const DFLT_MARGIN = 4;
const NDIM = 2;

/** @see lib/common/utils.c:mapBool */
function mapBoolDflt(p: string | undefined, defaultValue: boolean): boolean {
  if (p === undefined || p === '') return defaultValue;
  const s = p.toLowerCase();
  if (s === 'false' || s === 'no') return false;
  if (s === 'true' || s === 'yes') return true;
  if (p[0]! >= '0' && p[0]! <= '9') return parseInt(p, 10) !== 0;
  return defaultValue;
}

/** prism try-count from the attr suffix ("prism2000" → 2000; default 1000).
 * @see lib/neatogen/adjust.c:setPrismValues */
function prismValue(suffix: string): number {
  const v = parseInt(suffix, 10);
  return Number.isInteger(v) && v >= 0 ? v : 1000;
}

/** Named modes handled elsewhere or as no-ops; PRISM/scale handled here. */
const NAMED_MODES = new Set([
  'voronoi', 'scale', 'compress', 'vpsc', 'ipsep', 'oscale', 'scalexy',
  'ortho', 'ortho_yx', 'orthoxy', 'orthoyx',
  'portho', 'portho_yx', 'porthoxy', 'porthoyx',
]);

/**
 * Resolved PRISM try count for `flag`, or null when the mode is not PRISM
 * (AM_NONE, a scale-family mode, or an unported named mode). Note
 * "prism0" IS prism with ntry=0 — remove_overlap still applies the
 * initial scaling before its `if (!ntry) return`.
 * @see adjust.c:getAdjustMode
 */
export function overlapPrismTries(flag: string | undefined): number | null {
  if (flag === undefined || flag === '') return null; // AM_NONE
  const s = flag.toLowerCase();
  if (s.startsWith('prism')) return prismValue(flag.slice('prism'.length));
  if (NAMED_MODES.has(s)) return null; // dispatched elsewhere (or unported)
  // boolean fallback: true → AM_NONE; false or unrecognized → AM_PRISM
  const v = mapBoolDflt(flag, false);
  const unmappable = v !== mapBoolDflt(flag, true);
  if (unmappable || !v) return 1000;
  return null;
}

/**
 * PRISM node-overlap removal over ND_pos (inches).
 * @see lib/neatogen/adjust.c:fdpAdjust
 */
export function fdpAdjust(g: Graph, ntry: number): void {
  const A0 = makeMatrix(g);
  const pos = new Array<number>(NDIM * g.nodes.size).fill(0);
  const sep = sepFactor(g);
  const pad = sep.doAdd
    ? { x: sep.x / 72, y: sep.y / 72 }
    : { x: DFLT_MARGIN / 72, y: DFLT_MARGIN / 72 };
  const sizes = getSizes(g, pad);

  for (const n of g.nodes.values()) {
    const i = n.info.id!;
    pos[i * NDIM] = n.info.pos?.[0] ?? 0;
    pos[i * NDIM + 1] = n.info.pos?.[1] ?? 0;
  }

  const A = !smIsSymmetric(A0, false) || A0.type !== MATRIX_TYPE_REAL
    ? smGetRealAdjacencySymmetrized(A0)
    : smRemoveDiagonal(A0);

  const scaling = lateDouble(
    g.root.attrs.get('overlap_scaling'), -4.0, -1.e10);
  const doShrinking = mapBoolDflt(
    g.attrs.get('overlap_shrink') ?? g.root.attrs.get('overlap_shrink'), true);

  removeOverlapPrism(NDIM, A, pos, sizes, ntry, scaling, doShrinking);

  for (const n of g.nodes.values()) {
    const i = n.info.id!;
    if (!n.info.pos) n.info.pos = [0, 0];
    n.info.pos[0] = pos[i * NDIM]!;
    n.info.pos[1] = pos[i * NDIM + 1]!;
  }
}

/**
 * Full adjustNodes: scale-family via scAdjust, PRISM via fdpAdjust,
 * everything else a no-op (AM_NONE, or a mode with no divergent corpus
 * coverage — see sc-adjust module doc).
 * @see lib/neatogen/adjust.c:adjustNodes / removeOverlapWith
 */
export function adjustNodesFull(g: Graph): number {
  const flag = g.attrs.get('overlap') ?? g.root.attrs.get('overlap');
  const ntry = overlapPrismTries(flag);
  // C removeOverlapWith: fewer than 2 nodes short-circuits every mode.
  if (ntry !== null && g.nodes.size >= 2) {
    fdpAdjust(g, ntry);
    return 1;
  }
  return adjustNodesScale(g);
}
