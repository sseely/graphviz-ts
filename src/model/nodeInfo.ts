// SPDX-License-Identifier: EPL-2.0

/**
 * TypeScript port of Agnodeinfo_t from lib/common/types.h.
 *
 * All ND_* macros in the C source expand into this struct via AGDATA().
 * In TypeScript, ND_* accesses become direct property reads/writes on NodeInfo.
 *
 * @see lib/common/types.h:Agnodeinfo_t
 * @see lib/common/types.h:ND_* macros
 */

import type { Point, Box } from './geom.js';
import type { Edge } from './edge.js';
import type { Graph } from './graph.js';
import type { Node } from './node.js';

// ---------------------------------------------------------------------------
// Per-engine algorithm data — discriminated union (AD-7)
//
// In C, ND_alg is a void* that each layout engine casts to its own private
// struct. TypeScript uses a discriminated union so the kind discriminant is
// statically knowable and no unsafe casts are needed. Each engine's batch
// adds its concrete fields; the `kind` discriminant is the only required
// field now.
// ---------------------------------------------------------------------------

/**
 * Layout-engine algorithm data stored in ND_alg for the dot engine.
 *
 * @see lib/dotgen/ — dot-engine algorithm data
 */
export interface DotAlgData {
  readonly kind: 'dot';
}

/**
 * Layout-engine algorithm data stored in ND_alg for the neato engine.
 *
 * @see lib/neatogen/ — neato-engine algorithm data
 */
export interface NeatoAlgData {
  readonly kind: 'neato';
}

/**
 * Layout-engine algorithm data stored in ND_alg for the fdp engine.
 *
 * @see lib/fdpgen/ — fdp-engine algorithm data
 */
export interface FdpAlgData {
  readonly kind: 'fdp';
}

/**
 * Per-node init data for the circo engine (ndata in C).
 * Stored in ND_alg on original-graph nodes during Pass 0.
 * @see lib/circogen/circular.h:ndata
 */
export interface CircoNData {
  readonly kind: 'circo-ndata';
  dnode: unknown;
}

/**
 * Rich per-node layout data for the circo engine (cdata in C).
 * Stored in ND_alg on derived-graph nodes across Passes 1–4.
 * @see lib/circogen/circular.h:cdata
 */
export interface CircoCData {
  readonly kind: 'circo-cdata';
  flags: number;
  parent: unknown;
  block: unknown;
  bc: { val: number; lowVal: number };
  clone: unknown;
  tparent: unknown;
  leafone: unknown;
  leaftwo: unknown;
  fdist: number;
  sdist: number;
  pos: number;
  psi: number;
  degree: number;
  derivedNode: unknown;
}

/**
 * Sentinel value for an unset theta (angular position).
 * Valid theta values are in [0, 2π]; 10.0 is outside this range.
 *
 * @see lib/twopigen/circle.c:#define UNSET 10.00
 */
export const THETA_UNSET = 10.0;

/**
 * Per-node radial layout data for the twopi engine.
 *
 * Mirrors the `rdata` struct in lib/twopigen/circle.h. All fields are zeroed
 * at allocation time (gv_calloc equivalent). theta is set to THETA_UNSET
 * (10.0) by initLayout; nStepsToCenter is set to n² as the INF sentinel.
 *
 * @see lib/twopigen/circle.h:rdata
 * @see lib/twopigen/circle.c:initLayout
 */
export interface TwopiAlgData {
  readonly kind: 'twopi';
  /** BFS distance to nearest leaf. @see lib/twopigen/circle.h:rdata:nStepsToLeaf (SLEAF) */
  nStepsToLeaf: number;
  /** Leaf count in BFS subtree. @see lib/twopigen/circle.h:rdata:subtreeSize (STSIZE) */
  subtreeSize: number;
  /** Number of BFS children. @see lib/twopigen/circle.h:rdata:nChildren (NCHILD) */
  nChildren: number;
  /**
   * BFS distance from root (ring index). n² = INF sentinel.
   * @see lib/twopigen/circle.h:rdata:nStepsToCenter (SCENTER)
   */
  nStepsToCenter: number;
  /** BFS parent pointer; null for root. @see lib/twopigen/circle.h:rdata:parent (SPARENT) */
  parent: Node | null;
  /** Angular span in radians. @see lib/twopigen/circle.h:rdata:span (SPAN) */
  span: number;
  /**
   * Angular midpoint in radians. THETA_UNSET (10.0) until assigned.
   * @see lib/twopigen/circle.h:rdata:theta (THETA)
   */
  theta: number;
}

/**
 * Layout-engine algorithm data stored in ND_alg for the osage engine.
 *
 * ND_alg(n) is repurposed as a cluster-ownership marker during layout():
 * when a node is claimed by a cluster, alg is set to an OsageAlgData
 * with ownerCluster pointing to that cluster. Unclaimed nodes have
 * alg === undefined.
 *
 * @see lib/osage/osageinit.c:PARENT macro
 */
export interface OsageAlgData {
  readonly kind: 'osage';
  /** The cluster graph that owns this node. @see lib/osage/osageinit.c:ND_alg usage */
  readonly ownerCluster: Graph;
}

/**
 * Layout-engine algorithm data stored in ND_alg for the patchwork engine.
 *
 * @see lib/patchwork/ — patchwork-engine algorithm data
 */
export interface PatchworkAlgData {
  readonly kind: 'patchwork';
}

/**
 * Discriminated union of all per-engine algorithm data structs stored in
 * Agnodeinfo_t.alg (ND_alg). Each layout engine stores a different struct
 * in the C void*; here the `kind` discriminant makes the active engine
 * statically knowable without unsafe casting.
 *
 * @see lib/common/types.h:Agnodeinfo_t:alg (ND_alg)
 */
export type NodeAlgData =
  | DotAlgData
  | NeatoAlgData
  | FdpAlgData
  | CircoNData
  | CircoCData
  | TwopiAlgData
  | OsageAlgData
  | PatchworkAlgData;

// ---------------------------------------------------------------------------
// Edge list helper type (mirrors elist in types.h)
// ---------------------------------------------------------------------------

/**
 * Dynamic edge list, ported from the C `elist` struct.
 *
 * @see lib/common/types.h: typedef struct elist { edge_t **list; size_t size; }
 */
export interface EdgeList {
  list: Edge[];
  size: number;
}

// ---------------------------------------------------------------------------
// NodeInfo interface
// ---------------------------------------------------------------------------

/**
 * Node-level layout info record, ported from Agnodeinfo_t in lib/common/types.h.
 *
 * This interface replaces all ND_* macro accesses in the C source. Required
 * (always-present) fields mirror the non-pointer, non-conditional fields of
 * Agnodeinfo_t. Optional fields correspond to pointer fields and to fields
 * gated by #ifndef DOT_ONLY / #ifndef NEATO_ONLY.
 *
 * @see lib/common/types.h:Agnodeinfo_t
 * @see lib/common/types.h:ND_* macros
 */
export interface NodeInfo {
  // -------------------------------------------------------------------------
  // Required fields — always present, non-pointer in C
  // -------------------------------------------------------------------------

  /** Final layout coordinate (node center). @see lib/common/types.h:ND_coord */
  coord: Point;

  /** Node width in inches. @see lib/common/types.h:ND_width */
  width: number;

  /** Node height in inches. @see lib/common/types.h:ND_height */
  height: number;

  /** Bounding box. @see lib/common/types.h:ND_bb */
  bb: Box;

  /** Total height in points. @see lib/common/types.h:ND_ht */
  ht: number;

  /** Left half-width in points. @see lib/common/types.h:ND_lw */
  lw: number;

  /** Right half-width in points. @see lib/common/types.h:ND_rw */
  rw: number;

  /**
   * Width in points with penwidth taken into account.
   * @see lib/common/types.h:ND_outline_width
   */
  outline_width: number;

  /**
   * Height in points with penwidth taken into account.
   * @see lib/common/types.h:ND_outline_height
   */
  outline_height: number;

  /**
   * Layout state (char in C). @see lib/common/types.h:ND_state
   */
  state: number;

  /**
   * Node state for GUI ops (unsigned char in C).
   * Bitfield values: GUI_STATE_ACTIVE, GUI_STATE_SELECTED,
   * GUI_STATE_VISITED, GUI_STATE_DELETED.
   * @see lib/common/types.h:ND_gui_state
   */
  gui_state: number;

  /** True if node represents a cluster. @see lib/common/types.h:ND_clustnode */
  clustnode: boolean;

  // -------------------------------------------------------------------------
  // Optional pointer / engine-specific fields
  // -------------------------------------------------------------------------

  /**
   * Main node label (textlabel_t* in C).
   * Typed as unknown until textlabel_t is ported in Batch 5b.
   * @see lib/common/types.h:ND_label
   */
  label?: unknown;

  /**
   * External node label (textlabel_t* in C).
   * Typed as unknown until textlabel_t is ported in Batch 5b.
   * @see lib/common/types.h:ND_xlabel
   */
  xlabel?: unknown;

  /**
   * Node shape descriptor (shape_desc* in C).
   * Typed as unknown until shape_desc is ported.
   * @see lib/common/types.h:ND_shape
   */
  shape?: unknown;

  /**
   * Shape-specific data (polygon_t*, field_t*, or engine struct in C).
   * Typed as unknown until the concrete shape types are ported.
   * @see lib/common/types.h:ND_shape_info
   */
  shape_info?: unknown;

  // -------------------------------------------------------------------------
  // Fields from #ifndef NEATO_ONLY block
  // -------------------------------------------------------------------------

  /**
   * During the dot rank-assignment phase this field holds the assigned rank
   * (integer row in the layered graph).
   *
   * DUAL-USE WARNING: During the dot position phase (x-coordinate assignment),
   * `rank` is REPURPOSED as the x-coordinate by network simplex. Do not read
   * this field as a rank value while the position phase is active. The field
   * is restored to its rank value by `set_xcoords` at the end of the position
   * phase. See lib/dotgen/position.c and AD-8.
   *
   * @see lib/common/types.h:ND_rank
   */
  rank?: number;

  /**
   * Initial order for ordered edges; also used in crossing-minimization.
   * @see lib/common/types.h:ND_order
   */
  order?: number;

  /**
   * AD-8: True while the position phase is active and `rank` holds an
   * x-coordinate instead of a rank index. Set before rank(g,2,…) is called;
   * cleared by setXcoords after ND_coord.x is populated.
   * @see lib/dotgen/position.c:set_xcoords
   */
  rankIsXCoord?: boolean;

  /** @see lib/common/types.h:ND_mval */
  mval?: number;

  /**
   * Fast-graph / spanning-tree node type (char in C).
   * @see lib/common/types.h:ND_node_type
   */
  node_type?: number;

  /**
   * Rank type classification (char in C).
   * @see lib/common/types.h:ND_ranktype
   */
  ranktype?: number;

  /**
   * Weight class (char in C).
   * @see lib/common/types.h:ND_weight_class
   */
  weight_class?: number;

  /**
   * Visited / traversal mark (size_t in C).
   * @see lib/common/types.h:ND_mark
   */
  mark?: number;

  /**
   * On-stack flag for DFS (char in C).
   * @see lib/common/types.h:ND_onstack
   */
  onstack?: number;

  /**
   * True if edge has port info. @see lib/common/types.h:ND_has_port
   */
  has_port?: boolean;

  /**
   * Showboxes flag (unsigned char in C).
   * @see lib/common/types.h:ND_showboxes
   */
  showboxes?: number;

  // Edge adjacency lists (elist fields)

  /** In-edges. @see lib/common/types.h:ND_in */
  in?: EdgeList;

  /** Out-edges. @see lib/common/types.h:ND_out */
  out?: EdgeList;

  /** Flat in-edges (same-rank). @see lib/common/types.h:ND_flat_in */
  flat_in?: EdgeList;

  /** Flat out-edges (same-rank). @see lib/common/types.h:ND_flat_out */
  flat_out?: EdgeList;

  /** Other (non-tree, non-flat) edges. @see lib/common/types.h:ND_other */
  other?: EdgeList;

  /** Saved in-edges (for virtual node removal). @see lib/common/types.h:ND_save_in */
  save_in?: EdgeList;

  /** Saved out-edges (for virtual node removal). @see lib/common/types.h:ND_save_out */
  save_out?: EdgeList;

  /** Network-simplex tree in-edges. @see lib/common/types.h:ND_tree_in */
  tree_in?: EdgeList;

  /** Network-simplex tree out-edges. @see lib/common/types.h:ND_tree_out */
  tree_out?: EdgeList;

  // Doubly-linked list through fast-graph

  /** Next node in doubly-linked fast-graph list. @see lib/common/types.h:ND_next */
  next?: Node;

  /** Previous node in doubly-linked fast-graph list. @see lib/common/types.h:ND_prev */
  prev?: Node;

  // Network-simplex fields

  /**
   * Network-simplex spanning-tree parent edge.
   * @see lib/common/types.h:ND_par
   */
  par?: Edge;

  /** Low limit for network simplex. @see lib/common/types.h:ND_low */
  low?: number;

  /** Limit for network simplex subtree. @see lib/common/types.h:ND_lim */
  lim?: number;

  /** Priority for network simplex edge selection. @see lib/common/types.h:ND_priority */
  priority?: number;

  // Union-find / collapsing

  /** Union-find tree size. @see lib/common/types.h:ND_UF_size */
  UF_size?: number;

  /** Union-find parent node. @see lib/common/types.h:ND_UF_parent */
  UF_parent?: Node;

  /** Representative node for a collapsed set. @see lib/common/types.h:ND_rep */
  rep?: Node;

  /** Set leader for min/max rank. @see lib/common/types.h:ND_set */
  set?: Node;

  /** Cluster subgraph that this node belongs to. @see lib/common/types.h:ND_clust */
  clust?: Graph;

  /**
   * Flat-edge label constraint edge stored in ND_alg during dot position phase.
   * Set by flat.c when a virtual node hosts a flat-edge label; read by
   * make_LR_constraints and dotsplines.c.
   * @see lib/dotgen/flat.c:ND_alg (flat edge label usage)
   */
  posAlg?: Edge;

  // -------------------------------------------------------------------------
  // Fields from #ifndef DOT_ONLY block (neato/fdp/sfdp)
  // -------------------------------------------------------------------------

  /**
   * True if the node's position is pinned (pos attribute with !).
   * @see lib/common/types.h:ND_pinned
   */
  pinned?: boolean;

  /**
   * Internal integer node ID used by neato/fdp.
   * @see lib/common/types.h:ND_id
   */
  id?: number;

  /**
   * Index into the priority queue heap (neato/fdp).
   * @see lib/common/types.h:ND_heapindex
   */
  heapindex?: number;

  /**
   * BFS hop count from the starting node (neato/fdp).
   * @see lib/common/types.h:ND_hops
   */
  hops?: number;

  /**
   * N-dimensional position vector (length = ndim).
   * @see lib/common/types.h:ND_pos
   */
  pos?: number[];

  /**
   * Distance value used by neato stress majorization.
   * @see lib/common/types.h:ND_dist
   */
  dist?: number;

  // -------------------------------------------------------------------------
  // Engine algorithm data (AD-7)
  // -------------------------------------------------------------------------

  /**
   * Per-engine algorithm data. Each layout engine stores a different struct
   * in ND_alg; the `kind` discriminant identifies which engine's data is
   * active without unsafe casting (AD-7).
   *
   * @see lib/common/types.h:ND_alg
   */
  alg?: NodeAlgData;
}

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Constructs a zero-valued NodeInfo with all required fields set to their
 * zero/false initial state and all optional fields absent (undefined).
 *
 * Mirrors the effect of calloc-initializing an Agnodeinfo_t in C.
 *
 * @see lib/common/types.h:Agnodeinfo_t
 * @see lib/cgraph/node.c:agnode (initial record allocation via agbindrec)
 */
export function makeNodeInfo(): NodeInfo {
  return {
    coord: { x: 0, y: 0 },
    width: 0,
    height: 0,
    bb: { ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } },
    ht: 0,
    lw: 0,
    rw: 0,
    outline_width: 0,
    outline_height: 0,
    state: 0,
    gui_state: 0,
    clustnode: false,
  };
}
