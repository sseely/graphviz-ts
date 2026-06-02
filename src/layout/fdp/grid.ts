// SPDX-License-Identifier: EPL-2.0

/**
 * Spatial hash grid for accelerating repulsion force computation in fdp.
 *
 * Nodes are bucketed into cells by dividing their position by cellSize.
 * Repulsion is only computed between nodes in adjacent (3×3) cells,
 * reducing O(n²) to approximately O(n) for uniform distributions.
 *
 * @see lib/fdpgen/grid.c
 */

import type { Node } from '../../model/node.js';

// ---------------------------------------------------------------------------
// Cell — one bucket in the spatial grid
// ---------------------------------------------------------------------------

/**
 * A single grid cell holding all nodes whose quantized position maps to (i, j).
 *
 * @see lib/fdpgen/grid.h:cell
 */
export interface Cell {
  /** Nodes assigned to this cell. */
  nodes: Node[];
}

// ---------------------------------------------------------------------------
// Grid — spatial hash, keyed by "i:j" string
// ---------------------------------------------------------------------------

/**
 * Spatial hash grid owning a Map from cell-key to Cell.
 *
 * Cell size should be set to 3K (where K is the fdp spring constant).
 *
 * @see lib/fdpgen/grid.c:struct _grid
 * @see lib/fdpgen/grid.c:mkGrid
 */
export class Grid {
  private readonly cells: Map<string, Cell>;
  readonly cellSize: number;

  /** @see lib/fdpgen/grid.c:mkGrid */
  constructor(cellSize: number) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  /** @see lib/fdpgen/grid.c:clearGrid */
  clear(): void {
    this.cells.clear();
  }

  /** @see lib/fdpgen/grid.c:addGrid */
  add(i: number, j: number, n: Node): void {
    const key = gridCellKey(i, j);
    let cell = this.cells.get(key);
    if (cell === undefined) {
      cell = { nodes: [] };
      this.cells.set(key, cell);
    }
    cell.nodes.push(n);
  }

  /** @see lib/fdpgen/grid.c:findGrid */
  find(i: number, j: number): Cell | undefined {
    return this.cells.get(gridCellKey(i, j));
  }

  /** @see lib/fdpgen/grid.c:walkGrid */
  walk(fn: (cell: Cell, i: number, j: number) => void): void {
    for (const [key, cell] of this.cells) {
      const sep = key.indexOf(':');
      const i = parseInt(key.slice(0, sep), 10);
      const j = parseInt(key.slice(sep + 1), 10);
      fn(cell, i, j);
    }
  }
}

// ---------------------------------------------------------------------------
// Pure helper functions (exported for testing and internal use)
// ---------------------------------------------------------------------------

/**
 * Returns the canonical string key for grid cell (i, j).
 *
 * @see lib/fdpgen/grid.c:ijcmpf
 */
export function gridCellKey(i: number, j: number): string {
  return `${i}:${j}`;
}

/**
 * Converts a continuous position value into a grid cell index.
 *
 * Equivalent to `FLOOR(pos / cellSize)` in the C source.
 *
 * @see lib/fdpgen/tlayout.c:gAdjust (FLOOR macro usage)
 */
export function gridToCell(pos: number, cellSize: number): number {
  return Math.floor(pos / cellSize);
}

/**
 * Adds node n to the grid cell that contains its current position.
 *
 * @see lib/fdpgen/tlayout.c:gAdjust (addGrid call)
 */
export function addToGrid(grid: Grid, n: Node): void {
  const pos = n.info.pos;
  if (!pos) return;
  const i = gridToCell(pos[0], grid.cellSize);
  const j = gridToCell(pos[1], grid.cellSize);
  grid.add(i, j, n);
}

/**
 * Returns the cell at (i, j) if it exists.
 *
 * @see lib/fdpgen/grid.c:findGrid
 */
export function findInGrid(grid: Grid, i: number, j: number): Cell | undefined {
  return grid.find(i, j);
}

/**
 * Calls fn for every non-empty cell in the grid.
 *
 * @see lib/fdpgen/grid.c:walkGrid
 */
export function walkGrid(grid: Grid, fn: (cell: Cell) => void): void {
  grid.walk((cell) => fn(cell));
}

/**
 * Clears all cells from the grid (resets state before each iteration).
 *
 * @see lib/fdpgen/grid.c:clearGrid
 */
export function clearGrid(grid: Grid): void {
  grid.clear();
}
