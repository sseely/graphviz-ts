// SPDX-License-Identifier: EPL-2.0
//
// Edge label emission with per-label `<a>` hot spots — the SVG-relevant half of
// emit_edge's emit_edge_label calls. Each of the center label, xlabel, head
// label, and tail label is wrapped in its own anchor when it carries a url or
// an explicit tooltip (siblings of the whole-edge anchor, not nested).
//
// @see lib/common/emit.c:emit_edge (3010-3025)
// @see lib/common/emit.c:emit_edge_label (2882)

import type { Edge } from '../model/edge.js';
import type { TextlabelT } from '../common/types.js';
import type { RendererPlugin } from './context.js';
import type { RenderJob } from './job.js';
import { EmitState } from './job.js';
import { openAnchorWith } from './anchor.js';
import { renderOneLabel, transformPoint } from './device.js';
import { dotneatoClosest } from '../common/spline-midpoint.js';
import { mapbool } from '../layout/dot/rank.js';
import type { Spline } from '../model/geom.js';

/**
 * Emit all four edge label slots in C order: label, xlabel, head, tail. Must
 * run inside the edge group, after the path and arrow polygons.
 * @see lib/common/emit.c:emit_end_edge (3010-3025)
 */
export function renderEdgeLabels(e: Edge, renderer: RendererPlugin, job: RenderJob): void {
  const obj = job.obj;
  // C passes ED_spl to the label/xlabel emits when decorate=true, and
  // emit_attachment then draws the label-to-spline polyline.
  // @see lib/common/emit.c:3013-3017
  const spl = mapbool(e.attrs.get('decorate') ?? 'false') ? e.info.spl : undefined;
  if (obj === null) {
    renderOneLabel(e.info.label as TextlabelT | undefined, renderer, job);
    if (spl) emitAttachment(e.info.label as TextlabelT | undefined, spl, renderer, job);
    renderOneLabel(e.info.xlabel as TextlabelT | undefined, renderer, job);
    if (spl) emitAttachment(e.info.xlabel as TextlabelT | undefined, spl, renderer, job);
    renderOneLabel(e.info.head_label, renderer, job);
    renderOneLabel(e.info.tail_label, renderer, job);
    return;
  }
  const id = obj.id ?? '';
  const labelHs: LabelHotspot =
    { url: obj.labelUrl, tooltip: obj.labelTooltip, target: obj.labelTarget, explicit: obj.explicitLabelTooltip };
  // @see lib/common/emit.c:emit_edge (3010-3025) — per-label hot spots.
  emitEdgeLabel(e.info.label as TextlabelT | undefined, `${id}-label`, labelHs, renderer, job, spl);
  emitEdgeLabel(e.info.xlabel as TextlabelT | undefined, `${id}-label`, labelHs, renderer, job, spl);
  emitEdgeLabel(e.info.head_label as TextlabelT | undefined, `${id}-headlabel`,
    { url: obj.headUrl, tooltip: obj.headTooltip, target: obj.headTarget, explicit: obj.explicitHeadTooltip },
    renderer, job, undefined, EmitState.HLabel);
  emitEdgeLabel(e.info.tail_label as TextlabelT | undefined, `${id}-taillabel`,
    { url: obj.tailUrl, tooltip: obj.tailTooltip, target: obj.tailTarget, explicit: obj.explicitTailTooltip },
    renderer, job, undefined, EmitState.TLabel);
}

/** Per-label hot-spot fields, mirroring the emit_edge_label args. */
interface LabelHotspot {
  url: string | null;
  tooltip: string | null;
  target: string | null;
  explicit: boolean;
}

/**
 * Emit one edge label, wrapping it in its own `<a>` hot spot when the label has
 * a url or an explicit tooltip. The label's baseline emission is unchanged; only
 * the anchor wrap is added. id is the full anchor id (`<edgeId>-label`).
 * @see lib/common/emit.c:emit_edge_label (2882)
 */
function emitEdgeLabel(
  lp: TextlabelT | undefined,
  id: string,
  hs: LabelHotspot,
  renderer: RendererPlugin,
  job: RenderJob,
  spl?: Spline,
  emitState?: EmitState,
): void {
  if (!lp?.set) return; // emit_edge_label: lbl == NULL || !lbl->set
  const open = hs.url !== null || hs.explicit;
  if (open) openAnchorWith(renderer, job, hs.url, hs.tooltip, hs.target, id);
  // Head/tail labels route to EMIT_HLABEL/EMIT_TLABEL (→ _hldraw_/_tldraw_);
  // the center label keeps its default EMIT_ELABEL. @see emit.c:emit_edge
  const savedOverride = job.labelEmitOverride;
  if (emitState !== undefined) job.labelEmitOverride = emitState;
  try {
    renderOneLabel(lp, renderer, job);
  } finally {
    job.labelEmitOverride = savedOverride;
  }
  if (spl) emitAttachment(lp, spl, renderer, job); // emit.c:2918
  if (open) renderer.endAnchor?.(job);
}

/**
 * Label-to-spline attachment polyline (decorate=true): from the label's
 * bottom-right corner, along the bottom edge to bottom-left, then to the
 * closest point on the spline. Skipped for all-whitespace label text. Drawn
 * with the DEFAULT line style and the label's fontcolor, not the edge style.
 * @see lib/common/emit.c:emit_attachment (1870-1894)
 */
function emitAttachment(
  lp: TextlabelT | undefined,
  spl: Spline,
  renderer: RendererPlugin,
  job: RenderJob,
): void {
  if (!lp?.set) return;
  if (!/\S/.test(lp.text ?? '')) return; // C: skip all-whitespace text
  const sz = lp.dimen;
  const a0 = { x: lp.pos.x + sz.x / 2, y: lp.pos.y - sz.y / 2 };
  const a1 = { x: a0.x - sz.x, y: a0.y };
  const a2 = dotneatoClosest(spl, lp.pos);
  const pts = [a0, a1, a2].map((pt) => transformPoint(pt, job));
  renderer.attachmentPolyline?.(pts, lp.fontcolor || 'black', job);
}
