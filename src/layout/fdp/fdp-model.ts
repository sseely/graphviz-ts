// SPDX-License-Identifier: EPL-2.0

/**
 * fdp engine data model — gdata, dndata, bport_t, xparams, and the
 * accessor macros of the C private interface.
 *
 * Spec read at the 15.0.0 tag (post-tag fdpgen commits add an Mlimit
 * branch and float reorderings the golden refs do not have).
 *
 * @see lib/fdpgen/fdp.h (15.0.0)
 * @see lib/fdpgen/xlayout.h (15.0.0)
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { Box } from '../../model/geom.js';
import type { FdpAlgData, FdpDndata } from '../../model/nodeInfo.js';

/** Layout dimension. @see lib/fdpgen/fdp.h:NDIM */
export const NDIM = 2;

// ---------------------------------------------------------------------------
// ND_pinned states — @see lib/common/const.h:247-249
// ---------------------------------------------------------------------------

/** Position supplied by user. @see lib/common/const.h:P_SET */
export const P_SET = 1;
/** Position fixed during topological layout. @see lib/common/const.h:P_FIX */
export const P_FIX = 2;
/** Position fixed. @see lib/common/const.h:P_PIN */
export const P_PIN = 3;

// ---------------------------------------------------------------------------
// bport_t — boundary port
// ---------------------------------------------------------------------------

/**
 * Boundary port: a real edge crossing the cluster boundary, the inside
 * endpoint, and its angle on the boundary ellipse. C arrays are
 * 0-terminated; TS uses plain arrays.
 *
 * @see lib/fdpgen/fdp.h:bport_t
 */
export interface Bport {
  e: Edge;
  n: Node;
  alpha: number;
}

// ---------------------------------------------------------------------------
// xparams — parameters handed from tlayout to xlayout
// ---------------------------------------------------------------------------

/** @see lib/fdpgen/xlayout.h:xparams */
export interface XParams {
  numIters: number;
  T0: number;
  K: number;
  C: number;
  loopcnt: number;
}

// ---------------------------------------------------------------------------
// gdata — attached to the root graph, cluster graphs, and derived graphs
// ---------------------------------------------------------------------------

/** @see lib/fdpgen/fdp.h:gdata */
export interface Gdata {
  /** Boundary ports. @see lib/fdpgen/fdp.h:PORTS */
  ports: Bport[] | null;
  /** Number of ports. @see lib/fdpgen/fdp.h:NPORTS */
  nports: number;
  /** Bounding box of graph in INCHES. @see lib/fdpgen/fdp.h:BB */
  bb: Box;
  flags: number;
  /** Depth in graph hierarchy. @see lib/fdpgen/fdp.h:LEVEL */
  level: number;
  /** Smallest containing cluster. @see lib/fdpgen/fdp.h:GPARENT */
  parent: Graph | null;
}

/** Allocate a zeroed gdata record (gv_alloc equivalent). */
export function mkGdata(): Gdata {
  return {
    ports: null,
    nports: 0,
    bb: { ll: { x: 0, y: 0 }, ur: { x: 0, y: 0 } },
    flags: 0,
    level: 0,
    parent: null,
  };
}

/** GDATA(g) — gdata bound to g.info.alg; binds one if missing. */
export function gdata(g: Graph): Gdata {
  let d = g.info.alg as Gdata | undefined;
  if (d === undefined) {
    d = mkGdata();
    g.info.alg = d;
  }
  return d;
}

// ---------------------------------------------------------------------------
// dndata — attached to nodes in derived graphs (ND_alg)
// ---------------------------------------------------------------------------

/** Allocate a zeroed dndata record. @see lib/fdpgen/layout.c:mkDeriveNode */
export function mkDndata(): FdpDndata {
  return {
    kind: 'fdp-dndata',
    deg: 0,
    wdeg: 0,
    dn: null,
    clust: null,
    disp: [0, 0],
    pinned: 0,
  };
}

/** DNDATA(n) — dndata of a derived node. */
export function dndata(n: Node): FdpDndata {
  return n.info.alg as unknown as FdpDndata;
}

/** DISP(n) @see lib/fdpgen/fdp.h:DISP */
export function disp(n: Node): [number, number] {
  return dndata(n).disp;
}

/** ANODE(n) @see lib/fdpgen/fdp.h:ANODE */
export function anode(n: Node): Node | null {
  return dndata(n).dn;
}

/** IS_PORT(n) @see lib/fdpgen/fdp.h:IS_PORT */
export function isPort(n: Node): boolean {
  const d = dndata(n);
  return d.dn === null && d.clust === null;
}

// ---------------------------------------------------------------------------
// Real-node fdp fields — DNODE (ND_next) and PARENT (ND_clust)
// ---------------------------------------------------------------------------

/** Bind-or-get the fdp alg record on a REAL node. */
export function fdpData(n: Node): FdpAlgData {
  let d = n.info.alg as FdpAlgData | undefined;
  if (d === undefined || d.kind !== 'fdp') {
    d = { kind: 'fdp', dnode: null, parent: null, pinned: 0 };
    n.info.alg = d;
  }
  return d;
}

/** DNODE(n) @see lib/fdpgen/fdp.h:DNODE */
export function getDnode(n: Node): Node | null {
  const d = n.info.alg as FdpAlgData | undefined;
  return d !== undefined && d.kind === 'fdp' ? d.dnode : null;
}

/** DNODE(n) = dn */
export function setDnode(n: Node, dn: Node | null): void {
  fdpData(n).dnode = dn;
}

/** PARENT(n) @see lib/fdpgen/fdp.h:PARENT */
export function getParent(n: Node): Graph | null {
  const d = n.info.alg as FdpAlgData | undefined;
  return d !== undefined && d.kind === 'fdp' ? d.parent : null;
}

/** PARENT(n) = g */
export function setParent(n: Node, g: Graph): void {
  fdpData(n).parent = g;
}

// ---------------------------------------------------------------------------
// Pinned-state helpers (numeric on derived nodes / real fdp nodes)
// ---------------------------------------------------------------------------

/** ND_pinned for a derived node. */
export function dnPinned(n: Node): number {
  return dndata(n).pinned;
}

/** hasPos(n) @see lib/neatogen/neato.h:hasPos */
export function hasPos(n: Node): boolean {
  return dndata(n).pinned > 0;
}

// ---------------------------------------------------------------------------
// Derived-edge real-edge list (C overloads ED_to_virt as edge_t**)
// ---------------------------------------------------------------------------

/** Real edges merged into a derived edge. @see lib/fdpgen/layout.c:addEdge */
export function realEdges(de: Edge): Edge[] {
  return (de.info.alg as Edge[] | undefined) ?? [];
}

/** NEW_EDGE(e) — no real edge recorded yet. @see lib/fdpgen/layout.c:NEW_EDGE */
export function isNewEdge(de: Edge): boolean {
  return de.info.alg === undefined;
}

/**
 * Add real edge e to its image de in the derived graph.
 * @see lib/fdpgen/layout.c:addEdge
 */
export function addEdge(de: Edge, e: Edge): void {
  const el = de.info.alg as Edge[] | undefined;
  if (el === undefined) {
    de.info.alg = [e];
  } else {
    el.push(e);
  }
  de.info.count = (de.info.count ?? 0) + 1;
}

// ---------------------------------------------------------------------------
// Graph-attribute lookup with parent fallback (agget semantics)
// ---------------------------------------------------------------------------

/**
 * agget(g, name): look up an attribute on g, falling back up the parent
 * chain (derived components resolve attrs copied onto the derived root).
 * @see lib/cgraph/attr.c:agget
 */
export function aggetGraph(g: Graph, name: string): string | undefined {
  let cur: Graph | null = g;
  while (cur !== null) {
    const v = cur.attrs.get(name);
    if (v !== undefined) return v;
    cur = cur.parent;
  }
  return undefined;
}
