// SPDX-License-Identifier: EPL-2.0

/**
 * XDot operation dispatcher and label emitter.
 *
 * @see lib/common/emit.c:emit_xdot (line 1362)
 * @see lib/common/labels.c:emit_label (line 217)
 */

import type { Point } from '../model/geom.js';
import type { TextlabelT } from '../common/types.js';
import type { XdotOp, RenderJob, TextSpan } from './emit-types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default pen color string. @see lib/common/const.h:DEFAULT_COLOR */
export const DEFAULT_COLOR = 'black';

/** Default fill color string. @see lib/common/const.h:DEFAULT_FILL */
export const DEFAULT_FILL = 'lightgrey';

// ---------------------------------------------------------------------------
// XdotShapeDispatch — shape/geometry xdot operations
// ---------------------------------------------------------------------------

/** Dispatches shape-drawing xdot operations. Separate class for CCN budget. */
class XdotShapeDispatch {
  /**
   * Dispatch an ellipse operation.
   * @see lib/common/emit.c:emit_xdot case xd_filled_ellipse/xd_unfilled_ellipse
   */
  static ellipse(
    op: Extract<XdotOp, { kind: 'filled_ellipse' | 'unfilled_ellipse' }>,
    job: RenderJob,
  ): void {
    const filled = op.kind === 'filled_ellipse';
    job.renderer.ellipse({ x: op.x, y: op.y }, op.w, op.h, filled, job);
  }

  /**
   * Dispatch a polygon operation.
   * @see lib/common/emit.c:emit_xdot case xd_filled_polygon/xd_unfilled_polygon
   */
  static polygon(
    op: Extract<XdotOp, { kind: 'filled_polygon' | 'unfilled_polygon' }>,
    job: RenderJob,
  ): void {
    const filled = op.kind === 'filled_polygon';
    job.renderer.polygon(op.pts, filled, job);
  }

  /**
   * Dispatch a bezier operation.
   * @see lib/common/emit.c:emit_xdot case xd_filled_bezier/xd_unfilled_bezier
   */
  static bezier(
    op: Extract<XdotOp, { kind: 'filled_bezier' | 'unfilled_bezier' }>,
    job: RenderJob,
  ): void {
    const filled = op.kind === 'filled_bezier';
    job.renderer.bezier(op.pts, filled, job);
  }

  /**
   * Dispatch a polyline operation.
   * @see lib/common/emit.c:emit_xdot case xd_polyline
   */
  static polyline(
    op: Extract<XdotOp, { kind: 'polyline' }>,
    job: RenderJob,
  ): void {
    job.renderer.polyline(op.pts, job);
  }

  /**
   * Try to dispatch a shape-type op. Returns true if handled.
   * @see lib/common/emit.c:emit_xdot shape cases
   */
  static tryDispatch(op: XdotOp, job: RenderJob): boolean {
    if (op.kind === 'filled_ellipse' || op.kind === 'unfilled_ellipse') {
      XdotShapeDispatch.ellipse(op, job);
      return true;
    }
    if (op.kind === 'filled_polygon' || op.kind === 'unfilled_polygon') {
      XdotShapeDispatch.polygon(op, job);
      return true;
    }
    if (op.kind === 'filled_bezier' || op.kind === 'unfilled_bezier') {
      XdotShapeDispatch.bezier(op, job);
      return true;
    }
    if (op.kind === 'polyline') {
      XdotShapeDispatch.polyline(op, job);
      return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// XdotAttrDispatch — attribute-setting xdot operations
// ---------------------------------------------------------------------------

/** Dispatches attribute-setting xdot operations. */
class XdotAttrDispatch {
  /**
   * Dispatch a text operation.
   * @see lib/common/emit.c:emit_xdot case xd_text
   */
  static text(
    op: Extract<XdotOp, { kind: 'text' }>,
    job: RenderJob,
  ): void {
    const pt: Point = { x: op.x, y: op.y };
    job.renderer.textspan(pt, op.span, job);
  }

  /**
   * Try to dispatch an attribute-type op. Returns true if handled.
   * @see lib/common/emit.c:emit_xdot attribute cases
   */
  static tryDispatch(op: XdotOp, job: RenderJob): boolean {
    if (op.kind === 'text') {
      XdotAttrDispatch.text(op, job);
      return true;
    }
    if (op.kind === 'fill_color') {
      job.renderer.fillColor(op.color, job);
      return true;
    }
    if (op.kind === 'pen_color') {
      job.renderer.penColor(op.color, job);
      return true;
    }
    if (op.kind === 'font') {
      job.renderer.font(op.size, op.name, job);
      return true;
    }
    if (op.kind === 'style') {
      job.renderer.style(op.style, job);
      return true;
    }
    return false;
  }
}

// ---------------------------------------------------------------------------
// emitXdot — public
// ---------------------------------------------------------------------------

/**
 * Dispatch an array of xdot operations to the renderer.
 *
 * Gradient color and image operations are not ported (AD-2).
 * The `styles` reset after the loop (C line 1472) is omitted because
 * the renderer owns style state.
 *
 * @see lib/common/emit.c:emit_xdot (line 1362)
 */
export function emitXdot(ops: XdotOp[], job: RenderJob): void {
  for (const op of ops) {
    if (XdotShapeDispatch.tryDispatch(op, job)) continue;
    XdotAttrDispatch.tryDispatch(op, job);
  }
}

// ---------------------------------------------------------------------------
// LabelYHelper — y-position computation for emitLabel
// ---------------------------------------------------------------------------

/**
 * Compute the starting y-position for a plain-text label.
 * Matches the C valign switch in emit_label / labels.c.
 *
 * @see lib/common/labels.c:emit_label (line 240)
 */
class LabelYHelper {
  /** Compute y start for valign 't' (top). */
  static top(pos: Point, space: Point, fontsize: number): number {
    return pos.y + space.y / 2.0 - fontsize;
  }

  /** Compute y start for valign 'b' (bottom). */
  static bottom(
    pos: Point,
    space: Point,
    dimen: Point,
    fontsize: number,
  ): number {
    return pos.y - space.y / 2.0 + dimen.y - fontsize;
  }

  /** Compute y start for valign center (default). */
  static center(pos: Point, dimen: Point, fontsize: number): number {
    return pos.y + dimen.y / 2.0 - fontsize;
  }

  /** Compute starting y based on valign char code. @see labels.c:emit_label */
  static compute(lp: TextlabelT): number {
    const valign = String.fromCharCode(lp.valign);
    if (valign === 't') {
      return LabelYHelper.top(lp.pos, lp.space, lp.fontsize);
    }
    if (valign === 'b') {
      return LabelYHelper.bottom(lp.pos, lp.space, lp.dimen, lp.fontsize);
    }
    return LabelYHelper.center(lp.pos, lp.dimen, lp.fontsize);
  }
}

// ---------------------------------------------------------------------------
// LabelSpanHelper — per-span x-position
// ---------------------------------------------------------------------------

/** Computes x-position for a label span based on justification. */
class LabelSpanHelper {
  /** X for left-justified span. */
  static xLeft(pos: Point, space: Point): number {
    return pos.x - space.x / 2.0;
  }

  /** X for right-justified span. */
  static xRight(pos: Point, space: Point): number {
    return pos.x + space.x / 2.0;
  }

  /** Compute x for span given its justification. @see labels.c:emit_label */
  static xForSpan(span: TextSpan, lp: TextlabelT): number {
    if (span.just === 'l') {
      return LabelSpanHelper.xLeft(lp.pos, lp.space);
    }
    if (span.just === 'r') {
      return LabelSpanHelper.xRight(lp.pos, lp.space);
    }
    return lp.pos.x;
  }
}

// ---------------------------------------------------------------------------
// emitLabel — public
// ---------------------------------------------------------------------------

/**
 * Emit all text spans of a plain-text label.
 *
 * HTML labels and the obj_state emit_state machinery are not ported (AD-2).
 * `gvrender_begin_label` / `gvrender_end_label` are omitted — the Renderer
 * interface does not include them per AD-2.
 *
 * @see lib/common/labels.c:emit_label (line 217)
 */
export function emitLabel(lp: TextlabelT, job: RenderJob): void {
  if (lp.html) return; // HTML labels not ported (AD-2)
  if (lp.u.kind !== 'txt') return;
  if (lp.u.nspans < 1) return;

  job.renderer.penColor(lp.fontcolor, job);

  let y = LabelYHelper.compute(lp);

  for (let i = 0; i < lp.u.nspans; i++) {
    const span = lp.u.span[i] as TextSpan | undefined;
    if (span === undefined) break;
    const x = LabelSpanHelper.xForSpan(span, lp);
    job.renderer.textspan({ x, y }, span, job);
    y -= span.size.y;
  }
}
