// SPDX-License-Identifier: EPL-2.0

/**
 * Core block and derived-graph data structures for the circo layout engine.
 *
 * Ports the type definitions from lib/circogen/block.h, lib/circogen/circular.h,
 * and the DerivedGraph/DerivedNode/DerivedEdge helpers used across all passes.
 *
 * Also holds CircoCData (cdata) here to avoid a circular import with init.ts:
 * cdata needs a back-reference to DerivedNode, so both must live in the same
 * module.
 *
 * @see lib/circogen/block.h
 * @see lib/circogen/circular.h
 */

import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';

// ---------------------------------------------------------------------------
// Flag constants for CircoCData.flags
// @see lib/circogen/circular.h
// ---------------------------------------------------------------------------

export const FLAGS_VISITED = 0x01;
export const FLAGS_ONSTACK = 0x02;
export const FLAGS_ISPARENT = 0x04;
export const FLAGS_ONPATH = 0x08;
export const FLAGS_NEIGHBOR = 0x10;

// ---------------------------------------------------------------------------
// CircoCData — rich per-node layout data on derived-graph nodes (Passes 1–4)
// @see lib/circogen/circular.h:cdata
// ---------------------------------------------------------------------------

/**
 * Rich algorithm data stored on derived-graph nodes across Passes 1–4.
 * Fields are reused across passes (mirrors the C union in cdata).
 *
 * @see lib/circogen/circular.h:cdata
 */
export interface CircoCData {
  readonly kind: 'circo-cdata';
  flags: number;
  /** DFS parent (Pass 1). @see PARENT(n) */
  parent: DerivedNode | null;
  /** Block containing this node. @see BLOCK(n) */
  block: unknown;
  /** Biconnectivity fields (Pass 1). @see VAL(n), LOWVAL(n) */
  bc: { val: number; lowVal: number };
  /** Clone pointer (Pass 3a). @see CLONE(n) */
  clone: Node | null;
  /** Spanning-tree parent (Pass 3b). @see TPARENT(n) */
  tparent: CircoCData | null;
  leafone: CircoCData | null;
  leaftwo: CircoCData | null;
  fdist: number;
  sdist: number;
  /** Circle position index (Pass 3c/4). @see POSITION(n) */
  pos: number;
  /** Child-block mid-angle (Pass 4). @see PSI(n) */
  psi: number;
  /** Degree counter (reuses ND_order slot). @see DEGREE(n) */
  degree: number;
  /** Back-reference to the DerivedNode that owns this cdata. */
  derivedNode: DerivedNode;
}

// ---------------------------------------------------------------------------
// SubGraph / DerivedGraph / DerivedNode / DerivedEdge
// ---------------------------------------------------------------------------

/** Lightweight subgraph used in the derived graph for circo. */
export interface SubGraph {
  name: string;
  nodes: DerivedNode[];
  edges: DerivedEdge[];
  parent: DerivedGraph;
}

/** Strict undirected derived graph built in Pass 0. */
export interface DerivedGraph {
  nodes: Map<string, DerivedNode>;
  subgraphs: SubGraph[];
  components: SubGraph[];
}

/** Node in the derived graph with cdata attached. */
export interface DerivedNode {
  name: string;
  orig: Node;
  pos: [number, number];
  cdata: CircoCData;
  lw: number;
  rw: number;
  ht: number;
}

/** Edge in the derived graph. */
export interface DerivedEdge {
  tail: DerivedNode;
  head: DerivedNode;
  /** +1 tail→head, -1 head→tail, 0 = unset. @see EDGEORDER(e) */
  order: number;
  origEdge: Edge | null;
}

// ---------------------------------------------------------------------------
// Block — biconnected component
// @see lib/circogen/block.h:block_t
// ---------------------------------------------------------------------------

const COALESCED_F = 1;

/**
 * One biconnected component (or isolated node).
 * @see lib/circogen/block.h:block_t
 */
export interface Block {
  subGraph: SubGraph;
  radius: number;
  rad0: number;
  circleList: Node[];
  children: Block[];
  /** Parent-connection angle for single-node blocks; -1 = unset. */
  parentPos: number;
  flags: number;
  /** Cutpoint node connecting this block to its parent block. */
  child: Node | null;
}

/** @see lib/circogen/block.c:mkBlock */
export function mkBlock(sg: SubGraph): Block {
  return {
    subGraph: sg,
    radius: 0,
    rad0: 0,
    circleList: [],
    children: [],
    parentPos: -1,
    flags: 0,
    child: null,
  };
}

/** @see lib/circogen/block.c:blockSize */
export function blockSize(bp: Block): number {
  return bp.subGraph.nodes.length;
}

/** @see lib/circogen/block.c:appendBlock */
export function appendBlock(bl: Block[], bp: Block): void {
  bl.push(bp);
}

/** @see lib/circogen/block.c:insertBlock */
export function insertBlock(bl: Block[], bp: Block): void {
  bl.unshift(bp);
}

/** @see lib/circogen/block.h:SET_COALESCED */
export function setCoalesced(bp: Block): void {
  bp.flags |= COALESCED_F;
}

/** @see lib/circogen/block.h:COALESCED */
export function isCoalesced(bp: Block): boolean {
  return (bp.flags & COALESCED_F) !== 0;
}

/** @see lib/circogen/block.h:BLK_PARENT */
export function blkParent(bp: Block): Node | null {
  return bp.child;
}

// ---------------------------------------------------------------------------
// CircState — layout state threaded through all passes
// @see lib/circogen/circular.h:circ_state
// ---------------------------------------------------------------------------

/** @see lib/circogen/circular.h:circ_state */
export interface CircState {
  bl: Block[];
  orderCount: number;
  blockCount: number;
  graphCopyCount: number;
  spanningTreeCount: number;
  minDist: number;
  rootname: string;
}

const MINDIST = 1.0;

/** @see lib/circogen/circular.c:initGraphAttrs */
export function makeCircState(blockCount: number): CircState {
  return {
    bl: [],
    orderCount: 1,
    blockCount,
    graphCopyCount: 0,
    spanningTreeCount: 0,
    minDist: MINDIST,
    rootname: '',
  };
}

/** Create a zero-initialised CircoCData for a given DerivedNode. */
export function makeCData(dn: DerivedNode): CircoCData {
  // Temporarily assign; derivedNode is set by caller after construction.
  return {
    kind: 'circo-cdata',
    flags: 0,
    parent: null,
    block: null,
    bc: { val: 0, lowVal: 0 },
    clone: null,
    tparent: null,
    leafone: null,
    leaftwo: null,
    fdist: 0,
    sdist: 0,
    pos: 0,
    psi: 0,
    degree: 0,
    derivedNode: dn,
  };
}
