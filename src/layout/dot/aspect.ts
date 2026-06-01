// SPDX-License-Identifier: EPL-2.0

/**
 * Aspect ratio control for dot layout.
 *
 * The 'aspect' feature was never completed in Graphviz. This file exists
 * to satisfy the pipeline call in dotinit.c.
 *
 * @see lib/dotgen/aspect.c
 */

import type { Graph } from '../../model/graph.js';

/**
 * Aspect ratio control — reads the 'aspect' attribute and would adjust
 * layout, but the feature was never completed. This is a no-op.
 *
 * @see lib/dotgen/aspect.c:setAspect
 */
export function setAspect(_g: Graph): void {
  /* aspect feature was never completed in Graphviz — no-op per AD in mission brief */
}
