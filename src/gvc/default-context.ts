// SPDX-License-Identifier: EPL-2.0

/**
 * Factory that builds a GvcContext with all built-in layout engines and
 * every built-in renderer registered.  This replaces the module-private
 * makeContext() in src/index.ts and will be wired in by T9.
 *
 * @see lib/gvc/gvc.c:gvContext
 */

import { GvcContext } from './context.js';
import { createMeasurer } from '../common/textmeasure-factory.js';
import { DOT_LAYOUT_ENGINE } from '../layout/dot/index.js';
import { NEATO_LAYOUT_ENGINE } from '../layout/neato/index.js';
import { fdpEngine } from '../layout/fdp/index.js';
import { SFDP_LAYOUT_ENGINE } from '../layout/sfdp/index.js';
import { CIRCO_LAYOUT_ENGINE } from '../layout/circo/index.js';
import { TWOPI_LAYOUT_ENGINE } from '../layout/twopi/index.js';
import { OSAGE_LAYOUT_ENGINE } from '../layout/osage/index.js';
import { PATCHWORK_LAYOUT_ENGINE } from '../layout/patchwork/index.js';
import { createSvgRenderer } from '../render/svg.js';
import { createDotRenderer, createXdotRenderer } from '../render/dot.js';
import { createJson0Renderer, createJsonRenderer } from '../render/json.js';
import {
  createPlainRenderer,
  createPlainExtRenderer,
  createImapRenderer,
  createImapNpRenderer,
  createCmapxRenderer,
  createCmapxNpRenderer,
} from '../render/map.js';

/**
 * Build a GvcContext with all 8 built-in layout engines and all 11 built-in
 * renderer plugins registered.
 *
 * Engines: dot, neato, fdp, sfdp, circo, twopi, osage, patchwork
 * Renderers: svg, dot, xdot, json0, json, plain, plain-ext, imap, imap-np,
 *            cmapx, cmapx-np
 *
 * @see lib/gvc/gvc.c:gvContext
 */
export function createDefaultContext(): GvcContext {
  const ctx = new GvcContext(createMeasurer());

  // Layout engines — identical list to makeContext() in src/index.ts
  ctx.register(DOT_LAYOUT_ENGINE);
  ctx.register(NEATO_LAYOUT_ENGINE);
  ctx.register(fdpEngine);
  ctx.register(SFDP_LAYOUT_ENGINE);
  ctx.register(CIRCO_LAYOUT_ENGINE);
  ctx.register(TWOPI_LAYOUT_ENGINE);
  ctx.register(OSAGE_LAYOUT_ENGINE);
  ctx.register(PATCHWORK_LAYOUT_ENGINE);

  // Renderer plugins — all built-in formats
  ctx.register(createSvgRenderer());
  ctx.register(createDotRenderer());
  ctx.register(createXdotRenderer());
  ctx.register(createJson0Renderer());
  ctx.register(createJsonRenderer());
  ctx.register(createPlainRenderer());
  ctx.register(createPlainExtRenderer());
  ctx.register(createImapRenderer());
  ctx.register(createImapNpRenderer());
  ctx.register(createCmapxRenderer());
  ctx.register(createCmapxNpRenderer());

  return ctx;
}
