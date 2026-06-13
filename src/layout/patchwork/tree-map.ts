// SPDX-License-Identifier: EPL-2.0

/**
 * Squarified treemap algorithm (tree_map.c port).
 *
 * Implements the squarified treemap layout primitive: given a sorted
 * (descending) array of areas and a fill rectangle, assigns one
 * center-based Rectangle to each item while minimising aspect ratio.
 *
 * @see lib/patchwork/tree_map.c
 * @see lib/patchwork/tree_map.h
 */

// ---------------------------------------------------------------------------
// Rectangle type
// ---------------------------------------------------------------------------

/**
 * Center-based rectangle used by the squarified treemap algorithm.
 * x[0] = center-x, x[1] = center-y.
 * size[0] = width, size[1] = height.
 *
 * @see lib/patchwork/tree_map.h:rectangle
 */
export interface Rectangle {
  x: [number, number];
  size: [number, number];
}

// ---------------------------------------------------------------------------
// Squarifier
// ---------------------------------------------------------------------------

/**
 * Stateful worker that runs one squarified treemap layout.
 *
 * All mutable algorithm state is held as instance fields so that every
 * method signature stays within the 5-parameter project limit.
 *
 * @see lib/patchwork/tree_map.c:squarify
 */
class Squarifier {
  // inputs
  private readonly area: readonly number[];
  private readonly recs: Rectangle[];
  // per-recursion state (reset between strip levels)
  private nadded = 0;
  private maxarea = 0;
  private minarea = 1;
  private totalarea = 0;
  private asp = 1;
  private offset = 0;

  constructor(area: readonly number[], recs: Rectangle[]) {
    this.area = area;
    this.recs = recs;
  }

  /** Place nadded items left-to-right at top of a tall fillrec. */
  private placeTall(nadded: number, totalarea: number, fillrec: Rectangle): void {
    const w = Math.min(fillrec.size[0], fillrec.size[1]);
    const hh = totalarea / w;
    const topY = fillrec.x[1] + 0.5 * fillrec.size[1] - hh / 2;
    let xx = fillrec.x[0] - fillrec.size[0] / 2;
    for (let i = 0; i < nadded; i++) {
      const ww = this.area[this.offset + i]! / hh;
      this.recs[this.offset + i] = { x: [xx + ww / 2, topY], size: [ww, hh] };
      xx += ww;
    }
  }

  /** Place nadded items top-to-bottom at left of a wide fillrec. */
  private placeWide(nadded: number, totalarea: number, fillrec: Rectangle): void {
    const w = Math.min(fillrec.size[0], fillrec.size[1]);
    const ww = totalarea / w;
    const leftX = fillrec.x[0] - 0.5 * fillrec.size[0] + ww / 2;
    let yy = fillrec.x[1] + fillrec.size[1] / 2;
    for (let i = 0; i < nadded; i++) {
      const hh = this.area[this.offset + i]! / ww;
      this.recs[this.offset + i] = { x: [leftX, yy - hh / 2], size: [ww, hh] };
      yy -= hh;
    }
  }

  /** Commit current strip and return the shrunken remaining fillrec. */
  private commit(nadded: number, totalarea: number, fillrec: Rectangle): Rectangle {
    const w = Math.min(fillrec.size[0], fillrec.size[1]);
    if (fillrec.size[0] <= fillrec.size[1]) {
      this.placeTall(nadded, totalarea, fillrec);
      const hh = totalarea / w;
      return {
        x: [fillrec.x[0], fillrec.x[1] - hh / 2],
        size: [fillrec.size[0], fillrec.size[1] - hh],
      };
    }
    this.placeWide(nadded, totalarea, fillrec);
    const ww = totalarea / w;
    return {
      x: [fillrec.x[0] + ww / 2, fillrec.x[1]],
      size: [fillrec.size[0] - ww, fillrec.size[1]],
    };
  }

  /** Try adding the next item; return true if aspect ratio improves. */
  private tryAdd(n: number, fillrec: Rectangle): boolean {
    if (this.nadded >= n) return false;
    const w = Math.min(fillrec.size[0], fillrec.size[1]);
    const next = this.area[this.offset + this.nadded]!;
    const newmax = Math.max(this.maxarea, next);
    const newmin = Math.min(this.minarea, next);
    const s = this.totalarea + next;
    const h = s / w;
    const newasp = Math.max(h / (newmin / h), (newmax / h) / h);
    if (newasp > this.asp) return false;
    this.nadded++;
    this.maxarea = newmax;
    this.minarea = newmin;
    this.totalarea = s;
    this.asp = newasp;
    return true;
  }

  /**
   * Run the squarified layout for n items starting at this.offset.
   *
   * @see lib/patchwork/tree_map.c:squarify
   */
  run(n: number, fillrec: Rectangle): void {
    if (n === 0) return;
    const w = Math.min(fillrec.size[0], fillrec.size[1]);
    // Bootstrap: seed with first item
    const a0 = this.area[this.offset]!;
    this.nadded = 1;
    this.maxarea = a0;
    this.minarea = a0;
    this.totalarea = a0;
    this.asp = Math.max(a0 / (w * w), (w * w) / a0);
    // Grow strip while aspect ratio improves
    while (this.tryAdd(n, fillrec)) { /* tryAdd mutates state */ }
    // Commit strip and recurse on remainder
    const committed = this.nadded;
    const total = this.totalarea;
    const nextFill = this.commit(committed, total, fillrec);
    this.offset += committed;
    // Reset strip state for next level
    this.nadded = 0;
    this.maxarea = 0;
    this.minarea = 1;
    this.totalarea = 0;
    this.asp = 1;
    this.run(n - committed, nextFill);
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Perform a squarified treemap layout on a single level.
 *
 * area[] must be sorted descending. Returns null if the total area exceeds
 * the fill rectangle's capacity (plus 0.001 float tolerance). Otherwise
 * returns an array of n center-based rectangles.
 *
 * @see lib/patchwork/tree_map.c:tree_map
 */
export function treeMap(
  n: number,
  area: readonly number[],
  fillrec: Rectangle,
): Rectangle[] | null {
  let total = 0;
  for (let i = 0; i < n; i++) total += area[i]!;
  if (total > fillrec.size[0] * fillrec.size[1] + 0.001) return null;

  const recs: Rectangle[] = Array.from({ length: n }, () => ({
    x: [0, 0] as [number, number],
    size: [0, 0] as [number, number],
  }));
  new Squarifier(area, recs).run(n, fillrec);
  return recs;
}
