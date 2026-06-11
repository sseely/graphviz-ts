// SPDX-License-Identifier: EPL-2.0

/**
 * Derived-graph construction: clusters collapse into single nodes, and
 * an edge joins two derived nodes when any real edge joins their
 * underlying node sets. Boundary ports transform into port nodes.
 *
 * The C derived graph is a strict digraph whose edge direction is
 * canonicalized by node POINTER comparison (`hd > tl`, layout.c:466);
 * node ids are creation-ordered here, so id comparison models it.
 * agedge with a NULL name dedups on strict digraphs (cgraph
 * edge.c:262), merging parallel real edges into one derived edge.
 *
 * Spec read at the 15.0.0 tag.
 *
 * @see lib/fdpgen/layout.c:deriveGraph (15.0.0)
 */

import { Graph } from '../../model/graph.js';
import { Node } from '../../model/node.js';
import { Edge } from '../../model/edge.js';
import type { Box } from '../../model/geom.js';
import { doGraphLabel } from '../dot/graph-label.js';
import { layoutMeasurer } from '../../common/nodeinit.js';
import {
  type Bport,
  gdata,
  dndata,
  mkDndata,
  getDnode,
  setDnode,
  getParent,
  setParent,
  fdpData,
  isNewEdge,
  addEdge,
  aggetGraph,
  P_PIN,
  P_FIX,
  P_SET,
} from './fdp-model.js';

/** Per-fdp-run bookkeeping. @see lib/fdpgen/layout.c:layout_info */
export interface LayoutInfo {
  /** Logical root; the graph passed to fdp_layout. */
  rootg: Graph;
  /** Whether a "coords" graph attribute exists (G_coord symbol). */
  hasCoords: boolean;
  gid: number;
  /** Pack parameters resolved by init_info. */
  pack: import('../pack/types.js').PackInfo;
}

// ---------------------------------------------------------------------------
// Derived-node construction
// ---------------------------------------------------------------------------

/**
 * Construct a node in a derived graph, allocating its dndata.
 * @see lib/fdpgen/layout.c:mkDeriveNode
 */
export function mkDeriveNode(dg: Graph, name: string): Node {
  const dn = new Node(dg.nodes.size, name, dg);
  dn.info.alg = mkDndata();
  dn.info.pos = [0, 0];
  dg.nodes.set(name, dn);
  return dn;
}

/**
 * Copy one graph attribute from g (resolved up its parent chain) onto
 * dg. HTML-string attribute values are not distinguished (AD-2).
 * @see lib/fdpgen/layout.c:copyAttr
 */
function copyAttr(g: Graph, dg: Graph, attr: string): void {
  const v = aggetGraph(g, attr);
  if (v !== undefined) dg.attrs.set(attr, v);
}

/**
 * Use a cluster's "coords" attribute, if any, for the initial position
 * of its derived node. PSinputscale (inputscale attr) is not ported —
 * no supported input sets it.
 * @see lib/fdpgen/layout.c:chkPos
 */
function chkPos(g: Graph, n: Node, infop: LayoutInfo, bbp: Box): void {
  const p = g.attrs.get('coords');
  if (p === undefined || p === '') return;
  if (g !== infop.rootg) {
    const pp = g.parent !== null ? g.parent.attrs.get('coords') : undefined;
    if (p === pp) return;
  }
  const parsed = scanCoords(p);
  if (parsed === null) return; // C warns "expected four doubles"
  bbp.ll.x = parsed.box.ll.x;
  bbp.ll.y = parsed.box.ll.y;
  bbp.ur.x = parsed.box.ur.x;
  bbp.ur.y = parsed.box.ur.y;
  dndata(n).pinned = parsed.pinned;
}

/** sscanf(p, "%lf,%lf,%lf,%lf%c") for chkPos. */
function scanCoords(p: string): { box: Box; pinned: number } | null {
  const num = String.raw`(-?[\d.]+)`;
  const m = new RegExp(
    `^${num},${num},${num},${num}\\s*([!?])?`,
  ).exec(p);
  if (m === null) return null;
  const box: Box = {
    ll: { x: parseFloat(m[1]!), y: parseFloat(m[2]!) },
    ur: { x: parseFloat(m[3]!), y: parseFloat(m[4]!) },
  };
  const c = m[5];
  const pinned = c === '!' ? P_PIN : c === '?' ? P_FIX : P_SET;
  return { box, pinned };
}

/** Derived nodes from clusters. @see layout.c:deriveGraph (cluster loop) */
function deriveClusterNodes(g: Graph, dg: Graph, infop: LayoutInfo): void {
  const nClusters = g.info.n_cluster ?? 0;
  for (let i = 0; i < nClusters; i++) {
    const subg = g.info.clust![i]!;
    const fixBB: Box = {
      ll: { x: Number.MAX_VALUE, y: Number.MAX_VALUE },
      ur: { x: -Number.MAX_VALUE, y: -Number.MAX_VALUE },
    };
    doGraphLabel(subg, layoutMeasurer(infop.rootg));
    const dn = mkDeriveNode(dg, subg.name);
    dndata(dn).clust = subg;
    if (infop.hasCoords) chkPos(subg, dn, infop, fixBB);
    for (const n of subg.nodes.values()) {
      setDnode(n, dn);
    }
    if (dndata(dn).pinned) {
      dn.info.pos![0] = (fixBB.ll.x + fixBB.ur.x) / 2;
      dn.info.pos![1] = (fixBB.ll.y + fixBB.ur.y) / 2;
    }
  }
}

/**
 * Derived nodes from the remaining (non-cluster) nodes.
 * @returns false on the two-non-comparable-clusters error
 * @see layout.c:deriveGraph (remaining-nodes loop)
 */
function deriveRealNodes(g: Graph, dg: Graph): boolean {
  for (const n of g.nodes.values()) {
    if (getDnode(n) !== null) continue;
    const par = getParent(n);
    if (par !== null && par !== gdata(g).parent) {
      // C: agerrorf "node is contained in two non-comparable clusters"
      return false;
    }
    setParent(n, g);
    if (n.info.clustnode) continue;
    setDnode(n, mkRealDnode(dg, n));
  }
  return true;
}

/** Derived image of one real node, sizes copied. @see layout.c:438-453 */
function mkRealDnode(dg: Graph, n: Node): Node {
  const dn = mkDeriveNode(dg, n.name);
  dn.info.width = n.info.width;
  dn.info.height = n.info.height;
  dn.info.lw = n.info.lw;
  dn.info.rw = n.info.rw;
  dn.info.ht = n.info.ht;
  dn.info.shape = n.info.shape;
  dn.info.shape_info = n.info.shape_info;
  if (fdpData(n).pinned) {
    dn.info.pos![0] = n.info.pos![0]!;
    dn.info.pos![1] = n.info.pos![1]!;
    dndata(dn).pinned = fdpData(n).pinned;
  }
  dndata(dn).dn = n;
  return dn;
}

/** Find-or-create the canonical derived edge for (tl, hd). */
function deriveEdge(dg: Graph, byPair: Map<string, Edge>, tl: Node, hd: Node): Edge {
  // C: if (hd > tl) agedge(dg, tl, hd) else agedge(dg, hd, tl)
  const [t, h] = hd.id > tl.id ? [tl, hd] : [hd, tl];
  const key = `${t.id}:${h.id}`;
  let de = byPair.get(key);
  if (de === undefined) {
    de = new Edge(t, h, '');
    de.info.count = 0;
    byPair.set(key, de);
    dg.edges.push(de);
  }
  return de;
}

/** Derived edges. @see layout.c:deriveGraph (edge loop) */
function deriveEdges(g: Graph, dg: Graph, byPair: Map<string, Edge>): void {
  for (const n of g.nodes.values()) {
    const tl = getDnode(n)!;
    for (const e of n.outEdges(g)) {
      const hd = getDnode(e.head)!;
      if (hd === tl) continue;
      const de = deriveEdge(dg, byPair, tl, hd);
      de.info.dist = e.info.dist;
      de.info.factor = e.info.factor;
      dndata(hd).wdeg++;
      dndata(tl).wdeg++;
      if (isNewEdge(de)) {
        dndata(hd).deg++;
        dndata(tl).deg++;
      }
      addEdge(de, e);
    }
  }
}

/** Transform g's ports into dg port nodes. @see layout.c:deriveGraph (ports) */
function derivePorts(g: Graph, dg: Graph, byPair: Map<string, Edge>): void {
  const pp = gdata(g).ports;
  if (pp === null) return;
  const pq: Bport[] = [];
  for (const port of pp) {
    const m = getDnode(port.n);
    /* Create port in derived graph only if it hooks to an internal node */
    if (m === null) continue;
    pq.push(derivePort(g, dg, byPair, port, m));
  }
  gdata(dg).ports = pq;
  gdata(dg).nports = pq.length;
}

/** One derived port node + its edge. @see layout.c:494-517 */
function derivePort(
  g: Graph, dg: Graph, byPair: Map<string, Edge>, port: Bport, m: Node,
): Bport {
  // C portName: _port_<graph>_(<tid>)_(<hid>)_<seq>
  const name =
    `_port_${g.name}_(${port.e.tail.id})_(${port.e.head.id})_${port.e.seq}`;
  const dn = mkDeriveNode(dg, name);
  const de = deriveEdge(dg, byPair, m, dn);
  de.info.dist = port.e.info.dist;
  de.info.factor = port.e.info.factor;
  addEdge(de, port.e);
  dndata(dn).wdeg++;
  dndata(m).wdeg++;
  dndata(dn).deg++; /* ports are unique, so this is the only touch */
  dndata(m).deg++;
  return { n: dn, alpha: port.alpha, e: de };
}

/**
 * Create the derived graph of g by collapsing clusters into nodes.
 * @returns null on the non-comparable-clusters input error
 * @see lib/fdpgen/layout.c:deriveGraph
 */
export function deriveGraph(g: Graph, infop: LayoutInfo): Graph | null {
  const dg = new Graph('derived', 'strict-directed');
  dg.parent = null;
  gdata(dg);
  infop.gid++;

  copyAttr(g, dg, 'overlap');
  copyAttr(g, dg, 'sep');
  copyAttr(g, dg, 'K');

  deriveClusterNodes(g, dg, infop);
  if (!deriveRealNodes(g, dg)) return null;
  const byPair = new Map<string, Edge>();
  deriveEdges(g, dg, byPair);
  derivePorts(g, dg, byPair);

  return dg;
}
