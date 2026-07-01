// SPDX-License-Identifier: EPL-2.0

/**
 * beginpath — sets up routing boxes at the tail (start) node.
 * Ported from lib/common/splines.c:beginpath.
 *
 * @see lib/common/splines.c:beginpath
 */

import type { Box } from '../model/geom.js';
import type { Path, PathendT, ShapeDesc } from './types.js';
import type { Edge } from '../model/edge.js';
import type { Node } from '../model/node.js';
import { TOP, BOTTOM, LEFT, RIGHT, FUDGE, REGULAREDGE, FLATEDGE } from './splines-constants.js';
import {
  resolvePort, clearClipForOrig, applyDefaultBoxes,
  invokePboxfn, setStartTheta,
} from './splines-path-shared.js';

/** Bundled beginpath context to stay within MAX_PARAMS=5. */
interface BeginCtx {
  P: Path;
  e: Edge;
  n: Node;
  endp: PathendT;
  ranksep: number;
}

// ---------------------------------------------------------------------------
// REGULAREDGE side helpers
// ---------------------------------------------------------------------------

/** @see lib/common/splines.c:beginpath TOP branch */
class BeginRegSide {
  static topLeft(ctx: BeginCtx): void {
    const { P, n, endp, ranksep } = ctx;
    const b = endp.nb;
    endp.boxes[0] = {
      ll: { x: b.ll.x - 1, y: P.start.p.y },
      ur: { x: b.ur.x, y: n.info.coord.y + n.info.ht / 2 + ranksep / 2 },
    };
    endp.boxes[1] = {
      ll: { x: b.ll.x - 1, y: n.info.coord.y - n.info.ht / 2 },
      ur: { x: n.info.coord.x - n.info.lw - (FUDGE - 2), y: P.start.p.y },
    };
  }

  static topRight(ctx: BeginCtx): void {
    const { P, n, endp, ranksep } = ctx;
    const b = endp.nb;
    endp.boxes[0] = {
      ll: { x: b.ll.x, y: P.start.p.y },
      ur: { x: b.ur.x + 1, y: n.info.coord.y + n.info.ht / 2 + ranksep / 2 },
    };
    endp.boxes[1] = {
      ll: { x: n.info.coord.x + n.info.rw + (FUDGE - 2), y: n.info.coord.y - n.info.ht / 2 },
      ur: { x: b.ur.x + 1, y: P.start.p.y },
    };
  }

  static top(ctx: BeginCtx): void {
    const { P, n, e, endp } = ctx;
    if (P.start.p.x < n.info.coord.x) BeginRegSide.topLeft(ctx);
    else BeginRegSide.topRight(ctx);
    endp.sidemask = TOP;
    endp.boxn = 2;
    P.start.p.y += 1;
    clearClipForOrig(e, n, true);
  }

  static bottom(ctx: BeginCtx): void {
    const { P, n, e, endp } = ctx;
    endp.boxes[0] = {
      ll: endp.nb.ll,
      ur: { x: endp.nb.ur.x, y: Math.max(endp.nb.ur.y, P.start.p.y) },
    };
    endp.sidemask = BOTTOM;
    endp.boxn = 1;
    P.start.p.y -= 1;
    clearClipForOrig(e, n, true);
  }

  static left(ctx: BeginCtx): void {
    const { P, n, e, endp } = ctx;
    endp.boxes[0] = {
      ll: { x: endp.nb.ll.x, y: n.info.coord.y - n.info.ht / 2 },
      ur: { x: P.start.p.x, y: P.start.p.y },
    };
    endp.sidemask = LEFT;
    endp.boxn = 1;
    P.start.p.x -= 1;
    clearClipForOrig(e, n, true);
  }

  static right(ctx: BeginCtx): void {
    const { P, n, e, endp } = ctx;
    endp.boxes[0] = {
      ll: { x: P.start.p.x, y: n.info.coord.y - n.info.ht / 2 },
      ur: { x: endp.nb.ur.x, y: P.start.p.y },
    };
    endp.sidemask = RIGHT;
    endp.boxn = 1;
    P.start.p.x += 1;
    clearClipForOrig(e, n, true);
  }

  static dispatch(ctx: BeginCtx, side: number): void {
    if (side & TOP) BeginRegSide.top(ctx);
    else if (side & BOTTOM) BeginRegSide.bottom(ctx);
    else if (side & LEFT) BeginRegSide.left(ctx);
    else BeginRegSide.right(ctx);
  }
}

// ---------------------------------------------------------------------------
// FLATEDGE side helpers
// ---------------------------------------------------------------------------

class BeginFlatSide {
  static bottom(ctx: BeginCtx, b: Box): void {
    const { P, n, endp, ranksep } = ctx;
    if (endp.sidemask === TOP) {
      endp.boxes[0] = {
        ll: { x: P.start.p.x, y: n.info.coord.y - n.info.ht / 2 - ranksep / 2 },
        ur: { x: b.ur.x + 1, y: n.info.coord.y - n.info.ht / 2 },
      };
      endp.boxes[1] = {
        ll: { x: n.info.coord.x + n.info.rw + (FUDGE - 2), y: n.info.coord.y - n.info.ht / 2 },
        ur: { x: b.ur.x + 1, y: n.info.coord.y + n.info.ht / 2 },
      };
      endp.boxn = 2;
    } else {
      endp.boxes[0] = {
        ll: b.ll,
        ur: { x: b.ur.x, y: Math.max(b.ur.y, P.start.p.y) },
      };
      endp.boxn = 1;
    }
    P.start.p.y -= 1;
  }

  static left(ctx: BeginCtx, b: Box): void {
    const { P, n, endp } = ctx;
    const top = endp.sidemask === TOP;
    endp.boxes[0] = {
      ll: { x: b.ll.x, y: top ? P.start.p.y - 1 : n.info.coord.y - n.info.ht / 2 },
      ur: { x: P.start.p.x + 1, y: top ? n.info.coord.y + n.info.ht / 2 : P.start.p.y + 1 },
    };
    endp.boxn = 1;
    P.start.p.x -= 1;
  }

  static right(ctx: BeginCtx, b: Box): void {
    const { P, n, endp } = ctx;
    const top = endp.sidemask === TOP;
    endp.boxes[0] = {
      ll: { x: P.start.p.x, y: top ? P.start.p.y : n.info.coord.y - n.info.ht / 2 },
      ur: { x: b.ur.x, y: top ? n.info.coord.y + n.info.ht / 2 : P.start.p.y + 1 },
    };
    endp.boxn = 1;
    P.start.p.x += 1;
  }

  static dispatch(ctx: BeginCtx, side: number): void {
    const { P, n, e, endp } = ctx;
    const b = endp.nb;
    if (side & TOP) {
      endp.boxes[0] = {
        ll: { x: b.ll.x, y: Math.min(b.ll.y, P.start.p.y) },
        ur: b.ur,
      };
      endp.boxn = 1;
      P.start.p.y += 1;
    } else if (side & BOTTOM) {
      BeginFlatSide.bottom(ctx, b);
    } else if (side & LEFT) {
      BeginFlatSide.left(ctx, b);
    } else {
      BeginFlatSide.right(ctx, b);
    }
    clearClipForOrig(e, n, true);
    endp.sidemask = side;
  }
}

// ---------------------------------------------------------------------------
// Default path
// ---------------------------------------------------------------------------

function beginDefaultPath(ctx: BeginCtx, et: number): void {
  const { P, e, n, endp } = ctx;
  const side = et === REGULAREDGE ? BOTTOM : endp.sidemask;
  // C beginpath sources pboxfn from ND_shape(n)->fns->pboxfn (splines.c:389).
  const fns = (n.info.shape as ShapeDesc | undefined)?.fns ?? null;
  const mask = invokePboxfn(fns, n, e.info.tail_port, side, endp);
  if (mask) { endp.sidemask = mask; return; }
  endp.boxes[0] = endp.nb;
  endp.boxn = 1;
  applyDefaultBoxes(P, et, endp);
}

// ---------------------------------------------------------------------------
// beginPath (public)
// ---------------------------------------------------------------------------

/** Arguments for beginPath; bundles params to stay within MAX_PARAMS=5. */
export interface BeginPathArgs {
  P: Path;
  e: Edge;
  et: number;
  endp: PathendT;
  merge: boolean;
  ranksep: number;
}

/**
 * Sets up path boxes near the tail node.
 * @see lib/common/splines.c:beginpath
 */
export function beginPath(args: BeginPathArgs): void {
  const { P, e, et, endp, merge, ranksep } = args;
  const n = e.tail;
  if (e.info.tail_port.dyna) {
    e.info.tail_port = resolvePort(n, e.head, e.info.tail_port);
  }
  P.start.p = {
    x: n.info.coord.x + e.info.tail_port.p.x,
    y: n.info.coord.y + e.info.tail_port.p.y,
  };
  setStartTheta(P, e, merge);
  P.nbox = 0;
  P.data = e;
  endp.np = { x: P.start.p.x, y: P.start.p.y };
  const ctx: BeginCtx = { P, e, n, endp, ranksep };
  const side = e.info.tail_port.side;
  if (et === REGULAREDGE && n.info.node_type === 0 && side) {
    BeginRegSide.dispatch(ctx, side); return;
  }
  if (et === FLATEDGE && side) {
    BeginFlatSide.dispatch(ctx, side); return;
  }
  beginDefaultPath(ctx, et);
}
