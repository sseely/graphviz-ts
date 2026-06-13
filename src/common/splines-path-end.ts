// SPDX-License-Identifier: EPL-2.0

/**
 * endpath — sets up routing boxes at the head (end) node.
 * Ported from lib/common/splines.c:endpath.
 *
 * @see lib/common/splines.c:endpath
 */

import type { Box } from '../model/geom.js';
import type { Path, PathendT, ShapeDesc } from './types.js';
import type { Edge } from '../model/edge.js';
import type { Node } from '../model/node.js';
import { TOP, BOTTOM, LEFT, FUDGE, REGULAREDGE, FLATEDGE } from './splines-constants.js';
import {
  resolvePort, clearClipForOrig, applyEndDefaultBoxes,
  invokePboxfn, setEndTheta,
} from './splines-path-shared.js';

/** Arguments for endPath; bundles params to stay within MAX_PARAMS=5. */
export interface EndPathArgs {
  P: Path;
  e: Edge;
  et: number;
  endp: PathendT;
  merge: boolean;
  inEdges: Edge[];
  outEdges: Edge[];
  ranksep: number;
  pboxfn: ShapeDesc['fns'];
}

/** Bundled endpath context to stay within MAX_PARAMS=5. */
interface EndCtx {
  P: Path;
  e: Edge;
  n: Node;
  endp: PathendT;
  ranksep: number;
}

// ---------------------------------------------------------------------------
// REGULAREDGE side helpers
// ---------------------------------------------------------------------------

class EndRegSide {
  static bottom(ctx: EndCtx): void {
    const { P, n, e, endp, ranksep } = ctx;
    const b = endp.nb;
    if (P.end.p.x < n.info.coord.x) {
      endp.boxes[0] = {
        ll: { x: b.ll.x - 1, y: n.info.coord.y - n.info.ht / 2 - ranksep / 2 },
        ur: { x: b.ur.x, y: P.end.p.y },
      };
      endp.boxes[1] = {
        ll: { x: b.ll.x - 1, y: P.end.p.y },
        ur: { x: n.info.coord.x - n.info.lw - (FUDGE - 2), y: n.info.coord.y + n.info.ht / 2 },
      };
    } else {
      endp.boxes[0] = {
        ll: { x: b.ll.x, y: n.info.coord.y - n.info.ht / 2 - ranksep / 2 },
        ur: { x: b.ur.x + 1, y: P.end.p.y },
      };
      endp.boxes[1] = {
        ll: { x: n.info.coord.x + n.info.rw + (FUDGE - 2), y: P.end.p.y },
        ur: { x: b.ur.x + 1, y: n.info.coord.y + n.info.ht / 2 },
      };
    }
    endp.boxn = 2;
    P.end.p.y -= 1;
    clearClipForOrig(e, n, false);
  }

  static top(ctx: EndCtx): void {
    const { P, n, e, endp } = ctx;
    endp.boxes[0] = {
      ll: { x: endp.nb.ll.x, y: Math.min(endp.nb.ll.y, P.end.p.y) },
      ur: endp.nb.ur,
    };
    endp.sidemask = TOP;
    endp.boxn = 1;
    P.end.p.y += 1;
    clearClipForOrig(e, n, false);
  }

  static left(ctx: EndCtx): void {
    const { P, n, e, endp } = ctx;
    endp.boxes[0] = {
      ll: { x: endp.nb.ll.x, y: P.end.p.y },
      ur: { x: P.end.p.x, y: n.info.coord.y + n.info.ht / 2 },
    };
    endp.boxn = 1;
    P.end.p.x -= 1;
    clearClipForOrig(e, n, false);
  }

  static right(ctx: EndCtx): void {
    const { P, n, e, endp } = ctx;
    endp.boxes[0] = {
      ll: { x: P.end.p.x, y: P.end.p.y },
      ur: { x: endp.nb.ur.x, y: n.info.coord.y + n.info.ht / 2 },
    };
    endp.boxn = 1;
    P.end.p.x += 1;
    clearClipForOrig(e, n, false);
  }

  static dispatch(ctx: EndCtx, side: number): void {
    const { endp } = ctx;
    if (side & TOP) EndRegSide.top(ctx);
    else if (side & BOTTOM) EndRegSide.bottom(ctx);
    else if (side & LEFT) EndRegSide.left(ctx);
    else EndRegSide.right(ctx);
    endp.sidemask = side;
  }
}

// ---------------------------------------------------------------------------
// FLATEDGE side helpers
// ---------------------------------------------------------------------------

class EndFlatSide {
  static bottom(ctx: EndCtx, b: Box): void {
    const { P, n, endp, ranksep } = ctx;
    if (endp.sidemask === TOP) {
      endp.boxes[0] = {
        ll: { x: b.ll.x - 1, y: n.info.coord.y - n.info.ht / 2 - ranksep / 2 },
        ur: { x: P.end.p.x, y: n.info.coord.y - n.info.ht / 2 },
      };
      endp.boxes[1] = {
        ll: { x: b.ll.x - 1, y: n.info.coord.y - n.info.ht / 2 },
        ur: { x: n.info.coord.x - n.info.lw - 2, y: n.info.coord.y + n.info.ht / 2 },
      };
      endp.boxn = 2;
    } else {
      endp.boxes[0] = {
        ll: b.ll,
        ur: { x: b.ur.x, y: Math.max(b.ur.y, P.start.p.y) },
      };
      endp.boxn = 1;
    }
    P.end.p.y -= 1;
  }

  static left(ctx: EndCtx, b: Box): void {
    const { P, n, endp } = ctx;
    const top = endp.sidemask === TOP;
    endp.boxes[0] = {
      ll: { x: b.ll.x, y: top ? P.end.p.y - 1 : n.info.coord.y - n.info.ht / 2 },
      ur: { x: P.end.p.x + 1, y: top ? n.info.coord.y + n.info.ht / 2 : P.end.p.y + 1 },
    };
    endp.boxn = 1;
    P.end.p.x -= 1;
  }

  static right(ctx: EndCtx, b: Box): void {
    const { P, n, endp } = ctx;
    const top = endp.sidemask === TOP;
    endp.boxes[0] = {
      ll: { x: P.end.p.x - 1, y: top ? P.end.p.y - 1 : n.info.coord.y - n.info.ht / 2 },
      ur: { x: b.ur.x, y: top ? n.info.coord.y + n.info.ht / 2 : P.end.p.y },
    };
    endp.boxn = 1;
    P.end.p.x += 1;
  }

  static dispatch(ctx: EndCtx, side: number): void {
    const { P, n, e, endp } = ctx;
    const b = endp.nb;
    if (side & TOP) {
      endp.boxes[0] = {
        ll: { x: b.ll.x, y: Math.min(b.ll.y, P.end.p.y) },
        ur: b.ur,
      };
      endp.boxn = 1;
      P.end.p.y += 1;
    } else if (side & BOTTOM) {
      EndFlatSide.bottom(ctx, b);
    } else if (side & LEFT) {
      EndFlatSide.left(ctx, b);
    } else {
      EndFlatSide.right(ctx, b);
    }
    clearClipForOrig(e, n, false);
    endp.sidemask = side;
  }
}

// ---------------------------------------------------------------------------
// Default path
// ---------------------------------------------------------------------------

function endDefaultPath(
  ctx: EndCtx, et: number, pboxfn: ShapeDesc['fns'],
): void {
  const { P, e, n, endp } = ctx;
  const side = et === REGULAREDGE ? TOP : endp.sidemask;
  const mask = invokePboxfn(pboxfn, n, e.info.head_port, side);
  if (mask) { endp.sidemask = mask; return; }
  endp.boxes[0] = endp.nb;
  endp.boxn = 1;
  applyEndDefaultBoxes(P, et, endp);
}

// ---------------------------------------------------------------------------
// endPath (public)
// ---------------------------------------------------------------------------

/**
 * Sets up path boxes near the head node.
 * @see lib/common/splines.c:endpath
 */
export function endPath(args: EndPathArgs): void {
  const { P, e, et, endp, merge, inEdges, outEdges, ranksep, pboxfn } = args;
  const n = e.head;
  if (e.info.head_port.dyna) {
    e.info.head_port = resolvePort(n, e.tail, e.info.head_port);
  }
  P.end.p = {
    x: n.info.coord.x + e.info.head_port.p.x,
    y: n.info.coord.y + e.info.head_port.p.y,
  };
  setEndTheta(P, e, merge, inEdges, outEdges);
  endp.np = { x: P.end.p.x, y: P.end.p.y };
  const ctx: EndCtx = { P, e, n, endp, ranksep };
  const side = e.info.head_port.side;
  if (et === REGULAREDGE && n.info.node_type === 0 && side) {
    EndRegSide.dispatch(ctx, side); return;
  }
  if (et === FLATEDGE && side) {
    EndFlatSide.dispatch(ctx, side); return;
  }
  endDefaultPath(ctx, et, pboxfn);
}
