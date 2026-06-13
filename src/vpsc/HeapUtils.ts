// SPDX-License-Identifier: EPL-2.0

/**
 * Min-heap helpers over Constraint arrays.
 *
 * The C++ code uses std::make_heap / std::push_heap / std::pop_heap with a
 * `gt` comparator that flips compareConstraints, producing a min-heap.
 * We replicate that with a standard binary heap stored in an array.
 *
 * @see lib/vpsc/block.cpp: make_heap, insert, deleteMin, findMin, merge_heaps, gt
 */

import { Constraint, compareConstraints } from "./Constraint.js";

/**
 * Greater-than comparator: flips compareConstraints to turn a max-heap into
 * a min-heap (matching the C++ `gt` lambda).
 * @see lib/vpsc/block.cpp: static bool gt(...)
 */
export function heapGt(l: Constraint, r: Constraint): boolean {
  return compareConstraints(r, l);
}

/**
 * Bubble element at index i upward until the heap property is restored.
 * @see lib/vpsc/block.cpp: std::push_heap internals
 */
export function heapSiftUp(h: Constraint[], i: number): void {
  while (i > 0) {
    const parent = (i - 1) >> 1;
    if (!heapGt(h[parent]!, h[i]!)) break;
    const tmp = h[parent]!;
    h[parent] = h[i]!;
    h[i] = tmp;
    i = parent;
  }
}

/**
 * Push element at index i downward until the heap property is restored.
 * @see lib/vpsc/block.cpp: std::pop_heap internals
 */
export function heapSiftDown(h: Constraint[], i: number): void {
  const n = h.length;
  for (;;) {
    let smallest = i;
    const l = 2 * i + 1;
    const r = 2 * i + 2;
    if (l < n && heapGt(h[smallest]!, h[l]!)) smallest = l;
    if (r < n && heapGt(h[smallest]!, h[r]!)) smallest = r;
    if (smallest === i) break;
    const tmp = h[i]!;
    h[i] = h[smallest]!;
    h[smallest] = tmp;
    i = smallest;
  }
}

/** @see lib/vpsc/block.cpp: static void make_heap(...) */
export function makeHeap(h: Constraint[]): void {
  for (let i = (h.length >> 1) - 1; i >= 0; i--) {
    heapSiftDown(h, i);
  }
}

/** @see lib/vpsc/block.cpp: static Constraint *findMin(...) */
export function heapFindMin(h: Constraint[]): Constraint {
  return h[0]!;
}

/** @see lib/vpsc/block.cpp: static void deleteMin(...) */
export function heapDeleteMin(h: Constraint[]): void {
  h[0] = h[h.length - 1]!;
  h.pop();
  if (h.length > 0) heapSiftDown(h, 0);
}

/** @see lib/vpsc/block.cpp: static void insert(...) */
export function heapInsert(h: Constraint[], c: Constraint): void {
  h.push(c);
  heapSiftUp(h, h.length - 1);
}

/** @see lib/vpsc/block.cpp: static void merge_heaps(...) */
export function mergeHeaps(heap1: Constraint[], heap2: Constraint[]): void {
  for (const c of heap2) heap1.push(c);
  makeHeap(heap1);
}
