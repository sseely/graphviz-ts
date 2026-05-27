// SPDX-License-Identifier: EPL-2.0
/**
 * Shared internal types for the ortho edge router.
 *
 * Corresponds to lib/ortho/structures.h, lib/ortho/maze.h,
 * lib/ortho/sgraph.h, and lib/ortho/rawgraph.h.
 *
 * @see lib/ortho/structures.h
 * @see lib/ortho/maze.h
 * @see lib/ortho/sgraph.h
 * @see lib/ortho/rawgraph.h
 */

/**
 * A 2D point with floating-point coordinates.
 * Corresponds to `pointf` in the C source.
 * @see common/types.h:pointf
 */
export interface OrthoPoint {
  x: number;
  y: number;
}

/**
 * Axis-aligned bounding box.
 * Corresponds to `boxf` in the C source.
 * @see common/geom.h:boxf
 */
export interface OrthoBox {
  LL: OrthoPoint; // lower-left
  UR: OrthoPoint; // upper-right
}

/**
 * Bend direction for segment endpoints.
 * Corresponds to `enum bend` in structures.h.
 * @see lib/ortho/structures.h:bend
 */
export const enum Bend {
  B_NODE = 0,
  B_UP = 1,
  B_LEFT = 2,
  B_DOWN = 3,
  B_RIGHT = 4,
}

/**
 * Pair of doubles (interval / extent).
 * Corresponds to `paird` in structures.h.
 * @see lib/ortho/structures.h:paird
 */
export interface Paird {
  p1: number;
  p2: number;
}

/**
 * A routing segment — either horizontal or vertical.
 * Corresponds to `struct segment` in structures.h.
 * @see lib/ortho/structures.h:segment
 */
export interface OrthoSegment {
  isVert: boolean;
  commCoord: number; // the common (fixed) coordinate
  p: Paird; // end-point range; p1 <= p2
  l1: Bend;
  l2: Bend;
  indNo: number | null; // index in channel (-1 = unset)
  trackNo: number | null; // assigned track number
  prev: OrthoSegment | null;
  next: OrthoSegment | null;
}

/**
 * A route — an ordered array of segments.
 * Corresponds to `route` in structures.h.
 * @see lib/ortho/structures.h:route
 */
export interface Route {
  segs: OrthoSegment[];
}

// ─── Maze cell ───────────────────────────────────────────────────────────────

/** Cell flag constants. @see lib/ortho/maze.h */
export const MZ_ISNODE = 1;
export const MZ_VSCAN = 2;
export const MZ_HSCAN = 4;
export const MZ_SMALLV = 8;
export const MZ_SMALLH = 16;

/** Side indices. @see lib/ortho/maze.h */
export const M_RIGHT = 0;
export const M_TOP = 1;
export const M_LEFT = 2;
export const M_BOTTOM = 3;

/** Forward references resolved by maze.ts */
export interface SNode {
  nVal: number; // negative while in PQ, positive when finalized
  nIdx: number; // index in PQ heap
  nDad: SNode | null; // parent in shortest-path tree
  nEdge: SEdge | null; // edge leading to this node
  nAdj: number; // number of adjacent edges (live)
  saveNAdj: number; // saved nAdj for reset
  cells: [Cell | null, Cell | null]; // [0] left/bottom, [1] top/right
  adjEdgeList: number[]; // indices into edges array
  index: number; // index in graph nodes array
  isVert: boolean; // true = vertical boundary segment
}

export interface SEdge {
  weight: number;
  cnt: number; // path usage counter
  v1: number; // index of first endpoint
  v2: number; // index of second endpoint
}

export interface SGraph {
  nnodes: number;
  nedges: number;
  saveNnodes: number;
  saveNedges: number;
  nodes: SNode[];
  edges: SEdge[];
}

/**
 * A cell in the maze — a rectangular region between nodes.
 * Corresponds to `struct cell` in maze.h.
 * @see lib/ortho/maze.h:cell
 */
export interface Cell {
  flags: number;
  nedges: number;
  edges: (SEdge | null)[]; // up to 6
  nsides: number;
  sides: (SNode | null)[]; // indexed by M_RIGHT, M_TOP, M_LEFT, M_BOTTOM
  bb: OrthoBox;
}

/**
 * The maze — partitioned free space around graph nodes.
 * Corresponds to `maze` in maze.h.
 * @see lib/ortho/maze.h:maze
 */
export interface Maze {
  ncells: number;
  ngcells: number;
  cells: Cell[]; // non-node cells
  gcells: Cell[]; // node cells
  sg: SGraph;
  hchans: Map<number, Map<string, Channel>>; // horizontal channels
  vchans: Map<number, Map<string, Channel>>; // vertical channels
}

// ─── Rawgraph ────────────────────────────────────────────────────────────────

/**
 * Topological sort graph vertex.
 * Corresponds to `vertex` in rawgraph.h.
 * @see lib/ortho/rawgraph.h:vertex
 */
export interface RawVertex {
  color: number; // 0=UNSCANNED, 1=SCANNING, 2=SCANNED
  topsortOrder: number;
  adjList: number[]; // adjacency list (directed)
}

/**
 * Simple directed graph for channel ordering.
 * Corresponds to `rawgraph` in rawgraph.h.
 * @see lib/ortho/rawgraph.h:rawgraph
 */
export interface RawGraph {
  nvs: number;
  vertices: RawVertex[];
}

// ─── Channel ─────────────────────────────────────────────────────────────────

/**
 * A routing channel containing ordered segments.
 * Corresponds to `channel` in structures.h.
 * @see lib/ortho/structures.h:channel
 */
export interface Channel {
  p: Paird; // spatial extent of channel
  segList: OrthoSegment[]; // segments in this channel
  G: RawGraph | null; // ordering graph
  cp: Cell | null; // first cell in channel
}

// ─── Public graph interface (self-contained) ─────────────────────────────────

/**
 * Minimal graph interface accepted by orthoEdges.
 * Does not import from src/model or src/common.
 */
export interface OrthoNode {
  /** Node bounding box in graph coordinates */
  bb: OrthoBox;
}

export interface OrthoEdge {
  /** Source node */
  tail: OrthoNode;
  /** Destination node */
  head: OrthoNode;
}

export interface OrthoGraph {
  nodes: OrthoNode[];
  edges: OrthoEdge[];
}

/**
 * Callback type for installing routed edges (corresponds to clip_and_install).
 * @see lib/common/splines.c:clip_and_install
 */
export type ClipAndInstallFn = (
  g: OrthoGraph,
  e: OrthoEdge,
  path: OrthoPoint[],
  merge: boolean,
) => void;
