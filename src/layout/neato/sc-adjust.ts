// SPDX-License-Identifier: EPL-2.0

/**
 * Scale-based overlap removal — scAdjust and the adjustNodes overlap-mode
 * subset that reaches it.
 *
 * `overlap=scale` (AM_NSCALE) scales the layout uniformly so node boxes stop
 * overlapping; `scalexy` (AM_SCALEXY) scales x and y independently;
 * `compress` (AM_COMPRESS) scales down to remove excess space. Based on
 * Marriott, Stuckey, Tam and He, "Removing Node Overlapping in Graph Layout
 * Using Constrained Optimization", Constraints 8(2):143-172, 2003 (per the
 * C source comment).
 *
 * Other overlap modes (voronoi, prism, vpsc, ortho*) remain unported; with
 * the attr unset C's getAdjustMode resolves to AM_NONE and the pass is a
 * no-op (normalize/simpleScale only fire on rare attrs, also unported).
 *
 * @see lib/neatogen/constraint.c:scAdjust
 * @see lib/neatogen/adjust.c:removeOverlapWith / getAdjustMode
 */

import type { Graph } from '../../model/graph.js';
import type { Node } from '../../model/node.js';
import { sepFactor } from './sep-factor.js';
import { gvQsort } from '../../util/bsd-qsort.js';
import { nodesInSeq } from '../dot/decomp.js';

interface Pointf { x: number; y: number }

/** Per-node scratch mirroring constraint.c's `info` struct. */
interface Info {
  pos: Pointf;
  ll: Pointf;
  ur: Pointf;
  wd2: number;
  ht2: number;
  np: Node;
}

/** Boxes overlap (closed intervals). @see lib/neatogen/adjust.h:OVERLAP */
function overlap(a: Info, b: Info): boolean {
  return a.ur.x >= b.ll.x && b.ur.x >= a.ll.x && a.ur.y >= b.ll.y && b.ur.y >= a.ll.y;
}

/** @see lib/neatogen/constraint.c:sortf */
function sortf(p: Pointf, q: Pointf): number {
  if (p.x < q.x) return -1;
  if (p.x > q.x) return 1;
  if (p.y < q.y) return -1;
  if (p.y > q.y) return 1;
  return 0;
}

/**
 * Per overlapping pair, the (x,y) scale factors that would separate it.
 * aarr[0] is a {0,0} sentinel the callers overwrite/skip.
 * @see lib/neatogen/constraint.c:mkOverlapSet
 */
function mkOverlapSet(nl: Info[]): Pointf[] {
  const S: Pointf[] = [{ x: 0, y: 0 }];
  for (let i = 0; i < nl.length; i++) {
    const p = nl[i]!;
    for (let j = i + 1; j < nl.length; j++) {
      const q = nl[j]!;
      if (!overlap(p, q)) continue;
      const pt: Pointf = { x: 0, y: 0 };
      if (p.pos.x === q.pos.x) pt.x = Number.POSITIVE_INFINITY;
      else {
        pt.x = (p.wd2 + q.wd2) / Math.abs(p.pos.x - q.pos.x);
        if (pt.x < 1) pt.x = 1;
      }
      if (p.pos.y === q.pos.y) pt.y = Number.POSITIVE_INFINITY;
      else {
        pt.y = (p.ht2 + q.ht2) / Math.abs(p.pos.y - q.pos.y);
        if (pt.y < 1) pt.y = 1;
      }
      S.push(pt);
    }
  }
  return S;
}

/** Uniform scale: max over pairs of min(x,y). @see constraint.c:computeScale */
function computeScale(aarr: Pointf[]): number {
  let sc = 0;
  for (let i = 1; i < aarr.length; i++) {
    const p = aarr[i]!;
    const v = Math.min(p.x, p.y);
    if (v > sc) sc = v;
  }
  return sc;
}

/** Separate x/y scales minimizing area. @see constraint.c:computeScaleXY */
function computeScaleXY(aarr: Pointf[]): Pointf {
  const m = aarr.length;
  aarr[0] = { x: 1, y: Number.POSITIVE_INFINITY };
  const rest = aarr.slice(1);
  gvQsort(rest, sortf);
  for (let i = 1; i < m; i++) aarr[i] = rest[i - 1]!;

  const barr: Pointf[] = new Array(m).fill(null).map(() => ({ x: 0, y: 0 }));
  barr[m - 1] = { x: aarr[m - 1]!.x, y: 1 };
  for (let k = m - 2; ; k--) {
    barr[k] = { x: aarr[k]!.x, y: Math.max(aarr[k + 1]!.y, barr[k + 1]!.y) };
    if (k === 0) break;
  }

  let best = 0;
  let bestcost = Number.POSITIVE_INFINITY;
  for (let k = 0; k < m; k++) {
    const cost = barr[k]!.x * barr[k]!.y;
    if (cost < bestcost) { bestcost = cost; best = k; }
  }
  return { x: barr[best]!.x, y: barr[best]!.y };
}

/** Max scale that leaves no free space; 0 if overlaps exist.
 * @see lib/neatogen/constraint.c:compress */
function compress(nl: Info[]): number {
  let sc = 0;
  for (let i = 0; i < nl.length; i++) {
    const p = nl[i]!;
    for (let j = i + 1; j < nl.length; j++) {
      const q = nl[j]!;
      if (overlap(p, q)) return 0;
      const ptx = p.pos.x === q.pos.x
        ? Number.POSITIVE_INFINITY
        : (p.wd2 + q.wd2) / Math.abs(p.pos.x - q.pos.x);
      const pty = p.pos.y === q.pos.y
        ? Number.POSITIVE_INFINITY
        : (p.ht2 + q.ht2) / Math.abs(p.pos.y - q.pos.y);
      const s = pty < ptx ? pty : ptx;
      if (s > sc) sc = s;
    }
  }
  return sc;
}

/**
 * Scale the layout (positions in ND_pos INCHES).
 * equal > 0 → uniform scale to remove overlaps; equal = 0 → separate x/y;
 * equal < 0 → scale DOWN to remove excess space (assumes no overlaps).
 * @see lib/neatogen/constraint.c:767 scAdjust
 */
export function scAdjust(g: Graph, equal: number): number {
  const margin = sepFactor(g);
  let mx = margin.x;
  let my = margin.y;
  if (margin.doAdd) {
    mx = mx / 72; // PS2INCH
    my = my / 72;
  }

  const nlist: Info[] = [];
  for (const n of nodesInSeq(g)) {
    const w2 = margin.doAdd ? (n.info.width ?? 0) / 2 + mx : (mx * (n.info.width ?? 0)) / 2;
    const h2 = margin.doAdd ? (n.info.height ?? 0) / 2 + my : (my * (n.info.height ?? 0)) / 2;
    const pos: Pointf = { x: n.info.pos?.[0] ?? 0, y: n.info.pos?.[1] ?? 0 };
    nlist.push({
      pos,
      ll: { x: pos.x - w2, y: pos.y - h2 },
      ur: { x: pos.x + w2, y: pos.y + h2 },
      wd2: w2,
      ht2: h2,
      np: n,
    });
  }

  let s: Pointf;
  if (equal < 0) {
    const sc = compress(nlist);
    if (sc === 0) return 0; // overlaps exist
    s = { x: sc, y: sc };
  } else {
    const aarr = mkOverlapSet(nlist);
    if (aarr.length === 1) return 0; // no overlaps
    if (equal) {
      const sc = computeScale(aarr);
      s = { x: sc, y: sc };
    } else {
      s = computeScaleXY(aarr);
    }
  }

  for (const p of nlist) {
    if (!p.np.info.pos) p.np.info.pos = [0, 0];
    p.np.info.pos[0] = s.x * p.pos.x;
    p.np.info.pos[1] = s.y * p.pos.y;
  }
  return 1;
}

/**
 * The adjustNodes overlap-mode subset reaching scAdjust; other modes are
 * no-ops (see module doc).
 * @see lib/neatogen/adjust.c:999 adjustNodes, :776 adjustMode table
 */
export function adjustNodesScale(g: Graph): number {
  // agget falls back to the root graph's attrs for component subgraphs.
  const flag = (g.attrs.get('overlap') ?? g.root.attrs.get('overlap') ?? '').toLowerCase();
  if (flag === 'scale') return scAdjust(g, 1);       // AM_NSCALE
  if (flag === 'scalexy') return scAdjust(g, 0);     // AM_SCALEXY
  if (flag === 'compress') return scAdjust(g, -1);   // AM_COMPRESS
  return 0; // unset -> AM_NONE; other modes unported
}
