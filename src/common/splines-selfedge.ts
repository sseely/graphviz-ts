// SPDX-License-Identifier: EPL-2.0

/**
 * Self-edge (loop) spline routing, ported from lib/common/splines.c.
 *
 * @see lib/common/splines.c:makeSelfEdge
 * @see lib/common/splines.c:selfTop / selfBottom / selfRight / selfLeft
 * @see lib/common/splines.c:selfRightSpace
 */

import type { Point } from '../model/geom.js';
import type { SplineInfo } from './types.js';
import type { Edge } from '../model/edge.js';
import { TOP, BOTTOM, LEFT, RIGHT, SELF_EDGE_SIZE } from './splines-constants.js';
import { clipAndInstall } from './splines-clip.js';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

type LabelLike = {
  dimen?: { x: number; y: number };
  pos?: { x: number; y: number };
  set?: boolean;
};

interface LabelYArgs { y: number; x: number; sign: number; }
interface LabelXArgs { x: number; y: number; sign: number; }

interface SelfEdgeArgs {
  edges: Edge[];
  cnt: number;
  size1: number;
  size2: number;
  sinfo: SplineInfo;
}

/** Tail/head port pair for dispatchLeft. */
interface PortPair {
  tp: Edge['info']['tail_port'];
  hp: Edge['info']['head_port'];
}

/** Bundled vertical (bottom/top) control-point args. */
interface VPtsArgs {
  tp: Point; hp: Point; np: Point;
  dx: number; dy: number; ty: number; hy: number;
}

/** Bundled horizontal (right/left) control-point args. */
interface HPtsArgs {
  tp: Point; hp: Point; np: Point;
  dx: number; dy: number; tx: number; hx: number;
}

/** Bundled topDx args. */
interface TopDxArgs {
  pp: number;
  n: Edge['tail'];
  np: Point;
  tp: Point;
  hp: Point;
}

/** Bundled vertical loop state. */
interface VLoopState {
  np: Point; tp: Point; hp: Point;
  dy: number; dx: number; ty: number; hy: number; sgn: number;
}

/** Bundled horizontal loop state. */
interface HLoopState {
  np: Point; tp: Point; hp: Point;
  dx: number; dy: number; tx: number; hx: number; sgn: number;
}

// ---------------------------------------------------------------------------
// Lookup tables (module-level constants)
// ---------------------------------------------------------------------------

const SIDE_VERTICES = [12, 4, 6, 2, 3, 1, 9, 8];
const SIDE_PAIR_A: readonly number[][] = [
  [11, 12, 13, 14, 15, 16, 17, 18],
  [21, 22, 23, 24, 25, 26, 27, 28],
  [31, 32, 33, 34, 35, 36, 37, 38],
  [41, 42, 43, 44, 45, 46, 47, 48],
  [51, 52, 53, 54, 55, 56, 57, 58],
  [61, 62, 63, 64, 65, 66, 67, 68],
  [71, 72, 73, 74, 75, 76, 77, 78],
  [81, 82, 83, 84, 85, 86, 87, 88],
];
const TOP_DX_SET_C = new Set([14, 37, 47, 51, 57, 58]);
const TOP_DX_SET_E = new Set([74, 75, 85]);

// ---------------------------------------------------------------------------
// Self-edge implementation class
// All helpers live inside the class so Lizard resets its param accumulator
// at the class boundary rather than accumulating across free functions.
// ---------------------------------------------------------------------------

class SelfEdgeImpl {
  static sidesToPoints(tailSide: number, headSide: number): number {
    let tailI = -1;
    let headI = -1;
    for (let i = 0; i < 8; i++) {
      if (headSide === SIDE_VERTICES[i]) headI = i;
      if (tailSide === SIDE_VERTICES[i]) tailI = i;
    }
    if (tailI < 0 || headI < 0) return 0;
    return SIDE_PAIR_A[tailI][headI];
  }

  static setLabelY(e: Edge, a: LabelYArgs): void {
    const lbl = e.info.label as LabelLike | undefined;
    if (!lbl?.dimen) return;
    lbl.pos = { x: a.x, y: a.y + a.sign * lbl.dimen.y / 2 };
    lbl.set = true;
  }

  static setLabelX(e: Edge, a: LabelXArgs): void {
    const lbl = e.info.label as LabelLike | undefined;
    if (!lbl?.dimen) return;
    lbl.pos = { x: a.x + a.sign * lbl.dimen.x / 2, y: a.y };
    lbl.set = true;
  }

  static bottomPts(a: VPtsArgs): Point[] {
    const { tp, hp, np, dx, dy, ty, hy } = a;
    return [
      tp, { x: tp.x + dx, y: tp.y - ty / 3 },
      { x: tp.x + dx, y: np.y - dy },
      { x: (tp.x + hp.x) / 2, y: np.y - dy },
      { x: hp.x - dx, y: np.y - dy },
      { x: hp.x - dx, y: hp.y - hy / 3 }, hp,
    ];
  }

  static topPts(a: VPtsArgs): Point[] {
    const { tp, hp, np, dx, dy, ty, hy } = a;
    return [
      tp, { x: tp.x + dx, y: tp.y + ty / 3 },
      { x: tp.x + dx, y: np.y + dy },
      { x: (tp.x + hp.x) / 2, y: np.y + dy },
      { x: hp.x - dx, y: np.y + dy },
      { x: hp.x - dx, y: hp.y + hy / 3 }, hp,
    ];
  }

  static rightPts(a: HPtsArgs): Point[] {
    const { tp, hp, np, dx, dy, tx, hx } = a;
    return [
      tp, { x: tp.x + tx / 3, y: tp.y + dy },
      { x: np.x + dx, y: tp.y + dy },
      { x: np.x + dx, y: (tp.y + hp.y) / 2 },
      { x: np.x + dx, y: hp.y - dy },
      { x: hp.x + hx / 3, y: hp.y - dy }, hp,
    ];
  }

  static leftPts(a: HPtsArgs): Point[] {
    const { tp, hp, np, dx, dy, tx, hx } = a;
    return [
      tp, { x: tp.x - tx / 3, y: tp.y + dy },
      { x: np.x - dx, y: tp.y + dy },
      { x: np.x - dx, y: (tp.y + hp.y) / 2 },
      { x: np.x - dx, y: hp.y - dy },
      { x: hp.x - hx / 3, y: hp.y - dy }, hp,
    ];
  }

  static topDxBase(n: Edge['tail'], np: Point, tp: Point, hp: Point): number {
    return n.info.lw - (np.x - tp.x) + (n.info.rw - (hp.x - np.x));
  }

  static topDx(a: TopDxArgs, sgn: number, stepx: number): number {
    const { pp, n, np, tp, hp } = a;
    if (pp === 15) return sgn * (n.info.rw - (hp.x - np.x) + stepx);
    if (pp === 38) return sgn * (n.info.lw - (np.x - hp.x) + stepx);
    if (pp === 41 || pp === 48) return sgn * (n.info.rw - (tp.x - np.x) + stepx);
    const base = SelfEdgeImpl.topDxBase(n, np, tp, hp);
    if (TOP_DX_SET_C.has(pp)) return sgn * (base / 3.0);
    if (pp === 73) return sgn * (n.info.lw - (np.x - tp.x) + stepx);
    if (pp === 83) return sgn * (n.info.lw - (np.x - tp.x));
    if (pp === 84) return sgn * (base / 2.0 + stepx);
    if (TOP_DX_SET_E.has(pp)) return sgn * (base / 2.0 + 2 * stepx);
    return 0;
  }

  static bottomLoop(args: SelfEdgeArgs, s: VLoopState): void {
    const { edges, cnt, size1: stepx, size2: stepy, sinfo } = args;
    let { dy, dx, ty, hy } = s;
    for (let i = 0; i < cnt; i++) {
      dy += stepy; ty += stepy; hy += stepy; dx += s.sgn * stepx;
      const pts = SelfEdgeImpl.bottomPts({ ...s, dx, dy, ty, hy });
      SelfEdgeImpl.setLabelY(edges[i], { y: s.np.y - dy, x: s.np.x, sign: -1 });
      clipAndInstall(edges[i], edges[i].head, pts, pts.length, sinfo);
    }
  }

  static topLoop(args: SelfEdgeArgs, s: VLoopState): void {
    const { edges, cnt, size1: stepx, size2: stepy, sinfo } = args;
    let { dy, dx, ty, hy } = s;
    for (let i = 0; i < cnt; i++) {
      dy += stepy; ty += stepy; hy += stepy; dx += s.sgn * stepx;
      const pts = SelfEdgeImpl.topPts({ ...s, dx, dy, ty, hy });
      SelfEdgeImpl.setLabelY(edges[i], { y: s.np.y + dy, x: s.np.x, sign: 1 });
      clipAndInstall(edges[i], edges[i].head, pts, pts.length, sinfo);
    }
  }

  static rightLoop(args: SelfEdgeArgs, s: HLoopState): void {
    const { edges, cnt, size1: stepx, size2: stepy, sinfo } = args;
    let { dx, dy, tx, hx } = s;
    for (let i = 0; i < cnt; i++) {
      dx += stepx; tx += stepx; hx += stepx; dy += s.sgn * stepy;
      const pts = SelfEdgeImpl.rightPts({ ...s, dx, dy, tx, hx });
      SelfEdgeImpl.setLabelX(edges[i], { x: s.np.x + dx, y: s.np.y, sign: 1 });
      clipAndInstall(edges[i], edges[i].head, pts, pts.length, sinfo);
    }
  }

  static leftLoop(args: SelfEdgeArgs, s: HLoopState): void {
    const { edges, cnt, size1: stepx, size2: stepy, sinfo } = args;
    let { dx, dy, tx, hx } = s;
    for (let i = 0; i < cnt; i++) {
      dx += stepx; tx += stepx; hx += stepx; dy += s.sgn * stepy;
      const pts = SelfEdgeImpl.leftPts({ ...s, dx, dy, tx, hx });
      SelfEdgeImpl.setLabelX(edges[i], { x: s.np.x - dx, y: s.np.y, sign: -1 });
      clipAndInstall(edges[i], edges[i].head, pts, pts.length, sinfo);
    }
  }

  /** Shared goesRight predicate used by selfRightSpace and makeSelfEdge. */
  static goesRight(ports: PortPair): boolean {
    const { tp, hp } = ports;
    if (!tp.defined && !hp.defined) return true;
    if (tp.side & LEFT) return false;
    if (hp.side & LEFT) return false;
    return tp.side !== hp.side || !(tp.side & (TOP | BOTTOM));
  }

  /**
   * Handles the LEFT-side dispatch branch of makeSelfEdge.
   * Bundled into (args, ports) to stay within MAX_PARAMS=5.
   */
  static dispatchLeft(args: SelfEdgeArgs, ports: PortPair): void {
    const { edges, cnt, size1, size2, sinfo } = args;
    const { tp, hp } = ports;
    if ((tp.side & RIGHT) || (hp.side & RIGHT)) {
      selfTop(edges, cnt, size1, size2, sinfo);
    } else {
      selfLeft(edges, cnt, size1, size2, sinfo);
    }
  }
}

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/** @see lib/common/splines.c:selfBottom */
export function selfBottom(
  edges: Edge[], cnt: number, sizex: number, stepy: number, sinfo: SplineInfo,
): void {
  const e0 = edges[0];
  const n = e0.tail;
  const stepx = Math.max(sizex / 2.0 / cnt, 2.0);
  const np = n.info.coord;
  const tp = { x: e0.info.tail_port.p.x + np.x, y: e0.info.tail_port.p.y + np.y };
  const hp = { x: e0.info.head_port.p.x + np.x, y: e0.info.head_port.p.y + np.y };
  const pp = SelfEdgeImpl.sidesToPoints(e0.info.tail_port.side, e0.info.head_port.side);
  let sgn = tp.x >= hp.x ? 1 : -1;
  if (pp === 67) sgn = -sgn;
  const dy = n.info.ht / 2.0;
  const ty = Math.min(dy, 3 * (tp.y + dy - np.y));
  const hy = Math.min(dy, 3 * (hp.y + dy - np.y));
  SelfEdgeImpl.bottomLoop(
    { edges, cnt, size1: stepx, size2: stepy, sinfo },
    { np, tp, hp, dy, dx: 0, ty, hy, sgn },
  );
}

/** @see lib/common/splines.c:selfTop */
export function selfTop(
  edges: Edge[], cnt: number, sizex: number, stepy: number, sinfo: SplineInfo,
): void {
  const e0 = edges[0];
  const n = e0.tail;
  const stepx = Math.max(sizex / 2.0 / cnt, 2.0);
  const np = n.info.coord;
  const tp = { x: e0.info.tail_port.p.x + np.x, y: e0.info.tail_port.p.y + np.y };
  const hp = { x: e0.info.head_port.p.x + np.x, y: e0.info.head_port.p.y + np.y };
  const sgn = tp.x >= hp.x ? 1 : -1;
  const pp = SelfEdgeImpl.sidesToPoints(e0.info.tail_port.side, e0.info.head_port.side);
  const dy = n.info.ht / 2.0;
  const dx = SelfEdgeImpl.topDx({ pp, n, np, tp, hp }, sgn, stepx);
  const ty = Math.min(dy, 3 * (np.y + dy - tp.y));
  const hy = Math.min(dy, 3 * (np.y + dy - hp.y));
  SelfEdgeImpl.topLoop(
    { edges, cnt, size1: stepx, size2: stepy, sinfo },
    { np, tp, hp, dy, dx, ty, hy, sgn },
  );
}

/** @see lib/common/splines.c:selfRight */
export function selfRight(
  edges: Edge[], cnt: number, stepx: number, sizey: number, sinfo: SplineInfo,
): void {
  const e0 = edges[0];
  const n = e0.tail;
  const stepy = Math.max(sizey / 2.0 / cnt, 2.0);
  const np = n.info.coord;
  const tp = { x: e0.info.tail_port.p.x + np.x, y: e0.info.tail_port.p.y + np.y };
  const hp = { x: e0.info.head_port.p.x + np.x, y: e0.info.head_port.p.y + np.y };
  const pp = SelfEdgeImpl.sidesToPoints(e0.info.tail_port.side, e0.info.head_port.side);
  let sgn = tp.y >= hp.y ? 1 : -1;
  if ((pp === 32 || pp === 65) && tp.y === hp.y) sgn = -sgn;
  const dx = n.info.rw;
  const tx = Math.min(dx, 3 * (np.x + dx - tp.x));
  const hx = Math.min(dx, 3 * (np.x + dx - hp.x));
  SelfEdgeImpl.rightLoop(
    { edges, cnt, size1: stepx, size2: stepy, sinfo },
    { np, tp, hp, dx, dy: 0, tx, hx, sgn },
  );
}

/** @see lib/common/splines.c:selfLeft */
export function selfLeft(
  edges: Edge[], cnt: number, stepx: number, sizey: number, sinfo: SplineInfo,
): void {
  const e0 = edges[0];
  const n = e0.tail;
  const stepy = Math.max(sizey / 2.0 / cnt, 2.0);
  const np = n.info.coord;
  const tp = { x: e0.info.tail_port.p.x + np.x, y: e0.info.tail_port.p.y + np.y };
  const hp = { x: e0.info.head_port.p.x + np.x, y: e0.info.head_port.p.y + np.y };
  const pp = SelfEdgeImpl.sidesToPoints(e0.info.tail_port.side, e0.info.head_port.side);
  let sgn = tp.y >= hp.y ? 1 : -1;
  if ((pp === 12 || pp === 67) && tp.y === hp.y) sgn = -sgn;
  const dx = n.info.lw;
  const tx = Math.min(dx, 3 * (tp.x + dx - np.x));
  const hx = Math.min(dx, 3 * (hp.x + dx - np.x));
  SelfEdgeImpl.leftLoop(
    { edges, cnt, size1: stepx, size2: stepy, sinfo },
    { np, tp, hp, dx, dy: 0, tx, hx, sgn },
  );
}

/**
 * Returns extra right-side space for a self-edge.
 * @see lib/common/splines.c:selfRightSpace
 */
export function selfRightSpace(e: Edge): number {
  const tp = e.info.tail_port;
  const hp = e.info.head_port;
  if (!SelfEdgeImpl.goesRight({ tp, hp })) return 0;
  const lbl = e.info.label as LabelLike | undefined;
  if (!lbl?.dimen) return SELF_EDGE_SIZE;
  // C uses the label dimension along the rank-cross axis: for a flipped
  // (LR/RL) layout the label is rotated, so its height (dimen.y) is the
  // relevant width; otherwise its width (dimen.x).
  // @see lib/common/splines.c:selfRightSpace — GD_flip(agraphof(aghead(e)))
  const flip = e.head.root.info.flip === true;
  return SELF_EDGE_SIZE + (flip ? lbl.dimen.y : lbl.dimen.x);
}

/**
 * Routes self-loop edges, choosing the appropriate side.
 * @see lib/common/splines.c:makeSelfEdge
 */
export function makeSelfEdge(
  edges: Edge[], cnt: number, sizex: number, sizey: number, sinfo: SplineInfo,
): void {
  const e = edges[0];
  const tp = e.info.tail_port;
  const hp = e.info.head_port;
  const ports: PortPair = { tp, hp };
  if (SelfEdgeImpl.goesRight(ports)) {
    selfRight(edges, cnt, sizex, sizey, sinfo);
  } else if ((tp.side & LEFT) || (hp.side & LEFT)) {
    SelfEdgeImpl.dispatchLeft({ edges, cnt, size1: sizex, size2: sizey, sinfo }, ports);
  } else if (tp.side & TOP) {
    selfTop(edges, cnt, sizex, sizey, sinfo);
  } else if (tp.side & BOTTOM) {
    selfBottom(edges, cnt, sizex, sizey, sinfo);
  }
}
