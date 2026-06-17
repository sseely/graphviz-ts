// SPDX-License-Identifier: EPL-2.0

/**
 * Central re-export hub for all ported lib/common/types.h types, plus
 * additional types from types.h not yet in src/model/.
 *
 * @see lib/common/types.h
 */

// ---------------------------------------------------------------------------
// Re-exports from src/model/
// ---------------------------------------------------------------------------

export type { GraphInfo } from '../model/graphInfo.js';
export { makeGraphInfo } from '../model/graphInfo.js';
export type { GVContext } from '../model/graphInfo.js';

export type { NodeInfo, NodeAlgData } from '../model/nodeInfo.js';
export { makeNodeInfo } from '../model/nodeInfo.js';

export type { EdgeInfo } from '../model/edgeInfo.js';
export { makeEdgeInfo, makePort } from '../model/edgeInfo.js';

export type { Point, Box, Port, Spline } from '../model/geom.js';

export type { LayoutParams, RatioKind } from '../model/layoutParams.js';
export { FontnameKind } from '../model/layoutParams.js';

export type { RankEntry, RankTable } from '../model/rankEntry.js';

// ---------------------------------------------------------------------------
// SplineInfo — @see lib/common/types.h:splineInfo
// ---------------------------------------------------------------------------

/**
 * Callback bag controlling edge-spline routing behaviour.
 *
 * @see lib/common/types.h:splineInfo
 */
export interface SplineInfo {
  /** Should head and tail be swapped? @see lib/common/types.h:splineInfo.swapEnds */
  swapEnds: ((e: unknown) => boolean) | null;
  /** Is n a node in the middle of an edge? @see lib/common/types.h:splineInfo.splineMerge */
  splineMerge: ((n: unknown) => boolean) | null;
  /** Test for swapped edges if false. @see lib/common/types.h:splineInfo.ignoreSwap */
  ignoreSwap: boolean;
  /** Orthogonal routing used. @see lib/common/types.h:splineInfo.isOrtho */
  isOrtho: boolean;
}

// ---------------------------------------------------------------------------
// PathendT — @see lib/common/types.h:pathend_t
// ---------------------------------------------------------------------------

import type { Box, Point } from '../model/geom.js';

/**
 * One endpoint of an edge path during spline routing.
 *
 * @see lib/common/types.h:pathend_t
 */
export interface PathendT {
  /** The node box. @see lib/common/types.h:pathend_t.nb */
  nb: Box;
  /** Node port. @see lib/common/types.h:pathend_t.np */
  np: Point;
  /** @see lib/common/types.h:pathend_t.sidemask */
  sidemask: number;
  /** @see lib/common/types.h:pathend_t.boxn */
  boxn: number;
  /**
   * Subdivision boxes; C declares boxf boxes[20].
   * @see lib/common/types.h:pathend_t.boxes
   */
  boxes: Box[];
}

// ---------------------------------------------------------------------------
// Path — @see lib/common/types.h:path
// ---------------------------------------------------------------------------

import type { Port } from '../model/geom.js';

/**
 * Internal specification for an edge spline.
 *
 * @see lib/common/types.h:path
 */
export interface Path {
  /** @see lib/common/types.h:path.start */
  start: Port;
  /** @see lib/common/types.h:path.end */
  end: Port;
  /** Number of subdivisions. @see lib/common/types.h:path.nbox */
  nbox: number;
  /** Rectangular regions of subdivision. @see lib/common/types.h:path.boxes */
  boxes: Box[];
  /** Engine-specific data. @see lib/common/types.h:path.data */
  data: unknown;
}

// ---------------------------------------------------------------------------
// Bezier — @see lib/common/types.h:bezier
//
// NOTE: Bezier is also exported from src/model/geom.ts as `Bezier` (same
// shape). We export it here under the same name so importers of
// src/common/types.ts get a consistent type.
// ---------------------------------------------------------------------------

export type { Bezier } from '../model/geom.js';

// ---------------------------------------------------------------------------
// Splines — @see lib/common/types.h:splines
//
// NOTE: Spline in geom.ts is structurally identical to splines in C.
// Re-export it as `Splines` (the plural C name) to match types.h naming.
// ---------------------------------------------------------------------------

import type { Spline } from '../model/geom.js';

/**
 * Type alias matching the C `splines` typedef.
 * Structurally identical to `Spline` from geom.ts.
 *
 * @see lib/common/types.h:splines
 */
export type Splines = Spline;

// ---------------------------------------------------------------------------
// TextlabelT — @see lib/common/types.h:textlabel_t
// ---------------------------------------------------------------------------

/**
 * Text label attached to a graph, node, or edge.
 *
 * The `u` union from C becomes a discriminated union here.
 * `html: false` → `txt` variant; `html: true` → `htmlLabel` variant.
 *
 * @see lib/common/types.h:textlabel_t
 */
export interface TextlabelT {
  /** @see lib/common/types.h:textlabel_t.text */
  text: string;
  /** @see lib/common/types.h:textlabel_t.fontname */
  fontname: string;
  /** @see lib/common/types.h:textlabel_t.fontcolor */
  fontcolor: string;
  /** @see lib/common/types.h:textlabel_t.charset */
  charset: number;
  /** @see lib/common/types.h:textlabel_t.fontsize */
  fontsize: number;
  /** Estimated diagonal size of the label. @see lib/common/types.h:textlabel_t.dimen */
  dimen: Point;
  /** Diagonal size of the space for the label. @see lib/common/types.h:textlabel_t.space */
  space: Point;
  /** Center of the space for the label. @see lib/common/types.h:textlabel_t.pos */
  pos: Point;
  /**
   * Label content union — ported as a discriminated union.
   * @see lib/common/types.h:textlabel_t.u
   */
  u:
    | {
        /** Non-HTML text spans. */
        kind: 'txt';
        /** @see lib/common/types.h:textlabel_t.u.txt.span */
        span: unknown[];
        /** @see lib/common/types.h:textlabel_t.u.txt.nspans */
        nspans: number;
      }
    | {
        /** HTML label. */
        kind: 'html';
        /** @see lib/common/types.h:textlabel_t.u.html */
        html: unknown;
      };
  /** Vertical alignment: 't' top, 'c' center, 'b' bottom. @see lib/common/types.h:textlabel_t.valign */
  valign: number;
  /** True if position is set. @see lib/common/types.h:textlabel_t.set */
  set: boolean;
  /** True if HTML label. @see lib/common/types.h:textlabel_t.html */
  html: boolean;
}

// ---------------------------------------------------------------------------
// GraphvizPolygonStyle — @see lib/common/types.h:graphviz_polygon_style_t
// ---------------------------------------------------------------------------

/**
 * Bitfield controlling polygon corner and fill rendering.
 * The C bitfield is represented as a plain object of booleans plus
 * a `shape` discriminant integer.
 *
 * @see lib/common/types.h:graphviz_polygon_style_t
 */
export interface GraphvizPolygonStyle {
  /** @see lib/common/types.h:graphviz_polygon_style_t.filled */
  filled: boolean;
  /** @see lib/common/types.h:graphviz_polygon_style_t.radial */
  radial: boolean;
  /** @see lib/common/types.h:graphviz_polygon_style_t.rounded */
  rounded: boolean;
  /** @see lib/common/types.h:graphviz_polygon_style_t.diagonals */
  diagonals: boolean;
  /** @see lib/common/types.h:graphviz_polygon_style_t.auxlabels */
  auxlabels: boolean;
  /** @see lib/common/types.h:graphviz_polygon_style_t.invisible */
  invisible: boolean;
  /** @see lib/common/types.h:graphviz_polygon_style_t.striped */
  striped: boolean;
  /** @see lib/common/types.h:graphviz_polygon_style_t.dotted */
  dotted: boolean;
  /** @see lib/common/types.h:graphviz_polygon_style_t.dashed */
  dashed: boolean;
  /** @see lib/common/types.h:graphviz_polygon_style_t.wedged */
  wedged: boolean;
  /** @see lib/common/types.h:graphviz_polygon_style_t.underline */
  underline: boolean;
  /** @see lib/common/types.h:graphviz_polygon_style_t.fixedshape */
  fixedshape: boolean;
  /**
   * Special shape discriminant (7-bit unsigned in C).
   * Values come from the polygon shape enum constants in const.h.
   * @see lib/common/types.h:graphviz_polygon_style_t.shape
   */
  shape: number;
}

// ---------------------------------------------------------------------------
// PolygonT — @see lib/common/types.h:polygon_t
// ---------------------------------------------------------------------------

/**
 * Mutable shape information for a node polygon.
 *
 * @see lib/common/types.h:polygon_t
 */
export interface PolygonT {
  /** True for symmetric shapes. @see lib/common/types.h:polygon_t.regular */
  regular: boolean;
  /** Number of periphery lines. @see lib/common/types.h:polygon_t.peripheries */
  peripheries: number;
  /** Number of sides (0 means user controls all). @see lib/common/types.h:polygon_t.sides */
  sides: number;
  /** Orientation in degrees. @see lib/common/types.h:polygon_t.orientation */
  orientation: number;
  /** Distortion factor (e.g. trapezium). @see lib/common/types.h:polygon_t.distortion */
  distortion: number;
  /** Skew factor (e.g. parallelogram). @see lib/common/types.h:polygon_t.skew */
  skew: number;
  /** Style flags. @see lib/common/types.h:polygon_t.option */
  option: GraphvizPolygonStyle;
  /**
   * Resolved node penwidth (default 1). C bakes the half-penwidth outline
   * periphery into `vertices` in poly_init; the TS `vertices` omit that ring,
   * so poly_inside reapplies it and needs the value here.
   * @see lib/common/shapes.c:poly_init (outline periphery)
   */
  penwidth?: number;
  /**
   * Precomputed vertex array, or null when computed at render time.
   * @see lib/common/types.h:polygon_t.vertices
   */
  vertices: Point[] | null;
}

// ---------------------------------------------------------------------------
// ShapeFunctions — @see lib/common/types.h:shape_functions
// ---------------------------------------------------------------------------

/**
 * Read-only shape function table; ported from the C function-pointer struct.
 * Node and edge arguments are typed `unknown` until those types are fully ported.
 *
 * @see lib/common/types.h:shape_functions
 */
export interface ShapeFunctions {
  /** Initializes shape from node shape_info. @see lib/common/types.h:shape_functions.initfn */
  initfn: ((n: unknown) => void) | null;
  /** Frees shape from node shape_info. @see lib/common/types.h:shape_functions.freefn */
  freefn: ((n: unknown) => void) | null;
  /** Finds aiming point and slope of a port. @see lib/common/types.h:shape_functions.portfn */
  portfn: ((n: unknown, portname: string, compass: string) => Port) | null;
  /** Clips incident spline on shape. @see lib/common/types.h:shape_functions.insidefn */
  insidefn: ((insideCtx: unknown, p: Point) => boolean) | null;
  /** Finds box path to reach port. @see lib/common/types.h:shape_functions.pboxfn */
  pboxfn:
    | ((
        n: unknown,
        p: Port,
        side: number,
        rv: Box[],
        kptr: number[],
      ) => number)
    | null;
  /** Emits graphics code for node. @see lib/common/types.h:shape_functions.codefn */
  codefn: ((job: unknown, n: unknown) => void) | null;
}

// ---------------------------------------------------------------------------
// ShapeKind — @see lib/common/types.h:shape_kind
// ---------------------------------------------------------------------------

/**
 * Discriminant for the type of shape a node uses.
 *
 * @see lib/common/types.h:shape_kind
 */
export enum ShapeKind {
  /** @see lib/common/types.h:SH_UNSET */
  SH_UNSET = 0,
  /** @see lib/common/types.h:SH_POLY */
  SH_POLY = 1,
  /** @see lib/common/types.h:SH_RECORD */
  SH_RECORD = 2,
  /** @see lib/common/types.h:SH_POINT */
  SH_POINT = 3,
  /** @see lib/common/types.h:SH_EPSF */
  SH_EPSF = 4,
}

// ---------------------------------------------------------------------------
// ShapeDesc — @see lib/common/types.h:shape_desc
// ---------------------------------------------------------------------------

/**
 * Read-only shape descriptor bound to a node.
 *
 * NOTE: The C struct does not carry a `kind` field — `shapeOf()` derives it
 * from `fns->initfn` at runtime. In TypeScript we store it directly on the
 * descriptor to avoid function-pointer comparisons.
 *
 * @see lib/common/types.h:shape_desc
 * @see lib/common/shapes.c:shapeOf
 */
export interface ShapeDesc {
  /** Shape name as read from graph file. @see lib/common/types.h:shape_desc.name */
  name: string;
  /** Shape function table. @see lib/common/types.h:shape_desc.fns */
  fns: ShapeFunctions | null;
  /** Base polygon info; null for non-polygon shapes. @see lib/common/types.h:shape_desc.polygon */
  polygon: PolygonT | null;
  /**
   * Derived shape kind (stored here to avoid initfn comparison).
   * @see lib/common/shapes.c:shapeOf
   */
  kind: ShapeKind;
  /** True for user-defined shapes. @see lib/common/types.h:shape_desc.usershape */
  usershape: boolean;
}

// ---------------------------------------------------------------------------
// RankT — @see lib/common/types.h:rank_t
//
// NOTE: RankEntry in src/model/rankEntry.ts already ports rank_t. RankT is
// provided here as an alias for consumers importing from src/common/types.ts.
// ---------------------------------------------------------------------------

export type { RankEntry as RankT } from '../model/rankEntry.js';

// ---------------------------------------------------------------------------
// FieldT — @see lib/common/types.h:field_t
// ---------------------------------------------------------------------------

/**
 * A field within a record-shape node.
 *
 * @see lib/common/types.h:field_t
 */
export interface FieldT {
  /** Field dimensions. @see lib/common/types.h:field_t.size */
  size: Point;
  /** Placement in node coordinates. @see lib/common/types.h:field_t.b */
  b: Box;
  /** Number of sub-fields. @see lib/common/types.h:field_t.n_flds */
  n_flds: number;
  /** Label pointer; used when n_flds == 0. @see lib/common/types.h:field_t.lp */
  lp: TextlabelT | null;
  /** Sub-field array; used when n_flds > 0. @see lib/common/types.h:field_t.fld */
  fld: FieldT[] | null;
  /** User's identifier. @see lib/common/types.h:field_t.id */
  id: string | null;
  /**
   * Non-zero if box list is horizontal (left to right).
   * @see lib/common/types.h:field_t.LR
   */
  LR: number;
  /** Sides of node exposed to this field. @see lib/common/types.h:field_t.sides */
  sides: number;
}

// ---------------------------------------------------------------------------
// NlistT — @see lib/common/types.h:nlist_t
// ---------------------------------------------------------------------------

/**
 * Generic node list.
 *
 * @see lib/common/types.h:nlist_t
 */
export interface NlistT {
  /** @see lib/common/types.h:nlist_t.list */
  list: unknown[];
  /** @see lib/common/types.h:nlist_t.size */
  size: number;
}

// ---------------------------------------------------------------------------
// ElistT — @see lib/common/types.h:elist
// ---------------------------------------------------------------------------

/**
 * Dynamic edge list (ported from the C `elist` struct).
 *
 * NOTE: NodeInfo already contains a typed EdgeList for known-edge contexts.
 * ElistT covers the generic `elist` where the element type is not yet known.
 *
 * @see lib/common/types.h:elist
 */
export interface ElistT {
  /** @see lib/common/types.h:elist.list */
  list: unknown[];
  /** @see lib/common/types.h:elist.size */
  size: number;
}
