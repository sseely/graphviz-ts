// SPDX-License-Identifier: EPL-2.0

/**
 * Compound edge routing stub for the fdp layout engine.
 *
 * The full compoundEdges implementation from lib/fdpgen/clusteredges.c
 * builds per-edge obstacle lists from cluster bounding boxes and routes
 * splines around them using the pathplan visibility-graph router. That
 * machinery depends on cluster infrastructure not yet ported (PARENT,
 * LEVEL, GPARENT macros, makeObstacle for clusters, etc.).
 *
 * This stub falls back to standard spline routing via splineEdges(),
 * which handles the non-cluster case correctly.
 *
 * @see lib/fdpgen/clusteredges.c:compoundEdges
 * @see lib/neatogen/neatosplines.c:splineEdges
 */

import type { Graph } from '../../model/graph.js';
import { splineEdges } from '../neato/splines.js';

/**
 * Routes edges in g as splines, falling back to standard routing.
 *
 * TODO T46: port lib/fdpgen/clusteredges.c:compound_edges for full cluster
 * obstacle generation and per-edge visibility-graph routing.
 *
 * @see lib/fdpgen/clusteredges.c:compoundEdges
 */
export function compoundEdges(g: Graph): void {
  /* TODO T46: port lib/fdpgen/clusteredges.c:compound_edges */
  // Fallback: use standard spline routing
  splineEdges(g);
}
