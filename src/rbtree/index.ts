// SPDX-License-Identifier: EPL-2.0

/**
 * Red-black balanced binary search tree, ported from lib/rbtree/.
 *
 * Original implementation by Emin Martinian. All algorithms, sentinel
 * design, and behavioral details are preserved exactly from the C source.
 *
 * @see lib/rbtree/red_black_tree.h
 * @see lib/rbtree/red_black_tree.c
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * A single node in the red-black tree.
 * All leaf pointers point to `tree.nil`; never JS null/undefined.
 * @see lib/rbtree/red_black_tree.h:26-32 rb_red_blk_node
 */
export interface RbNode {
  key: unknown;
  /** Color: 1 = red, 0 = black. */
  red: number;
  left: RbNode;
  right: RbNode;
  parent: RbNode;
}

/**
 * Tree handle. `root` is a dummy sentinel; real BST root is `root.left`.
 * `nil` is the leaf sentinel; always black.
 * @see lib/rbtree/red_black_tree.h:37-48 rb_red_blk_tree
 */
export interface RbTree {
  nil: RbNode;
  root: RbNode;
  compare: (a: unknown, b: unknown) => number;
  destroyKey: (key: unknown) => void;
}

// ---------------------------------------------------------------------------
// Internal helpers — exported so lizard parses function boundaries correctly.
// These are implementation details; only the six public symbols below form
// the stable API.
// ---------------------------------------------------------------------------

/** @internal */
export function makeNode(): RbNode {
  return {} as RbNode;
}

/**
 * Left-rotate around node `x`.
 * Guards nil.parent to avoid corrupting the sentinel (see C source comments).
 * @internal
 * @see lib/rbtree/red_black_tree.c:79-112 LeftRotate
 */
export function leftRotate(tree: RbTree, x: RbNode): void {
  const nil = tree.nil;
  const y = x.right;
  x.right = y.left;
  if (y.left !== nil) y.left.parent = x; // guard: do not write nil.parent
  y.parent = x.parent;
  if (x === x.parent.left) {
    x.parent.left = y;
  } else {
    x.parent.right = y;
  }
  y.left = x;
  x.parent = y;
}

/**
 * Right-rotate around node `y`. Symmetric nil-sentinel guard as leftRotate.
 * @internal
 * @see lib/rbtree/red_black_tree.c:132-164 RightRotate
 */
export function rightRotate(tree: RbTree, y: RbNode): void {
  const nil = tree.nil;
  const x = y.left;
  y.left = x.right;
  if (x.right !== nil) x.right.parent = y; // guard: do not write nil.parent
  x.parent = y.parent;
  if (y === y.parent.left) {
    y.parent.left = x;
  } else {
    y.parent.right = x;
  }
  x.right = y;
  y.parent = x;
}

/**
 * Plain BST insertion of z (no rebalancing). Equal keys route right.
 * @internal
 * @see lib/rbtree/red_black_tree.c:181-207 TreeInsertHelp
 */
export function treeInsertHelp(tree: RbTree, z: RbNode): void {
  const nil = tree.nil;
  z.left = nil;
  z.right = nil;
  let y: RbNode = tree.root;
  let x: RbNode = tree.root.left;
  while (x !== nil) {
    y = x;
    x = tree.compare(x.key, z.key) === 1 ? x.left : x.right;
  }
  z.parent = y;
  if (y === tree.root || tree.compare(y.key, z.key) === 1) {
    y.left = z;
  } else {
    y.right = z;
  }
}

/**
 * Insert fixup: parent is a left child (CLRS cases 1-3).
 * Returns the updated cursor node x.
 * @internal
 */
export function insertFixUpLeft(tree: RbTree, xIn: RbNode): RbNode {
  let x = xIn;
  const y = x.parent.parent.right; // uncle
  if (y.red) {
    x.parent.red = 0;
    y.red = 0;
    x.parent.parent.red = 1;
    return x.parent.parent;
  }
  if (x === x.parent.right) {
    x = x.parent;
    leftRotate(tree, x);
  }
  x.parent.red = 0;
  x.parent.parent.red = 1;
  rightRotate(tree, x.parent.parent);
  return x;
}

/**
 * Insert fixup: parent is a right child (CLRS cases 1-3, symmetric).
 * Returns the updated cursor node x.
 * @internal
 */
export function insertFixUpRight(tree: RbTree, xIn: RbNode): RbNode {
  let x = xIn;
  const y = x.parent.parent.left; // uncle
  if (y.red) {
    x.parent.red = 0;
    y.red = 0;
    x.parent.parent.red = 1;
    return x.parent.parent;
  }
  if (x === x.parent.left) {
    x = x.parent;
    rightRotate(tree, x);
  }
  x.parent.red = 0;
  x.parent.parent.red = 1;
  leftRotate(tree, x.parent.parent);
  return x;
}

/** @internal Delete fixup left-child case (CLRS §13.4). Returns updated cursor. */
export function deleteFixUpLeft(tree: RbTree, xIn: RbNode, root: RbNode): RbNode {
  let w = xIn.parent.right;
  if (w.red) {
    w.red = 0;
    xIn.parent.red = 1;
    leftRotate(tree, xIn.parent);
    w = xIn.parent.right;
  }
  if (!w.right.red && !w.left.red) {
    w.red = 1;
    return xIn.parent;
  }
  if (!w.right.red) {
    w.left.red = 0;
    w.red = 1;
    rightRotate(tree, w);
    w = xIn.parent.right;
  }
  w.red = xIn.parent.red;
  xIn.parent.red = 0;
  w.right.red = 0;
  leftRotate(tree, xIn.parent);
  return root;
}

/** @internal Delete fixup right-child case (CLRS §13.4, symmetric). Returns updated cursor. */
export function deleteFixUpRight(tree: RbTree, xIn: RbNode, root: RbNode): RbNode {
  let w = xIn.parent.left;
  if (w.red) {
    w.red = 0;
    xIn.parent.red = 1;
    rightRotate(tree, xIn.parent);
    w = xIn.parent.left;
  }
  if (!w.right.red && !w.left.red) {
    w.red = 1;
    return xIn.parent;
  }
  if (!w.left.red) {
    w.right.red = 0;
    w.red = 1;
    leftRotate(tree, w);
    w = xIn.parent.left;
  }
  w.red = xIn.parent.red;
  xIn.parent.red = 0;
  w.left.red = 0;
  rightRotate(tree, xIn.parent);
  return root;
}

/** @internal Restore red-black invariants after removal. @see red_black_tree.c:447 RBDeleteFixUp */
export function rbDeleteFixUp(tree: RbTree, xIn: RbNode): void {
  const root = tree.root.left;
  let x = xIn;
  while (!x.red && root !== x) {
    if (x === x.parent.left) {
      x = deleteFixUpLeft(tree, x, root);
    } else {
      x = deleteFixUpRight(tree, x, root);
    }
  }
  x.red = 0;
}

/**
 * Splice successor y into z's position (two-child delete case).
 * Calls destroyKey on z.key, not y.key, per the C source.
 * @internal
 */
export function spliceSuccessorIntoZ(
  tree: RbTree,
  y: RbNode,
  z: RbNode,
  x: RbNode,
): void {
  if (!y.red) rbDeleteFixUp(tree, x);
  tree.destroyKey(z.key);
  y.left = z.left;
  y.right = z.right;
  y.parent = z.parent;
  y.red = z.red;
  z.left.parent = y;
  z.right.parent = y;
  if (z === z.parent.left) {
    z.parent.left = y;
  } else {
    z.parent.right = y;
  }
}

/**
 * Postorder destruction helper.
 * @internal
 * @see lib/rbtree/red_black_tree.c:367-375 TreeDestHelper
 */
export function treeDestHelper(tree: RbTree, x: RbNode): void {
  if (x !== tree.nil) {
    treeDestHelper(tree, x.left);
    treeDestHelper(tree, x.right);
    tree.destroyKey(x.key);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new empty red-black tree with the given comparator and destructor.
 * @see lib/rbtree/red_black_tree.c:27-60 RBTreeCreate
 */
export function rbTreeCreate(
  compare: (a: unknown, b: unknown) => number,
  destroyKey: (key: unknown) => void,
): RbTree {
  const nil = makeNode();
  nil.parent = nil;
  nil.left = nil;
  nil.right = nil;
  nil.red = 0;
  nil.key = null;
  const root = makeNode();
  root.parent = nil;
  root.left = nil;
  root.right = nil;
  root.key = null;
  root.red = 0;
  return { nil, root, compare, destroyKey };
}

/**
 * Insert `key` into the tree and return the new node.
 * Node pointer is stable until rbDelete or rbTreeDestroy is called on it.
 * @see lib/rbtree/red_black_tree.c:229-280 RBTreeInsert
 */
export function rbTreeInsert(tree: RbTree, key: unknown): RbNode {
  const newNode = makeNode();
  newNode.key = key;
  treeInsertHelp(tree, newNode);
  let x: RbNode = newNode;
  x.red = 1;
  while (x.parent.red) {
    if (x.parent === x.parent.parent.left) {
      x = insertFixUpLeft(tree, x);
    } else {
      x = insertFixUpRight(tree, x);
    }
  }
  tree.root.left.red = 0;
  return newNode;
}

/**
 * Delete node `z` from the tree and call destroyKey on its key.
 * Uses successor-splice strategy when z has two non-nil children.
 * After this call z must not be used.
 * @see lib/rbtree/red_black_tree.c:524-567 RBDelete
 */
export function rbDelete(tree: RbTree, z: RbNode): void {
  const nil = tree.nil;
  const root = tree.root;
  const y: RbNode = z.left === nil || z.right === nil
    ? z
    : treeSuccessor(tree, z);
  const x: RbNode = y.left === nil ? y.right : y.left;
  x.parent = y.parent; // intentional assignment (mirrors C)
  if (root === y.parent) {
    root.left = x;
  } else if (y === y.parent.left) {
    y.parent.left = x;
  } else {
    y.parent.right = x;
  }
  if (y !== z) {
    spliceSuccessorIntoZ(tree, y, z, x);
  } else {
    tree.destroyKey(y.key);
    if (!y.red) rbDeleteFixUp(tree, x);
  }
}

/**
 * Destroy all nodes. Tree must not be used after this call.
 * @see lib/rbtree/red_black_tree.c:391-396 RBTreeDestroy
 */
export function rbTreeDestroy(tree: RbTree): void {
  treeDestHelper(tree, tree.root.left);
}

/**
 * Search for a node whose key equals `q` per the tree's comparator.
 * Returns the highest matching node when duplicates exist.
 * Returns null (not tree.nil) when no match is found.
 * @see lib/rbtree/red_black_tree.c:412-428 RBExactQuery
 */
export function rbExactQuery(tree: RbTree, q: unknown): RbNode | null {
  const nil = tree.nil;
  let x: RbNode = tree.root.left;
  if (x === nil) return null;
  let compVal = tree.compare(x.key, q);
  while (compVal !== 0) {
    x = compVal === 1 ? x.left : x.right;
    if (x === nil) return null;
    compVal = tree.compare(x.key, q);
  }
  return x;
}

/**
 * Return in-order successor of x (next larger key).
 * Returns tree.nil when x is the maximum element.
 * @see lib/rbtree/red_black_tree.c:296-315 TreeSuccessor
 */
export function treeSuccessor(tree: RbTree, x: RbNode): RbNode {
  const nil = tree.nil;
  const root = tree.root;
  let y: RbNode;
  if ((y = x.right) !== nil) {
    while (y.left !== nil) y = y.left;
    return y;
  }
  y = x.parent;
  while (x === y.right) {
    x = y;
    y = y.parent;
  }
  if (y === root) return nil;
  return y;
}

/**
 * Return in-order predecessor of x (next smaller key).
 * Returns tree.nil when x is the minimum element.
 * @see lib/rbtree/red_black_tree.c:331-350 TreePredecessor
 */
export function treePredecessor(tree: RbTree, x: RbNode): RbNode {
  const nil = tree.nil;
  const root = tree.root;
  let y: RbNode;
  if ((y = x.left) !== nil) {
    while (y.right !== nil) y = y.right;
    return y;
  }
  y = x.parent;
  while (x === y.left) {
    if (y === root) return nil;
    x = y;
    y = y.parent;
  }
  return y;
}
