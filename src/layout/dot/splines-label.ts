// SPDX-License-Identifier: EPL-2.0

/**
 * Label placement for edge virtual nodes.
 *
 * @see lib/dotgen/dotsplines.c:place_vnlabel, setEdgeLabelPos
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import { VIRTUAL } from './fastgr.js';

// ---------------------------------------------------------------------------
// TextLabel interface (minimal — full type deferred to Batch 5b)
// ---------------------------------------------------------------------------

/** Minimal label shape sufficient for placement. */
export interface TextLabel {
  pos: { x: number; y: number };
  dimen: { x: number; y: number };
  set: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Cast an unknown label to TextLabel if it has the required shape. */
export function asTextLabel(label: unknown): TextLabel | undefined {
  const l = label as Record<string, unknown>;
  if (l && typeof l['pos'] === 'object' && typeof l['dimen'] === 'object') {
    return l as unknown as TextLabel;
  }
  return undefined;
}

/** Walk to_orig until edge_type is NORMAL (0). */
export function findNormalOutEdge(first: Edge): Edge | undefined {
  let e: Edge | undefined = first;
  while (e && (e.info.edge_type ?? 0) !== 0) e = e.info.to_orig;
  return e;
}

/** Compute label x-position from node coord, dimen, and flip flag. */
export function labelXPos(n: Node, l: TextLabel): number {
  const flip = !!(n.root?.info.flip);
  const width = flip ? l.dimen.y : l.dimen.x;
  return n.info.coord.x + width / 2.0;
}

// ---------------------------------------------------------------------------
// place_vnlabel
// @see lib/dotgen/dotsplines.c:place_vnlabel
// ---------------------------------------------------------------------------

/**
 * Assign position of an edge label from its virtual node.
 * @see lib/dotgen/dotsplines.c:place_vnlabel
 */
export function placeVnlabel(n: Node): void {
  if ((n.info.in?.size ?? 0) === 0) return; // skip flat edge labels
  const first = n.info.out?.list[0];
  if (!first) return;
  const e = findNormalOutEdge(first);
  if (!e) return;
  const l = asTextLabel(e.info.label);
  if (!l) return;
  l.pos.x = labelXPos(n, l);
  l.pos.y = n.info.coord.y;
  l.set = true;
}

// ---------------------------------------------------------------------------
// setEdgeLabelPos
// @see lib/dotgen/dotsplines.c:setEdgeLabelPos
// ---------------------------------------------------------------------------

/** Set label pos from posAlg edge for virtual label nodes. */
export function setAlgLabelPos(n: Node): void {
  const fe = n.info.posAlg;
  if (!fe) return;
  const l = asTextLabel(fe.info.label);
  if (!l) return;
  l.pos = { x: n.info.coord.x, y: n.info.coord.y };
  l.set = true;
}

/**
 * Set edge label position information for regular and non-adjacent flat edges.
 * @see lib/dotgen/dotsplines.c:setEdgeLabelPos
 */
export function setEdgeLabelPos(g: Graph): void {
  for (let n: Node | undefined = g.info.nlist; n; n = n.info.next) {
    if ((n.info.node_type ?? 0) !== VIRTUAL) continue;
    if (n.info.posAlg) setAlgLabelPos(n);
    else if (n.info.label) placeVnlabel(n);
  }
}
