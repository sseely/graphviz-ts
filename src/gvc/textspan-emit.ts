// SPDX-License-Identifier: EPL-2.0
//
// gvrender_textspan: the single choke point through which every label text
// span is emitted. Mirrors lib/gvc/gvrender.c:gvrender_textspan — a span is
// emitted only when its string is non-empty and (unless there is no object)
// the object's pen is not PEN_NONE. Blank lines (zero-length spans, e.g. the
// leading "\n\n" of a "\n\nDecl" record field) and PEN_NONE objects are
// skipped; callers still advance their text baseline unconditionally so blank
// lines reserve vertical space.

import type { Point } from '../model/geom.js';
import type { TextSpan } from '../common/emit-types.js';
import type { RendererPlugin } from './context.js';
import { PenType } from './context.js';
import type { RenderJob } from './job.js';

/**
 * Whether a label span should be emitted: non-empty string, and (unless no
 * obj) a visible pen.
 * @see lib/gvc/gvrender.c:419 gvrender_textspan
 *   if (span->str && span->str[0] && (!job->obj || job->obj->pen != PEN_NONE))
 */
export function spanIsVisible(span: TextSpan, job: RenderJob): boolean {
  if (span.str.length === 0) return false;
  return job.obj === null || job.obj.pen !== PenType.None;
}

/**
 * Emit one text span through the renderer, applying C's visibility guard.
 * All label emitters (node/record labels, edge/graph labels, cluster labels,
 * HTML-table text runs) route through here, exactly as C routes every
 * emission through gvrender_textspan.
 * @see lib/gvc/gvrender.c:414 gvrender_textspan
 */
export function gvrenderTextspan(
  renderer: RendererPlugin,
  pos: Point,
  span: TextSpan,
  job: RenderJob,
): void {
  if (spanIsVisible(span, job)) {
    renderer.textspan(pos, span, job);
  }
}
