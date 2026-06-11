// SPDX-License-Identifier: EPL-2.0

/**
 * Spatial grid used to localise repulsive-force computation: on each
 * pass nodes are bucketed into cells; repulsion is only computed
 * against nodes in the 9 adjacent cells.
 *
 * Ordering is load-bearing for float reproducibility:
 * - C's dtwalk over a Dtoset dictionary visits cells in ascending
 *   (i, j) order (grid.c:ijcmpf) — walk() replicates that sort.
 * - C prepends nodes to each cell's list (grid.c:newNode), so within a
 *   cell nodes appear in REVERSE insertion order — add() unshifts.
 *
 * Spec read at the 15.0.0 tag.
 *
 * @see lib/fdpgen/grid.c (15.0.0)
 */

import type { Node } from '../../model/node.js';

/** One grid cell. @see lib/fdpgen/grid.h:cell */
export interface Cell {
  i: number;
  j: number;
  /** Nodes in reverse insertion order. @see lib/fdpgen/grid.c:newNode */
  nodes: Node[];
}

/**
 * The grid: cells keyed by (i, j).
 * Block allocators (newBlock/getCell) are memory management with no
 * behavioral effect and are not ported.
 *
 * @see lib/fdpgen/grid.c:_grid
 */
export class Grid {
  private readonly cells = new Map<string, Cell>();

  /** Reset the grid, reusing storage. @see lib/fdpgen/grid.c:clearGrid */
  clear(): void {
    this.cells.clear();
  }

  /** Add node n to cell (i, j). @see lib/fdpgen/grid.c:addGrid */
  add(i: number, j: number, n: Node): void {
    const key = `${i},${j}`;
    let c = this.cells.get(key);
    if (c === undefined) {
      c = { i, j, nodes: [] };
      this.cells.set(key, c);
    }
    c.nodes.unshift(n);
  }

  /** Cell at (i, j), if any. @see lib/fdpgen/grid.c:findGrid */
  find(i: number, j: number): Cell | undefined {
    return this.cells.get(`${i},${j}`);
  }

  /**
   * Apply walkf to each cell in ascending (i, j) order — the dtwalk
   * traversal order of the Dtoset dictionary.
   * @see lib/fdpgen/grid.c:walkGrid
   * @see lib/fdpgen/grid.c:ijcmpf
   */
  walk(walkf: (c: Cell, g: Grid) => void): void {
    const sorted = [...this.cells.values()].sort(
      (a, b) => (a.i - b.i) || (a.j - b.j),
    );
    for (const c of sorted) walkf(c, this);
  }
}

/** Number of nodes in a cell. @see lib/fdpgen/grid.c:gLength */
export function gLength(c: Cell): number {
  return c.nodes.length;
}
