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
 * @param dotSource - DOT-language graph source
 * @param engine    - layout engine name ({@link EngineName}): a built-in
 *                    ('dot', 'neato', 'fdp', 'sfdp', 'circo', 'twopi',
 *                    'osage', 'patchwork') or any custom-registered name
 * @returns SVG string
 * @throws ParseError if dotSource is not valid DOT
 * @throws RenderError if layout or rendering fails
 */
export function renderSvg(dotSource: string, engine: EngineName): string {
  const g = parse(dotSource);
  const ctx = createDefaultContext();
  try {
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
export { GvcContext } from './gvc/context.js';
export type { BuiltinEngine, EngineName } from './gvc/context.js';

// Discoverable root re-exports of the api + render surfaces (ADR-2): root
// `graphviz-ts` exposes everything from `graphviz-ts/api` and
// `graphviz-ts/render` for one-import discoverability.
//
// Collision resolution: the root `render` is the new public
// `render(g, format, opts?)` from `./render`. The low-level
// `render(ctx, g, format)` from `./gvc/device` is no longer re-exported at
// root (it is an internal renderer-pipeline primitive). See decisions.md
// ADR-5 and the decision journal.
export * from './api/index.js';
export * from './render/index.js';
