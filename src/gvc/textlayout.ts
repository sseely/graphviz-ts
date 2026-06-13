// SPDX-License-Identifier: EPL-2.0

/**
 * Text layout selection and measurement.
 *
 * Ports gvtextlayout_select and gvtextlayout from lib/gvc/gvtextlayout.c,
 * simplified for the TypeScript model where the text-layout engine is always
 * the context's registered TextMeasurer (no dynamic plugin loading).
 *
 * @see lib/gvc/gvtextlayout.c:gvtextlayout_select
 * @see lib/gvc/gvtextlayout.c:gvtextlayout
 */

import type { GvcContext } from './context.js';
import type { TextMeasurer } from '../common/textmeasure.js';
import type { TextSpan } from '../common/emit-types.js';

/**
 * Return the text measurer registered on ctx.
 *
 * Replaces gvtextlayout_select / plugin load with direct access to the
 * context's measurer, per AD-2 (static registration, no libltdl).
 *
 * @see lib/gvc/gvtextlayout.c:gvtextlayout_select
 */
export function selectTextLayout(ctx: GvcContext): TextMeasurer {
  return ctx.textMeasurer;
}

/**
 * Measure a text span and write the result into span.size.
 *
 * Mirrors gvtextlayout: calls the engine's textlayout method to populate
 * the size field on the span.  Falls back to 'Times-Roman' / 14pt when
 * fontName or fontSize are unspecified.
 *
 * @see lib/gvc/gvtextlayout.c:gvtextlayout
 */
export function measure(span: TextSpan, ctx: GvcContext): void {
  const fontName = span.fontName ?? 'Times-Roman';
  const fontSize = span.fontSize > 0 ? span.fontSize : 14;
  const size = ctx.textMeasurer.measure(span.str, fontName, fontSize);
  span.size = { x: size.w, y: size.h };
}
