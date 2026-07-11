// SPDX-License-Identifier: EPL-2.0
/**
 * External-label placement — public types and placeLabels entry point.
 *
 * Internal algorithm is split across:
 *   xlabels-geom.ts      — Hilbert code, rect helpers
 *   xlabels-intersect.ts — neighbour-grid recording, xladjust
 *
 * @see lib/label/xlabels.h
 * @see lib/label/xlabels.c
 */

import { type Box } from '../model/geom.js';
import { type RTree, rTreeOpen, rTreeClose, rTreeInsert } from './index.js';
import { DtBag } from '../cdt/bag.js';
import { type Rect } from './rectangle.js';
import { hdHilSFromXy, objplpmks } from './xlabels-geom.js';
import { xladjust } from './xlabels-intersect.js';

// ---------------------------------------------------------------------------
// Public types  (xlabels.h)
// ---------------------------------------------------------------------------

/**
 * External label attached to a graph object.
 * @see lib/label/xlabels.h:xlabel_t
 */
export interface XLabelT {
  /** Size of label (input). @see xlabel_t.sz */
  sz: { x: number; y: number };
  /** Position of lower-left corner (output). @see xlabel_t.pos */
  pos: { x: number; y: number };
  /** Opaque pointer to label in the graph. @see xlabel_t.lbl */
  lbl: unknown;
  /** Non-zero when position has been set. @see xlabel_t.set */
  set: number;
}

/**
 * Graph object that may carry an external label.
 * @see lib/label/xlabels.h:object_t
 */
export interface ObjectT {
  /** Position of lower-left corner. @see object_t.pos */
  pos: { x: number; y: number };
  /** Size; may be zero for a point object. @see object_t.sz */
  sz: { x: number; y: number };
  /** Attached label, or null. @see object_t.lbl */
  lbl: XLabelT | null;
}

/**
 * Parameters controlling label placement.
 * @see lib/label/xlabels.h:label_params_t
 */
export interface LabelParamsT {
  /** Bounding box of all objects. @see label_params_t.bb */
  bb: Box;
  /** When true, all labels must be placed even if overlaps result. */
  force: boolean;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

/** Hilbert-keyed dict entry. @see lib/label/xlabels.h:HDict_t */
interface HDictT {
  key: number;
  d: { rect: Rect; data: ObjectT };
}

/** XLabels state bundle. @see lib/label/xlabels.h:XLabels_t */
interface XLabelsT {
  objs: ObjectT[];
  nObjs: number;
  lbls: XLabelT[];
  nLbls: number;
  params: LabelParamsT;
  hdx: DtBag<HDictT, number>;
  spdx: RTree;
}

// ---------------------------------------------------------------------------
// Hilbert order
// ---------------------------------------------------------------------------

/**
 * Hilbert curve order: smallest n such that 2^n >= max(bb.UR.x, bb.UR.y).
 * @see lib/label/xlabels.c:xlhorder
 */
function xlhorder(xlp: XLabelsT): number {
  const m = Math.max(xlp.params.bb.ur.x, xlp.params.bb.ur.y);
  return Math.floor(Math.log2(Math.round(m))) + 1;
}

// ---------------------------------------------------------------------------
// Index loading / unloading
// ---------------------------------------------------------------------------

/** Allocate and initialise XLabels state. @see lib/label/xlabels.c:xlnew */
function xlnew(
  objs: ObjectT[], lbls: XLabelT[], params: LabelParamsT,
): XLabelsT {
  return {
    objs, nObjs: objs.length, lbls, nLbls: lbls.length, params,
    hdx: new DtBag<HDictT, number>((hp) => hp.key, (a, b) => a - b),
    spdx: rTreeOpen(),
  };
}

/** Release the R-tree. @see lib/label/xlabels.c:xlfree */
function xlfree(xlp: XLabelsT): void {
  rTreeClose(xlp.spdx);
}

/**
 * Load all objects into the Hilbert-keyed bag.
 * @see lib/label/xlabels.c:xlhdxload
 */
function xlhdxload(xlp: XLabelsT): number {
  const order = xlhorder(xlp);
  for (let i = 0; i < xlp.nObjs; i++) {
    const obj = xlp.objs[i];
    const rect = objplpmks(obj);
    const cx = rect.boundary[0] + (rect.boundary[2] - rect.boundary[0]) / 2;
    const cy = rect.boundary[1] + (rect.boundary[3] - rect.boundary[1]) / 2;
    // C stores the unsigned hilbert code into a SIGNED `int key` field
    // (xlabels.h:HDict_t.key) and `icompare` (xlabels.c) compares it as a
    // signed int. Keys >= 2^31 therefore sort BEFORE positive keys, which
    // changes the R-tree insertion order (and thus the tree's node MBRs and
    // RTreeSearch pruning). Reinterpret the code as int32 to match.
    // @see lib/label/xlabels.c:xlhdxload / icompare
    const key = hdHilSFromXy(Math.trunc(cx), Math.trunc(cy), order) | 0;
    xlp.hdx.insert({ key, d: { rect, data: obj } });
  }
  return 0;
}

/** Drain the Hilbert bag. @see lib/label/xlabels.c:xlhdxunload */
function xlhdxunload(xlp: XLabelsT): void { xlp.hdx.clear(); }

/** Load R-tree from Hilbert bag in ascending key order. @see lib/label/xlabels.c:xlspdxload */
function xlspdxload(xlp: XLabelsT): void {
  for (const hp of xlp.hdx) rTreeInsert(xlp.spdx, hp.d.rect, hp.d.data);
}

/** Build Hilbert bag then load R-tree. @see lib/label/xlabels.c:xlinitialize */
function xlinitialize(xlp: XLabelsT): number {
  const r = xlhdxload(xlp);
  if (r < 0) return r;
  xlspdxload(xlp);
  xlhdxunload(xlp);
  return 0;
}

// ---------------------------------------------------------------------------
// Placement decision helper
// ---------------------------------------------------------------------------

/**
 * Apply the BestPos result to one object's label.
 * @see lib/label/xlabels.c:placeLabels (inner loop body)
 */
function applyBestPos(
  obj: ObjectT,
  bp: { n: number; area: number; pos: { x: number; y: number } },
  force: boolean,
): number {
  if (bp.n === 0) {
    obj.lbl!.set = 1;
    return 0;
  }
  if (bp.area === 0 || force) {
    obj.lbl!.pos = bp.pos;
    obj.lbl!.set = 1;
    return 0;
  }
  return 1;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Place external labels near their attached objects, minimising overlaps.
 * Returns 0 when all labels were placed without overlap; non-zero otherwise.
 *
 * @see lib/label/xlabels.c:placeLabels
 */
export function placeLabels(
  objs: ObjectT[],
  lbls: XLabelT[],
  params: LabelParamsT,
): number {
  const xlp = xlnew(objs, lbls, params);
  const initResult = xlinitialize(xlp);
  if (initResult < 0) return initResult;

  let r = 0;
  for (let i = 0; i < objs.length; i++) {
    if (objs[i].lbl === null) continue;
    const bp = xladjust(xlp, objs[i]);
    r |= applyBestPos(objs[i], bp, params.force);
  }
  xlfree(xlp);
  return r;
}
