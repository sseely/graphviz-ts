// SPDX-License-Identifier: EPL-2.0
/**
 * Internal splay-tree node type and top-down splay algorithm.
 *
 * Ported faithfully from lib/cdt/dttree.c (Kiem-Phong Vo, 5/25/96)
 * and lib/cdt/dthdr.h.
 *
 * PARTITION NAMING INVERSION (preserved from C source):
 *   The dummy `link` node uses inverted field names:
 *     link.right  → head of the LEFT  partition (keys < target)
 *     link.left   → head of the RIGHT partition (keys > target)
 *   `l` is the tail pointer into link.right (LEFT partition).
 *   `r` is the tail pointer into link.left  (RIGHT partition).
 *   llink(l, x): l = l.right = x   — extends LEFT  partition
 *   rlink(r, x): r = r.left  = x   — extends RIGHT partition
 *
 * @see lib/cdt/dttree.c
 * @see lib/cdt/dthdr.h
 */

import type { Comparator, KeyOf } from "./types.js";

/** Internal tree node — analogous to Dtlink_t in the C source. */
export interface SplayNode<T> {
  left: SplayNode<T> | null; // hl._left
  right: SplayNode<T> | null;
  obj: T;
}

// ─── Rotation helpers (mirrors of dthdr.h macros) ────────────────────────────
// rrotate(x, y): x.left = y.right; y.right = x
// lrotate(x, y): x.right = y.left; y.left = x

export function rrotate<T>(x: SplayNode<T>, y: SplayNode<T>): void {
  x.left = y.right;
  y.right = x;
}

export function lrotate<T>(x: SplayNode<T>, y: SplayNode<T>): void {
  x.right = y.left;
  y.left = x;
}

/**
 * Splay minimum of `subtree` to its root via repeated RROTATE.
 * Returns the new root (which has no left child).
 * Mirrors the DT_FIRST loop and the DT_NEXT subtree-min logic.
 * @see lib/cdt/dttree.c:dttree DT_FIRST / DT_NEXT
 */
export function splayMin<T>(subtree: SplayNode<T>): SplayNode<T> {
  let root = subtree;
  let t: SplayNode<T> | null;
  while ((t = root.left) !== null) {
    rrotate(root, t); // root.left = t.right; t.right = root
    root = t;
  }
  return root;
}

/**
 * Splay maximum of `subtree` to its root via repeated LROTATE.
 * Returns the new root (which has no right child).
 * Mirrors the DT_LAST loop and the DT_PREV subtree-max logic.
 * @see lib/cdt/dttree.c:dttree DT_LAST / DT_PREV
 */
export function splayMax<T>(subtree: SplayNode<T>): SplayNode<T> {
  let root = subtree;
  let t: SplayNode<T> | null;
  while ((t = root.right) !== null) {
    lrotate(root, t); // root.right = t.left; t.left = root
    root = t;
  }
  return root;
}

/**
 * Insert `node` as new root by splitting `oldRoot` at the given comparison
 * result `cmp` (compare(newKey, oldRoot.key)).
 * `cmp` must be non-zero (caller already checked for duplicate).
 * Returns the new root.
 * @see lib/cdt/dttree.c:dttree DT_INSERT (not-found branch)
 */
export function splaySplitInsert<T>(
  node: SplayNode<T>,
  oldRoot: SplayNode<T>,
  cmp: number,
): SplayNode<T> {
  if (cmp < 0) {
    // new key < old root: old root becomes right child
    node.left  = oldRoot.left;
    node.right = oldRoot;
    oldRoot.left = null;
  } else {
    // new key > old root: old root becomes left child
    node.right = oldRoot.right;
    node.left  = oldRoot;
    oldRoot.right = null;
  }
  return node;
}

/**
 * Top-down splay.
 *
 * Splays the node whose key equals `key` (or the closest node) to root.
 * Returns the new root.  Always performs structural mutations.
 *
 * @see lib/cdt/dttree.c:dttree (do_search loop)
 */
export function splay<T, K>(
  root: SplayNode<T>,
  key: K,
  keyOf: KeyOf<T, K>,
  compare: Comparator<K>,
): SplayNode<T> {
  // Dummy node: .right = LEFT partition head, .left = RIGHT partition head
  const link: SplayNode<T> = {
    left: null,
    right: null,
    obj: undefined as unknown as T,
  };

  // l = tail of LEFT partition  (extended via l.right = llink)
  // r = tail of RIGHT partition (extended via r.left  = rlink)
  let l: SplayNode<T> = link;
  let r: SplayNode<T> = link;
  let cur: SplayNode<T> | null = root;

  outer: while (cur !== null) {
    const cmp = compare(key, keyOf(cur.obj));

    if (cmp === 0) {
      break;
    } else if (cmp < 0) {
      const t: SplayNode<T> | null = cur.left;
      if (t !== null) {
        const cmp2 = compare(key, keyOf(t.obj));
        if (cmp2 < 0) {
          // zig-zig right: rrotate(cur, t) then rlink(r, t)
          rrotate(cur, t);          // cur.left = t.right; t.right = cur
          r.left = t; r = t;        // rlink: extend RIGHT partition
          cur = t.left;
        } else if (cmp2 === 0) {
          // llink(l, t) — wait, C says: rlink(r, cur); root = t
          // From dttree.c: else if(cmp==0){ llink(l,root); root = t; break; }
          // (when we're going left and find key at t)
          r.left = cur; r = cur;    // rlink(r, cur)
          cur = t;
          break outer;
        } else {
          // cmp2 > 0: llink(l, t) then rlink(r, cur)
          l.right = t; l = t;       // llink: extend LEFT partition
          r.left = cur; r = cur;    // rlink: extend RIGHT partition
          cur = t.right;
        }
        if (cur === null) break;
      } else {
        // no left child: rlink(r, cur)
        r.left = cur; r = cur;
        cur = null;
        break;
      }
    } else {
      // cmp > 0
      const t: SplayNode<T> | null = cur.right;
      if (t !== null) {
        const cmp2 = compare(key, keyOf(t.obj));
        if (cmp2 > 0) {
          // zig-zig left: lrotate(cur, t) then llink(l, t)
          lrotate(cur, t);          // cur.right = t.left; t.left = cur
          l.right = t; l = t;       // llink: extend LEFT partition
          cur = t.right;
        } else if (cmp2 === 0) {
          // From dttree.c: else if(cmp==0){ llink(l,root); root = t; break; }
          l.right = cur; l = cur;   // llink(l, cur)
          cur = t;
          break outer;
        } else {
          // cmp2 < 0: rlink(r, t) then llink(l, cur)
          r.left = t; r = t;        // rlink: extend RIGHT partition
          l.right = cur; l = cur;   // llink: extend LEFT partition
          cur = t.left;
        }
        if (cur === null) break;
      } else {
        // no right child: llink(l, cur)
        l.right = cur; l = cur;
        cur = null;
        break;
      }
    }
  }

  // Reassemble tree
  if (cur !== null) {
    // Found: close partitions, reattach
    l.right = cur.left;
    r.left  = cur.right;
    cur.left  = link.right; // LEFT  partition → left subtree
    cur.right = link.left;  // RIGHT partition → right subtree
    return cur;
  }

  // Not found: close partition tails, merge via rightmost-of-left
  r.left  = null;
  l.right = null;

  const leftPart  = link.right;
  const rightPart = link.left;

  if (leftPart === null)  return rightPart ?? (link as unknown as SplayNode<T>);
  if (rightPart === null) return leftPart;

  // Attach rightPart as right child of rightmost node in leftPart
  let p = leftPart;
  while (p.right !== null) p = p.right;
  p.right = rightPart;
  return leftPart;
}
