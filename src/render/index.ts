// SPDX-License-Identifier: EPL-2.0

/**
 * `graphviz-ts/render` — the output-formats + draw-ops entry point (ADR-2).
 *
 * Pure re-export barrel for the public render surface: the multi-format
 * `render()` entry and the structured xdot draw-op access.
 *
 * Typical flow: build or `parse()` a graph (see `graphviz-ts/api`), then
 * either call `render(g, format, opts?)` for a serialized output string —
 * `format` is one of {@link OutputFormat} (`'svg'`, `'dot'`, `'xdot'`,
 * `'json'`, `'plain'`, ...) — or call {@link getDrawOps} to skip string
 * output entirely and get a flat, typed draw-op stream for a custom
 * canvas/WebGL/PDF backend.
 *
 * (No `src/render/index.ts` existed before this mission; this file is new.
 * The renderer factories live in their own modules — `svg.ts`, `dot.ts`,
 * `json.ts`, `map.ts` — and are wired through `createDefaultContext`, not
 * re-exported here.)
 */

// --- Multi-format render entry (T5) ---------------------------------------
export { render } from './public.js';
export type { OutputFormat, RenderOptions } from './public.js';

// --- Structured xdot draw-ops (T6) ----------------------------------------
export { getDrawOps, DEFAULT_DRAW_ENGINE } from './xdot-public.js';
export type { DrawOpsOptions } from './xdot-public.js';
export type { Xdot, XdotOp, XdotColor } from './xdot-public.js';
