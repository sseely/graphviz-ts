// SPDX-License-Identifier: EPL-2.0

/**
 * Multi-format public render entry point.
 *
 * Wraps the low-level `gvc/device.ts:render` with context lifecycle
 * management (layout → render → freeLayout) and structured-error handling,
 * mirroring `src/index.ts:renderSvg` exactly.
 *
 * @see lib/gvc/gvc.c:gvRender
 */

import type { Graph } from '../model/graph.js';
import { createDefaultContext } from '../gvc/default-context.js';
import { render as deviceRender } from '../gvc/device.js';
import { RenderError } from '../errors.js';
import type { GvError } from '../errors.js';
import type { EngineName } from '../gvc/context.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Supported output formats. Closed string union matching the built-in
 * renderers registered by `createDefaultContext`.
 */
export type OutputFormat =
  | 'svg'
  | 'dot'
  | 'xdot'
  | 'json'
  | 'plain'
  | 'plain-ext'
  | 'imap'
  | 'cmapx';

/**
 * Options for {@link render}.
 */
export interface RenderOptions {
  /**
   * Layout engine to use. Defaults to `'dot'`.
   *
   * yAxis is intentionally absent: coordinate orientation is a `getLayout`
   * concern (ADR-5). The raw format strings produced here carry native
   * y-up coordinates; callers that need y-down must flip in post-processing.
   */
  engine?: EngineName;
}

// ---------------------------------------------------------------------------
// Private helpers (mirrors index.ts)
// ---------------------------------------------------------------------------

/**
 * Duck-type a thrown value as a {@link GvError}: object with string `type`
 * and string `code`. Re-implemented here (not imported) so this module has
 * no circular dependency on `src/index.ts`.
 */
function isGvErrorLike(err: unknown): err is GvError {
  return (
    typeof err === 'object' &&
    err !== null &&
    typeof (err as { type?: unknown }).type === 'string' &&
    typeof (err as { code?: unknown }).code === 'string'
  );
}

/* v8 ignore next -- defensive normalizer; unreachable via public API */
function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a (parsed or built) graph to the requested format string.
 *
 * Lifecycle: createDefaultContext → layout → deviceRender → freeLayout.
 * Error handling mirrors `renderSvg`: GvError-like throws re-surface
 * unchanged; unknown throws become `RenderError('RENDER_ERROR')`.
 *
 * @remarks
 * Security: for the markup formats (`svg`, `cmapx`, `imap`), treat the output
 * as attacker-controlled when the source graph came from untrusted DOT.
 * Attribute values are XML-escaped, but URL schemes and resource origins
 * (`href`/`URL`/`image`/`stylesheet`) are passed through unfiltered, matching
 * native Graphviz. Apply a Content-Security-Policy or sanitize before embedding
 * — see the README "Security" section.
 *
 * @param g      - graph produced by `parse(...)` or the builder API
 * @param format - target output format
 * @param opts   - optional engine override (default: `'dot'`)
 * @returns rendered string in the requested format
 * @throws RenderError on layout or render failure
 *
 * @see lib/gvc/gvc.c:gvRender
 */
export function render(
  g: Graph,
  format: OutputFormat,
  opts?: RenderOptions,
): string {
  const engine: EngineName = opts?.engine ?? 'dot';
  const ctx = createDefaultContext();
  try {
    ctx.layout(g, engine);
    const result = deviceRender(ctx, g, format);
    ctx.freeLayout(g, engine);
    return result;
  } catch (err: unknown) {
    /* v8 ignore next -- current engines don't throw a GvError-like value here */
    if (isGvErrorLike(err)) throw err;
    throw new RenderError(messageOf(err), 'RENDER_ERROR');
  }
}
