// SPDX-License-Identifier: EPL-2.0

/**
 * R-tree public API: open/close/insert/search.
 * @see label/index.h
 * @see label/index.c
 */

import { type Rect, overlap, combineRect, NUMDIMS } from './rectangle.js';
import {
  NODECARD,
  type Branch,
  type Node,
  type SplitQ,
  rTreeNewNode,
  nodeCover,
  pickBranch,
  addBranch,
  disconnectBranch,
  makeSplitQ,
} from './node.js';

// Import split-q.ts for its side-effect: registerSplitNode().
// Without this import addBranch will throw when a split is needed.
import './split-q.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * An R-tree leaf: the bounding rect and the caller-supplied data pointer.
 *
 * In C this is `Leaf_t { Rect_t rect; void *data; }` and a leaf branch is
 * cast directly to Leaf_t* — `branch[i].child` holds the data pointer while
 * `branch[i].rect` is the bounding rectangle.  We replicate that layout here.
 *
 * @see label/index.h:Leaf_t
 */
export interface Leaf {
  rect: Rect;
  /** Caller-supplied opaque data (C: void *). */
  data: unknown;
}

/**
 * R-tree: root node plus the SplitQ scratchpad.
 * @see label/index.h:struct RTree
 */
export interface RTree {
  root: Node | null;
  split: SplitQ;
}

// ---------------------------------------------------------------------------
// Internal leaf-list helpers
// ---------------------------------------------------------------------------

/**
 * Leaf list node — a singly-linked cons cell.
 *
 * C iterates with `for (LeafList_t *ilp = llp; ilp; ilp = ilp->next)`.
 * Each new hit is prepended (list-cons), so within a leaf node the order
 * is REVERSED relative to branch-slot scan order (slot 0 is last in list).
 * Between subtrees of an internal node, child results are appended to the
 * tail in child-slot order.
 *
 * rTreeSearch returns a plain Leaf[] that reproduces this exact iteration
 * sequence: within each leaf, hits appear in reverse slot order; across
 * internal-node children, results are in forward slot order.
 *
 * @see label/index.c:LeafList_t
 */
interface LeafListNode {
  leaf: Leaf;
  next: LeafListNode | null;
}

/** Prepend a new hit to the list — mirrors RTreeLeafListAdd. */
function leafListAdd(head: LeafListNode | null, leaf: Leaf): LeafListNode {
  return { leaf, next: head };
}

/** Append list `tail` to the end of `head`; returns the new head. */
function leafListAppend(
  head: LeafListNode | null,
  tail: LeafListNode | null,
): LeafListNode | null {
  if (!head) return tail;
  if (!tail) return head;
  let cur: LeafListNode = head;
  while (cur.next) cur = cur.next;
  cur.next = tail;
  return head;
}

/** Convert a linked list to an array, preserving iteration order. */
function leafListToArray(head: LeafListNode | null): Leaf[] {
  const result: Leaf[] = [];
  for (let cur = head; cur !== null; cur = cur.next) {
    result.push(cur.leaf);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Allocate and initialise a new R-tree.
 * @see label/index.c:RTreeOpen
 */
export function rTreeOpen(): RTree {
  return { root: rTreeNewIndex(), split: makeSplitQ() };
}

/**
 * Recursively free all nodes.  In GC'd TS the objects will be collected
 * anyway; this mirrors the C traversal so behaviour is faithful.
 * @see label/index.c:RTreeClose2
 */
function rTreeClose2(n: Node): void {
  if (n.level > 0) {
    for (let i = 0; i < NODECARD; i++) {
      if (!n.branch[i].child) continue;
      rTreeClose2(n.branch[i].child as Node);
      disconnectBranch(n, i);
    }
  } else {
    for (let i = 0; i < NODECARD; i++) {
      if (!n.branch[i].child) continue;
      disconnectBranch(n, i);
    }
  }
}

/**
 * Close (free) the R-tree.
 * In GC'd TS this is a no-op in practice, but we walk and clear the tree
 * faithfully to mirror the C version and release references eagerly.
 * @see label/index.c:RTreeClose
 */
export function rTreeClose(rtp: RTree): void {
  if (rtp.root) {
    rTreeClose2(rtp.root);
    rtp.root = null;
  }
}

/**
 * Make a new empty index (single leaf node at level 0).
 * @see label/index.c:RTreeNewIndex
 */
export function rTreeNewIndex(): Node {
  const x = rTreeNewNode();
  x.level = 0; // leaf
  return x;
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/**
 * Recursive search helper.
 *
 * Leaf-list construction mirrors C exactly:
 *   - Leaf node: `RTreeLeafListAdd` prepends each hit → reverse slot order
 *     within a leaf.
 *   - Internal node: each child's result list is appended to the tail of
 *     the accumulator → child results in forward slot order.
 *
 * @see label/index.c:RTreeSearch
 */
/** Search internal node: recurse into overlapping children, append results. */
function searchInternal(n: Node, r: Rect): LeafListNode | null {
  let llp: LeafListNode | null = null;
  for (let i = 0; i < NODECARD; i++) {
    if (n.branch[i].child && overlap(r, n.branch[i].rect)) {
      const tlp = rTreeSearchRec(n.branch[i].child as Node, r);
      llp = leafListAppend(llp, tlp);
    }
  }
  return llp;
}

/** Search leaf node: prepend each matching branch (reverse slot order). */
function searchLeaf(n: Node, r: Rect): LeafListNode | null {
  let llp: LeafListNode | null = null;
  for (let i = 0; i < NODECARD; i++) {
    if (n.branch[i].child && overlap(r, n.branch[i].rect)) {
      llp = leafListAdd(llp, { rect: n.branch[i].rect, data: n.branch[i].child });
    }
  }
  return llp;
}

function rTreeSearchRec(n: Node, r: Rect): LeafListNode | null {
  return n.level > 0 ? searchInternal(n, r) : searchLeaf(n, r);
}

/**
 * Search the index for all data rectangles overlapping `r`.
 *
 * Returns a Leaf[] whose iteration order matches C's LeafList_t traversal:
 * within each leaf node hits are in reverse branch-slot order (list-cons
 * prepend); across internal-node children results are in forward slot order.
 *
 * @see label/index.c:RTreeSearch
 */
export function rTreeSearch(rtp: RTree, n: Node, r: Rect): Leaf[] {
  void rtp; // rtp unused in search (matches C signature for API parity)
  return leafListToArray(rTreeSearchRec(n, r));
}

// ---------------------------------------------------------------------------
// Insert
// ---------------------------------------------------------------------------

/** Bundled insert context — reduces per-call param count. */
interface InsertCtx {
  rtp: RTree;
  r: Rect;
  data: unknown;
  level: number;
}

/** Insert2: handle n.level > ctx.level (descend, propagate split). */
function insert2Descend(
  ctx: InsertCtx, n: Node, newOut: { value: Node | null },
): number {
  const n2Out: { value: Node | null } = { value: null };
  const i = pickBranch(ctx.r, n);
  if (!rTreeInsert2(ctx, n.branch[i].child as Node, n2Out)) {
    n.branch[i].rect = combineRect(ctx.r, n.branch[i].rect);
    return 0;
  }
  n.branch[i].rect = nodeCover(n.branch[i].child as Node);
  const b: Branch = { rect: nodeCover(n2Out.value as Node), child: n2Out.value };
  return addBranch(ctx.rtp, b, n, newOut);
}

/**
 * Recursive insert helper.
 * Returns 0 if node not split; 1 + sets newOut.value if split.
 * @see label/index.c:RTreeInsert2
 */
function rTreeInsert2(
  ctx: InsertCtx, n: Node, newOut: { value: Node | null },
): number {
  if (n.level > ctx.level) return insert2Descend(ctx, n, newOut);
  if (n.level === ctx.level) {
    return addBranch(ctx.rtp, { rect: ctx.r, child: ctx.data as Node }, n, newOut);
  }
  return 0; // should never happen
}

/** Validate rect: low side must be <= high side per dimension. */
function validateRect(r: Rect): void {
  for (let i = 0; i < NUMDIMS; i++) {
    if (r.boundary[i] > r.boundary[NUMDIMS + i]) {
      throw new Error('rTreeInsert: rect low > high');
    }
  }
}

/** Grow a new root after the old root was split into oldRoot + sibling. */
function growRoot(rtp: RTree, sibling: Node): void {
  const newRoot = rTreeNewNode();
  newRoot.level = (rtp.root as Node).level + 1;
  addBranch(rtp, { rect: nodeCover(rtp.root as Node), child: rtp.root }, newRoot, { value: null });
  addBranch(rtp, { rect: nodeCover(sibling), child: sibling }, newRoot, { value: null });
  rtp.root = newRoot;
}

/**
 * Insert a data rectangle into the index.
 * Returns 1 if root was split, 0 otherwise. Updates rtp.root on split.
 * @see label/index.c:RTreeInsert
 */
export function rTreeInsert(rtp: RTree, r: Rect, data: unknown): number {
  validateRect(r);
  const newNodeOut: { value: Node | null } = { value: null };
  const ctx: InsertCtx = { rtp, r, data, level: 0 };
  if (!rTreeInsert2(ctx, rtp.root as Node, newNodeOut)) return 0;
  growRoot(rtp, newNodeOut.value as Node);
  return 1;
}

/**
 * Free a LeafList.  In GC'd TypeScript this is a documented no-op stub;
 * the caller may discard the Leaf[] returned by rTreeSearch without calling
 * this function.
 *
 * Kept as a named export so callers ported from C can call it without change.
 *
 * @see label/index.c:RTreeLeafListFree
 */
export function rTreeLeafListFree(_leaves: Leaf[]): void {
  // No-op: GC handles deallocation.
}
