// SPDX-License-Identifier: EPL-2.0
//
// Diagnostic harness: dump the aux graph's internal rank/chain structure
// for the flat-adj back-edge size-4-vs-7 divergence (#241_0).
//
// Usage:
//   npx tsx test/diagnostic/flat-aux-dump.ts [dotFile]
//
// Reads flat-back-port.dot by default. Runs the port layout pipeline,
// then replays buildFlatAux using exported helpers (no src/ edits) to
// expose the per-node ranks and virtual-node chain for both:
//   forward  2:ne -> 3:nw  (canary — must agree with C)
//   reversed 3:sw -> 2:se  (the diverging case)
//
// Interface contract (used by T3 unchanged):
//   { edge, maxrank, nodes:[{name,rank,type,order}], chain, auxSize }
//
// ROOT CAUSE: C groups BOTH adjacent flat edges between the same node pair
// into ONE make_flat_adj_edges call (cnt=2). The reversed edge then appears
// as a BACK edge in the joint aux graph, triggering back-edge curl routing
// (auxSize=7). Port calls makeFlatAdjEdges once per edge (cnt=1), making the
// reversed edge a FORWARD edge in its own aux (auxSize=4, straight).
//
// Node-only dev/test infra — never imported by src/index.ts.
//
// @see lib/dotgen/dotsplines.c:make_flat_adj_edges (1122-1281)
// @see src/layout/dot/splines-flat.ts:buildFlatAux (149-166)

import { readFileSync } from 'node:fs';
import { parse } from '../../src/parser/index.js';
import { GvcContext } from '../../src/gvc/context.js';
import { createSvgRenderer } from '../../src/render/svg.js';
import { createMeasurer } from '../../src/common/textmeasure-factory.js';
import { DOT_LAYOUT_ENGINE, dotInitNodeEdge } from '../../src/layout/dot/index.js';
import {
  cloneGraph, runAuxPipeline,
} from '../../src/layout/dot/splines-flat.js';
import {
  cloneNode, cloneEdge,
} from '../../src/layout/dot/splines-clone.js';
import { dotSameports } from '../../src/layout/dot/sameport.js';
import { dotSplines_ } from '../../src/layout/dot/splines.js';
import { Edge as EdgeClass } from '../../src/model/edge.js';
import { NORMAL, VIRTUAL } from '../../src/layout/dot/fastgr.js';
import type { Graph } from '../../src/model/graph.js';
import type { Node } from '../../src/model/node.js';
import type { Edge } from '../../src/model/edge.js';

// ---------------------------------------------------------------------------
// Types matching the T3 interface contract
// ---------------------------------------------------------------------------

interface NodeEntry {
  name: string;
  rank: number;
  type: 'NORMAL' | 'VIRTUAL';
  order: number;
}

interface AuxDump {
  edge: string;
  maxrank: number;
  nodes: NodeEntry[];
  chain: string[];
  auxSize: number;
}

// ---------------------------------------------------------------------------
// isVirtualNode — true for VIRTUAL (non-endpoint routing) nodes
// ---------------------------------------------------------------------------

function isVirtualNode(n: Node): boolean {
  return (n.info.node_type ?? NORMAL) === VIRTUAL;
}

// ---------------------------------------------------------------------------
// edgeLabel — "tail:port->head:port" string
// ---------------------------------------------------------------------------

function edgeLabel(e: Edge): string {
  const tp = e.info.tail_port.defined
    ? `:${e.info.tail_port.name ?? '?'}` : '';
  const hp = e.info.head_port.defined
    ? `:${e.info.head_port.name ?? '?'}` : '';
  return `${e.tail.name}${tp}->${e.head.name}${hp}`;
}

// ---------------------------------------------------------------------------
// toNormalEdge — walk to the NORMAL original (ED_to_orig loop)
// @see lib/dotgen/dotsplines.c:make_flat_adj_edges
// ---------------------------------------------------------------------------

function toNormalEdge(e: Edge): Edge {
  let cur = e;
  while ((cur.info.edge_type ?? NORMAL) !== NORMAL
      && cur.info.to_orig != null) {
    cur = cur.info.to_orig;
  }
  return cur;
}

// ---------------------------------------------------------------------------
// collectVnodes — pick virtual nodes from nlist, excluding endpoints
// ---------------------------------------------------------------------------

function collectVnodes(
  auxg: Graph, auxt: Node, auxh: Node,
): Array<{ name: string; rank: number; order: number }> {
  const acc: Array<{ name: string; rank: number; order: number }> = [];
  for (let n: Node | undefined = auxg.info.nlist; n; n = n.info.next) {
    if (n === auxt || n === auxh || !isVirtualNode(n)) continue;
    acc.push({ name: n.name, rank: n.info.rank ?? -1, order: n.info.order ?? 0 });
  }
  return acc;
}

// ---------------------------------------------------------------------------
// collectChain — sorted virtual-node ids between tail and head
// ---------------------------------------------------------------------------

function collectChain(auxg: Graph, auxt: Node, auxh: Node): string[] {
  const vs = collectVnodes(auxg, auxt, auxh);
  vs.sort((a, b) => a.rank - b.rank || a.order - b.order);
  return vs.map(v => v.name);
}

// ---------------------------------------------------------------------------
// Reposition context — bundles the 4 scalar inputs for repositionAux
// ---------------------------------------------------------------------------

interface RepCtx { rightx: number; leftx: number; midx: number; midy: number }

// ---------------------------------------------------------------------------
// computeRepCtx — derive reposition scalars from original-graph geometry
// @see src/layout/dot/splines-flat.ts:repositionFlatAux (184-201)
// ---------------------------------------------------------------------------

function computeRepCtx(
  g: Graph, otn: Node, ohn: Node, auxt: Node, auxh: Node,
): RepCtx {
  const flip = g.info.flip ?? false;
  const stn = flip ? ohn : otn;
  const shn = flip ? otn : ohn;
  return {
    rightx: ohn.info.coord.x,
    leftx: otn.info.coord.x,
    midx: (stn.info.coord.x - stn.info.rw
      + shn.info.coord.x + shn.info.lw) / 2,
    midy: (auxt.info.coord.x + auxh.info.coord.x) / 2,
  };
}

// ---------------------------------------------------------------------------
// repositionAux — apply reposition scalars to aux nlist
// repositionFlatAux is not exported; this replicates it for the harness.
// @see src/layout/dot/splines-flat.ts:repositionFlatAux (184-201)
// ---------------------------------------------------------------------------

function repositionAux(
  ctx: RepCtx, auxt: Node, auxh: Node, auxg: Graph,
): void {
  for (let n: Node | undefined = auxg.info.nlist; n; n = n.info.next) {
    if (n === auxt) n.info.coord = { x: ctx.midy, y: ctx.rightx };
    else if (n === auxh) n.info.coord = { x: ctx.midy, y: ctx.leftx };
    else n.info.coord = { x: n.info.coord.x, y: ctx.midx };
  }
}

// ---------------------------------------------------------------------------
// addHvye — add a heavy ordering edge (hvye) to the aux graph
// @see src/layout/dot/splines-flat.ts:buildFlatAux (168-164)
// ---------------------------------------------------------------------------

function addHvye(auxg: Graph, auxt: Node, auxh: Node, auxe: Edge): void {
  const noPort = !auxe.info.tail_port.defined
    && !auxe.info.head_port.defined;
  const hvye = noPort ? auxe : new EdgeClass(auxt, auxh, '');
  if (!noPort) auxg.edges.push(hvye);
  hvye.info.weight = 10000;
}

// ---------------------------------------------------------------------------
// buildOneEdgeAux — PORT's per-edge aux graph (cnt=1 replication)
//
// Mirrors port's buildFlatAux for a single edge.
// KEY DIFFERENCE vs C: auxt goes directly into auxg (no rank=source subgraph).
// C puts auxt into subg (rank=source) so the reversed clone is a BACK edge.
// @see src/layout/dot/splines-flat.ts:buildFlatAux (149-166)
// ---------------------------------------------------------------------------

interface AuxNodes { auxg: Graph; auxt: Node; auxh: Node; auxe: Edge }

function buildOneEdgeAux(g: Graph, orig: Edge): AuxNodes {
  const flip = g.info.flip ?? false;
  const otn = orig.tail;
  const ohn = orig.head;
  const auxg = cloneGraph(g);
  const auxt = cloneNode(auxg, flip ? ohn : otn);
  const auxh = cloneNode(auxg, flip ? otn : ohn);
  const edgeOrig = toNormalEdge(orig);
  const auxe = edgeOrig.tail === otn
    ? cloneEdge(auxg, auxt, auxh, edgeOrig)
    : cloneEdge(auxg, auxh, auxt, edgeOrig);
  addHvye(auxg, auxt, auxh, auxe);
  return { auxg, auxt, auxh, auxe };
}

// ---------------------------------------------------------------------------
// collectNodes — gather NodeEntry records from nlist
// ---------------------------------------------------------------------------

function collectNodes(
  auxg: Graph, auxt: Node, auxh: Node,
): NodeEntry[] {
  const acc: NodeEntry[] = [];
  for (let n: Node | undefined = auxg.info.nlist; n; n = n.info.next) {
    const tag = n === auxt ? '(auxt)' : n === auxh ? '(auxh)' : '';
    acc.push({
      name: `${n.name}${tag}`,
      rank: n.info.rank ?? -1,
      type: isVirtualNode(n) ? 'VIRTUAL' : 'NORMAL',
      order: n.info.order ?? 0,
    });
  }
  return acc;
}

// ---------------------------------------------------------------------------
// dumpAuxGraph — run pipeline on one-edge aux + collect the T3 dump struct.
// Mirrors the PORT's actual per-edge call path in makeFlatAdjEdges.
// ---------------------------------------------------------------------------

function dumpAuxGraph(g: Graph, orig: Edge): AuxDump {
  const label = edgeLabel(orig);
  const { auxg, auxt, auxh, auxe } = buildOneEdgeAux(g, orig);
  dotInitNodeEdge(auxg);
  if (runAuxPipeline(auxg) !== 0) {
    return { edge: label, maxrank: -1, nodes: [], chain: [], auxSize: -1 };
  }
  const nodes = collectNodes(auxg, auxt, auxh);
  const chain = collectChain(auxg, auxt, auxh);
  const maxrank = auxg.info.maxrank ?? -1;
  // Reposition before splines (mirrors real path)
  repositionAux(
    computeRepCtx(g, orig.tail, orig.head, auxt, auxh),
    auxt, auxh, auxg,
  );
  dotSameports(auxg);
  dotSplines_(auxg, false);
  const auxSize = auxe.info.spl?.list[0]?.size ?? -1;
  return { edge: label, maxrank, nodes, chain, auxSize };
}

// ---------------------------------------------------------------------------
// splSize — spline size from a post-layout edge (-1 if not set)
// ---------------------------------------------------------------------------

function splSize(e: Edge): number {
  return e.info.spl?.list[0]?.size ?? -1;
}

// ---------------------------------------------------------------------------
// findSameRankEdge — locate an edge by tail/head names and port names
// ---------------------------------------------------------------------------

function findSameRankEdge(
  g: Graph, tailName: string, headName: string,
  tailPort: string, headPort: string,
): Edge | undefined {
  return g.edges.find(
    e => e.tail.name === tailName && e.head.name === headName
      && (e.info.tail_port?.name === tailPort
        || e.info.head_port?.name === headPort),
  );
}

// ---------------------------------------------------------------------------
// Main — canary then reversed dump
// ---------------------------------------------------------------------------

const dotFile = process.argv[2]
  ?? 'test/diagnostic/flat-back-port.dot';
const dotSrc = readFileSync(dotFile, 'utf8');

// Full port layout (all phases)
const portG = parse(dotSrc);
const ctx = new GvcContext(createMeasurer());
ctx.register(DOT_LAYOUT_ENGINE);
ctx.register(createSvgRenderer());
ctx.layout(portG, 'dot');

const portFwdEdge = findSameRankEdge(portG, '2', '3', 'ne', 'nw');
const portBwdEdge = findSameRankEdge(portG, '3', '2', 'sw', 'se');
const portFwdSize = portFwdEdge !== undefined ? splSize(portFwdEdge) : -1;
const portBwdSize = portBwdEdge !== undefined ? splSize(portBwdEdge) : -1;

// Phase-3-only layout (stops after dotPosition, before dotSplines)
const dumpG = parse(dotSrc);
const ctx2 = new GvcContext(createMeasurer());
ctx2.register(DOT_LAYOUT_ENGINE);
ctx2.register(createSvgRenderer());
dumpG.attrs.set('maxphase', '3');
ctx2.layout(dumpG, 'dot');

const dumpEdgeFwd = findSameRankEdge(dumpG, '2', '3', 'ne', 'nw');
const dumpEdgeBwd = findSameRankEdge(dumpG, '3', '2', 'sw', 'se');
const fwdDump = dumpEdgeFwd !== undefined ? dumpAuxGraph(dumpG, dumpEdgeFwd) : null;
const bwdDump = dumpEdgeBwd !== undefined ? dumpAuxGraph(dumpG, dumpEdgeBwd) : null;

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

console.log('=== flat-aux-dump: PORT-SIDE ANALYSIS ===');
console.log('');
console.log('--- Final spline sizes (full port layout) ---');
console.log(`  forward  2:ne->3:nw  port auxSize = ${portFwdSize}`);
console.log(`  reversed 3:sw->2:se  port auxSize = ${portBwdSize}`);
console.log('');

if (fwdDump !== null) {
  console.log(`--- One-edge aux dump: ${fwdDump.edge} (CANARY) ---`);
  console.log(JSON.stringify(fwdDump, null, 2));
} else {
  console.log('WARN: forward edge (2:ne->3:nw) not found in graph');
}
console.log('');

if (bwdDump !== null) {
  console.log(`--- One-edge aux dump: ${bwdDump.edge} (DIVERGING) ---`);
  console.log(JSON.stringify(bwdDump, null, 2));
} else {
  console.log('WARN: reversed edge (3:sw->2:se) not found in graph');
}
console.log('');

console.log('=== C-SIDE DATA (from native dot instrumentation) ===');
console.log('C calls make_flat_adj_edges ONCE with cnt=2 (both edges grouped).');
console.log('C aux graph (edge0=2->3, cnt=2, auxt=node2, auxh=node3):');
console.log('  auxEdge1: auxt(2)->auxh(3) ne->nw  size=7');
console.log('  auxEdge2: auxh(3)->auxt(2) sw->se  size=7  <- BACK EDGE in aux');
console.log('  hvye:     auxt(2)->auxh(3) wt=10000 size=4');
console.log('C maxrank=1, no virtual nodes.');
console.log('Back-edge routing in dot_splines_ produces curl (auxSize=7).');
console.log('');
console.log('Port calls makeFlatAdjEdges ONCE PER EDGE (cnt=1).');
console.log('Port aux for 3:sw->2:se:');
console.log('  auxt=node3(rank 0), auxh=node2(rank 1)');
console.log('  auxEdge: auxt(3)->auxh(2) sw->se  size=4  <- FORWARD EDGE');
console.log('Reversed edge is FORWARD in its own aux -> straight routing (size 4).');
console.log('');
console.log('ROOT CAUSE: port processes edges one-at-a-time (cnt=1); C groups');
console.log('all adjacent flat edges (cnt=N). With cnt=1 the back-edge is absent');
console.log('from the aux graph, so dot_splines_ never routes it with the curl.');
console.log('');

const canaryOk = portFwdSize === 7;
const bugReproduced = portBwdSize === 4;
console.log(`CANARY (2:ne->3:nw port=7): ${canaryOk ? 'GREEN' : 'RED'}`);
console.log(`BUG REPRODUCED (3:sw->2:se port=4 vs C=7): ${bugReproduced ? 'YES' : 'NO'}`);

if (!canaryOk) {
  process.stderr.write(
    `CANARY FAILED: forward edge auxSize=${portFwdSize}, expected 7\n`,
  );
  process.exit(1);
}
