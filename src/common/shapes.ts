// SPDX-License-Identifier: EPL-2.0

/**
 * Shape catalogue ported from lib/common/shapes.c.
 *
 * Exports the `Shapes` table (62 entries, indices 0–61), the
 * `DEFAULT_SHAPE_NAME` constant, and the `bindShape` lookup function.
 *
 * @see lib/common/shapes.c:Shapes
 * @see lib/common/shapes.c:bind_shape
 */

import { ShapeKind, type ShapeDesc, type ShapeFunctions } from './types.js';
import {
  P_BOX, P_POLYGON, P_ELLIPSE, P_EGG, P_TRIANGLE, P_CIRCLE,
  P_SQUARE, P_PLAINTEXT, P_PLAIN, P_DIAMOND, P_TRAPEZIUM,
  P_PARALLELOGRAM, P_HOUSE, P_PENTAGON, P_HEXAGON, P_SEPTAGON,
  P_OCTAGON, P_NOTE, P_TAB, P_FOLDER, P_BOX3D, P_COMPONENT,
  P_UNDERLINE, P_CYLINDER, P_DOUBLECIRCLE, P_INVTRIANGLE,
  P_INVTRAPEZIUM, P_INVHOUSE, P_DOUBLEOCTAGON, P_TRIPLEOCTAGON,
  P_MDIAMOND, P_MSQUARE, P_MCIRCLE, P_STAR, P_PROMOTER, P_CDS,
  P_TERMINATOR, P_UTR, P_INSULATOR, P_RIBOSITE, P_RNASTAB,
  P_PROTEASESITE, P_PROTEINSTAB, P_PRIMERSITE, P_RESTRICTIONSITE,
  P_FIVEPOVERHANG, P_THREEPOVERHANG, P_NOVERHANG, P_ASSEMBLY,
  P_SIGNATURE, P_RPROMOTER, P_RARROW, P_LARROW, P_LPROMOTER,
} from './shapeData.js';
import { polyGencode } from './poly-gencode.js';
import { recordGencode } from './record.js';
import { polyInside, recordInside } from './poly-inside.js';
import { polyPort } from './compass-port.js';
import { recordPort, recordPath } from './record-port.js';

// ---------------------------------------------------------------------------
// Shape function tables
// ---------------------------------------------------------------------------

/** insidefn entry: ShapeFunctions types the context as unknown. */
const POLY_INSIDE = polyInside as ShapeFunctions['insidefn'];

/** Function table for all polygon-based shapes. @see lib/common/shapes.c */
const POLY_FNS: ShapeFunctions = {
  initfn: null,
  freefn: null,
  portfn: polyPort as ShapeFunctions['portfn'],
  insidefn: POLY_INSIDE,
  pboxfn: null,
  codefn: polyGencode,
};

/** Function table for record shapes. @see lib/common/shapes.c:record_fns */
const RECORD_FNS: ShapeFunctions = {
  initfn: null,
  freefn: null,
  portfn: recordPort as ShapeFunctions['portfn'],
  insidefn: recordInside as ShapeFunctions['insidefn'],
  pboxfn: recordPath as ShapeFunctions['pboxfn'],
  codefn: recordGencode,
};

// Descriptor constructors (one per shape_functions group in shapes.c)
const mkPoly = (n: string, p: ShapeDesc['polygon']): ShapeDesc =>
  ({ name: n, fns: POLY_FNS, polygon: p, kind: ShapeKind.SH_POLY, usershape: false });
const mkPoint = (n: string, p: ShapeDesc['polygon']): ShapeDesc =>
  ({ name: n, fns: POLY_FNS, polygon: p, kind: ShapeKind.SH_POINT, usershape: false });
const mkRecord = (n: string): ShapeDesc =>
  ({ name: n, fns: RECORD_FNS, polygon: null, kind: ShapeKind.SH_RECORD, usershape: false });
const mkEpsf = (n: string): ShapeDesc =>
  ({ name: n, fns: null, polygon: null, kind: ShapeKind.SH_EPSF, usershape: false });

/**
 * Shape catalogue — 62 entries (indices 0–61).
 * Index 0 is the fallback for unknown shape names.
 * Order matches lib/common/shapes.c:Shapes exactly.
 *
 * @see lib/common/shapes.c:Shapes
 */
export const Shapes: readonly ShapeDesc[] = [
  /* [0]  */ mkPoly('box',              P_BOX),
  /* [1]  */ mkPoly('polygon',          P_POLYGON),
  /* [2]  */ mkPoly('ellipse',          P_ELLIPSE),
  /* [3]  */ mkPoly('oval',             P_ELLIPSE),
  /* [4]  */ mkPoly('circle',           P_CIRCLE),
  /* [5]  */ mkPoint('point',           P_CIRCLE),
  /* [6]  */ mkPoly('egg',              P_EGG),
  /* [7]  */ mkPoly('triangle',         P_TRIANGLE),
  /* [8]  */ mkPoly('none',             P_PLAINTEXT),
  /* [9]  */ mkPoly('plaintext',        P_PLAINTEXT),
  /* [10] */ mkPoly('plain',            P_PLAIN),
  /* [11] */ mkPoly('diamond',          P_DIAMOND),
  /* [12] */ mkPoly('trapezium',        P_TRAPEZIUM),
  /* [13] */ mkPoly('parallelogram',    P_PARALLELOGRAM),
  /* [14] */ mkPoly('house',            P_HOUSE),
  /* [15] */ mkPoly('pentagon',         P_PENTAGON),
  /* [16] */ mkPoly('hexagon',          P_HEXAGON),
  /* [17] */ mkPoly('septagon',         P_SEPTAGON),
  /* [18] */ mkPoly('octagon',          P_OCTAGON),
  /* [19] */ mkPoly('note',             P_NOTE),
  /* [20] */ mkPoly('tab',              P_TAB),
  /* [21] */ mkPoly('folder',           P_FOLDER),
  /* [22] */ mkPoly('box3d',            P_BOX3D),
  /* [23] */ mkPoly('component',        P_COMPONENT),
  /* [24] */ mkPoly('cylinder',         P_CYLINDER),
  /* [25] */ mkPoly('rect',             P_BOX),
  /* [26] */ mkPoly('rectangle',        P_BOX),
  /* [27] */ mkPoly('square',           P_SQUARE),
  /* [28] */ mkPoly('doublecircle',     P_DOUBLECIRCLE),
  /* [29] */ mkPoly('doubleoctagon',    P_DOUBLEOCTAGON),
  /* [30] */ mkPoly('tripleoctagon',    P_TRIPLEOCTAGON),
  /* [31] */ mkPoly('invtriangle',      P_INVTRIANGLE),
  /* [32] */ mkPoly('invtrapezium',     P_INVTRAPEZIUM),
  /* [33] */ mkPoly('invhouse',         P_INVHOUSE),
  /* [34] */ mkPoly('underline',        P_UNDERLINE),
  /* [35] */ mkPoly('Mdiamond',         P_MDIAMOND),
  /* [36] */ mkPoly('Msquare',          P_MSQUARE),
  /* [37] */ mkPoly('Mcircle',          P_MCIRCLE),
  /* [38] */ mkPoly('promoter',         P_PROMOTER),
  /* [39] */ mkPoly('cds',              P_CDS),
  /* [40] */ mkPoly('terminator',       P_TERMINATOR),
  /* [41] */ mkPoly('utr',              P_UTR),
  /* [42] */ mkPoly('insulator',        P_INSULATOR),
  /* [43] */ mkPoly('ribosite',         P_RIBOSITE),
  /* [44] */ mkPoly('rnastab',          P_RNASTAB),
  /* [45] */ mkPoly('proteasesite',     P_PROTEASESITE),
  /* [46] */ mkPoly('proteinstab',      P_PROTEINSTAB),
  /* [47] */ mkPoly('primersite',       P_PRIMERSITE),
  /* [48] */ mkPoly('restrictionsite',  P_RESTRICTIONSITE),
  /* [49] */ mkPoly('fivepoverhang',    P_FIVEPOVERHANG),
  /* [50] */ mkPoly('threepoverhang',   P_THREEPOVERHANG),
  /* [51] */ mkPoly('noverhang',        P_NOVERHANG),
  /* [52] */ mkPoly('assembly',         P_ASSEMBLY),
  /* [53] */ mkPoly('signature',        P_SIGNATURE),
  /* [54] */ mkPoly('rpromoter',        P_RPROMOTER),
  /* [55] */ mkPoly('larrow',           P_LARROW),
  /* [56] */ mkPoly('rarrow',           P_RARROW),
  /* [57] */ mkPoly('lpromoter',        P_LPROMOTER),
  /* [58] */ mkRecord('record'),
  /* [59] */ mkRecord('Mrecord'),
  /* [60] */ mkEpsf('epsf'),
  /* [61] */ mkPoly('star',             P_STAR),
] as const;

/**
 * Name of the fallback shape used when a requested name is not found.
 * Matches Shapes[0].name.
 *
 * @see lib/common/shapes.c:Shapes (first entry is default for no such shape)
 */
export const DEFAULT_SHAPE_NAME = 'box';

/**
 * Returns the ShapeDesc for the given name (case-sensitive).
 * Falls back to Shapes[0] (box) when the name is not recognised.
 *
 * Equivalent to C's bind_shape() for built-in shapes; the user-shape
 * and shapefile branches require a node argument not yet ported.
 *
 * @see lib/common/shapes.c:bind_shape
 */
export function bindShape(name: string): ShapeDesc {
  for (const shape of Shapes) {
    if (shape.name === name) {
      return shape;
    }
  }
  return Shapes[0];
}
