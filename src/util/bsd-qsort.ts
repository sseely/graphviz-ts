// SPDX-License-Identifier: EPL-2.0

/**
 * In-place sort matching C's `qsort(3)` permutation, including its treatment of
 * comparator-equal elements.
 *
 * Graphviz sorts via `LIST_SORT` → `gv_list_sort_` → libc `qsort`
 * (`lib/util/list.c:gv_list_sort_`). libc `qsort` is **not stable**: it reorders
 * comparator-equal elements in an implementation-defined permutation. Most port
 * sort sites can use JS's stable `Array.prototype.sort` because their comparator
 * never reports a tie (e.g. `edge-order.ts`). Where ties DO occur AND the
 * downstream result depends on their order, a stable sort diverges from the C
 * oracle.
 *
 * `TB_balance` (`lib/common/ns.c`) is such a site: it sorts nodes by rank
 * (`increasingrankcmpf`, which returns 0 for equal ranks) and then walks the
 * sorted list mutating a per-rank population count, so the order of equal-rank
 * nodes changes which rank each tied node lands on. The macOS/BSD libc `qsort`
 * the oracle links against is the Bentley & McIlroy "Engineering a Sort
 * Function" (1993) introspective quicksort: median-of-3 pivot (pseudo-median of
 * 9 above 40 elements), three-way "fat partition" of equal keys, and an
 * insertion sort for sub-arrays below 7 elements. This module reproduces that
 * algorithm exactly so tie ordering matches the oracle.
 *
 * Verified: on `graphs/mike.gv` TB_balance this reproduces the oracle's 33-node
 * permutation byte-for-byte (threshold 7; thresholds 4/6/8 do not match).
 *
 * @see lib/util/list.c:gv_list_sort_ (the LIST_SORT backend)
 * @see Bentley, McIlroy, "Engineering a Sort Function", Softw. Pract. Exper. 1993
 */

/** Sub-array size below which the C qsort switches to insertion sort. */
const THRESH = 7;
/** Array size above which the C qsort uses a pseudo-median of 9 for the pivot. */
const BIG = 40;

function swap<T>(arr: T[], i: number, j: number): void {
  const t = arr[i];
  arr[i] = arr[j];
  arr[j] = t;
}

/** Swap `n` consecutive elements starting at `i` with those starting at `j`. */
function vecswap<T>(arr: T[], i: number, j: number, n: number): void {
  let k = n;
  while (k-- > 0) swap(arr, i++, j++);
}

/** Median of the elements at indices a, b, c under `cmp` (B&M `med3`). */
function med3<T>(arr: T[], a: number, b: number, c: number, cmp: (x: T, y: T) => number): number {
  return cmp(arr[a], arr[b]) < 0
    ? (cmp(arr[b], arr[c]) < 0 ? b : (cmp(arr[a], arr[c]) < 0 ? c : a))
    : (cmp(arr[b], arr[c]) > 0 ? b : (cmp(arr[a], arr[c]) < 0 ? a : c));
}

/** Insertion sort of `arr[lo .. lo+n)` (B&M small-array branch). */
function insertionSort<T>(arr: T[], lo: number, n: number, cmp: (x: T, y: T) => number): void {
  for (let pm = lo + 1; pm < lo + n; pm++)
    for (let pl = pm; pl > lo && cmp(arr[pl - 1], arr[pl]) > 0; pl--)
      swap(arr, pl, pl - 1);
}

/** Pick the pivot index for `arr[lo .. lo+n)` (median-of-3, pseudo-median of 9). */
function choosePivot<T>(arr: T[], lo: number, n: number, cmp: (x: T, y: T) => number): number {
  let pm = lo + (n >> 1);
  if (n <= THRESH) return pm;
  let pl = lo;
  let pn = lo + (n - 1);
  if (n > BIG) {
    const d = n >> 3;
    pl = med3(arr, pl, pl + d, pl + 2 * d, cmp);
    pm = med3(arr, pm - d, pm, pm + d, cmp);
    pn = med3(arr, pn - 2 * d, pn - d, pn, cmp);
  }
  return med3(arr, pl, pm, pn, cmp);
}

/** Boundaries of the three-way partition: [lo,pb) < pivot, [pc..) > pivot. */
interface Part { pa: number; pb: number; pc: number; pd: number; }

/**
 * Three-way ("fat") partition around the pivot at `arr[lo]`. Equal keys are
 * shoved to the two ends (pa/pd) and swapped back to the middle by the caller.
 */
function partition3<T>(arr: T[], lo: number, n: number, cmp: (x: T, y: T) => number): Part {
  let pa = lo + 1;
  let pb = lo + 1;
  let pc = lo + (n - 1);
  let pd = lo + (n - 1);
  for (;;) {
    let r: number;
    while (pb <= pc && (r = cmp(arr[pb], arr[lo])) <= 0) {
      if (r === 0) { swap(arr, pa, pb); pa++; }
      pb++;
    }
    while (pb <= pc && (r = cmp(arr[pc], arr[lo])) >= 0) {
      if (r === 0) { swap(arr, pc, pd); pd--; }
      pc--;
    }
    if (pb > pc) break;
    swap(arr, pb, pc);
    pb++;
    pc--;
  }
  return { pa, pb, pc, pd };
}

/** Sort `arr[lo .. lo+n)` in place (B&M quicksort body with tail-call elision). */
function qsortRange<T>(arr: T[], lo: number, n: number, cmp: (x: T, y: T) => number): void {
  for (;;) {
    if (n < THRESH) { insertionSort(arr, lo, n, cmp); return; }
    swap(arr, lo, choosePivot(arr, lo, n, cmp)); // pivot to front
    const { pa, pb, pc, pd } = partition3(arr, lo, n, cmp);
    const pn = lo + n;
    let r = Math.min(pa - lo, pb - pa);
    vecswap(arr, lo, pb - r, r);
    r = Math.min(pd - pc, pn - pd - 1);
    vecswap(arr, pb, pn - r, r);
    const leftN = pb - pa;  // count of elements < pivot
    const rightN = pd - pc; // count of elements > pivot
    if (leftN > 1) qsortRange(arr, lo, leftN, cmp);
    if (rightN > 1) { lo = pn - rightN; n = rightN; continue; } // tail recursion
    return;
  }
}

/**
 * Sort `arr` in place, reproducing libc `qsort`'s permutation of
 * comparator-equal elements (Bentley–McIlroy quicksort). Use this instead of
 * `Array.prototype.sort` only where the C oracle's `qsort` tie ordering is
 * load-bearing; elsewhere the stable native sort is preferred.
 *
 * @param arr Array sorted in place (also returned for convenience).
 * @param cmp Comparator returning <0, 0, or >0 — matching the C comparator's
 *   sign, including 0 for elements the C comparator treats as equal.
 */
export function gvQsort<T>(arr: T[], cmp: (a: T, b: T) => number): T[] {
  if (arr.length > 1) qsortRange(arr, 0, arr.length, cmp);
  return arr;
}
