// SPDX-License-Identifier: EPL-2.0
/**
 * DtBag — ordered multiset (Dtobag) backed by a splay tree.
 *
 * Unlike DtSplay (DT_OSET), DtBag allows duplicate keys.  On insert of a
 * duplicate, the new node is inserted immediately to the LEFT of the
 * matching node (mirrors C dttree.c DT_OBAG insert: new node placed in
 * link.left, i.e. the right partition, becoming the successor of the
 * matching group — faithfully ported from dttree.c lines 226-230).
 *
 * Iteration (first/next) produces ascending comparator order.  Among
 * equal-key nodes the splay tree does not guarantee a fixed sub-order,
 * matching Dtobag semantics in C.
 *
 * AD4 extension: required by xlabels.ts which uses dtopen(&Hdisc, Dtobag).
 *
 * @see lib/cdt/dttree.c (DT_OBAG)
 */

import type { Comparator, KeyOf } from "./types.js";
import {
  splay,
  splayMin,
  splayMax,
  splaySplitInsert,
} from "./splay-core.js";
import type { SplayNode } from "./splay-core.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Splice a duplicate node to the left of the current root.
 * Mirrors dttree.c DT_OBAG DT_INSERT (found branch, lines 227-230):
 *   root->left = NULL; root->right = link.left; link.left = root;
 * @see lib/cdt/dttree.c:dttree DT_INSERT (DT_OBAG duplicate branch)
 */
function insertDuplicate<T>(
  node: SplayNode<T>,
  root: SplayNode<T>,
): SplayNode<T> {
  node.left = root.left;
  root.left = null;
  node.right = root;
  return node;
}

/**
 * Walk left-spine from `start` to find a node whose `.obj === target`.
 * All nodes on the spine share the same key.
 * Returns [node, parent] or [null, null] when not found.
 */
function findByIdentity<T, K>(
  start: SplayNode<T>,
  target: T,
  key: K,
  keyOf: KeyOf<T, K>,
  compare: Comparator<K>,
): [SplayNode<T> | null, SplayNode<T> | null] {
  let cur: SplayNode<T> | null = start;
  let parent: SplayNode<T> | null = null;
  while (cur !== null) {
    if (cur.obj === target) return [cur, parent];
    if (compare(key, keyOf(cur.obj)) !== 0) return [null, null];
    parent = cur;
    cur = cur.left;
  }
  return [null, null];
}

/**
 * Unlink `cur` from the tree.  `parent` is its direct parent (null → root).
 * Returns the new root.
 */
function unlinkNode<T>(
  root: SplayNode<T>,
  cur: SplayNode<T>,
  parent: SplayNode<T> | null,
): SplayNode<T> | null {
  const left  = cur.left;
  const right = cur.right;
  let replacement: SplayNode<T> | null;
  if (left === null) {
    replacement = right;
  } else {
    const maxLeft = splayMax(left);
    maxLeft.right = right;
    replacement = maxLeft;
  }
  if (parent === null) return replacement;
  parent.left = replacement;
  return root;
}

// ---------------------------------------------------------------------------
// DtBag class
// ---------------------------------------------------------------------------

export class DtBag<T, K = T> {
  private _root: SplayNode<T> | null = null;
  private _size = 0;
  private readonly _keyOf: KeyOf<T, K>;
  private readonly _compare: Comparator<K>;

  constructor(keyOf: KeyOf<T, K>, compare: Comparator<K>) {
    this._keyOf = keyOf;
    this._compare = compare;
  }

  /** @see lib/cdt/dtsize.c:dtsize */
  size(): number { return this._size; }

  /**
   * Insert obj.  Duplicates ARE inserted (DT_OBAG semantics).
   * @see lib/cdt/dttree.c:dttree DT_INSERT (DT_OBAG branch)
   */
  insert(obj: T): T {
    const node: SplayNode<T> = { left: null, right: null, obj };
    if (this._root === null) {
      this._root = node;
      this._size++;
      return obj;
    }
    const key = this._keyOf(obj);
    this._root = splay(this._root, key, this._keyOf, this._compare);
    const cmp = this._compare(key, this._keyOf(this._root.obj));
    this._root = cmp === 0
      ? insertDuplicate(node, this._root)
      : splaySplitInsert(node, this._root, cmp);
    this._size++;
    return obj;
  }

  /**
   * Delete one occurrence of obj by object identity.
   * @see lib/cdt/dttree.c:dttree DT_OBAG DT_DELETE
   */
  delete(obj: T): boolean {
    if (this._root === null) return false;
    const key = this._keyOf(obj);
    this._root = splay(this._root, key, this._keyOf, this._compare);
    if (this._compare(key, this._keyOf(this._root.obj)) !== 0) return false;
    const [cur, parent] = findByIdentity(
      this._root, obj, key, this._keyOf, this._compare,
    );
    if (cur === null) return false;
    const newRoot = unlinkNode(this._root, cur, parent);
    this._root = newRoot;
    this._size--;
    return true;
  }

  /**
   * Return the minimum element (splays to root).
   * @see lib/cdt/dttree.c:dttree DT_FIRST
   */
  first(): T | undefined {
    if (this._root === null) return undefined;
    this._root = splayMin(this._root);
    return this._root.obj;
  }

  /**
   * Return the in-order successor of obj.
   * @see lib/cdt/dttree.c:dttree DT_NEXT
   */
  next(obj: T): T | undefined {
    if (this._root === null) return undefined;
    const key = this._keyOf(obj);
    this._root = splay(this._root, key, this._keyOf, this._compare);
    const cmp = this._compare(key, this._keyOf(this._root.obj));
    if (cmp < 0) return this._root.obj;
    const right = this._root.right;
    if (right === null) return undefined;
    const minNode = splayMin(right);
    this._root.right = null;
    minNode.left = this._root;
    this._root = minNode;
    return minNode.obj;
  }

  /**
   * Return the maximum element (splays to root).
   * @see lib/cdt/dttree.c:dttree DT_LAST
   */
  last(): T | undefined {
    if (this._root === null) return undefined;
    this._root = splayMax(this._root);
    return this._root.obj;
  }

  /** Remove all elements. */
  clear(): void {
    this._root = null;
    this._size = 0;
  }

  /** Iterate in ascending comparator order via first() / next(). */
  [Symbol.iterator](): Iterator<T> {
    let current: T | undefined = this.first();
    const self = this;
    return {
      next(): IteratorResult<T> {
        if (current === undefined) {
          return { value: undefined as unknown as T, done: true };
        }
        const value = current;
        current = self.next(value);
        return { value, done: false };
      },
    };
  }
}
