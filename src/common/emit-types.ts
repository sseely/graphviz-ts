// SPDX-License-Identifier: EPL-2.0

/**
 * Public types and constants for the emit rendering dispatch layer.
 *
 * This replaces the GVJ_t vtable system with a direct Renderer interface
 * per AD-2. The layer/pagination/viewport machinery is stubbed as no-ops.
 *
 * @see lib/common/emit.c
 * @see lib/common/render.h
 */

import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';
import type { Edge } from '../model/edge.js';
import type { Point } from '../model/geom.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Conversion factor: PostScript points → inches.
 * @see lib/common/geom.h: #define POINTS_PER_INCH 72 (inverted)
 */
export const PS2INCH = 1.0 / 72.0;

/**
 * Conversion factor: inches → PostScript points.
 * @see lib/common/geom.h: #define POINTS_PER_INCH 72
 */
export const INCH2PS = 72.0;

// ---------------------------------------------------------------------------
// TextSpan — @see lib/common/textspan.h:textspan_t
// ---------------------------------------------------------------------------

/**
 * Atomic unit of text emitted using a single font.
 * Ported from textspan_t in lib/common/textspan.h.
 *
 * @see lib/common/textspan.h:textspan_t
 */
export interface TextSpan {
  /** UTF-8 text content. @see lib/common/textspan.h:textspan_t.str */
  str: string;
  /** Font name; null if unspecified. @see lib/common/textspan.h:textfont_t.name */
  fontName: string | null;
  /** Font size in points; negative if unspecified. @see lib/common/textspan.h:textfont_t.size */
  fontSize: number;
  /** Font color; null if unspecified. @see lib/common/textspan.h:textfont_t.color */
  fontColor: string | null;
  /** HTML font flags (HTML_BF, HTML_IF, HTML_UL, etc.). @see lib/common/textspan.h:textfont_t.flags */
  fontFlags: number;
  /**
   * Vertical offset from layout baseline.
   * @see lib/common/textspan.h:textspan_t.yoffset_layout
   */
  yoffset_layout: number;
  /**
   * Vertical offset from centerline.
   * @see lib/common/textspan.h:textspan_t.yoffset_centerline
   */
  yoffset_centerline: number;
  /** Measured text size in points. @see lib/common/textspan.h:textspan_t.size */
  size: Point;
  /**
   * Justification: 'l' left, 'n' centered, 'r' right.
   * @see lib/common/textspan.h:textspan_t.just
   */
  just: 'l' | 'n' | 'r';
}

// ---------------------------------------------------------------------------
// RenderJob — replaces GVJ_t for the rendering dispatch layer
// ---------------------------------------------------------------------------

/**
 * Lightweight render job context replacing GVJ_t.
 * Per AD-2, the C plugin vtable is replaced by a direct Renderer reference.
 *
 * @see lib/gvc/gvcext.h:GVJ_t
 */
export interface RenderJob {
  /** Root graph being rendered. */
  g: Graph;
  /** Renderer implementation that receives rendering callbacks. */
  renderer: Renderer;
  /**
   * Graph bounding-box height in points.
   * Used for Y-axis flip when the renderer uses Y-down coordinates (e.g. SVG).
   */
  graphHeight: number;
}

// ---------------------------------------------------------------------------
// Renderer — replaces the C gvrender_engine_t vtable
// ---------------------------------------------------------------------------

/**
 * Renderer callback interface, replacing the GVJ_t function-pointer vtable.
 * Each method corresponds to one gvrender_* call in the C source.
 *
 * Per AD-2, the layer/pagination/viewport machinery is entirely absent here.
 * Rendering is always single-layer, single-page.
 *
 * @see lib/gvc/gvcext.h:gvrender_engine_t
 */
export interface Renderer {
  /**
   * Called once before any graph content.
   * @see lib/common/emit.c:emit_begin_graph → gvrender_begin_graph
   */
  beginGraph(g: Graph, job: RenderJob): void;

  /**
   * Called once after all graph content.
   * @see lib/common/emit.c:emit_end_graph → gvrender_end_graph
   */
  endGraph(g: Graph, job: RenderJob): void;

  /**
   * Called before rendering a cluster's contents.
   * @see lib/common/emit.c:emit_begin_cluster → gvrender_begin_cluster
   */
  beginCluster(g: Graph, job: RenderJob): void;

  /**
   * Called after rendering a cluster's contents.
   * @see lib/common/emit.c:emit_end_cluster → gvrender_end_cluster
   */
  endCluster(g: Graph, job: RenderJob): void;

  /**
   * Called before rendering a node's shapes.
   * @see lib/common/emit.c:emit_begin_node → gvrender_begin_node
   */
  beginNode(n: Node, job: RenderJob): void;

  /**
   * Called after rendering a node's shapes.
   * @see lib/common/emit.c:emit_end_node → gvrender_end_node
   */
  endNode(n: Node, job: RenderJob): void;

  /**
   * Called before rendering an edge's splines.
   * @see lib/common/emit.c:emit_begin_edge → gvrender_begin_edge
   */
  beginEdge(e: Edge, job: RenderJob): void;

  /**
   * Called after rendering an edge's splines and labels.
   * @see lib/common/emit.c:emit_end_edge → gvrender_end_edge
   */
  endEdge(e: Edge, job: RenderJob): void;

  /**
   * Emit a single text span at position pos.
   * @see lib/common/emit.c → gvrender_textspan
   * @see lib/common/labels.c:emit_label
   */
  textspan(pos: Point, span: TextSpan, job: RenderJob): void;

  /**
   * Emit an ellipse whose bounding box is defined by (pos, rx, ry).
   * @see lib/common/emit.c → gvrender_ellipse
   */
  ellipse(
    pos: Point,
    rx: number,
    ry: number,
    filled: boolean,
    job: RenderJob,
  ): void;

  /**
   * Emit a filled or stroked polygon.
   * @see lib/common/emit.c → gvrender_polygon
   */
  polygon(pts: Point[], filled: boolean, job: RenderJob): void;

  /**
   * Emit a Bezier curve.
   * @see lib/common/emit.c → gvrender_beziercurve
   */
  bezier(pts: Point[], filled: boolean, job: RenderJob): void;

  /**
   * Emit a polyline (open, not filled).
   * @see lib/common/emit.c → gvrender_polyline
   */
  polyline(pts: Point[], job: RenderJob): void;

  /**
   * Set the current fill color.
   * @see lib/common/emit.c → gvrender_set_fillcolor
   */
  fillColor(color: string, job: RenderJob): void;

  /**
   * Set the current pen (stroke) color.
   * @see lib/common/emit.c → gvrender_set_pencolor
   */
  penColor(color: string, job: RenderJob): void;

  /**
   * Set the current font name and size.
   * @see lib/common/emit.c → gvrender_set_font
   */
  font(size: number, name: string, job: RenderJob): void;

  /**
   * Apply a style string token.
   * @see lib/common/emit.c → gvrender_set_style
   */
  style(s: string, job: RenderJob): void;
}

// ---------------------------------------------------------------------------
// XdotOpKind — @see lib/xdot/xdot.h:xdot_kind
// ---------------------------------------------------------------------------

/**
 * Discriminant for each xdot operation kind.
 * Only the subset actually dispatched in emitXdot is listed here.
 *
 * @see lib/xdot/xdot.h:xdot_kind
 */
export type XdotOpKind =
  | 'filled_ellipse'
  | 'unfilled_ellipse'
  | 'filled_polygon'
  | 'unfilled_polygon'
  | 'filled_bezier'
  | 'unfilled_bezier'
  | 'polyline'
  | 'text'
  | 'fill_color'
  | 'pen_color'
  | 'font'
  | 'style';

/**
 * A single xdot drawing operation.
 * Corresponds to xdot_op in lib/xdot/xdot.h, with the union discriminated.
 *
 * @see lib/xdot/xdot.h:xdot_op
 */
export type XdotOp =
  | {
      kind: 'filled_ellipse' | 'unfilled_ellipse';
      x: number;
      y: number;
      w: number;
      h: number;
    }
  | {
      kind: 'filled_polygon' | 'unfilled_polygon';
      pts: Point[];
    }
  | {
      kind: 'filled_bezier' | 'unfilled_bezier';
      pts: Point[];
    }
  | {
      kind: 'polyline';
      pts: Point[];
    }
  | {
      kind: 'text';
      x: number;
      y: number;
      span: TextSpan;
    }
  | {
      kind: 'fill_color';
      color: string;
    }
  | {
      kind: 'pen_color';
      color: string;
    }
  | {
      kind: 'font';
      size: number;
      name: string;
    }
  | {
      kind: 'style';
      style: string;
    };
