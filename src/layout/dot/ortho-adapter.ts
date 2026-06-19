// SPDX-License-Identifier: EPL-2.0
/**
 * Dot-local adapter between the dot `Graph` model and the `orthoEdges`
 * pipeline (`src/ortho`). Mirrors neato's private `OrthoHelper`
 * (`neato/splines.ts:247`) rather than extracting a shared helper, so the
 * working neato path is untouched (ADR-1) — this matches C, where dotgen and
 * neatogen each have their own call site into `ortho.c:orthoEdges`.
 *
 * @see lib/dotgen/dotsplines.c:dot_splines_ (EDGETYPE_ORTHO branch)
 * @see src/layout/neato/splines.ts:OrthoHelper
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import { clipAndInstall } from '../../common/splines-clip.js';
import { buildDotSinfo } from './self-loop.js';
import { orthoEdges } from '../../ortho/index.js';
import type {
  OrthoGraph, OrthoEdge, OrthoPoint,
} from '../../ortho/index.js';
import type { SplineInfo } from '../../common/types.js';

/** OrthoEdge carrying its originating dot Edge for result installation. */
interface TaggedOrthoEdge extends OrthoEdge {
  _edge: Edge;
}

type OrthoNodeArr = OrthoGraph['nodes'];

/**
 * Node bb from dot layout coords: center ± (lw, rw, ht/2).
 * @see lib/dotgen/dotsplines.c node-box construction; neato OrthoHelper.buildNodes
 */
function buildNodes(nodeArr: Node[]): OrthoNodeArr {
  return nodeArr.map((n) => ({
    bb: {
      LL: { x: n.info.coord.x - n.info.lw, y: n.info.coord.y - n.info.ht / 2 },
      UR: { x: n.info.coord.x + n.info.rw, y: n.info.coord.y + n.info.ht / 2 },
    },
  }));
}

function buildEdges(
  g: Graph, nodeArr: Node[], orthoNodes: OrthoNodeArr,
): TaggedOrthoEdge[] {
  return g.edges
    .filter((e) => e.tail !== e.head)
    .map((e) => ({
      tail: orthoNodes[nodeArr.indexOf(e.tail)],
      head: orthoNodes[nodeArr.indexOf(e.head)],
      _edge: e,
    } as TaggedOrthoEdge));
}

/** Build an OrthoGraph from the dot Graph (tail≠head edges only). */
export function buildOrthoGraph(g: Graph): OrthoGraph {
  const nodeArr = [...g.nodes.values()];
  const orthoNodes = buildNodes(nodeArr);
  return { nodes: orthoNodes, edges: buildEdges(g, nodeArr, orthoNodes) };
}

// C ortho sinfo: {swap_ends_p, spline_merge, ignoreSwap=true, isOrtho=true}
// (ortho.c:attachOrthoEdges). Reuse dot's swapEnds/splineMerge fns.
const ORTHO_SINFO: SplineInfo = {
  ...buildDotSinfo(),
  ignoreSwap: true,
  isOrtho: true,
};

/** Install an orthoEdges result (orthogonal point list) onto the dot Edge. */
export function installOrthoResult(oe: OrthoEdge, pts: OrthoPoint[]): void {
  const origEdge = (oe as TaggedOrthoEdge)._edge;
  if (!origEdge) return;
  clipAndInstall(origEdge, origEdge.head, pts, pts.length, ORTHO_SINFO);
}

/** Run the ortho pipeline over the dot graph, installing results (no labels). */
export function dispatchOrthoEdges(g: Graph, useLbls: boolean): void {
  orthoEdges(buildOrthoGraph(g), useLbls, (_og, oe, pts) =>
    installOrthoResult(oe, pts),
  );
}
