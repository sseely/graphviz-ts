// SPDX-License-Identifier: EPL-2.0

/**
 * Per-engine algorithm data — discriminated union (AD-7).
 *
 * In C, ND_alg is a void* that each layout engine casts to its own private
 * struct. TypeScript uses a discriminated union so the kind discriminant is
 * statically knowable and no unsafe casts are needed. Each engine's batch
 * adds its concrete fields; the `kind` discriminant is the only required
 * field now. Split out of nodeInfo.ts to keep that file under the size cap.
 *
 * @see lib/common/types.h:Agnodeinfo_t:alg (ND_alg)
 */

import type { Graph } from './graph.js';
import type { Node } from './node.js';

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
 * fdp data for REAL (input-graph) nodes.
 *
 * C stores DNODE in ND_next and PARENT in ND_clust (dot fields reused);
 * here both live in the alg record together with the numeric ND_pinned
 * state (P_SET/P_FIX/P_PIN), which the boolean NodeInfo.pinned cannot
 * represent.
 *
 * @see lib/fdpgen/fdp.h:DNODE / PARENT
 */
export interface FdpAlgData {
  readonly kind: 'fdp';
  /** Derived node for this real node. @see lib/fdpgen/fdp.h:DNODE */
  dnode: Node | null;
  /** Smallest containing cluster. @see lib/fdpgen/fdp.h:PARENT */
  parent: Graph | null;
  /** ND_pinned P_* state. @see lib/common/const.h:P_SET */
  pinned: number;
}

/**
 * fdp data for DERIVED-graph nodes (dndata in C).
 *
 * @see lib/fdpgen/fdp.h:dndata
 */
export interface FdpDndata {
  readonly kind: 'fdp-dndata';
  /** Degree of node. @see lib/fdpgen/fdp.h:DEG */
  deg: number;
  /** Weighted degree of node. @see lib/fdpgen/fdp.h:WDEG */
  wdeg: number;
  /** Real node if not a cluster. @see lib/fdpgen/fdp.h:ANODE */
  dn: Node | null;
  /** Cluster in real graph, for cluster nodes. @see lib/common/types.h:ND_clust */
  clust: Graph | null;
  /** Incremental displacement. @see lib/fdpgen/fdp.h:DISP */
  disp: [number, number];
  /** ND_pinned P_* state. @see lib/common/const.h:P_SET */
  pinned: number;
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
  | FdpDndata
  | CircoNData
  | CircoCData
  | TwopiAlgData
  | OsageAlgData
  | PatchworkAlgData;
