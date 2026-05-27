// SPDX-License-Identifier: EPL-2.0
/**
 * DtSplay — ordered set (DT_OSET) backed by a top-down splay tree.
 *
 * Iteration order: ascending by comparator (same as DT_OSET in the C source).
 * Every operation is a structural mutation (splay rotation) — intentional.
 *
 * @see lib/cdt/dttree.c
 */

import type { Comparator, KeyOf } from "./types.js";
import {
  lrotate,
  rrotate,
  splay,
  splayMax,
  splayMin,
  splaySplitInsert,
} from "./splay-core.js";
import type { SplayNode } from "./splay-core.js";

export class DtSplay<T, K = T> {
  /** Current root — analogous to dt->data.here in the C source. */
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
   * Insert obj.  If the key already exists returns the existing object
   * unchanged (DT_OSET: no duplicates).
   * @see lib/cdt/dttree.c:dttree DT_INSERT
   */
  insert(obj: T): T {
    if (this._root === null) {
      this._root = { left: null, right: null, obj };
      this._size++;
      return obj;
    }

    const key = this._keyOf(obj);
    this._root = splay(this._root, key, this._keyOf, this._compare);
    const cmp = this._compare(key, this._keyOf(this._root.obj));

    if (cmp === 0) return this._root.obj; // DT_OSET: return existing

    const node: SplayNode<T> = { left: null, right: null, obj };
    this._root = splaySplitInsert(node, this._root, cmp);
    this._size++;
    return obj;
  }

  /**
   * Delete obj by key.  Returns true if found and removed.
   * @see lib/cdt/dttree.c:dttree DT_DELETE
   */
  delete(obj: T): boolean {
    if (this._root === null) return false;

    const key = this._keyOf(obj);
    this._root = splay(this._root, key, this._keyOf, this._compare);
    if (this._compare(key, this._keyOf(this._root.obj)) !== 0) return false;

    const left  = this._root.left;
    const right = this._root.right;
    if (left === null) {
      this._root = right;
    } else {
      const maxLeft = splayMax(left);
      maxLeft.right = right;
      this._root = maxLeft;
    }

    this._size--;
    return true;
  }

  /**
   * Search by key.  Splays found node to root.
   * @see lib/cdt/dttree.c:dttree DT_SEARCH
   */
  search(key: K): T | undefined {
    if (this._root === null) return undefined;
    this._root = splay(this._root, key, this._keyOf, this._compare);
    return this._compare(key, this._keyOf(this._root.obj)) === 0
      ? this._root.obj : undefined;
  }

  /**
   * Return the minimum element; splays it to root.
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

    // When no exact match and key < root.key, root IS the successor.
    if (cmp < 0) return this._root.obj;

    const right = this._root.right;
    if (right === null) return undefined;

    // Splay min of right subtree, attach old root as its left child.
    const minNode = splayMin(right);
    this._root.right = null;
    minNode.left = this._root;
    this._root = minNode;
    return minNode.obj;
  }

  /**
   * Return the maximum element; splays it to root.
   * @see lib/cdt/dttree.c:dttree DT_LAST
   */
  last(): T | undefined {
    if (this._root === null) return undefined;
    this._root = splayMax(this._root);
    return this._root.obj;
  }

  /**
   * Return the in-order predecessor of obj.
   * @see lib/cdt/dttree.c:dttree DT_PREV
   */
  prev(obj: T): T | undefined {
    if (this._root === null) return undefined;

    const key = this._keyOf(obj);
    this._root = splay(this._root, key, this._keyOf, this._compare);
    const cmp = this._compare(key, this._keyOf(this._root.obj));

    // When no exact match and key > root.key, root IS the predecessor.
    if (cmp > 0) return this._root.obj;

    const left = this._root.left;
    if (left === null) return undefined;

    // Splay max of left subtree, attach old root as its right child.
    const maxNode = splayMax(left);
    this._root.left = null;
    maxNode.right = this._root;
    this._root = maxNode;
    return maxNode.obj;
  }

  /** Remove all elements. @see lib/cdt/dttree.c:dttree DT_CLEAR */
  clear(): void {
    this._root = null;
    this._size = 0;
  }

  /**
   * Iterate in ascending comparator order via first() / next().
   * Each step is a structural mutation per C DT_OSET spec.
   */
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
