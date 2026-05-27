// SPDX-License-Identifier: EPL-2.0
/**
 * DtHash — unordered set (DT_SET) backed by a separate-chaining hash table.
 *
 * Ported faithfully from lib/cdt/dthash.c (Kiem-Phong Vo, 05/25/96).
 *
 * Behavioral contracts preserved from C:
 *  - Initial slot count: 256 (HSLOT)
 *  - Resize when size > 2*ntab, suppressed while loop > 0
 *  - loop counter: first() increments; next() returning undefined decrements
 *  - Move-to-front on search when loop === 0; suppressed during walk
 *
 * @see lib/cdt/dthash.c
 * @see lib/cdt/dthdr.h
 */

import type { Comparator, KeyOf } from "./types.js";
import {
  hindex,
  hload,
  HashNode,
  HSLOT,
  rehash,
} from "./hash-core.js";

/**
 * DtHash — unordered set backed by a separate-chaining hash table.
 * @see lib/cdt/dthash.c:dthash
 */
export class DtHash<T, K = T> {
  private _slots: Array<HashNode<T> | null> = [];
  private _size  = 0;
  /** Nesting depth of active walks — suppresses resize when > 0. */
  private _loop  = 0;
  /** Finger: last accessed node — analogous to dt->data.here */
  private _here: HashNode<T> | null = null;
  private readonly _keyOf:   KeyOf<T, K>;
  private readonly _hash:    (key: K) => number;
  private readonly _compare: Comparator<K>;

  constructor(
    keyOf:   KeyOf<T, K>,
    hash:    (key: K) => number,
    compare: Comparator<K>,
  ) {
    this._keyOf   = keyOf;
    this._hash    = hash;
    this._compare = compare;
  }

  /** @see lib/cdt/dtsize.c:dtsize */
  size(): number { return this._size; }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /** Allocate the slot array on first use. */
  private _ensureSlots(): void {
    if (this._slots.length === 0) {
      this._slots = new Array<HashNode<T> | null>(HSLOT).fill(null);
    }
  }

  /**
   * Find a node by key.
   * Returns [node, predecessor, slotIndex]; node is null when not found.
   */
  private _find(key: K, h: number): [HashNode<T> | null, HashNode<T> | null, number] {
    if (this._slots.length === 0) return [null, null, -1];
    const si = hindex(this._slots.length, h);
    let prev: HashNode<T> | null = null;
    let t = this._slots[si];
    while (t !== null) {
      if (t.hash === h && this._compare(key, this._keyOf(t.obj)) === 0) {
        return [t, prev, si];
      }
      prev = t;
      t = t.right;
    }
    return [null, null, si];
  }

  /** Resize if over load and no active walk. */
  private _maybeResize(): void {
    if (this._loop > 0) return;
    if (this._size > hload(this._slots.length)) {
      this._slots = rehash(this._slots, this._size);
    }
  }

  /** End an active walk: decrement loop, possibly trigger deferred resize. */
  private _endWalk(): undefined {
    if (this._loop > 0) this._loop--;
    if (this._size > hload(this._slots.length) && this._loop <= 0) {
      this._slots = rehash(this._slots, this._size);
    }
    return undefined;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Insert obj.  If key already exists returns the existing object (DT_SET).
   * @see lib/cdt/dthash.c:dthash DT_INSERT
   */
  insert(obj: T): T {
    const key = this._keyOf(obj);
    const h   = this._hash(key) >>> 0;

    this._ensureSlots();
    this._maybeResize();

    const [existing, , ] = this._find(key, h);
    if (existing !== null) {
      this._here = existing;
      return existing.obj;
    }

    const node: HashNode<T> = { right: null, hash: h, obj };
    const idx = hindex(this._slots.length, h);
    node.right = this._slots[idx];
    this._slots[idx] = node;
    this._size++;
    this._here = node;
    this._maybeResize();
    return obj;
  }

  /**
   * Delete obj by key.  Returns true if found and removed.
   * @see lib/cdt/dthash.c:dthash DT_DELETE
   */
  delete(obj: T): boolean {
    if (this._size === 0) return false;
    const key = this._keyOf(obj);
    const h   = this._hash(key) >>> 0;
    const [t, prev, si] = this._find(key, h);
    if (t === null) return false;

    if (prev !== null) prev.right = t.right;
    else this._slots[si] = t.right;
    this._size--;
    this._here = prev ?? this._slots[si];
    return true;
  }

  /**
   * Search by key.  Applies move-to-front when loop === 0.
   * @see lib/cdt/dthash.c:dthash DT_SEARCH
   */
  search(key: K): T | undefined {
    if (this._size === 0) return undefined;
    const h = this._hash(key) >>> 0;
    const [t, prev, si] = this._find(key, h);
    if (t === null) return undefined;

    if (prev !== null && this._loop <= 0) {
      prev.right      = t.right;
      t.right         = this._slots[si];
      this._slots[si] = t;
    }
    this._here = t;
    return t.obj;
  }

  /**
   * Return the first element; increments the walk loop counter.
   * Scans slots from index 0 upward.
   * @see lib/cdt/dthash.c:dthash DT_FIRST
   */
  first(): T | undefined {
    if (this._size <= 0) return undefined;
    let t: HashNode<T> | null = null;
    for (let i = 0; i < this._slots.length; i++) {
      if (this._slots[i] !== null) { t = this._slots[i]; break; }
    }
    this._loop++;
    this._here = t;
    return t !== null ? t.obj : undefined;
  }

  /**
   * Return the next element; advance within chain then across slots.
   * Decrements loop counter and triggers deferred resize when exhausted.
   * @see lib/cdt/dthash.c:dthash DT_NEXT
   */
  next(_obj: T): T | undefined {
    if (this._here === null) return this._endWalk();
    const si = hindex(this._slots.length, this._here.hash);
    let p: HashNode<T> | null = this._here.right;
    if (p === null) {
      for (let i = si + 1; i < this._slots.length; i++) {
        if (this._slots[i] !== null) { p = this._slots[i]; break; }
      }
    }
    if (p === null) return this._endWalk();
    this._here = p;
    return p.obj;
  }

  /** Remove all elements. @see lib/cdt/dthash.c:dthash DT_CLEAR */
  clear(): void {
    this._slots.fill(null);
    this._size = 0;
    this._loop = 0;
    this._here = null;
  }
}
