// SPDX-License-Identifier: EPL-2.0

/**
 * fdp layout bookkeeping: the cluster recursion over derived graphs,
 * component packing, bounding-box finalization, and the translation
 * of relative cluster coordinates to absolute positions.
 *
 * Spec read at the 15.0.0 tag.
 *
 * @see lib/fdpgen/layout.c (15.0.0)
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Box, Point } from '../../model/geom.js';
import type { TextlabelT } from '../../common/types.js';
import { lateInt, lateDouble } from '../../common/nodeinit.js';
import type { PolygonT } from '../../common/types.js';
import { isACluster } from '../dot/rank.js';
import { BOTTOM_IX, TOP_IX } from '../dot/position-aux.js';
import {
  putGraphs,
  computeSubgraphBB,
  getPackInfo,
} from '../pack/index.js';
import { PackMode, type PackInfo } from '../pack/types.js';
import { CL_OFFSET } from '../twopi/pipeline.js';
import { fdpTLayout } from './tlayout.js';
import { fdpXLayout } from './xlayout.js';
import { findCComp } from './comp.js';
import { deriveGraph, type LayoutInfo } from './derive.js';
import { expandCluster } from './ports.js';
import { normalizeG } from './normalize.js';
import { cround } from '../../common/arith.js';
import {
  type XParams,
  gdata,
  dndata,
  isPort,
  setDnode,
  getParent,
} from './fdp-model.js';

/** @see lib/common/geom.h:POINTS_PER_INCH */
const POINTS_PER_INCH = 72;
/** POINTS(0.75) / POINTS(0.5) for empty graphs. @see lib/common/const.h */
const DEFAULT_NODEWIDTH_PTS = 54;
const DEFAULT_NODEHEIGHT_PTS = 36;

// ---------------------------------------------------------------------------
// init_info
// ---------------------------------------------------------------------------

/** @see lib/fdpgen/layout.c:init_info */
export function initInfo(g: Graph): LayoutInfo {
  const pack: PackInfo = {
    aspect: 1, sz: 0, margin: 0, doSplines: false,
    mode: PackMode.Undef, fixed: null, vals: null, flags: 0,
  };
  getPackInfo(g, PackMode.Node, CL_OFFSET / 2, pack);
  return {
    rootg: g,
    hasCoords: g.attrs.has('coords'),
    gid: 0,
    pack,
  };
}

// ---------------------------------------------------------------------------
// mkClusters
// ---------------------------------------------------------------------------

/**
 * Attach each graph's list of immediate child clusters (info.clust,
 * 0-indexed here vs C's 1-indexed GD_clust) and level/parent gdata.
 * @see lib/fdpgen/layout.c:mkClusters
 */
export function mkClusters(
  g: Graph,
  pclist: Graph[] | null,
  parent: Graph,
): void {
  const list: Graph[] = [];
  const clist = pclist ?? list;

  for (const subg of g.subgraphs.values()) {
    if (isACluster(subg)) {
      registerCluster(subg, parent, clist);
    } else {
      mkClusters(subg, clist, parent);
    }
  }
  if (pclist === null) {
    g.info.n_cluster = list.length;
    if (list.length > 0) g.info.clust = list;
  }
}

/** Bind gdata to one cluster and recurse into it. */
function registerCluster(subg: Graph, parent: Graph, clist: Graph[]): void {
  const gd = gdata(subg);
  gd.level = gdata(parent).level + 1;
  gd.parent = parent;
  clist.push(subg);
  mkClusters(subg, null, subg);
}

// ---------------------------------------------------------------------------
// finalCC
// ---------------------------------------------------------------------------

/** Union of component bbs (points), translated by pts. @see layout.c:91-114 */
function ccBounds(cc: Graph[], pts: Point[] | null): Box {
  const first = cc[0]!.info.bb as Box;
  const bb: Box = {
    ll: { x: first.ll.x, y: first.ll.y },
    ur: { x: first.ur.x, y: first.ur.y },
  };
  if (cc.length > 1) {
    let pt = pts![0]!;
    bb.ll.x += pt.x;
    bb.ll.y += pt.y;
    bb.ur.x += pt.x;
    bb.ur.y += pt.y;
    for (let i = 1; i < cc.length; i++) {
      const b = cc[i]!.info.bb as Box;
      pt = pts![i]!;
      bb.ll.x = Math.min(bb.ll.x, b.ll.x + pt.x);
      bb.ll.y = Math.min(bb.ll.y, b.ll.y + pt.y);
      bb.ur.x = Math.max(bb.ur.x, b.ur.x + pt.x);
      bb.ur.y = Math.max(bb.ur.y, b.ur.y + pt.y);
    }
  }
  return bb;
}

/** Empty-graph bb from the graph width/height attrs. @see layout.c:115-121 */
function emptyBounds(rg: Graph): Box {
  return {
    ll: { x: 0, y: 0 },
    ur: {
      x: lateInt(rg.attrs.get('width'), DEFAULT_NODEWIDTH_PTS, 3),
      y: lateInt(rg.attrs.get('height'), DEFAULT_NODEHEIGHT_PTS, 3),
    },
  };
}

/** Widen bb to fit the graph label, if any. @see layout.c:123-131 */
function widenForLabel(rg: Graph, bb: Box): boolean {
  const label = rg.info.label as TextlabelT | undefined;
  if (!label) return false;
  // C round(): half away from zero. @see lib/fdpgen/layout.c:125
  let d = cround(label.dimen.x) - (bb.ur.x - bb.ll.x);
  if (d > 0) { /* height of label added below */
    d /= 2;
    bb.ll.x -= d;
    bb.ur.x += d;
  }
  return true;
}

/** Translate every component's node positions by del (inches). */
function shiftComponents(
  cc: Graph[], pts: Point[] | null, pt: Point,
): void {
  for (let i = 0; i < cc.length; i++) {
    let p: Point;
    if (pts) {
      p = { x: pts[i]!.x + pt.x, y: pts[i]!.y + pt.y };
    } else {
      p = pt;
    }
    const del = { x: p.x / POINTS_PER_INCH, y: p.y / POINTS_PER_INCH };
    for (const n of cc[i]!.nodes.values()) {
      n.info.pos![0]! += del.x;
      n.info.pos![1]! += del.y;
    }
  }
}

/**
 * Set the derived graph's bounding box (inches) from its components,
 * add the cluster margin and label border, and reposition all nodes
 * so the layout's lower-left corner is the origin.
 * @see lib/fdpgen/layout.c:finalCC
 */
function finalCC(
  g: Graph, cc: Graph[], pts: Point[] | null, rg: Graph, infop: LayoutInfo,
): void {
  const isRoot = rg === infop.rootg;
  /* graph bounding box in points */
  const bb = cc.length > 0 ? ccBounds(cc, pts) : emptyBounds(rg);
  let isEmpty = cc.length === 0;
  if (widenForLabel(rg, bb)) isEmpty = false;

  const margin = isRoot || isEmpty
    ? 0
    : lateInt(rg.attrs.get('margin'), CL_OFFSET, 0);
  const pt = applyMarginAndBorder(rg, bb, margin);

  if (cc.length > 0) shiftComponents(cc, pts, pt);

  gdata(g).bb = {
    ll: { x: bb.ll.x / POINTS_PER_INCH, y: bb.ll.y / POINTS_PER_INCH },
    ur: { x: bb.ur.x / POINTS_PER_INCH, y: bb.ur.y / POINTS_PER_INCH },
  };
}

/**
 * Zero the bb's lower-left, adding margins and label borders; returns
 * the node translation in points. @see layout.c:133-142
 */
function applyMarginAndBorder(rg: Graph, bb: Box, margin: number): Point {
  const border = rg.info.border ?? [
    { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 },
  ];
  const pt: Point = {
    x: -bb.ll.x + margin,
    y: -bb.ll.y + margin + border[BOTTOM_IX]!.y,
  };
  bb.ll.x = 0;
  bb.ll.y = 0;
  bb.ur.x += pt.x + margin;
  bb.ur.y += pt.y + margin + border[TOP_IX]!.y;
  return pt;
}

// ---------------------------------------------------------------------------
// evalPositions / setBB / setClustNodes
// ---------------------------------------------------------------------------

/**
 * Translate cluster-relative node positions and cluster boxes to
 * absolute coordinates (root LL at the origin), in inches.
 * @see lib/fdpgen/layout.c:evalPositions
 */
export function evalPositions(g: Graph, rootg: Graph): void {
  const bb = gdata(g).bb;

  /* translate nodes whose smallest containing cluster is g */
  if (g !== rootg) translateOwnNodes(g, bb);

  /* translate top-level clusters and recurse */
  const nClusters = g.info.n_cluster ?? 0;
  for (let i = 0; i < nClusters; i++) {
    const subg = g.info.clust![i]!;
    if (g !== rootg) {
      const sbb = gdata(subg).bb;
      sbb.ll.x += bb.ll.x;
      sbb.ll.y += bb.ll.y;
      sbb.ur.x += bb.ll.x;
      sbb.ur.y += bb.ll.y;
    }
    evalPositions(subg, rootg);
  }
}

/** Shift nodes with PARENT(n) === g by g's bb lower-left (inches). */
function translateOwnNodes(g: Graph, bb: Box): void {
  for (const n of g.nodes.values()) {
    if ((n.info.alg as { parent?: Graph } | undefined)?.parent !== g) continue;
    n.info.pos![0]! += bb.ll.x;
    n.info.pos![1]! += bb.ll.y;
  }
}

/**
 * Set the point-space bb (info.bb) from the inch-space gdata bb, for
 * g and all clusters.
 * @see lib/fdpgen/layout.c:setBB
 */
export function setBB(g: Graph): void {
  const bb = gdata(g).bb;
  g.info.bb = {
    ll: { x: POINTS_PER_INCH * bb.ll.x, y: POINTS_PER_INCH * bb.ll.y },
    ur: { x: POINTS_PER_INCH * bb.ur.x, y: POINTS_PER_INCH * bb.ur.y },
  };
  const nClusters = g.info.n_cluster ?? 0;
  for (let i = 0; i < nClusters; i++) {
    setBB(g.info.clust![i]!);
  }
}

/**
 * Position cluster nodes (created by processClusterEdges for edges with
 * cluster endpoints) at the centers of their clusters and size them to the
 * cluster box, so their incident edges clip to the cluster boundary. Runs
 * before evalPositions, so the cluster bb (gdata.bb, inches) is still in its
 * parent-relative frame; pos is the cluster center, likewise relative.
 * @see lib/fdpgen/layout.c:setClustNodes
 */
export function setClustNodes(root: Graph): void {
  for (const n of root.nodes.values()) {
    if (!n.info.clustnode) continue;
    const p = getParent(n);
    if (p === null) continue;
    const bb = gdata(p).bb; // cluster bbox in inches (BB(p))
    const w = bb.ur.x - bb.ll.x;
    const h = bb.ur.y - bb.ll.y;
    const w2 = POINTS_PER_INCH * (w / 2);
    const h2 = POINTS_PER_INCH * (h / 2);
    n.info.pos![0] = w / 2; // center of the cluster (relative, inches)
    n.info.pos![1] = h / 2;
    n.info.width = w;
    n.info.height = h;
    // C late_double(n, N_penwidth, DEFAULT_NODEPENWIDTH=1, MIN_NODEPENWIDTH=0)
    const penwidth = lateDouble(n.attrs.get('penwidth'), 1, 0);
    n.info.outline_width = w + penwidth;
    n.info.outline_height = h + penwidth;
    n.info.lw = n.info.rw = w2;
    n.info.ht = POINTS_PER_INCH * h;
    // Rewrite the box shape vertices to the cluster extent (points). The TS
    // polygon omits C's outline periphery ring (poly_inside reapplies it via
    // penwidth), so only the 4 box corners are set. @see layout.c:750-758
    const poly = n.info.shape_info as PolygonT | undefined;
    if (poly && poly.vertices) {
      poly.vertices[0] = { x: w2, y: h2 };
      poly.vertices[1] = { x: -w2, y: h2 };
      poly.vertices[2] = { x: -w2, y: -h2 };
      poly.vertices[3] = { x: w2, y: -h2 };
    }
  }
}

// ---------------------------------------------------------------------------
// layout — the recursion
// ---------------------------------------------------------------------------

/** Sync derived coords (points) from pos (inches) for the packer. */
function syncCoordFromPos(cg: Graph): void {
  for (const n of cg.nodes.values()) {
    n.info.coord = {
      x: POINTS_PER_INCH * n.info.pos![0]!,
      y: POINTS_PER_INCH * n.info.pos![1]!,
    };
  }
}

/**
 * Expand cluster nodes of one laid-out component: recursively lay out
 * each cluster with ports induced by the component layout, then size
 * its derived node; delete port nodes.
 * @returns 0 on success (C error propagation)
 * @see lib/fdpgen/layout.c:layout (component inner loop)
 */
function expandComponentClusters(
  cg: Graph, infop: LayoutInfo, counter: { value: number },
): number {
  for (const n of [...cg.nodes.values()]) {
    if (dndata(n).clust !== null) {
      const sg = expandCluster(n, cg); /* attach ports to sg */
      const r = layout(sg, infop, counter);
      if (r !== 0) return r;
      n.info.width = gdata(sg).bb.ur.x;
      n.info.height = gdata(sg).bb.ur.y;
      const ptx = POINTS_PER_INCH * gdata(sg).bb.ur.x;
      const pty = POINTS_PER_INCH * gdata(sg).bb.ur.y;
      n.info.rw = n.info.lw = ptx / 2;
      n.info.ht = pty;
    } else if (isPort(n)) {
      deleteNodeFrom(cg, n); /* remove ports from component */
    }
  }
  return 0;
}

/** agdelete(cg, n): drop n and its incident edges from subgraph cg. */
function deleteNodeFrom(cg: Graph, n: Node): void {
  cg.nodes.delete(n.name);
  cg.edges = cg.edges.filter((e) => e.tail !== n && e.head !== n);
}

/** Pack multiple components; single components just get a bb. */
function packComponents(
  cc: Graph[], dg: Graph, pinned: boolean, infop: LayoutInfo,
): Point[] | null {
  for (const cg of cc) syncCoordFromPos(cg); // C coord(n) = 72·pos on demand
  if (cc.length > 1) {
    let bp: boolean[] | null = null;
    if (pinned) {
      bp = new Array<boolean>(cc.length).fill(false);
      bp[0] = true;
    }
    infop.pack.fixed = bp;
    const pts = putGraphs(cc.length, cc, dg, infop.pack);
    infop.pack.fixed = null;
    return pts;
  }
  if (cc.length === 1) {
    cc[0]!.info.bb = computeSubgraphBB(cc[0]!, 0); // C compute_bb
  }
  return null;
}

/** Record derived positions onto clusters and real nodes. */
function recordPositions(dg: Graph, g: Graph): void {
  for (const dn of dg.nodes.values()) {
    const dnd = dndata(dn);
    const sg = dnd.clust;
    if (sg !== null) {
      const llx = dn.info.pos![0]! - dn.info.width / 2;
      const lly = dn.info.pos![1]! - dn.info.height / 2;
      gdata(sg).bb = {
        ll: { x: llx, y: lly },
        ur: { x: llx + dn.info.width, y: lly + dn.info.height },
      };
    } else if (dnd.dn !== null) {
      const n = dnd.dn;
      n.info.pos![0] = dn.info.pos![0]!;
      n.info.pos![1] = dn.info.pos![1]!;
    }
  }
  gdata(g).bb = gdata(dg).bb;
}

/**
 * Lay out g: derive, split into components, tLayout each, expand
 * clusters recursively, remove overlaps, pack, and finalize.
 * @returns 0 on success
 * @see lib/fdpgen/layout.c:layout
 */
export function layout(
  g: Graph, infop: LayoutInfo, counter: { value: number },
): number {
  /* initialize derived node pointers */
  for (const n of g.nodes.values()) setDnode(n, null);

  const dg = deriveGraph(g, infop);
  if (dg === null) return -1;
  const { comps: cc, pinned } = findCComp(dg, counter);

  const r = layoutComponents(g, cc, infop, counter);
  if (r !== 0) return r;

  /* Pack connected components, then set the bb and reposition nodes */
  const pts = packComponents(cc, dg, pinned, infop);
  finalCC(dg, cc, pts, g, infop);

  /* record positions from derived graph to input graph */
  recordPositions(dg, g);

  return 0;
}

/** tLayout + cluster expansion + overlap removal per component. */
function layoutComponents(
  g: Graph, cc: Graph[], infop: LayoutInfo, counter: { value: number },
): number {
  const xpms: XParams = { numIters: 0, T0: 0, K: 0, C: 0, loopcnt: 0 };
  for (const cg of cc) {
    fdpTLayout(cg, xpms);
    const r = expandComponentClusters(cg, infop, counter);
    if (r !== 0) return r;

    /* Remove overlaps */
    if (cg.nodes.size >= 2) {
      if (g === infop.rootg) normalizeG(cg);
      fdpXLayout(cg, xpms);
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// fdpLayout
// ---------------------------------------------------------------------------

/**
 * Top-level fdp layout: recursive cluster layout, cluster-node
 * placement, absolute positioning, and point-space bbs.
 * @returns 0 on success
 * @see lib/fdpgen/layout.c:fdpLayout
 */
export function fdpLayout(g: Graph): number {
  const info = initInfo(g);
  const r = layout(g, info, { value: 0 });
  if (r !== 0) return r;
  setClustNodes(g);
  evalPositions(g, g);

  /* Set bbox info for g and all clusters, needed for spline drawing */
  setBB(g);

  return 0;
}
