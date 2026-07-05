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
import { buildOutEdgeIndex } from '../../model/node.js';
import { dotRoot } from './mincross-utils.js';
import { nodesInSeq } from './decomp.js';
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

/**
 * Gather edges to route, mirroring C's ortho gather loop exactly:
 * iterate nodes in agfstnode (creation/seq) order, then each node's out-edges
 * in agfstout order. When `concentrate` is set, dedup by the UNORDERED node
 * pair via a point-set — the first edge between a pair (in either direction)
 * is routed; any later edge sharing that pair (the reverse of a 2-cycle, or a
 * parallel multi-edge) is skipped. This is ortho's own concentrate mechanism,
 * distinct from class2's `edge_type == IGNORED` marking, and the keep-first
 * decision depends on this iteration order matching C's.
 * Self-loops (tail === head) are routed elsewhere and excluded here.
 * @see lib/ortho/ortho.c:1207-1228 (orthoEdges edge gather + Concentrate PS)
 */
function buildEdges(
  g: Graph, nodeArr: Node[], orthoNodes: OrthoNodeArr,
): TaggedOrthoEdge[] {
  const concentrate = dotRoot(g).info.concentrate ?? false;
  const nodeIndex = new Map<Node, number>();
  nodeArr.forEach((n, i) => nodeIndex.set(n, i));
  const outIndex = buildOutEdgeIndex(g);
  const seen = new Set<string>();
  const result: TaggedOrthoEdge[] = [];
  for (const n of nodeArr) {
    const oes = outIndex.get(n);
    if (oes === undefined) continue;
    for (const e of oes) {
      if (e.tail === e.head) continue;
      if (concentrate) {
        const ti = e.tail.id;
        const hi = e.head.id;
        const key = ti <= hi ? `${ti},${hi}` : `${hi},${ti}`;
        if (seen.has(key)) continue;
        seen.add(key);
      }
      result.push({
        tail: orthoNodes[nodeIndex.get(e.tail)!],
        head: orthoNodes[nodeIndex.get(e.head)!],
        // C: p1/q1 = ND_coord ± ED_*_port.p (ortho.c:1075-1076). Port defaults
        // to {0,0}, so this reproduces the port-less centre exactly when no
        // compass port is set.
        tailPoint: {
          x: e.tail.info.coord.x + e.info.tail_port.p.x,
          y: e.tail.info.coord.y + e.info.tail_port.p.y,
        },
        headPoint: {
          x: e.head.info.coord.x + e.info.head_port.p.x,
          y: e.head.info.coord.y + e.info.head_port.p.y,
        },
        _edge: e,
      } as TaggedOrthoEdge);
    }
  }
  return result;
}

/** Build an OrthoGraph from the dot Graph (tail≠head edges only). */
export function buildOrthoGraph(g: Graph): OrthoGraph {
  const nodeArr = nodesInSeq(g);
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
