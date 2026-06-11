// SPDX-License-Identifier: EPL-2.0

/**
 * Edge rendering dispatch — emitBeginEdge, emitEndEdge, emitEdgeGraphics,
 * emitEdge.
 *
 * URL/map/tooltip/anchor machinery, tapered edges, and multi-color parallel
 * Béziers are not ported per AD-2 (single-layer, no pagination).
 *
 * @see lib/common/emit.c:emit_begin_edge (line 2706)
 * @see lib/common/emit.c:emit_end_edge (line 2964)
 * @see lib/common/emit.c:emit_edge_graphics (line 2350)
 * @see lib/common/emit.c:emit_edge (line 3031)
 */

import type { Edge } from '../model/edge.js';
import type { Graph } from '../model/graph.js';
import type { Bezier, Spline } from '../model/geom.js';
import type { RenderJob } from './emit-types.js';
import type { TextlabelT } from '../common/types.js';
import { emitLabel } from './emit-xdot.js';
import { parseStyle } from './emit-style.js';
import { DEFAULT_COLOR } from './emit-xdot.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read an attribute from a Map<string,string>, returning '' if absent. */
function attr(m: Map<string, string>, key: string): string {
  return m.get(key) ?? '';
}

// ---------------------------------------------------------------------------
// EdgeStyleHelper — style parsing and "invis" detection
// ---------------------------------------------------------------------------

/**
 * Style helpers for edge rendering.
 * @see lib/common/emit.c:emit_edge (line 3060)
 */
class EdgeStyleHelper {
  /** Returns true when a parsed style list contains "invis". */
  static hasInvis(styles: string[]): boolean {
    for (const s of styles) {
      if (s === 'invis') return true;
    }
    return false;
  }

  /**
   * Parse the edge style attribute.
   * Returns null when no style, empty array on parse error, or token list.
   */
  static parse(e: Edge): string[] | null {
    const style = attr(e.attrs, 'style');
    if (style.length === 0) return null;
    return parseStyle(style);
  }
}

// ---------------------------------------------------------------------------
// emitBeginEdge — public
// ---------------------------------------------------------------------------

/**
 * Begin rendering an edge: call renderer.beginEdge.
 *
 * Style and penwidth setup are performed in emitEdgeGraphics.
 * URL/map/anchor machinery is not ported (AD-2).
 *
 * @see lib/common/emit.c:emit_begin_edge (line 2706)
 */
export function emitBeginEdge(e: Edge, job: RenderJob): void {
  job.renderer.beginEdge(e, job);
}

// ---------------------------------------------------------------------------
// emitEndEdge — public
// ---------------------------------------------------------------------------

/**
 * End rendering an edge: emit labels then call renderer.endEdge.
 *
 * Only plain-text labels are emitted. URL/anchor/map machinery from the C
 * source is not ported (AD-2).
 *
 * @see lib/common/emit.c:emit_end_edge (line 2964)
 */
export function emitEndEdge(e: Edge, job: RenderJob): void {
  emitEdgeLabels(e, job);
  job.renderer.endEdge(e, job);
}

// ---------------------------------------------------------------------------
// EdgeLabelHelper — label emission for all four edge label slots
// ---------------------------------------------------------------------------

/** Emit one optional edge label if present and positioned. */
class EdgeLabelHelper {
  static emit(lp: TextlabelT | undefined, job: RenderJob): void {
    if (lp === undefined) return;
    if (!lp.set) return;
    emitLabel(lp, job);
  }
}

/**
 * Emit all four label slots for an edge (label, xlabel, head_label, tail_label).
 * @see lib/common/emit.c:emit_end_edge (line 3010)
 */
function emitEdgeLabels(e: Edge, job: RenderJob): void {
  EdgeLabelHelper.emit(e.info.label, job);
  EdgeLabelHelper.emit(e.info.xlabel, job);
  EdgeLabelHelper.emit(e.info.head_label, job);
  EdgeLabelHelper.emit(e.info.tail_label, job);
}

// ---------------------------------------------------------------------------
// EdgeColorHelper — resolve pen/fill colors for single-color edges
// ---------------------------------------------------------------------------

/**
 * Resolve pen and fill colors for a single-color (no multi-color) edge.
 * Applies GUI_STATE_ACTIVE/SELECTED overrides.
 * @see lib/common/emit.c:emit_edge_graphics (line 2397)
 */
class EdgeColorHelper {
  /** GUI_STATE_ACTIVE bitmask. @see lib/common/types.h:GUI_STATE_ACTIVE */
  private static readonly GUI_STATE_ACTIVE = 1 << 0;
  /** GUI_STATE_SELECTED bitmask. @see lib/common/types.h:GUI_STATE_SELECTED */
  private static readonly GUI_STATE_SELECTED = 1 << 1;
  /** GUI_STATE_DELETED bitmask. @see lib/common/types.h:GUI_STATE_DELETED */
  private static readonly GUI_STATE_DELETED = 1 << 3;
  /** GUI_STATE_VISITED bitmask. @see lib/common/types.h:GUI_STATE_VISITED */
  private static readonly GUI_STATE_VISITED = 1 << 2;

  private static readonly ACTIVE_PEN = '#ff0000';
  private static readonly ACTIVE_FILL = '#ff0000';
  private static readonly SELECTED_PEN = '#0000ff';
  private static readonly SELECTED_FILL = '#0000ff';
  private static readonly DELETED_PEN = '#999999';
  private static readonly DELETED_FILL = '#999999';
  private static readonly VISITED_PEN = '#00bb00';
  private static readonly VISITED_FILL = '#00bb00';

  static resolve(e: Edge, color: string): { pen: string; fill: string } {
    const gs = e.info.gui_state ?? 0;
    if (gs & EdgeColorHelper.GUI_STATE_ACTIVE) {
      return { pen: EdgeColorHelper.ACTIVE_PEN, fill: EdgeColorHelper.ACTIVE_FILL };
    }
    if (gs & EdgeColorHelper.GUI_STATE_SELECTED) {
      return { pen: EdgeColorHelper.SELECTED_PEN, fill: EdgeColorHelper.SELECTED_FILL };
    }
    if (gs & EdgeColorHelper.GUI_STATE_DELETED) {
      return { pen: EdgeColorHelper.DELETED_PEN, fill: EdgeColorHelper.DELETED_FILL };
    }
    if (gs & EdgeColorHelper.GUI_STATE_VISITED) {
      return { pen: EdgeColorHelper.VISITED_PEN, fill: EdgeColorHelper.VISITED_FILL };
    }
    const fillAttr = attr(e.attrs, 'fillcolor');
    const fill = fillAttr.length > 0 ? fillAttr : color;
    return { pen: color, fill };
  }
}

// ---------------------------------------------------------------------------
// EdgeBezierHelper — emit bezier spline segments for a single-color edge
// ---------------------------------------------------------------------------

/**
 * Emit the bezier geometry for a single spline (no multi-color, no tapered).
 * @see lib/common/emit.c:emit_edge_graphics single-color branch (line 2537)
 */
class EdgeBezierHelper {
  /** Set pen and fill colors, then emit bezier curve for each spline segment. */
  static emitSplines(spl: Spline, pen: string, fill: string, job: RenderJob): void {
    const effectivePen = pen.length > 0 ? pen : DEFAULT_COLOR;
    const effectiveFill = fill.length > 0 ? fill : DEFAULT_COLOR;
    job.renderer.penColor(effectivePen, job);
    job.renderer.fillColor(effectiveFill, job);
    for (let i = 0; i < spl.size; i++) {
      const bz = spl.list[i] as Bezier | undefined;
      if (bz === undefined) continue;
      job.renderer.bezier(bz.list, false, job);
    }
  }
}

// ---------------------------------------------------------------------------
// emitEdgeGraphics — public
// ---------------------------------------------------------------------------

/**
 * Emit the graphical elements (splines) for an edge.
 *
 * Multi-color parallel Béziers and tapered edges are not ported (AD-2).
 * The basic single-color path is implemented faithfully.
 *
 * @see lib/common/emit.c:emit_edge_graphics (line 2350)
 */
export function emitEdgeGraphics(e: Edge, job: RenderJob): void {
  const spl = e.info.spl;
  if (spl === undefined) return;

  const color = attr(e.attrs, 'color');
  const { pen, fill } = EdgeColorHelper.resolve(e, color);
  EdgeBezierHelper.emitSplines(spl, pen, fill, job);
}

// ---------------------------------------------------------------------------
// emitEdge — public
// ---------------------------------------------------------------------------

/**
 * Emit a complete edge: style check, begin, graphics, end.
 *
 * Layer/clip box checking is not ported (AD-2).
 *
 * @see lib/common/emit.c:emit_edge (line 3031)
 */
export function emitEdge(e: Edge, _g: Graph, job: RenderJob): void {
  const styles = EdgeStyleHelper.parse(e);
  if (styles !== null && EdgeStyleHelper.hasInvis(styles)) return;

  emitBeginEdge(e, job);
  emitEdgeGraphics(e, job);
  emitEndEdge(e, job);
}
