// SPDX-License-Identifier: EPL-2.0

/**
 * Public API for structured xdot draw-op access.
 *
 * Lays out a Graph, renders it to the xdot format, parses the xdot
 * attribute strings back into typed XdotOp values, and returns a flat
 * op stream the caller can feed to any drawing backend (canvas, WebGL,
 * PDF, native UI) without touching SVG.
 *
 * This wrapper is a thin, faithful exposure of whatever the xdot renderer
 * emits — it adds no draw ops of its own.
 *
 * KNOWN LIMITATION (xdot renderer, not this wrapper): the underlying xdot
 * renderer (`createXdotRenderer` in `render/dot.ts`) is currently
 * integration-incomplete relative to native `dot -Txdot`:
 *   - edges emit no `_draw_` ops (no spline/arrowhead draw ops surface here);
 *   - custom node pen/fill colors are not applied to the emitted ops;
 *   - node draw-op coordinates can be mismatched between nodes.
 * Node shape ops (ellipse/polygon), text/label ops, and font ops are
 * emitted and surface correctly. The geometry itself is fully computed
 * (the SVG renderer draws the same graph correctly); only the xdot
 * emission path is incomplete. A faithful fix is tracked as a follow-on
 * mission (see plans/expose-library-api/decision-journal.md, 2026-06-21).
 *
 * @see lib/xdot/xdot.h
 * @see plugin/core/gvrender_core_dot.c (FORMAT_XDOT)
 */

import type { XdotOp } from '../xdot/types.js';
import { Graph } from '../model/graph.js';
import { parse } from '../parser/index.js';
import { render as gvcRender } from '../gvc/device.js';
import { createDefaultContext } from '../gvc/default-context.js';
import { parseXDot } from '../xdot/index.js';
import type { EngineName } from '../gvc/context.js';
import { RenderError } from '../errors.js';
import type { GvError } from '../errors.js';

/**
 * `Xdot` — the parsed result of one xdot attribute stream: `ops` (the
 * decoded draw-op array) plus `flags` (parse status bits).
 *
 * `XdotOp` — a single decoded xdot drawing operation, discriminated by its
 * `kind` field (e.g. `filled_ellipse`, `filled_polygon`, `filled_bezier`,
 * `polyline`, `text`, `fill_color`, `pen_color`, `grad_fill_color`,
 * `grad_pen_color`, `font`, `style`, `image`, `fontchar`). Each variant
 * carries one payload property named for its shape (`ellipse`, `polygon`,
 * `bezier`, `polyline`, `text`, `color`, `gradColor`, `font`, `style`,
 * `image`, `fontchar`) — narrow on `kind` in a switch to access it safely.
 *
 * `XdotColor` — a resolved xdot fill/pen color: `{ type: 'none', clr }` for
 * a solid color, or a linear/radial gradient (`{ type: 'linear', ling }` /
 * `{ type: 'radial', ring }`).
 *
 * @see lib/xdot/xdot.h:xdot
 * @see lib/xdot/xdot.h:xdot_op (`_xdot_op`)
 * @see lib/xdot/xdot.h:xdot_color
 */
export type { Xdot, XdotOp, XdotColor } from '../xdot/index.js';

/** Options for {@link getDrawOps}. */
export interface DrawOpsOptions {
  /** Layout engine to use. Defaults to `'dot'`. */
  engine?: EngineName;
}

/** Default layout engine used by {@link getDrawOps}. */
export const DEFAULT_DRAW_ENGINE: EngineName = 'dot';

/**
 * xdot attribute keys that carry draw-op streams.
 * @see plugin/core/gvrender_core_dot.c xdot_obj_attr_names
 */
const XDOT_DRAW_ATTRS = [
  '_draw_', '_ldraw_', '_hdraw_', '_tdraw_', '_hldraw_', '_tldraw_',
] as const;

function isGvErrorLike(err: unknown): err is GvError {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { type?: unknown }).type === 'string' &&
    typeof (err as { code?: unknown }).code === 'string'
  );
}

/** Re-throw GvError-like values; otherwise wrap as RENDER_ERROR. */
function rethrowAsRender(err: unknown): never {
  if (isGvErrorLike(err)) throw err;
  const msg = err instanceof Error ? err.message : String(err);
  throw new RenderError(msg, 'RENDER_ERROR');
}

/** Append XdotOps found in `attrs` for each xdot draw key into `out`. */
function appendAttrsOps(attrs: Map<string, string>, out: XdotOp[]): void {
  for (const key of XDOT_DRAW_ATTRS) {
    const val = attrs.get(key);
    if (val === undefined) continue;
    const parsed = parseXDot(val);
    if (parsed !== null) out.push(...parsed.ops);
  }
}

function collectGraphOps(xdotGraph: Graph): XdotOp[] {
  const ops: XdotOp[] = [];
  appendAttrsOps(xdotGraph.attrs, ops);
  for (const n of xdotGraph.nodes.values()) appendAttrsOps(n.attrs, ops);
  for (const e of xdotGraph.edges) appendAttrsOps(e.attrs, ops);
  return ops;
}

function layoutAndRenderXdot(g: Graph, engine: EngineName): string {
  const ctx = createDefaultContext();
  try {
    ctx.layout(g, engine);
    const src = gvcRender(ctx, g, 'xdot');
    ctx.freeLayout(g, engine);
    return src;
  } catch (err: unknown) {
    rethrowAsRender(err);
  }
}

/**
 * Lay out `g`, render to xdot, parse every draw-attribute stream, and
 * return all ops as a flat `XdotOp[]` in paint order (graph → node → edge).
 *
 * Consumers discriminate on the `kind` field of the `XdotOp` union —
 * no string parsing required.
 *
 * @param g    - A Graph from `parse()` or the builder API.
 * @param opts - Optional: `{ engine }` overrides the default `'dot'`.
 * @returns Flat typed draw-op array covering the full graph.
 * @throws ParseError  if the xdot DOT output cannot be re-parsed.
 * @throws RenderError if layout or rendering fails.
 *
 * @example
 * ```ts
 * import { parse } from '@knowvah/dot-engine';
 * import { getDrawOps } from 'graphviz-ts/render';
 *
 * const g = parse('digraph { a -> b; }');
 * for (const op of getDrawOps(g)) {
 *   switch (op.kind) {
 *     case 'filled_ellipse':
 *     case 'unfilled_ellipse':
 *       drawEllipse(op.ellipse);
 *       break;
 *     case 'text':
 *       drawText(op.text);
 *       break;
 *     // ...handle the remaining XdotOp kinds
 *   }
 * }
 * ```
 *
 * @see lib/xdot/xdot.h
 * @see lib/gvc/gvc.h:gvRender
 */
export function getDrawOps(g: Graph, opts?: DrawOpsOptions): XdotOp[] {
  const engine = opts?.engine ?? DEFAULT_DRAW_ENGINE;
  return collectGraphOps(parse(layoutAndRenderXdot(g, engine)));
}
