// SPDX-License-Identifier: EPL-2.0
/** @see lib/pathplan/shortestpth.c, lib/pathplan/cvt.c */

import type { Point, Poly, VConfig } from './types.js';
import { ptVis, directVis, visibility } from './visibility.js';

const UNSEEN = Number.MAX_SAFE_INTEGER;

class VisPathHelper {
  static relaxNode(k: number, V: number, dad: number[], vl: Float64Array, wadj: number[][]): number {
    let min = -1;
    for (let t = 0; t < V; t++) {
      if (vl[t + 1] < 0) {
        const wkt = k >= t ? wadj[k][t] : wadj[t][k];
        const newpri = -(vl[k + 1] + wkt);
        if (wkt !== 0 && vl[t + 1] < newpri) { vl[t + 1] = newpri; dad[t] = k; }
        if (vl[t + 1] > vl[min + 1]) min = t;
      }
    }
    return min;
  }

  static dijkstra(root: number, target: number, V: number, wadj: number[][]): number[] {
    const dad = new Array<number>(V).fill(-1);
    const vl = new Float64Array(V + 1);
    for (let k = 0; k < V; k++) vl[k + 1] = -UNSEEN;
    vl[0] = -(UNSEEN + 1);
    let min = root;
    while (min !== target) {
      const k = min;
      vl[k + 1] *= -1;
      if (vl[k + 1] === UNSEEN) vl[k + 1] = 0;
      min = VisPathHelper.relaxNode(k, V, dad, vl, wadj);
    }
    return dad;
  }

  static countPath(dad: number[], V: number): number {
    let n = 2;
    for (let i = dad[V]; i !== V + 1; i = dad[i]) n++;
    return n;
  }

  static extractPath(dad: number[], V: number, p0: Point, p1: Point, conf: VConfig): Point[] {
    const n = VisPathHelper.countPath(dad, V);
    const ops = new Array<Point>(n);
    let j = n - 1;
    ops[j--] = p1;
    for (let i = dad[V]; i !== V + 1; i = dad[i]) ops[j--] = conf.P[i];
    ops[0] = p0;
    return ops;
  }

  static fillArrays(conf: VConfig, polys: Poly[]): void {
    let i = 0;
    for (let pi = 0; pi < polys.length; pi++) {
      const start = i;
      conf.start[pi] = start;
      const pts = polys[pi].ps;
      const end = start + pts.length - 1;
      for (let pt = 0; pt < pts.length; pt++) {
        conf.P[i] = pts[pt];
        conf.next[i] = i + 1;
        conf.prev[i] = i - 1;
        i++;
      }
      conf.next[end] = start;
      conf.prev[start] = end;
    }
    conf.start[polys.length] = i;
  }

  static open(polys: Poly[]): VConfig {
    const n = polys.reduce((s, p) => s + p.ps.length, 0);
    const conf: VConfig = {
      N: n, Npoly: polys.length,
      P: new Array<Point>(n),
      start: new Array<number>(polys.length + 1),
      next: new Array<number>(n),
      prev: new Array<number>(n),
      vis: [],
    };
    VisPathHelper.fillArrays(conf, polys);
    visibility(conf);
    return conf;
  }

  static path(conf: VConfig, p0: Point, poly0: number, p1: Point, poly1: number): Point[] {
    const pvis = ptVis(conf, poly0, p0);
    const qvis = ptVis(conf, poly1, p1);
    const V = conf.N;
    let dad: number[];
    if (directVis(p0, poly0, p1, poly1, conf)) {
      dad = new Array<number>(V + 2).fill(-1);
      dad[V] = V + 1;
    } else {
      conf.vis[V] = qvis;
      conf.vis[V + 1] = pvis;
      dad = VisPathHelper.dijkstra(V + 1, V, V + 2, conf.vis);
    }
    return VisPathHelper.extractPath(dad, V, p0, p1, conf);
  }
}

/** @see lib/pathplan/cvt.c:Pobsopen */
export function obsOpen(polys: Poly[]): VConfig { return VisPathHelper.open(polys); }

/** @see lib/pathplan/cvt.c:Pobsclose */
export function obsClose(_conf: VConfig): void { /* GC handles memory */ }

/** @see lib/pathplan/cvt.c:Pobspath */
export function obsPath(conf: VConfig, p0: Point, poly0: number, p1: Point, poly1: number): Point[] {
  return VisPathHelper.path(conf, p0, poly0, p1, poly1);
}
