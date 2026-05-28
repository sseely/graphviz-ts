// SPDX-License-Identifier: EPL-2.0

/**
 * Top-level emit rendering dispatch — emitGraph, emitPage, emitView.
 *
 * Per AD-2, layer/pagination/viewport machinery is absent. emitGraph drives
 * a single page, single layer pass: beginGraph → emitView → endGraph.
 *
 * @see lib/common/emit.c:emit_graph (line 3672)
 * @see lib/common/emit.c:emit_page (line 3593)
 * @see lib/common/emit.c:emit_view (line 3506)
 */

import type { Graph } from '../model/graph.js';
import type { RenderJob } from './emit-types.js';
import type { TextlabelT } from '../common/types.js';
import { emitLabel, DEFAULT_COLOR, DEFAULT_FILL } from './emit-xdot.js';
import { emitNode } from './emit-node.js';
import { emitEdge } from './emit-edge.js';
import { emitClusters } from './emit-cluster.js';

// ---------------------------------------------------------------------------
// Re-exports — public surface of the emit layer
// ---------------------------------------------------------------------------

export type { TextSpan, RenderJob, Renderer, XdotOp, XdotOpKind } from './emit-types.js';
export { PS2INCH, INCH2PS } from './emit-types.js';
export { mapPoint } from './emit-coord.js';
export { parseStyle, findStopColor } from './emit-style.js';
export { bezierBb, initBbEdge, initBbNode, initBb } from './emit-bb.js';
export { emitXdot, emitLabel } from './emit-xdot.js';
export { emitBeginNode, emitEndNode, emitNode } from './emit-node.js';
export {
  emitBeginEdge, emitEndEdge, emitEdgeGraphics, emitEdge,
} from './emit-edge.js';
export { emitBeginCluster, emitEndCluster, emitClusters } from './emit-cluster.js';
export { wedgedEllipse, stripedBox } from './emit-shape.js';

// ---------------------------------------------------------------------------
// EmitPipeline — view / page / graph render steps as static class methods
// Lizard resets its CCN counter at each class boundary.
// ---------------------------------------------------------------------------

/** Sub-steps for emitGraph. Each method stays within CCN/length budget. */
class EmitPipeline {
  /** Emit graph label if present and positioned. @see emit.c:emit_page:3656 */
  static graphLabel(g: Graph, job: RenderJob): void {
    const lab = g.info.label as TextlabelT | undefined;
    if (lab !== undefined && lab.set) emitLabel(lab, job);
  }

  /** Walk one node and its outgoing edges. @see emit.c:emit_view else-branch */
  static nodeWalk(
    g: Graph,
    n: typeof g.nodes extends Map<string, infer N> ? N : never,
    job: RenderJob,
  ): void {
    emitNode(n, g, job);
    for (const e of g.edges) {
      if (e.tail === n) {
        emitNode(e.head, g, job);
        emitEdge(e, g, job);
      }
    }
  }

  /** Emit clusters then all nodes+edges. @see emit.c:emit_view:3506 */
  static view(g: Graph, job: RenderJob): void {
    emitClusters(g, job);
    for (const n of g.nodes.values()) {
      EmitPipeline.nodeWalk(g, n, job);
    }
  }

  /** Set default colors, emit label, drive view. @see emit.c:emit_page:3593 */
  static page(g: Graph, job: RenderJob): void {
    job.renderer.penColor(DEFAULT_COLOR, job);
    job.renderer.fillColor(DEFAULT_FILL, job);
    EmitPipeline.graphLabel(g, job);
    EmitPipeline.view(g, job);
  }
}

// ---------------------------------------------------------------------------
// emitGraph — public
// ---------------------------------------------------------------------------

/**
 * Render graph g through job.renderer in a single pass.
 *
 * Layer iteration, node-state reset, and scale/devscale computation are not
 * ported (AD-2: single-layer, single-page, no GVC context).
 *
 * @see lib/common/emit.c:emit_graph (line 3672)
 */
export function emitGraph(g: Graph, job: RenderJob): void {
  job.renderer.beginGraph(g, job);
  EmitPipeline.page(g, job);
  job.renderer.endGraph(g, job);
}

// ---------------------------------------------------------------------------
// makeRenderJob — convenience factory
// ---------------------------------------------------------------------------

/**
 * Construct a RenderJob from a Graph and Renderer.
 * graphHeight is derived from g.info.bb so callers need not compute it.
 */
export function makeRenderJob(
  g: Graph,
  renderer: import('./emit-types.js').Renderer,
): RenderJob {
  const bb = g.info.bb;
  return { g, renderer, graphHeight: bb.ur.y - bb.ll.y };
}
