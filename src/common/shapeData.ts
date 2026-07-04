// SPDX-License-Identifier: EPL-2.0

/**
 * Polygon data constants ported from lib/common/shapes.c.
 * Each constant mirrors a `static polygon_t p_*` declaration in the C source.
 *
 * @see lib/common/shapes.c
 * @see lib/common/const.h
 */

import type { PolygonT, GraphvizPolygonStyle } from './types.js';

// ---------------------------------------------------------------------------
// Polygon-style enum constants — from lib/common/const.h
// ---------------------------------------------------------------------------

/** @see lib/common/const.h:DOGEAR */
export const DOGEAR = 1;
/** @see lib/common/const.h:TAB */
export const TAB = 2;
/** @see lib/common/const.h:FOLDER */
export const FOLDER = 3;
/** @see lib/common/const.h:BOX3D */
export const BOX3D = 4;
/** @see lib/common/const.h:COMPONENT */
export const COMPONENT = 5;
/** @see lib/common/const.h:PROMOTER */
export const PROMOTER = 6;
/** @see lib/common/const.h:CDS */
export const CDS = 7;
/** @see lib/common/const.h:TERMINATOR */
export const TERMINATOR = 8;
/** @see lib/common/const.h:UTR */
export const UTR = 9;
/** @see lib/common/const.h:PRIMERSITE */
export const PRIMERSITE = 10;
/** @see lib/common/const.h:RESTRICTIONSITE */
export const RESTRICTIONSITE = 11;
/** @see lib/common/const.h:FIVEPOVERHANG */
export const FIVEPOVERHANG = 12;
/** @see lib/common/const.h:THREEPOVERHANG */
export const THREEPOVERHANG = 13;
/** @see lib/common/const.h:NOVERHANG */
export const NOVERHANG = 14;
/** @see lib/common/const.h:ASSEMBLY */
export const ASSEMBLY = 15;
/** @see lib/common/const.h:SIGNATURE */
export const SIGNATURE = 16;
/** @see lib/common/const.h:INSULATOR */
export const INSULATOR = 17;
/** @see lib/common/const.h:RIBOSITE */
export const RIBOSITE = 18;
/** @see lib/common/const.h:RNASTAB */
export const RNASTAB = 19;
/** @see lib/common/const.h:PROTEASESITE */
export const PROTEASESITE = 20;
/** @see lib/common/const.h:PROTEINSTAB */
export const PROTEINSTAB = 21;
/** @see lib/common/const.h:RPROMOTER */
export const RPROMOTER = 22;
/** @see lib/common/const.h:RARROW */
export const RARROW = 23;
/** @see lib/common/const.h:LARROW */
export const LARROW = 24;
/** @see lib/common/const.h:LPROMOTER */
export const LPROMOTER = 25;
/** @see lib/common/const.h:CYLINDER */
export const CYLINDER = 26;
/** Star: custom 10-vertex generator (not a regular decagon).
 *  @see lib/common/shapes.c:star_gen / star_vertices */
export const STAR = 27;

// ---------------------------------------------------------------------------
// Default polygon style — all flags false, shape = 0
// ---------------------------------------------------------------------------

/** Zero-valued polygon style (C zero-init). */
export const ZERO_STYLE: GraphvizPolygonStyle = {
  filled: false,
  radial: false,
  rounded: false,
  diagonals: false,
  auxlabels: false,
  invisible: false,
  striped: false,
  dotted: false,
  dashed: false,
  wedged: false,
  underline: false,
  fixedshape: false,
  shape: 0,
};

// ---------------------------------------------------------------------------
// Helper: build a polygon style with a custom shape discriminant
// ---------------------------------------------------------------------------

function withShape(shapeId: number): GraphvizPolygonStyle {
  return { ...ZERO_STYLE, shape: shapeId };
}

function withFlags(
  flags: Partial<GraphvizPolygonStyle>,
): GraphvizPolygonStyle {
  return { ...ZERO_STYLE, ...flags };
}

// ---------------------------------------------------------------------------
// Polygon definitions — one per static polygon_t in shapes.c
// ---------------------------------------------------------------------------

/** @see lib/common/shapes.c:p_polygon */
export const P_POLYGON: PolygonT = {
  regular: false, peripheries: 1, sides: 0,
  orientation: 0, distortion: 0, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_ellipse */
export const P_ELLIPSE: PolygonT = {
  regular: false, peripheries: 1, sides: 1,
  orientation: 0, distortion: 0, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_circle */
export const P_CIRCLE: PolygonT = {
  regular: true, peripheries: 1, sides: 1,
  orientation: 0, distortion: 0, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_egg */
export const P_EGG: PolygonT = {
  regular: false, peripheries: 1, sides: 1,
  orientation: 0, distortion: -0.3, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_triangle */
export const P_TRIANGLE: PolygonT = {
  regular: false, peripheries: 1, sides: 3,
  orientation: 0, distortion: 0, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_box */
export const P_BOX: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_square */
export const P_SQUARE: PolygonT = {
  regular: true, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_plaintext */
export const P_PLAINTEXT: PolygonT = {
  regular: false, peripheries: 0, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_plain */
export const P_PLAIN: PolygonT = {
  regular: false, peripheries: 0, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_diamond */
export const P_DIAMOND: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 45.0, distortion: 0, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_trapezium */
export const P_TRAPEZIUM: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: -0.4, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_parallelogram */
export const P_PARALLELOGRAM: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0.6,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_house */
export const P_HOUSE: PolygonT = {
  regular: false, peripheries: 1, sides: 5,
  orientation: 0, distortion: -0.64, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_pentagon */
export const P_PENTAGON: PolygonT = {
  regular: false, peripheries: 1, sides: 5,
  orientation: 0, distortion: 0, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_hexagon */
export const P_HEXAGON: PolygonT = {
  regular: false, peripheries: 1, sides: 6,
  orientation: 0, distortion: 0, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_septagon */
export const P_SEPTAGON: PolygonT = {
  regular: false, peripheries: 1, sides: 7,
  orientation: 0, distortion: 0, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_octagon */
export const P_OCTAGON: PolygonT = {
  regular: false, peripheries: 1, sides: 8,
  orientation: 0, distortion: 0, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_note */
export const P_NOTE: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(DOGEAR), vertices: null,
};

/** @see lib/common/shapes.c:p_tab */
export const P_TAB: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(TAB), vertices: null,
};

/** @see lib/common/shapes.c:p_folder */
export const P_FOLDER: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(FOLDER), vertices: null,
};

/** @see lib/common/shapes.c:p_box3d */
export const P_BOX3D: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(BOX3D), vertices: null,
};

/** @see lib/common/shapes.c:p_component */
export const P_COMPONENT: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(COMPONENT), vertices: null,
};

/** @see lib/common/shapes.c:p_underline */
export const P_UNDERLINE: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withFlags({ underline: true }), vertices: null,
};

/**
 * Cylinder: 19 sides, vertices computed at render time (null here).
 * In C, vertices points to a cylinder_gen descriptor; here null is used
 * since cylinder rendering is handled by the cylinder draw function.
 *
 * @see lib/common/shapes.c:p_cylinder
 */
export const P_CYLINDER: PolygonT = {
  regular: false, peripheries: 1, sides: 19,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(CYLINDER), vertices: null,
};

/** @see lib/common/shapes.c:p_doublecircle */
export const P_DOUBLECIRCLE: PolygonT = {
  regular: true, peripheries: 2, sides: 1,
  orientation: 0, distortion: 0, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_invtriangle */
export const P_INVTRIANGLE: PolygonT = {
  regular: false, peripheries: 1, sides: 3,
  orientation: 180.0, distortion: 0, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_invtrapezium */
export const P_INVTRAPEZIUM: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 180.0, distortion: -0.4, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_invhouse */
export const P_INVHOUSE: PolygonT = {
  regular: false, peripheries: 1, sides: 5,
  orientation: 180.0, distortion: -0.64, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_doubleoctagon */
export const P_DOUBLEOCTAGON: PolygonT = {
  regular: false, peripheries: 2, sides: 8,
  orientation: 0, distortion: 0, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_tripleoctagon */
export const P_TRIPLEOCTAGON: PolygonT = {
  regular: false, peripheries: 3, sides: 8,
  orientation: 0, distortion: 0, skew: 0,
  option: ZERO_STYLE, vertices: null,
};

/** @see lib/common/shapes.c:p_Mdiamond */
export const P_MDIAMOND: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 45.0, distortion: 0, skew: 0,
  option: withFlags({ diagonals: true, auxlabels: true }),
  vertices: null,
};

/** @see lib/common/shapes.c:p_Msquare */
export const P_MSQUARE: PolygonT = {
  regular: true, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withFlags({ diagonals: true }), vertices: null,
};

/** @see lib/common/shapes.c:p_Mcircle */
export const P_MCIRCLE: PolygonT = {
  regular: true, peripheries: 1, sides: 1,
  orientation: 0, distortion: 0, skew: 0,
  option: withFlags({ diagonals: true, auxlabels: true }),
  vertices: null,
};

/**
 * Star: 10 sides, vertices computed at render time (null here).
 * In C, vertices points to star_gen; here null since star rendering
 * is handled by star_inside and poly_gencode.
 *
 * @see lib/common/shapes.c:p_star
 */
export const P_STAR: PolygonT = {
  regular: false, peripheries: 1, sides: 10,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(STAR), vertices: null,
};

/** @see lib/common/shapes.c:p_promoter */
export const P_PROMOTER: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(PROMOTER), vertices: null,
};

/** @see lib/common/shapes.c:p_cds */
export const P_CDS: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(CDS), vertices: null,
};

/** @see lib/common/shapes.c:p_terminator */
export const P_TERMINATOR: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(TERMINATOR), vertices: null,
};

/** @see lib/common/shapes.c:p_utr */
export const P_UTR: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(UTR), vertices: null,
};

/** @see lib/common/shapes.c:p_insulator */
export const P_INSULATOR: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(INSULATOR), vertices: null,
};

/** @see lib/common/shapes.c:p_ribosite */
export const P_RIBOSITE: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(RIBOSITE), vertices: null,
};

/** @see lib/common/shapes.c:p_rnastab */
export const P_RNASTAB: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(RNASTAB), vertices: null,
};

/** @see lib/common/shapes.c:p_proteasesite */
export const P_PROTEASESITE: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(PROTEASESITE), vertices: null,
};

/** @see lib/common/shapes.c:p_proteinstab */
export const P_PROTEINSTAB: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(PROTEINSTAB), vertices: null,
};

/** @see lib/common/shapes.c:p_primersite */
export const P_PRIMERSITE: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(PRIMERSITE), vertices: null,
};

/** @see lib/common/shapes.c:p_restrictionsite */
export const P_RESTRICTIONSITE: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(RESTRICTIONSITE), vertices: null,
};

/** @see lib/common/shapes.c:p_fivepoverhang */
export const P_FIVEPOVERHANG: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(FIVEPOVERHANG), vertices: null,
};

/** @see lib/common/shapes.c:p_threepoverhang */
export const P_THREEPOVERHANG: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(THREEPOVERHANG), vertices: null,
};

/** @see lib/common/shapes.c:p_noverhang */
export const P_NOVERHANG: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(NOVERHANG), vertices: null,
};

/** @see lib/common/shapes.c:p_assembly */
export const P_ASSEMBLY: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(ASSEMBLY), vertices: null,
};

/** @see lib/common/shapes.c:p_signature */
export const P_SIGNATURE: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(SIGNATURE), vertices: null,
};

/** @see lib/common/shapes.c:p_rpromoter */
export const P_RPROMOTER: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(RPROMOTER), vertices: null,
};

/** @see lib/common/shapes.c:p_rarrow */
export const P_RARROW: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(RARROW), vertices: null,
};

/** @see lib/common/shapes.c:p_larrow */
export const P_LARROW: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(LARROW), vertices: null,
};

/** @see lib/common/shapes.c:p_lpromoter */
export const P_LPROMOTER: PolygonT = {
  regular: false, peripheries: 1, sides: 4,
  orientation: 0, distortion: 0, skew: 0,
  option: withShape(LPROMOTER), vertices: null,
};
