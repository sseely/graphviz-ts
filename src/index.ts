// SPDX-License-Identifier: EPL-2.0

/**
 * Public entry point for the graphviz-ts library.
 *
 * Wires together the parser, layout engines, SVG renderer, and GVC
 * orchestration layer into a single renderSvg function.
 *
 * @see lib/gvc/gvc.h
 */

import { parse } from './parser/index.js';
import { RenderError } from './errors.js';
import type { GvError, RenderResult } from './errors.js';
import type { EngineName } from './gvc/context.js';
import { render as deviceRender } from './gvc/device.js';
import { createDefaultContext } from './gvc/default-context.js';

/**
 * Duck-type a thrown value as a {@link GvError}: an object carrying a string
 * `type` and a string `code`. Covers `ParseError`, `HtmlParseError`, and
 * `RenderError` without per-subclass `instanceof`.
 */
function isGvErrorLike(err: unknown): err is GvError {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { type?: unknown }).type === 'string' &&
    typeof (err as { code?: unknown }).code === 'string'
  );
}

/* v8 ignore start -- defensive normalizers for non-Error / genuinely-unknown
   throws. Unreachable via the public API (renderSvg normalizes every throw to
   GvError-like; parse only throws ParseError) but mandated by ADR-3 and the
   render wrap. */
function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
function renderErrorFromUnknown(err: unknown): RenderError {
  return new RenderError(messageOf(err), 'GENERIC_ERROR');
}
/* v8 ignore stop */

/**
 * Normalize any thrown value to a plain, JSON-serializable {@link GvError}
 * (no stack). Structured throws are copied; unknown throws → `GENERIC_ERROR`.
 */
function classifyError(err: unknown): GvError {
  /* v8 ignore next -- the unknown-throw fallback is unreachable via the public
     API (see helpers above); ADR-3 still mandates it. */
  const gv: GvError = isGvErrorLike(err) ? err : renderErrorFromUnknown(err);
  const out: GvError = {
    type: gv.type, code: gv.code, message: gv.message, friendlyMessage: gv.friendlyMessage,
  };
  if (gv.location !== undefined) out.location = gv.location;
  if (gv.expected !== undefined) out.expected = gv.expected;
  return out;
}

/**
 * Render a DOT-language string to SVG using the specified layout engine.
 *
 * Always throws a value implementing {@link GvError}: parse failures throw
 * `ParseError`; layout/render failures surface as `RenderError`
 * (`RENDER_ERROR`).
 *
 * @remarks
 * Security: when `dotSource` is untrusted, treat the returned SVG as
 * attacker-controlled markup. Attribute values are XML-escaped (no element or
 * attribute breakout), but URL schemes and resource origins in `href`/`URL`/
 * `image`/`stylesheet` are passed through unfiltered, matching native Graphviz.
 * Embedding pages should apply a Content-Security-Policy (or sanitize the
 * markup) — see the "Security" section of the README.
 *
 * @param dotSource - DOT-language graph source
 * @param engine    - layout engine name ({@link EngineName}): a built-in
 *                    ('dot', 'neato', 'fdp', 'sfdp', 'circo', 'twopi',
 *                    'osage', 'patchwork') or any custom-registered name
 * @returns SVG string
 * @throws ParseError if dotSource is not valid DOT
 * @throws RenderError if layout or rendering fails
 */
export function renderSvg(dotSource: string, engine: EngineName): string {
  const ctx = createDefaultContext();
  try {
    // parse() is inside the try so any non-ParseError throw (e.g. a raw
    // RangeError from stack exhaustion) is still normalized to a GvError,
    // honoring the "always throws a value implementing GvError" contract.
    const g = parse(dotSource);
    ctx.layout(g, engine);
    const svg = deviceRender(ctx, g, 'svg');
    // C: gvFreeLayout runs after gvRenderJobs; cleanup is destructive.
    ctx.freeLayout(g, engine);
    return svg;
  } catch (err: unknown) {
    // A render-stage throw already implementing GvError (e.g. HtmlParseError)
    // is re-surfaced unchanged; only genuinely-unknown throws become RENDER_ERROR.
    /* v8 ignore next -- current engines don't throw a GvError-like value here */
    if (isGvErrorLike(err)) throw err;
    throw new RenderError(messageOf(err), 'RENDER_ERROR');
  }
}

/**
 * Result-style render: returns `{ svg }` on success or `{ errors: [one] }` on
 * the first failure (svg XOR errors). Errors are plain JSON-serializable
 * {@link GvError} data objects.
 *
 * @remarks
 * Security: same untrusted-input caveat as {@link renderSvg} — the returned
 * `svg` is attacker-controlled markup for untrusted `dotSource`; apply a CSP or
 * sanitize before embedding. See the README "Security" section.
 */
export function tryRenderSvg(dotSource: string, engine: EngineName): RenderResult {
  try {
    return { svg: renderSvg(dotSource, engine) };
  } catch (err: unknown) {
    return { errors: [classifyError(err)] };
  }
}

export { parse } from './parser/index.js';
export { ParseError } from './parser/index.js';
export { RenderError } from './errors.js';
export type {
  GvError,
  GvErrorType,
  GvErrorCode,
  GvExpectation,
  RenderResult,
} from './errors.js';
export { setImageSizer } from './gvc/usershape.js';
export type { ImageSizer } from './common/htmltable-types.js';
export { setImageResolver } from './gvc/image-resolver.js';
export type { ImageResolver } from './gvc/image-resolver.js';

// Text measurement: install a custom measurer (deterministic tests, or a
// host-faithful Node measurer wired from node-canvas). The library auto-resolves
// browser canvas → Node LUT by default and never imports `canvas` itself (zero
// runtime deps). @see plans/fix-xcoord-position/DESIGN.md
export { setTextMeasurer, getTextMeasurer } from './common/textmeasure-factory.js';
export {
  CanvasTextMeasurer, EstimateTextMeasurer, LutTextMeasurer,
} from './common/textmeasure.js';
export type { TextMeasurer, TextSize, TextVariantFlags } from './common/textmeasure.js';
export { GvcContext } from './gvc/context.js';
export type { BuiltinEngine, EngineName } from './gvc/context.js';

// Lower-level renderer-pipeline primitive: render a graph against a
// caller-built `GvcContext`. The root `render` name is taken by the new
// public `render(g, format, opts?)` (collision resolution below), so this
// is namespaced as `renderWithContext` to preserve the GvcContext workflow.
export { render as renderWithContext } from './gvc/device.js';

// Discoverable root re-exports of the api + render surfaces (ADR-2): root
// `graphviz-ts` exposes everything from `graphviz-ts/api` and
// `graphviz-ts/render` for one-import discoverability.
//
// Collision resolution: the root `render` is the new public
// `render(g, format, opts?)` from `./render`. The low-level
// `render(ctx, g, format)` is re-exported as `renderWithContext` (above)
// rather than `render`. See decisions.md ADR-5 and the decision journal.
export * from './api/index.js';
export * from './render/index.js';
