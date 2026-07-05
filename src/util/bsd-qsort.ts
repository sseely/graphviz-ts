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

/**
 * Insertion sort of `arr[lo .. lo+n)` with an optional swap budget (Apple
 * `_isort`). `swapLimit === 0` means unlimited (the small-array branch, which
 * must complete). With a positive limit, returns `false` — leaving the array
 * PARTIALLY sorted, mutations kept, exactly like the C code — once the number
 * of swaps exceeds the limit.
 */
function insertionSort<T>(
  arr: T[], lo: number, n: number, cmp: (x: T, y: T) => number, swapLimit = 0,
): boolean {
  let swapCnt = 0;
  for (let pm = lo + 1; pm < lo + n; pm++)
    for (let pl = pm; pl > lo && cmp(arr[pl - 1], arr[pl]) > 0; pl--) {
      swap(arr, pl, pl - 1);
      if (swapLimit !== 0 && ++swapCnt > swapLimit) return false;
    }
  return true;
}

/** Pick the pivot index for `arr[lo .. lo+n)` (median-of-3, pseudo-median of 9). */
function choosePivot<T>(arr: T[], lo: number, n: number, cmp: (x: T, y: T) => number): number {
  let pm = lo + (n >> 1);
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
interface Part { pa: number; pb: number; pc: number; pd: number; swapped: boolean; }

/**
 * Three-way ("fat") partition around the pivot at `arr[lo]`. Equal keys are
 * shoved to the two ends (pa/pd) and swapped back to the middle by the caller.
 */
function partition3<T>(arr: T[], lo: number, n: number, cmp: (x: T, y: T) => number): Part {
  let pa = lo + 1;
  let pb = lo + 1;
  let pc = lo + (n - 1);
  let pd = lo + (n - 1);
  let swapped = false;
  for (;;) {
    let r: number;
    while (pb <= pc && (r = cmp(arr[pb], arr[lo])) <= 0) {
      if (r === 0) { swapped = true; swap(arr, pa, pb); pa++; }
      pb++;
    }
    while (pb <= pc && (r = cmp(arr[pc], arr[lo])) >= 0) {
      if (r === 0) { swapped = true; swap(arr, pc, pd); pd--; }
      pc--;
    }
    if (pb > pc) break;
    swap(arr, pb, pc);
    swapped = true;
    pb++;
    pc--;
  }
  return { pa, pb, pc, pd, swapped };
}

/**
 * Sift the 1-based virtual index `parI` down through the max-heap occupying
 * `arr[lo .. lo+nmemb)` (virtual indices `1..nmemb`, `at(i) = arr[lo+i-1]`) to
 * restore heap order. Ported from the `CREATE` macro's loop body.
 * @see apple-oss-distributions/Libc stdlib/FreeBSD/heapsort.c:CREATE
 */
function heapSiftDown<T>(
  arr: T[], lo: number, nmemb: number, parI: number, cmp: (a: T, b: T) => number,
): void {
  const at = (i: number) => arr[lo + i - 1];
  for (;;) {
    let childI = parI * 2;
    if (childI > nmemb) return;
    if (childI < nmemb && cmp(at(childI), at(childI + 1)) < 0) childI++;
    if (cmp(at(childI), at(parI)) <= 0) return;
    const tmp = arr[lo + parI - 1];
    arr[lo + parI - 1] = arr[lo + childI - 1];
    arr[lo + childI - 1] = tmp;
    parI = childI;
  }
}

/**
 * Remove the heap root (already saved by the caller into `k`) from the
 * `nmemb`-element heap in `arr[lo .. lo+nmemb)`, then re-insert `k`. Ported
 * from the `SELECT` macro: first follow the larger-child path down from the
 * root copying child values up into their parent's slot (a "hole" moves
 * down without full swaps), then walk the hole back up toward the root to
 * find `k`'s resting place.
 * @see apple-oss-distributions/Libc stdlib/FreeBSD/heapsort.c:SELECT
 */
function heapSelect<T>(
  arr: T[], lo: number, nmemb: number, k: T, cmp: (a: T, b: T) => number,
): void {
  const at = (i: number) => arr[lo + i - 1];
  let parI = 1;
  let childI: number;
  for (;;) {
    childI = parI * 2;
    if (childI > nmemb) break;
    if (childI < nmemb && cmp(at(childI), at(childI + 1)) < 0) childI++;
    arr[lo + parI - 1] = arr[lo + childI - 1];
    parI = childI;
  }
  for (;;) {
    childI = parI;
    parI = childI >> 1;
    if (childI === 1 || cmp(k, at(parI)) < 0) {
      arr[lo + childI - 1] = k;
      return;
    }
    arr[lo + childI - 1] = arr[lo + parI - 1];
  }
}

/**
 * BSD heapsort — the fallback Apple libc `_qsort` dispatches to when
 * introsort's recursion-depth budget (`2*(fls(n)-1)`) is exhausted, guarding
 * against adversarial inputs that defeat median-of-3 pivot selection. Not
 * observed to trigger on this corpus (all inputs stay within budget), but
 * CLAUDE.md requires porting every branch a faithful port can reach.
 *
 * @see apple-oss-distributions/Libc stdlib/FreeBSD/heapsort.c:heapsort
 */
export function heapSort<T>(arr: T[], lo: number, n: number, cmp: (a: T, b: T) => number): void {
  if (n <= 1) return;
  for (let l = n >> 1; l >= 1; l--) heapSiftDown(arr, lo, n, l, cmp);
  for (let nmemb = n; nmemb > 1; nmemb--) {
    const k = arr[lo + nmemb - 1];
    arr[lo + nmemb - 1] = arr[lo];
    heapSelect(arr, lo, nmemb - 1, k, cmp);
  }
}

/** Sort `arr[lo .. lo+n)` in place (Apple Libc `_qsort` body, R4 prototype). */
function qsortRange<T>(
  arr: T[], lo: number, n: number, cmp: (x: T, y: T) => number, depthLimit: number,
): void {
  for (;;) {
    if (depthLimit-- <= 0) {
      // We've hit our recursion limit, switch to heapsort.
      // @see apple-oss-distributions/Libc stdlib/FreeBSD/qsort.c (depth_limit check)
      heapSort(arr, lo, n, cmp);
      return;
    }
    if (n <= THRESH) { insertionSort(arr, lo, n, cmp); return; }
    swap(arr, lo, choosePivot(arr, lo, n, cmp)); // pivot to front
    const { pa, pb, pc, pd, swapped } = partition3(arr, lo, n, cmp);
    const pn = lo + n;
    let r = Math.min(pa - lo, pb - pa);
    vecswap(arr, lo, pb - r, r);
    r = Math.min(pd - pc, pn - pd - 1);
    vecswap(arr, pb, pn - r, r);
    // Apple: a swap-free partition pass means "nearly sorted" — try a bounded
    // insertion sort over the whole range; bail back to quicksort (keeping the
    // partial mutations!) once swaps exceed 1 + n/4.
    if (!swapped) {
      const limit = 1 + Math.floor(n / 4);
      if (insertionSort(arr, lo, n, cmp, limit)) return;
    }
    const leftN = pb - pa;  // count of elements < pivot
    const rightN = pd - pc; // count of elements > pivot
    if (leftN <= rightN) {
      if (leftN > 1) qsortRange(arr, lo, leftN, cmp, depthLimit);
      if (rightN > 1) { lo = pn - rightN; n = rightN; continue; }
    } else {
      if (rightN > 1) qsortRange(arr, pn - rightN, rightN, cmp, depthLimit);
      if (leftN > 1) { n = leftN; continue; }
    }
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
  // DEPTH(n) = 2 * (fls(n) - 1); fls(n) = 32 - clz32(n) for n > 0.
  if (arr.length > 1) {
    const depth = 2 * (32 - Math.clz32(arr.length) - 1);
    qsortRange(arr, 0, arr.length, cmp, depth);
  }
  return arr;
}
