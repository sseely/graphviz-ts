// SPDX-License-Identifier: EPL-2.0

/**
 * Node/edge emission walk for the device renderer — C's `emit_view` body.
 * Split from device.ts to keep that file under the size cap.
 *
 * The output order follows the `outputorder` graph attr (chkOrder): `nodesfirst`
 * → all nodes then all edges (EMIT_SORTED), `edgesfirst` → the reverse
 * (EMIT_EDGE_SORTED), otherwise C's breadth-first graph walk (emit each node,
 * then its out-edges' heads + edges).
 *
 * @see lib/common/emit.c:emit_view
 * @see lib/common/emit.c:chkOrder
 */

import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';
import type { Edge } from '../model/edge.js';
import { buildOutEdgeIndex } from '../model/node.js';
import type { RendererPlugin } from './context.js';
import type { RenderJob } from './job.js';
import { type LayerInfo, nodeInLayer, edgeInLayer } from '../common/layers.js';
import { renderNode, renderEdge } from './device.js';

/** Whether a node is shown in the current layer (always true off-layer). */
function nodeShown(info: LayerInfo | undefined, job: RenderJob, n: Node, g: Graph): boolean {
  return info === undefined || job.numLayers <= 1 || nodeInLayer(info, job.layerNum, n, g);
}

/** Whether an edge is shown in the current layer (always true off-layer). */
function edgeShown(info: LayerInfo | undefined, job: RenderJob, e: Edge): boolean {
  return info === undefined || job.numLayers <= 1 || edgeInLayer(info, job.layerNum, e);
}

/**
 * Output order from the `outputorder` graph attr, mirroring C's chkOrder:
 * `nodesfirst` → EMIT_SORTED, `edgesfirst` → EMIT_EDGE_SORTED, else breadth-first.
 * @see lib/common/emit.c:chkOrder
 */
function chkOrder(g: Graph): 'nodesfirst' | 'edgesfirst' | 'default' {
  const p = g.attrs.get('outputorder');
  if (p === 'nodesfirst') return 'nodesfirst';
  if (p === 'edgesfirst') return 'edgesfirst';
  return 'default';
}

/** Emit every node (id order), then every edge. C's EMIT_SORTED branch. */
function emitNodesThenEdges(
  g: Graph, renderer: RendererPlugin, job: RenderJob, outIdx: Map<Node, Edge[]>, info?: LayerInfo,
): void {
  const done = new Set<Node>();
  for (const n of g.nodes.values()) {
    if (nodeShown(info, job, n, g)) renderNode(n, renderer, job, done);
  }
  for (const n of g.nodes.values()) {
    for (const e of outIdx.get(n) ?? []) {
      if (edgeShown(info, job, e)) renderEdge(e, renderer, job);
    }
  }
}

/** Emit every edge, then every node. C's EMIT_EDGE_SORTED branch. */
function emitEdgesThenNodes(
  g: Graph, renderer: RendererPlugin, job: RenderJob, outIdx: Map<Node, Edge[]>, info?: LayerInfo,
): void {
  const done = new Set<Node>();
  for (const n of g.nodes.values()) {
    for (const e of outIdx.get(n) ?? []) {
      if (edgeShown(info, job, e)) renderEdge(e, renderer, job);
    }
  }
  for (const n of g.nodes.values()) {
    if (nodeShown(info, job, n, g)) renderNode(n, renderer, job, done);
  }
}

/**
 * Render nodes and edges per the graph's `outputorder`.
 * @see lib/common/emit.c:emit_view
 */
export function walkNodesAndEdges(g: Graph, renderer: RendererPlugin, job: RenderJob, info?: LayerInfo): void {
  // One out-edge index instead of n.outEdges(g) per node (O(N·E) → O(E log E));
  // emission only writes the render device, never g.edges, and the index keeps
  // outEdges' sorted order so element emission order is unchanged.
  const outIdx = buildOutEdgeIndex(g);
  const order = chkOrder(g);
  if (order === 'nodesfirst') { emitNodesThenEdges(g, renderer, job, outIdx, info); return; }
  if (order === 'edgesfirst') { emitEdgesThenNodes(g, renderer, job, outIdx, info); return; }
  // Default: breadth-first graph walk (emit each node, then its out-edges' heads + edges).
  const done = new Set<Node>();
  for (const n of g.nodes.values()) {
    if (nodeShown(info, job, n, g)) renderNode(n, renderer, job, done);
    for (const e of outIdx.get(n) ?? []) {
      if (nodeShown(info, job, e.head, g)) renderNode(e.head, renderer, job, done);
      if (edgeShown(info, job, e)) renderEdge(e, renderer, job);
    }
  }
}
