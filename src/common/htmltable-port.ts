// SPDX-License-Identifier: EPL-2.0
/**
 * html_port resolution — walk a placed HTML table tree for a named port,
 * returning the matching element's node-relative box + boundary sides.
 * @see lib/common/htmltable.c:html_port / portToTbl / portToCell
 */
import type { Box } from '../model/geom.js';
import type { PlacedHtml, PlacedCell } from './htmltable-pos.js';
import { HTML_ALL_SIDES } from './htmltable-pos.js';

/** A resolved HTML port: the element's node-relative box + its boundary sides. */
export interface HtmlPortHit { box: Box; sides: number; }

const portEq = (p: string | undefined, id: string): boolean =>
  p !== undefined && p.toLowerCase() === id.toLowerCase();

/** Find `id` on a placed cell or, recursively, its nested table. @see portToCell */
function portToCell(cell: PlacedCell, id: string): HtmlPortHit | null {
  if (portEq(cell.port, id)) return { box: cell.box, sides: cell.sidesMask ?? HTML_ALL_SIDES };
  if (cell.nested !== undefined) return portToTbl(cell.nested, id);
  return null;
}

/** Find `id` on a placed table or any of its cells. @see portToTbl */
export function portToTbl(tbl: PlacedHtml, id: string): HtmlPortHit | null {
  if (portEq(tbl.port, id)) return { box: tbl.box, sides: tbl.boundarySides ?? HTML_ALL_SIDES };
  for (const cell of tbl.cells) {
    const hit = portToCell(cell, id);
    if (hit !== null) return hit;
  }
  return null;
}
