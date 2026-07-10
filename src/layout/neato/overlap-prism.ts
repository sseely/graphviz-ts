// SPDX-License-Identifier: EPL-2.0

/**
 * PRISM overlap removal — the HAVE_GTS remove_overlap of the reference
 * binary. `overlap=false` (and any unrecognized overlap value) maps to
 * AM_PRISM on that build, so circo/twopi/neato-family layouts run this
 * after positioning.
 *
 * Pipeline per try: proximity graph = Delaunay triangulation of the node
 * centers (call_tri) plus, after the first convergence, the scan-line
 * overlap graph; ideal distances stretch overlapping pairs apart; one
 * stress-majorization step (CG solve) moves the nodes.
 *
 * @see lib/neatogen/overlap.c
 * @see lib/sfdpgen/post_process.c:StressMajorizationSmoother_smooth
 */

import type { SpMatrix } from '../sfdp/sparse-matrix.js';
import {
  smNew, smCoordAddEntry, smFromCoordinateFormat, smSymmetrize,
  smAdd, smCopy, smMultiplyDense,
  MATRIX_TYPE_REAL, FORMAT_COORD,
} from '../sfdp/sparse-matrix.js';
import { smSolve } from '../sfdp/sparse-solve.js';
import { distance, averageEdgeLength } from '../sfdp/spring-electrical.js';
import { cdrand } from '../../common/crand.js';
import { delaunayTri } from './delaunay.js';
import {
  rbTreeCreate, rbTreeInsert, rbExactQuery, treePredecessor, rbDelete,
} from '../../rbtree/index.js';
import type { RbTree, RbNode } from '../../rbtree/index.js';

/** @see lib/sparse/general.h:MACHINEACC */
const MACHINEACC = 1.0e-16;

// ---------------------------------------------------------------------------
// call_tri
// ---------------------------------------------------------------------------

/**
 * Proximity graph: symmetrized Delaunay adjacency (unit weights, with
 * diagonal). @see lib/neatogen/call_tri.c:call_tri
 */
export function callTri(n: number, x: number[]): SpMatrix {
  const xv = new Array<number>(n);
  const yv = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    xv[i] = x[i * 2]!;
    yv[i] = x[i * 2 + 1]!;
  }

  const edgelist = n > 2 ? delaunayTri(xv, yv, n) : [];

  let A = smNew(n, n, MATRIX_TYPE_REAL, FORMAT_COORD);
  for (let i = 0; i * 2 < edgelist.length; i++) {
    smCoordAddEntry(A, edgelist[i * 2]!, edgelist[i * 2 + 1]!, 1);
  }
  if (n === 2) {
    smCoordAddEntry(A, 0, 1, 1);
  }
  for (let i = 0; i < n; i++) {
    smCoordAddEntry(A, i, i, 1);
  }
  const B = smFromCoordinateFormat(A);
  A = smSymmetrize(B, false);
  return A;
}

// ---------------------------------------------------------------------------
// get_overlap_graph — scan-line clash detection
// ---------------------------------------------------------------------------

const INTV_OPEN = 0;
const INTV_CLOSE = 1;

interface ScanPoint {
  node: number;
  x: number;
  status: number;
}

/** @see lib/neatogen/overlap.c:comp_scan_points */
function compScanPoints(p: unknown, q: unknown): number {
  const pp = p as ScanPoint;
  const qq = q as ScanPoint;
  if (pp.x > qq.x) return 1;
  if (pp.x < qq.x) return -1;
  if (pp.node > qq.node) return 1;
  if (pp.node < qq.node) return -1;
  return 0;
}

/**
 * Sweep x; an interval leaving the sweep is tested for y-overlap against
 * every tree predecessor of its close key. The departed interval's OPEN
 * key is never removed from the tree — that is the C behavior (only the
 * close key is deleted), and the stale keys are load-bearing for the
 * emitted clash set. Port exactly.
 * @see lib/neatogen/overlap.c:get_overlap_graph
 */
function getOverlapGraph(
  dim: number, n: number, x: number[], width: number[], checkOverlapOnly: boolean,
): SpMatrix {
  let A = smNew(n, n, MATRIX_TYPE_REAL, FORMAT_COORD);

  const scanpointsx: ScanPoint[] = new Array<ScanPoint>(2 * n);
  for (let i = 0; i < n; i++) {
    scanpointsx[2 * i] = { node: i, x: x[i * dim]! - width[i * dim]!, status: INTV_OPEN };
    scanpointsx[2 * i + 1] = { node: i + n, x: x[i * dim]! + width[i * dim]!, status: INTV_CLOSE };
  }
  // C uses libc qsort here; comp_scan_points is a total order on
  // (x, node) — node values are unique — so any sort gives the same result.
  scanpointsx.sort(compScanPoints);

  const scanpointsy: ScanPoint[] = new Array<ScanPoint>(2 * n);
  for (let i = 0; i < n; i++) {
    scanpointsy[i] = { node: i, x: x[i * dim + 1]! - width[i * dim + 1]!, status: INTV_OPEN };
    scanpointsy[i + n] = { node: i, x: x[i * dim + 1]! + width[i * dim + 1]!, status: INTV_CLOSE };
  }

  const treey: RbTree = rbTreeCreate(compScanPoints, () => undefined);

  outer:
  for (let i = 0; i < 2 * n; i++) {
    const k = scanpointsx[i]!.node % n;

    if (scanpointsx[i]!.status === INTV_OPEN) {
      rbTreeInsert(treey, scanpointsy[k]!); // add both open and close int for y
      rbTreeInsert(treey, scanpointsy[k + n]!);
    } else {
      const newNode0: RbNode | null = rbExactQuery(treey, scanpointsy[k + n]!);
      let newNode: RbNode | null = newNode0;
      const ii = (newNode!.key as ScanPoint).node;
      const bsta = scanpointsy[ii]!.x;
      const bsto = scanpointsy[ii + n]!.x;

      while (newNode && (newNode = treePredecessor(treey, newNode)) !== treey.nil) {
        const neighbor = (newNode.key as ScanPoint).node % n;
        const bbsta = scanpointsy[neighbor]!.x;
        const bbsto = scanpointsy[neighbor + n]!.x;
        if (neighbor !== k) {
          if (Math.abs(0.5 * (bsta + bsto) - 0.5 * (bbsta + bbsto))
              < 0.5 * (bsto - bsta) + 0.5 * (bbsto - bbsta)) {
            smCoordAddEntry(A, neighbor, k, 1);
            if (checkOverlapOnly) break outer;
          }
        }
      }

      if (newNode0) rbDelete(treey, newNode0);
    }
  }

  const B = smFromCoordinateFormat(A);
  A = smSymmetrize(B, false);
  return A;
}

// ---------------------------------------------------------------------------
// ideal_distance_avoid_overlap
// ---------------------------------------------------------------------------

/** @see lib/neatogen/overlap.c:ideal_distance_avoid_overlap */
function idealDistanceAvoidOverlap(
  dim: number, A: SpMatrix, x: number[], width: number[], idealDistance: number[],
): { tmax: number; tmin: number } {
  const ia = A.ia!;
  const ja = A.ja!;
  const expandmax = 1.5;
  const expandmin = 1;
  let tmax = 0;
  let tmin = 1.e10;

  for (let i = 0; i < A.m; i++) {
    for (let j = ia[i]!; j < ia[i + 1]!; j++) {
      const jj = ja[j]!;
      if (jj === i) continue;
      const dist = distance(x, dim, i, jj);
      const dx = Math.abs(x[i * dim]! - x[jj * dim]!);
      const dy = Math.abs(x[i * dim + 1]! - x[jj * dim + 1]!);
      const wx = width[i * dim]! + width[jj * dim]!;
      const wy = width[i * dim + 1]! + width[jj * dim + 1]!;
      if (dx < MACHINEACC * wx && dy < MACHINEACC * wy) {
        idealDistance[j] = Math.hypot(wx, wy);
        tmax = 2;
      } else {
        let t;
        if (dx < MACHINEACC * wx) {
          t = wy / dy;
        } else if (dy < MACHINEACC * wy) {
          t = wx / dx;
        } else {
          t = Math.min(wx / dx, wy / dy);
        }
        // no point in things like t = 1.00000001 as this slows down convergence
        if (t > 1) t = Math.max(t, 1.001);
        tmax = Math.max(tmax, t);
        tmin = Math.min(tmin, t);
        t = Math.min(expandmax, t);
        t = Math.max(expandmin, t);
        if (t > 1) {
          idealDistance[j] = t * dist;
        } else {
          idealDistance[j] = -t * dist;
        }
      }
    }
  }
  return { tmax, tmin };
}

// ---------------------------------------------------------------------------
// overlap_scaling — bisection shrink
// ---------------------------------------------------------------------------

/** @see lib/neatogen/overlap.c:scale_coord */
function scaleCoord(dim: number, m: number, x: number[], scale: number): void {
  for (let i = 0; i < dim * m; i++) x[i]! *= scale;
}

/** @see lib/neatogen/overlap.c:overlap_scaling */
function overlapScaling(
  dim: number, m: number, x: number[], width: number[],
  scaleStaIn: number, scaleStoIn: number, epsilon: number, maxiter: number,
): void {
  let scaleSta = scaleStaIn;
  let scaleSto = scaleStoIn;
  let iter = 0;

  if (scaleSta <= 0) {
    scaleSta = 0;
  } else {
    scaleCoord(dim, m, x, scaleSta);
    const C = getOverlapGraph(dim, m, x, width, true);
    if (C.nz === 0) return;
    scaleCoord(dim, m, x, 1 / scaleSta);
  }

  if (scaleSto < 0) {
    if (scaleSta === 0) {
      scaleSto = epsilon;
    } else {
      scaleSto = scaleSta;
    }
    scaleCoord(dim, m, x, scaleSto);
    let overlap;
    do {
      scaleSto *= 2;
      scaleCoord(dim, m, x, 2);
      const C = getOverlapGraph(dim, m, x, width, true);
      overlap = C.nz > 0;
    } while (overlap);
    scaleCoord(dim, m, x, 1 / scaleSto); // unscale
  }

  let scaleBest = scaleSto;
  while (iter++ < maxiter && scaleSto - scaleSta > epsilon) {
    const scale = 0.5 * (scaleSta + scaleSto);
    scaleCoord(dim, m, x, scale);
    const C = getOverlapGraph(dim, m, x, width, true);
    scaleCoord(dim, m, x, 1 / scale); // unscale
    const overlap = C.nz > 0;
    if (overlap) {
      scaleSta = scale;
    } else {
      scaleBest = scaleSto = scale;
    }
  }

  // final scaling
  scaleCoord(dim, m, x, scaleBest);
}

// ---------------------------------------------------------------------------
// OverlapSmoother (StressMajorizationSmoother, SM_SCHEME_NORMAL)
// ---------------------------------------------------------------------------

interface OverlapSmoother {
  Lw: SpMatrix;
  Lwd: SpMatrix;
  lambda: number[];
  tolCg: number;
  maxitCg: number;
}

/**
 * Build the smoother: Lw pattern = triangulation (+ overlap clashes after
 * the first pass); weights/ideal distances from overlap stretching.
 * @see lib/neatogen/overlap.c:OverlapSmoother_new
 */
function overlapSmootherNew(
  m: number, dim: number, x: number[], width: number[],
  neighborhoodOnly: boolean, shrink: boolean,
): { sm: OverlapSmoother; maxOverlap: number; minOverlap: number } {
  const sm: OverlapSmoother = {
    Lw: null as unknown as SpMatrix,
    Lwd: null as unknown as SpMatrix,
    lambda: new Array<number>(m).fill(0),
    tolCg: 0.01,
    maxitCg: Math.floor(Math.sqrt(m)),
  };

  let B = callTri(m, x);

  if (!neighborhoodOnly) {
    const C = getOverlapGraph(dim, m, x, width, false);
    B = smAdd(B, C);
  }
  sm.Lw = B;
  sm.Lwd = smCopy(sm.Lw);

  const { tmax, tmin } = idealDistanceAvoidOverlap(dim, sm.Lwd, x, width, sm.Lwd.a!);

  // no overlap at all!
  if (tmax < 1 && shrink) {
    const scaleSta = Math.min(1, tmax * 1.0001);
    const scaleSto = 1;
    overlapScaling(dim, m, x, width, scaleSta, scaleSto, 0.0001, 15);
    return { sm, maxOverlap: 1, minOverlap: tmin };
  }

  const iw = sm.Lw.ia!;
  const jw = sm.Lw.ja!;
  const w = sm.Lw.a!;
  const d = sm.Lwd.a!;

  for (let i = 0; i < m; i++) {
    let diagD = 0;
    let diagW = 0;
    let jdiag = -1;
    for (let j = iw[i]!; j < iw[i + 1]!; j++) {
      const k = jw[j]!;
      if (k === i) {
        jdiag = j;
        continue;
      }
      if (d[j]! > 0) { // those edges that need expansion
        w[j] = -100 / d[j]! / d[j]!;
      } else { // those that need shrinking are negative from ideal_distance
        w[j] = -1 / d[j]! / d[j]!;
        d[j] = -d[j]!;
      }
      const dist = d[j]!;
      diagW += w[j]!;
      d[j] = w[j]! * dist;
      diagD += d[j]!;
    }
    w[jdiag] = -diagW;
    d[jdiag] = -diagD;
  }
  return { sm, maxOverlap: tmax, minOverlap: tmin };
}

/** @see lib/sfdpgen/post_process.c:total_distance */
function totalDistance(m: number, dim: number, x: number[], y: number[]): number {
  let total = 0;
  for (let i = 0; i < m; i++) {
    let dist = 0;
    for (let j = 0; j < dim; j++) {
      dist += (y[i * dim + j]! - x[i * dim + j]!) * (y[i * dim + j]! - x[i * dim + j]!);
    }
    total += Math.sqrt(dist);
  }
  return total;
}

/** @see lib/sparse/general.c:vector_product */
function vectorProduct(n: number, x: number[], y: number[]): number {
  let t = 0;
  for (let i = 0; i < n; i++) t += x[i]! * y[i]!;
  return t;
}

/**
 * One (maxit_sm) stress-majorization step: refresh Lwdd from current
 * distances, form the rhs, CG-solve (Lw) x = rhs.
 * SM_SCHEME_NORMAL only — the edge-label constraint schemes are not
 * reachable from remove_overlap with ELSCHEME_NONE.
 * @see lib/sfdpgen/post_process.c:StressMajorizationSmoother_smooth
 */
function stressMajorizationSmooth(
  sm: OverlapSmoother, dim: number, x: number[], maxitSm: number,
): number {
  const Lw = sm.Lw;
  const Lwd = sm.Lwd;
  const Lwdd = smCopy(Lwd);
  const m = Lw.m;
  let iter = 0;
  let diff = 1;
  const tol = 0.001;

  const x0 = x.slice(0, dim * m);
  const y = new Array<number>(dim * m).fill(0);

  const id = Lwd.ia!;
  const jd = Lwd.ja!;
  const d = Lwd.a!;
  const dd = Lwdd.a!;
  const lambda = sm.lambda;

  while (iter++ < maxitSm && diff > tol) {
    for (let i = 0; i < m; i++) {
      let idiag = -1;
      let diag = 0;
      for (let j = id[i]!; j < id[i + 1]!; j++) {
        if (i === jd[j]) {
          idiag = j;
          continue;
        }
        let dist = distance(x, dim, i, jd[j]!);
        if (d[j] === 0) {
          dd[j] = 0;
        } else {
          if (dist === 0) {
            const dij = d[j]! / Lw.a![j]!; // the ideal distance
            // perturb so points do not sit at the same place
            for (let k = 0; k < dim; k++) {
              x[jd[j]! * dim + k]! += 0.0001 * (cdrand() + 0.0001) * dij;
            }
            dist = distance(x, dim, i, jd[j]!);
          }
          dd[j] = d[j]! / dist;
        }
        diag += dd[j]!;
      }
      dd[idiag] = -diag;
    }

    // solve (Lw+lambda*I) x = Lwdd y + lambda x0
    smMultiplyDense(Lwdd, x, y, dim);

    // lambda is all-zero for the overlap smoother; the C code still adds
    // the term — kept for exactness (it can flip -0 to +0).
    for (let i = 0; i < m; i++) {
      for (let j = 0; j < dim; j++) {
        y[i * dim + j]! += lambda[i]! * x0[i * dim + j]!;
      }
    }

    smSolve(Lw, dim, x, y, sm.tolCg, sm.maxitCg);

    diff = totalDistance(m, dim, x, y) / Math.sqrt(vectorProduct(m * dim, x, x));

    for (let i = 0; i < m * dim; i++) x[i] = y[i]!;
  }
  return diff;
}

// ---------------------------------------------------------------------------
// remove_overlap
// ---------------------------------------------------------------------------

/** Uniform scale so the average edge length = avgLabelSize. @see overlap.c:scale_to_edge_length */
function scaleToEdgeLength(dim: number, A: SpMatrix, x: number[], avgLabelSize: number): void {
  let dist = averageEdgeLength(A, dim, x);
  dist = avgLabelSize / Math.max(dist, MACHINEACC);
  for (let i = 0; i < dim * A.m; i++) x[i]! *= dist;
}

/**
 * The full PRISM overlap-removal loop (ELSCHEME_NONE path).
 * @see lib/neatogen/overlap.c:remove_overlap
 */
export function removeOverlapPrism(
  dim: number, A: SpMatrix, x: number[], labelSizes: number[] | null,
  ntry: number, initialScaling: number, doShrinking: boolean,
): void {
  if (!labelSizes) return;

  if (initialScaling < 0) {
    let avgLabelSize = 0;
    for (let i = 0; i < A.m; i++) {
      avgLabelSize += labelSizes[i * dim]! + labelSizes[i * dim + 1]!;
    }
    avgLabelSize /= A.m;
    scaleToEdgeLength(dim, A, x, -initialScaling * avgLabelSize);
  } else if (initialScaling > 0) {
    scaleToEdgeLength(dim, A, x, initialScaling);
  }

  if (!ntry) return;

  let neighborhoodOnly = true;
  let shrink = false;

  for (let i = 0; i < ntry; i++) {
    const { sm, maxOverlap } = overlapSmootherNew(
      A.m, dim, x, labelSizes, neighborhoodOnly, shrink);
    if (maxOverlap <= 1) {
      if (!neighborhoodOnly) {
        break;
      }
      neighborhoodOnly = false;
      if (doShrinking) {
        shrink = true;
      }
      continue;
    }
    // OverlapSmoother_smooth: a single stress-majorization iteration is
    // found to give better results and save time (C comment).
    stressMajorizationSmooth(sm, dim, x, 1);
  }
}
