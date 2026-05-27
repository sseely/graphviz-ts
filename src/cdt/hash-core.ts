// SPDX-License-Identifier: EPL-2.0
/**
 * Internal types and resize helpers for DtHash.
 *
 * Ported from lib/cdt/dthash.c (Kiem-Phong Vo, 05/25/96) and
 * lib/cdt/dthdr.h macros: HSLOT, HRESIZE, HLOAD, HINDEX.
 *
 * @see lib/cdt/dthash.c:dthtab
 * @see lib/cdt/dthdr.h
 */

/** Initial number of hash slots — HSLOT from dthdr.h */
export const HSLOT = 256;

/** Load threshold: resize when size > HLOAD(ntab) = 2*ntab @see dthdr.h:HLOAD */
export function hload(n: number): number { return n << 1; }

/** Map hash to slot index: HINDEX(n,h) = h & (n-1) @see dthdr.h:HINDEX */
export function hindex(n: number, h: number): number { return h & (n - 1); }

/** Internal chain node — analogous to Dtlink_t used in DT_SET mode. */
export interface HashNode<T> {
  right: HashNode<T> | null; // next in chain (Dtlink_t.right)
  hash:  number;             // hl._hash
  obj:   T;
}

/**
 * Migrate one slot's chain into newSlots of size n.
 * Nodes that map to a different slot are moved; those that stay are left
 * in oldSlots[si] and copied to newSlots[si] at the end.
 * @see lib/cdt/dthash.c:dthtab (inner rehash loop)
 */
export function migrateChain<T>(
  oldSlots: Array<HashNode<T> | null>,
  newSlots: Array<HashNode<T> | null>,
  si: number,
  n: number,
): void {
  let prev: HashNode<T> | null = null;
  let t = oldSlots[si];
  while (t !== null) {
    const next = t.right;
    const dest = hindex(n, t.hash);
    if (dest === si) {
      prev = t;
    } else {
      if (prev !== null) prev.right = next;
      else oldSlots[si] = next;
      t.right = newSlots[dest];
      newSlots[dest] = t;
    }
    t = next;
  }
  if (oldSlots[si] !== null) newSlots[si] = oldSlots[si];
}

/**
 * Compute the smallest power-of-two slot count that keeps size under load.
 * @see lib/cdt/dthash.c:dthtab (size computation block)
 */
export function targetSlotCount(current: number, size: number): number {
  let n = current === 0 ? HSLOT : current;
  while (size > hload(n)) n = n << 1; // HRESIZE
  return n;
}

/**
 * Resize and rehash the table; returns the new slot array.
 * No-op (returns oldSlots unchanged) when no resize is needed.
 * @see lib/cdt/dthash.c:dthtab
 */
export function rehash<T>(
  oldSlots: Array<HashNode<T> | null>,
  size: number,
): Array<HashNode<T> | null> {
  const n = targetSlotCount(oldSlots.length, size);
  if (n === oldSlots.length) return oldSlots;
  const newSlots: Array<HashNode<T> | null> = new Array(n).fill(null);
  for (let si = 0; si < oldSlots.length; si++) {
    migrateChain(oldSlots, newSlots, si, n);
  }
  return newSlots;
}
