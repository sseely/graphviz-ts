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
import { GvcContext, type EngineName } from './gvc/context.js';
import { render } from './gvc/device.js';
import { createSvgRenderer } from './render/svg.js';
import { createMeasurer } from './common/textmeasure-factory.js';
import { DOT_LAYOUT_ENGINE } from './layout/dot/index.js';
import { NEATO_LAYOUT_ENGINE } from './layout/neato/index.js';
import { fdpEngine } from './layout/fdp/index.js';
import { SFDP_LAYOUT_ENGINE } from './layout/sfdp/index.js';
import { CIRCO_LAYOUT_ENGINE } from './layout/circo/index.js';
import { TWOPI_LAYOUT_ENGINE } from './layout/twopi/index.js';
import { OSAGE_LAYOUT_ENGINE } from './layout/osage/index.js';
import { PATCHWORK_LAYOUT_ENGINE } from './layout/patchwork/index.js';

function makeContext(): GvcContext {
  const ctx = new GvcContext(createMeasurer());
  ctx.register(DOT_LAYOUT_ENGINE);
  ctx.register(NEATO_LAYOUT_ENGINE);
  ctx.register(fdpEngine);
  ctx.register(SFDP_LAYOUT_ENGINE);
  ctx.register(CIRCO_LAYOUT_ENGINE);
  ctx.register(TWOPI_LAYOUT_ENGINE);
  ctx.register(OSAGE_LAYOUT_ENGINE);
  ctx.register(PATCHWORK_LAYOUT_ENGINE);
  ctx.register(createSvgRenderer());
  return ctx;
}

/**
 * Render a DOT-language string to SVG using the specified layout engine.
 *
 * @param dotSource - DOT-language graph source
 * @param engine    - layout engine name ({@link EngineName}): a built-in
 *                    ('dot', 'neato', 'fdp', 'sfdp', 'circo', 'twopi',
 *                    'osage', 'patchwork') or any custom-registered name
 * @returns SVG string
 * @throws ParseError if dotSource is not valid DOT
 * @throws Error if engine is not registered
 */
export function renderSvg(dotSource: string, engine: EngineName): string {
  const g = parse(dotSource);
  const ctx = makeContext();
  ctx.layout(g, engine);
  const svg = render(ctx, g, 'svg');
  // C: gvFreeLayout runs after gvRenderJobs; cleanup is destructive.
  ctx.freeLayout(g, engine);
  return svg;
}

export { parse } from './parser/index.js';
export { setImageSizer } from './gvc/usershape.js';
export type { ImageSizer } from './common/htmltable-types.js';
export { GvcContext } from './gvc/context.js';
export type { BuiltinEngine, EngineName } from './gvc/context.js';
export { render } from './gvc/device.js';
