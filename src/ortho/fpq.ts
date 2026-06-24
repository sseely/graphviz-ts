// SPDX-License-Identifier: EPL-2.0
/**
 * Max-heap priority queue for Dijkstra shortest path.
 *
 * Faithful port of lib/ortho/fPQ.c.
 * Values stored NEGATED — larger negative = lower priority.
 * The guard node at index 0 has nVal = 0, so upheap stops at root.
 *
 * @see lib/ortho/fPQ.c
 * @see lib/ortho/fPQ.h
 */

import type { SNode } from "./types.js";

/**
 * Priority queue state.
 * @see lib/ortho/fPQ.c:struct pq
 */
export interface Pq {
  pq: (SNode | null)[];
  cnt: number;
  guard: SNode; // sentinel at index 0 (nVal = 0)
  size: number;
}

/**
 * Allocate a priority queue for up to sz nodes.
 * @see lib/ortho/fPQ.c:PQgen
 */
export function pqGen(sz: number): Pq {
  const guard: SNode = {
    nVal: 0,
    nIdx: 0,
    nDad: null,
    nEdge: null,
    nAdj: 0,
    saveNAdj: 0,
    cells: [null, null],
    adjEdgeList: [],
    index: -1,
    isVert: false,
    x: 0,
    y: 0,
  };
  const pq: (SNode | null)[] = new Array<SNode | null>(sz + 1).fill(null);
  pq[0] = guard;
  return { pq, cnt: 0, guard, size: sz };
}

/**
 * Free the priority queue. (No-op in TS.)
 * @see lib/ortho/fPQ.c:PQfree
 */
export function pqFree(_pq: Pq): void {
  // GC handled
}

/**
 * Reset the priority queue to empty.
 * @see lib/ortho/fPQ.c:PQinit
 */
export function pqInit(pq: Pq): void {
  pq.cnt = 0;
}

/** Move node at position k up the heap. @see lib/ortho/fPQ.c:PQupheap */
function pqUpheap(pq: Pq, k: number): void {
  const x = pq.pq[k] as SNode;
  const v = x.nVal;
  let pos = k;
  let next = pos >> 1;
  let n = pq.pq[next] as SNode;
  while (n.nVal < v) {
    pq.pq[pos] = n;
    n.nIdx = pos;
    pos = next;
    next = pos >> 1;
    n = pq.pq[next] as SNode;
  }
  pq.pq[pos] = x;
  x.nIdx = pos;
}

/**
 * Insert node np into the queue.
 * Returns 1 on overflow, 0 on success.
 * @see lib/ortho/fPQ.c:PQ_insert
 */
export function pqInsert(pq: Pq, np: SNode): number {
  if (pq.cnt === pq.size) {
    return 1; // heap overflow
  }
  pq.cnt++;
  pq.pq[pq.cnt] = np;
  pqUpheap(pq, pq.cnt);
  return 0;
}

/** Move node at position k down the heap. @see lib/ortho/fPQ.c:PQdownheap */
function pqDownheap(pq: Pq, k: number): void {
  const x = pq.pq[k] as SNode;
  const v = x.nVal;
  const lim = pq.cnt >> 1;
  let pos = k;
  while (pos <= lim) {
    let j = pos + pos;
    let n = pq.pq[j] as SNode;
    if (j < pq.cnt) {
      const nj1 = pq.pq[j + 1] as SNode;
      if (n.nVal < nj1.nVal) {
        j++;
        n = nj1;
      }
    }
    if (v >= n.nVal) break;
    pq.pq[pos] = n;
    n.nIdx = pos;
    pos = j;
  }
  pq.pq[pos] = x;
  x.nIdx = pos;
}

/**
 * Remove and return the node with the highest nVal (most-negative distance).
 * Returns null when queue is empty.
 * @see lib/ortho/fPQ.c:PQremove
 */
export function pqRemove(pq: Pq): SNode | null {
  if (pq.cnt > 0) {
    const n = pq.pq[1] as SNode;
    pq.pq[1] = pq.pq[pq.cnt];
    pq.cnt--;
    if (pq.cnt > 0) {
      pqDownheap(pq, 1);
    }
    return n;
  }
  return null;
}

/**
 * Update the priority of node n to d and restore heap.
 * @see lib/ortho/fPQ.c:PQupdate
 */
export function pqUpdate(pq: Pq, n: SNode, d: number): void {
  n.nVal = d;
  pqUpheap(pq, n.nIdx);
}
