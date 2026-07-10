// SPDX-License-Identifier: EPL-2.0

/**
 * Seven-phase radial layout algorithm for the twopi engine.
 * Ports lib/twopigen/circle.c.
 *
 * @see lib/twopigen/circle.c
 * @see lib/twopigen/circle.h
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import type { Edge } from '../../model/edge.js';
import type { TwopiAlgData } from '../../model/nodeInfo.js';
import { THETA_UNSET } from '../../model/nodeInfo.js';

/** Default ring separation in inches. @see lib/twopigen/circle.c:#define DEF_RANKSEP */
const DEF_RANKSEP = 1.0;

/** Minimum per-ring delta. @see lib/common/render.h:MIN_RANKSEP */
export const MIN_RANKSEP = 0.02;

/** Get the TwopiAlgData record for a node; throws if absent. */
function rdata(n: Node): TwopiAlgData {
  const d = n.info.alg;
  if (!d || d.kind !== 'twopi') throw new Error(`twopi: missing rdata on node ${n.name}`);
  return d;
}

/**
 * Resolve the neighbor of n across ep; null if ep is not incident.
 * @see lib/twopigen/circle.c (edge traversal pattern)
 */
function neighborOf(ep: Edge, n: Node): Node | null {
  if (ep.tail === n) return ep.head;
  if (ep.head === n) return ep.tail;
  return null;
}

/**
 * Edges incident to n in agfstedge/agnxtedge order: out-edges first,
 * then in-edges. C's traversal order is load-bearing for the fan
 * assignment in setChildPositions.
 * @see lib/cgraph/edge.c:agfstedge
 */
function incidentEdges(g: Graph, n: Node): Edge[] {
  return [...n.outEdges(g), ...n.inEdges(g)];
}

/**
 * Return true if n is a leaf: at most one distinct neighbor.
 * @see lib/twopigen/circle.c:isLeaf
 */
export function isLeaf(g: Graph, n: Node): boolean {
  let neighp: Node | null = null;
  for (const ep of incidentEdges(g, n)) {
    const np = neighborOf(ep, n);
    if (np === null || np === n) continue;
    if (neighp === null) { neighp = np; }
    else if (neighp !== np) { return false; }
  }
  return true;
}

/**
 * Phase 1: initialize all rdata fields before BFS passes.
 * @see lib/twopigen/circle.c:initLayout
 */
export function initLayout(g: Graph): void {
  const INF = g.nodes.size * g.nodes.size;
  for (const n of g.nodes.values()) {
    n.info.alg = {
      kind: 'twopi',
      nStepsToLeaf: isLeaf(g, n) ? 0 : INF,
      subtreeSize: 0,
      nChildren: 0,
      nStepsToCenter: INF,
      parent: null,
      span: 0,
      theta: THETA_UNSET,
    };
  }
}

/** Try to relax leaf-distance on one neighbor; recurse on improvement. */
function relaxLeafEdge(g: Graph, next: Node, from: Node, nsteps: number): void {
  const nd2 = rdata(next);
  if (nsteps < nd2.nStepsToLeaf) {
    nd2.nStepsToLeaf = nsteps;
    setNStepsToLeaf(g, next, from);
  }
}

/**
 * DFS to propagate leaf distance outward from n.
 * @see lib/twopigen/circle.c:setNStepsToLeaf
 */
export function setNStepsToLeaf(g: Graph, n: Node, prev: Node | null): void {
  const nsteps = rdata(n).nStepsToLeaf + 1;
  for (const ep of incidentEdges(g, n)) {
    const next = neighborOf(ep, n);
    if (next !== null && next !== prev) relaxLeafEdge(g, next, n, nsteps);
  }
}

/** Try to relax BFS distance to `next` through `cur`. */
function processBfsEdge(cur: Node, next: Node, nsteps: number, queue: Node[]): void {
  const nd2 = rdata(next);
  if (nsteps < nd2.nStepsToCenter) {
    nd2.nStepsToCenter = nsteps;
    nd2.parent = cur;
    rdata(cur).nChildren++;
    queue.push(next);
  }
}

/**
 * Phase 2: find center node (max nStepsToLeaf).
 * @see lib/twopigen/circle.c:findCenterNode
 */
export function findCenterNode(g: Graph): Node | null {
  for (const n of g.nodes.values()) {
    if (rdata(n).nStepsToLeaf === 0) setNStepsToLeaf(g, n, null);
  }
  let center: Node | null = null;
  let maxSteps = 0;
  for (const n of g.nodes.values()) {
    const sl = rdata(n).nStepsToLeaf;
    if (center === null || sl > maxSteps) { maxSteps = sl; center = n; }
  }
  return center;
}

/**
 * BFS from n assigning SCENTER and SPARENT; skips weight=0 edges.
 * @see lib/twopigen/circle.c:setNStepsToCenter
 */
export function setNStepsToCenter(g: Graph, n: Node): void {
  const queue: Node[] = [n];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++]!;
    const nsteps = rdata(cur).nStepsToCenter + 1;
    for (const ep of incidentEdges(g, cur)) {
      if (ep.attrs.get('weight') === '0') continue;
      const next = neighborOf(ep, cur);
      if (next !== null) processBfsEdge(cur, next, nsteps, queue);
    }
  }
}

/**
 * Phase 3: BFS from center; returns max ring index or MAX_SAFE_INTEGER.
 * @see lib/twopigen/circle.c:setParentNodes
 */
export function setParentNodes(sg: Graph, center: Node): number {
  const nd = rdata(center);
  const unset = nd.nStepsToCenter;
  nd.nStepsToCenter = 0;
  nd.parent = null;
  setNStepsToCenter(sg, center);
  let maxn = 0;
  for (const n of sg.nodes.values()) {
    const sc = rdata(n).nStepsToCenter;
    if (sc === unset) return Number.MAX_SAFE_INTEGER;
    if (sc > maxn) maxn = sc;
  }
  return maxn;
}

/** Walk the parent chain from n, incrementing subtreeSize at each ancestor. */
function walkAncestorChain(n: Node): void {
  let par = rdata(n).parent;
  while (par !== null) {
    rdata(par).subtreeSize++;
    par = rdata(par).parent;
  }
}

/**
 * Phase 4: count BFS-leaves in each subtree bottom-up.
 * @see lib/twopigen/circle.c:setSubtreeSize
 */
export function setSubtreeSize(g: Graph): void {
  for (const n of g.nodes.values()) {
    const nd = rdata(n);
    if (nd.nChildren > 0) continue;
    nd.subtreeSize++;
    walkAncestorChain(n);
  }
}

/**
 * Assign span to one child of n; recurse if it has children.
 * @see lib/twopigen/circle.c:setChildSubtreeSpans (inner body)
 */
function applySpanToChild(g: Graph, n: Node, next: Node, ratio: number, seen: Set<Node>): void {
  const nd2 = rdata(next);
  if (nd2.parent !== n || nd2.span !== 0 || seen.has(next)) return;
  seen.add(next);
  nd2.span = ratio * nd2.subtreeSize;
  if (nd2.nChildren > 0) setChildSubtreeSpans(g, next);
}

/**
 * Recursively partition a node's angular span among its children.
 * @see lib/twopigen/circle.c:setChildSubtreeSpans
 */
export function setChildSubtreeSpans(g: Graph, n: Node): void {
  const nd = rdata(n);
  const ratio = nd.span / nd.subtreeSize;
  const seen = new Set<Node>();
  for (const ep of incidentEdges(g, n)) {
    const next = neighborOf(ep, n);
    if (next !== null) applySpanToChild(g, n, next, ratio, seen);
  }
}

/**
 * Phase 5: root gets 2π span; children get proportional shares.
 * @see lib/twopigen/circle.c:setSubtreeSpans
 */
export function setSubtreeSpans(sg: Graph, center: Node): void {
  rdata(center).span = 2 * Math.PI;
  setChildSubtreeSpans(sg, center);
}

/**
 * Assign theta to one child and recurse; returns updated fan pointer.
 * @see lib/twopigen/circle.c:setChildPositions (inner body)
 */
function applyThetaToChild(sg: Graph, n: Node, next: Node, theta: number): number {
  const nd2 = rdata(next);
  if (nd2.parent !== n || nd2.theta !== THETA_UNSET) return theta;
  nd2.theta = theta + nd2.span / 2.0;
  theta += nd2.span;
  if (nd2.nChildren > 0) setChildPositions(sg, next);
  return theta;
}

/**
 * Assign theta (angular midpoint) to each child of n in a fan.
 * @see lib/twopigen/circle.c:setChildPositions
 */
export function setChildPositions(sg: Graph, n: Node): void {
  const nd = rdata(n);
  let theta = nd.parent === null ? 0 : nd.theta - nd.span / 2;
  for (const ep of incidentEdges(sg, n)) {
    const next = neighborOf(ep, n);
    if (next !== null) theta = applyThetaToChild(sg, n, next, theta);
  }
}

/**
 * Phase 6: assign angular positions; root gets theta = 0.
 * @see lib/twopigen/circle.c:setPositions
 */
export function setPositions(sg: Graph, center: Node): void {
  rdata(center).theta = 0;
  setChildPositions(sg, center);
}

/**
 * Parse colon-separated ranksep parts; returns last delta, next rk, running sum.
 * @see lib/twopigen/circle.c:getRankseps (parse loop)
 */
function parseRanksepParts(
  parts: string[], ranks: number[], maxrank: number,
): { delx: number; rk: number; xf: number } {
  // C initializes delx = 0.0; DEF_RANKSEP applies ONLY when the ranksep attr
  // is ABSENT. A present-but-unparseable value ("equally") leaves delx 0 and
  // every ring collapses to radius 0 — a load-bearing quirk (graphs/b80).
  // @see lib/twopigen/circle.c:getRankseps
  let xf = 0; let delx = 0; let rk = 1;
  for (const part of parts) {
    if (rk > maxrank) break;
    const d = parseFloat(part.trim());
    if (!isFinite(d) || d <= 0) break;
    delx = Math.max(d, MIN_RANKSEP);
    xf += delx;
    ranks[rk++] = xf;
  }
  return { delx, rk, xf };
}

/**
 * Build cumulative radius array from ranksep attribute.
 * @see lib/twopigen/circle.c:getRankseps
 */
export function getRankseps(g: Graph, maxrank: number): number[] {
  const ranks = new Array<number>(maxrank + 1).fill(0);
  const raw = g.root.attrs.get('ranksep') ?? g.attrs.get('ranksep');
  let delx = DEF_RANKSEP; let rk = 1; let xf = 0;
  if (raw !== undefined && raw.length > 0) {
    const r = parseRanksepParts(raw.split(':'), ranks, maxrank);
    delx = r.delx; rk = r.rk; xf = r.xf;
  }
  for (let i = rk; i <= maxrank; i++) { xf += delx; ranks[i] = xf; }
  return ranks;
}

/**
 * Phase 7: polar → Cartesian; writes to n.info.pos.
 * @see lib/twopigen/circle.c:setAbsolutePos
 */
export function setAbsolutePos(g: Graph, maxrank: number): void {
  const ranksep = getRankseps(g, maxrank);
  for (const n of g.nodes.values()) {
    const nd = rdata(n);
    const hyp = ranksep[nd.nStepsToCenter] ?? 0;
    if (!n.info.pos || n.info.pos.length < 2) n.info.pos = [0, 0];
    n.info.pos[0] = hyp * Math.cos(nd.theta);
    n.info.pos[1] = hyp * Math.sin(nd.theta);
  }
}

/**
 * Run the full seven-phase radial layout on a connected subgraph.
 * Returns the center node used; null only if the graph is empty.
 * @see lib/twopigen/circle.c:circleLayout
 */
export function circleLayout(sg: Graph, center: Node | null): Node | null {
  if (sg.nodes.size === 1) {
    const n = sg.nodes.values().next().value as Node;
    if (!n.info.pos || n.info.pos.length < 2) n.info.pos = [0, 0];
    n.info.pos[0] = 0; n.info.pos[1] = 0;
    return center;
  }
  initLayout(sg);
  if (center === null) center = findCenterNode(sg);
  if (center === null) return null;
  const maxN = setParentNodes(sg, center);
  if (maxN === Number.MAX_SAFE_INTEGER) return center;
  setSubtreeSize(sg);
  setSubtreeSpans(sg, center);
  setPositions(sg, center);
  setAbsolutePos(sg, maxN);
  return center;
}
