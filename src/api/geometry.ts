// SPDX-License-Identifier: EPL-2.0

/**
 * Geometry snapshot API — reads computed layout geometry from an
 * internal Graph after ctx.layout() has run, and returns a plain,
 * JSON-serializable snapshot.
 *
 * Coordinate systems
 * ------------------
 * Native graphviz coordinates are y-up (origin at lower-left).
 * Most screen consumers want y-down (origin at upper-left).
 *
 * With the default `yAxis: 'down'`, every y coordinate is flipped:
 *   y' = bbHeight - y
 * where bbHeight = graph bb.ur.y - graph bb.ll.y.
 * The `bounds` origin is normalised to (0, 0) at the top-left corner.
 *
 * With `yAxis: 'up'`, values are returned unchanged (native y-up frame).
 *
 * Units
 * -----
 * The internal model stores node `width` and `height` in inches
 * (matching C ND_width / ND_height in lib/common/types.h).
 * `NodeGeometry.width` and `NodeGeometry.height` are converted to
 * **points** (1 inch = 72 points) before being returned.
 *
 * All other coordinates (x, y, bbox dimensions, spline points,
 * label positions) are in the native graphviz point unit.
 *
 * @see lib/common/types.h
 */

import type { Graph } from '../model/graph.js';
import type { Node } from '../model/node.js';
import type { Edge } from '../model/edge.js';
import { RenderError } from '../errors.js';

// ---------------------------------------------------------------------------
// Public coordinate types (canonical home — T5 imports GeometryOptions here)
// ---------------------------------------------------------------------------

/** Coordinate system for returned geometry. */
export type YAxis = 'up' | 'down';

/**
 * Options for {@link getLayout}.
 *
 * @property yAxis - Coordinate direction. Default `'down'` (origin top-left,
 *   y increases downward — screen convention). Use `'up'` to get native
 *   graphviz coordinates (origin bottom-left, y increases upward).
 */
export type GeometryOptions = { yAxis?: YAxis };

/**
 * Overall bounding box of the graph, in points.
 *
 * With `yAxis:'down'`, x and y are 0 (normalised to top-left origin)
 * and width/height are the natural dimensions.
 * With `yAxis:'up'`, x and y match the raw lower-left corner of the
 * graph bounding box.
 */
export interface BoundsGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Per-node geometry extracted after layout, in points.
 *
 * `x` and `y` are the node centre coordinates.
 * `width` and `height` are in **points** (converted from the inches
 * stored on the model: `NodeInfo.width * 72`, `NodeInfo.height * 72`).
 *
 * @see lib/common/types.h:ND_coord, ND_width, ND_height
 */
export interface NodeGeometry {
  name: string;
  x: number;
  y: number;
  /**
   * Node width in **points** (model stores inches; multiplied by 72 here).
   * @see lib/common/types.h:ND_width
   */
  width: number;
  /**
   * Node height in **points** (model stores inches; multiplied by 72 here).
   * @see lib/common/types.h:ND_height
   */
  height: number;
}

/**
 * Per-edge geometry extracted after spline routing, in points.
 *
 * `points` concatenates all bezier control points from the edge spline,
 * in order. An edge with no routed spline produces an empty `points` array.
 * `label` is present only when the edge carries a centre label.
 *
 * @see lib/common/types.h:ED_spl, ED_label
 */
export interface EdgeGeometry {
  tail: string;
  head: string;
  /** Bezier control points for the edge spline, in points. */
  points: { x: number; y: number }[];
  /** Centre edge label position, if present. @see lib/common/types.h:ED_label */
  label?: { x: number; y: number };
}

/**
 * Per-cluster geometry extracted after layout, in points.
 *
 * `name` is the cluster subgraph's name (e.g. `cluster6`); for nested
 * clusters the name encodes the hierarchy, so no explicit parent link is
 * exposed. `x`/`y`/`width`/`height` describe the cluster's bounding box,
 * following the same frame convention as {@link BoundsGeometry}: with
 * `yAxis:'down'` (x, y) is the top-left corner; with `yAxis:'up'` (x, y) is
 * the lower-left corner (native graphviz frame). These are the raw box
 * corners graphviz computed — the same values `render()` rounds to emit the
 * `class="cluster"` polygon, so a consumer quantizing to SVG precision gets
 * byte-conformant geometry.
 *
 * @see lib/common/types.h:GD_bb (of a cluster subgraph)
 */
export interface ClusterGeometry {
  /** Cluster subgraph name (e.g. `cluster6`); encodes nesting. */
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Plain, JSON-serializable snapshot of the graph's computed geometry.
 *
 * `clusters` lists every cluster subgraph (recursively, nested clusters each
 * get their own entry) with a computed bounding box; it is empty for graphs
 * without clusters.
 *
 * @see lib/common/types.h:GD_bb, ND_coord, ED_spl, GD_clust
 */
export interface LayoutSnapshot {
  bounds: BoundsGeometry;
  nodes: NodeGeometry[];
  edges: EdgeGeometry[];
  clusters: ClusterGeometry[];
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

/** Points per inch — matches graphviz's DPI constant. @see lib/common/geom.h */
const INCHES_TO_POINTS = 72;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Build a y-flip function bound to a specific graph bounding-box height. */
function makeFlipY(bbHeight: number, yAxis: YAxis): (y: number) => number {
  if (yAxis === 'up') return (y) => y;
  return (y) => bbHeight - y;
}

/**
 * Snapshot one node's geometry.
 * @see lib/common/types.h:ND_coord, ND_width, ND_height
 */
function snapshotNode(node: Node, flipY: (y: number) => number): NodeGeometry {
  const coord = node.info.coord;
  return {
    name: node.name,
    x: coord.x,
    y: flipY(coord.y),
    width: node.info.width * INCHES_TO_POINTS,
    height: node.info.height * INCHES_TO_POINTS,
  };
}

/**
 * Collect bezier control points from an edge's spline.
 * Uses `.size` (not `.list.length`) because C over-allocates `list`
 * and `size` holds the actual count after clip_and_install.
 * @see lib/common/splines.c:clip_and_install
 */
function collectEdgePoints(
  edge: Edge,
  flipY: (y: number) => number,
): { x: number; y: number }[] {
  const spl = edge.info.spl;
  if (spl === undefined) return [];
  const pts: { x: number; y: number }[] = [];
  for (const bz of spl.list) {
    for (let k = 0; k < bz.size; k++) {
      const pt = bz.list[k];
      pts.push({ x: pt.x, y: flipY(pt.y) });
    }
  }
  return pts;
}

/**
 * Snapshot one edge's geometry.
 * @see lib/common/types.h:ED_spl, ED_label (textlabel_t.pos)
 */
function snapshotEdge(edge: Edge, flipY: (y: number) => number): EdgeGeometry {
  const geom: EdgeGeometry = {
    tail: edge.tail.name,
    head: edge.head.name,
    points: collectEdgePoints(edge, flipY),
  };
  const lbl = edge.info.label;
  if (lbl !== undefined) {
    geom.label = { x: lbl.pos.x, y: flipY(lbl.pos.y) };
  }
  return geom;
}

/**
 * Snapshot one cluster's bounding box, in the requested frame.
 *
 * Mirrors the {@link BoundsGeometry} convention: `yAxis:'up'` returns the
 * native lower-left corner (ll); `yAxis:'down'` returns the top-left corner
 * (ll.x, flipped ur.y). `width`/`height` are frame-independent (ur - ll).
 *
 * @see lib/common/types.h:GD_bb (cluster subgraph)
 */
function snapshotCluster(
  sg: Graph, yAxis: YAxis, flipY: (y: number) => number,
): ClusterGeometry {
  const bb = sg.info.bb;
  return {
    name: sg.name,
    x: bb.ll.x,
    // 'up' keeps the lower-left y; 'down' flips the upper-right y to the
    // top-left of the box (flipY is monotonic-decreasing there).
    y: yAxis === 'up' ? bb.ll.y : flipY(bb.ur.y),
    width: bb.ur.x - bb.ll.x,
    height: bb.ur.y - bb.ll.y,
  };
}

/**
 * Collect every cluster subgraph (depth-first, nested clusters included).
 * C stores clusters 1-indexed in GD_clust; the TS model exposes a 0-indexed
 * `info.clust` array on each (sub)graph. A cluster without a computed bb
 * (never laid out) is skipped.
 * @see lib/common/types.h:GD_clust, GD_n_cluster
 */
function collectClusters(
  sg: Graph, yAxis: YAxis, flipY: (y: number) => number,
  out: ClusterGeometry[],
): void {
  for (const c of sg.info.clust ?? []) {
    if (c.info.bb !== undefined) out.push(snapshotCluster(c, yAxis, flipY));
    collectClusters(c, yAxis, flipY, out);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns a plain, JSON-serializable snapshot of the computed geometry for
 * all nodes and edges in graph `g`.
 *
 * Must be called **after** `ctx.layout(g, engine)` (or `render`) has run.
 * Before layout the geometry fields hold calloc-zero defaults (every node at
 * the origin, an empty bounding box), so a not-yet-laid-out graph is rejected
 * with a `RenderError` rather than returning that all-zero snapshot as if it
 * were real geometry.
 *
 * @param g    - Laid-out graph (internal model; not mutated by this function).
 * @param opts - Coordinate options; defaults to `{ yAxis: 'down' }`.
 * @throws RenderError if `g` has not been laid out.
 *
 * @see lib/common/types.h:GD_bb, ND_coord, ED_spl
 */
export function getLayout(g: Graph, opts?: GeometryOptions): LayoutSnapshot {
  if (g.info?.laidOut !== true) {
    throw new RenderError(
      'getLayout requires a laid-out graph; run ctx.layout(g, engine) or render() first',
      'GENERIC_ERROR',
    );
  }
  const yAxis: YAxis = opts?.yAxis ?? 'down';
  const bb = g.info.bb;
  const bbWidth = bb.ur.x - bb.ll.x;
  const bbHeight = bb.ur.y - bb.ll.y;
  const flipY = makeFlipY(bbHeight, yAxis);

  const bounds: BoundsGeometry = yAxis === 'down'
    ? { x: 0, y: 0, width: bbWidth, height: bbHeight }
    : { x: bb.ll.x, y: bb.ll.y, width: bbWidth, height: bbHeight };

  const nodes = Array.from(g.nodes.values()).map((n) => snapshotNode(n, flipY));
  const edges = g.edges.map((e) => snapshotEdge(e, flipY));
  const clusters: ClusterGeometry[] = [];
  collectClusters(g, yAxis, flipY, clusters);

  return { bounds, nodes, edges, clusters };
}
