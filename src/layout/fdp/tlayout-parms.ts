// SPDX-License-Identifier: EPL-2.0

/**
 * fdp layout parameters: the fdp_parms process defaults, the static
 * parms_t working set, the cooling schedule, and parameter resolution
 * from graph attributes.
 *
 * Spec read at the 15.0.0 tag.
 *
 * @see lib/fdpgen/tlayout.c (15.0.0) — parms_t, fdp_initParams,
 *      init_params, cool, reset_params
 * @see lib/common/globals.c (15.0.0) — fdpParms defaults
 */

import type { Graph } from '../../model/graph.js';
import { lateDouble, lateInt } from '../../common/nodeinit.js';
import { type XParams, aggetGraph } from './fdp-model.js';

// ---------------------------------------------------------------------------
// Constants — @see lib/fdpgen/tlayout.c:96-101, lib/neatogen/neato.h:27-30
// ---------------------------------------------------------------------------

/** @see lib/fdpgen/tlayout.c:EXPFACTOR */
export const EXPFACTOR = 1.2;
/** @see lib/fdpgen/tlayout.c:DFLT_maxIters */
const DFLT_MAX_ITERS = 600;
/** @see lib/fdpgen/tlayout.c:DFLT_K */
const DFLT_K = 0.3;
/** @see lib/fdpgen/tlayout.c:DFLT_Cell */
const DFLT_CELL = 0.0;
/** @see lib/fdpgen/tlayout.c:DFLT_seed */
const DFLT_SEED = 1;

/** @see lib/neatogen/neato.h:INIT_SELF */
export const INIT_SELF = 0;
/** @see lib/neatogen/neato.h:INIT_REGULAR */
export const INIT_REGULAR = 1;
/** @see lib/neatogen/neato.h:INIT_RANDOM */
export const INIT_RANDOM = 2;
/** @see lib/fdpgen/tlayout.c:DFLT_smode */
const DFLT_SMODE = INIT_RANDOM;

// ---------------------------------------------------------------------------
// fdp_parms defaults — @see lib/common/globals.c (15.0.0)
// ---------------------------------------------------------------------------

/**
 * Process-level fdp defaults ("possibly set via command line; -1
 * indicates unset"). The CLI flags (-L*) are not ported; the struct is
 * kept because fdp_initParams and init_edge read it.
 *
 * @see lib/common/globals.c:fdpParms
 * @see lib/fdpgen/fdp.h:fdpParms_t
 */
export const fdpParms = {
  useGrid: 1,
  useNew: 1,
  numIters: -1,
  unscaled: 50,
  C: 0.0,
  Tfact: 1.0,
  K: -1.0,
  T0: -1.0,
};

// ---------------------------------------------------------------------------
// parms — actual parameters used (static parms_t in C)
// ---------------------------------------------------------------------------

/** @see lib/fdpgen/tlayout.c:parms_t */
export interface TParms {
  useGrid: number;
  useNew: number;
  seed: number;
  numIters: number;
  maxIters: number;
  unscaled: number;
  C: number;
  Tfact: number;
  K: number;
  T0: number;
  smode: number;
  Cell: number;
  Wd: number;
  Ht: number;
  pass1: number;
  loopcnt: number;
}

/** Module-level mutable state, mirroring the C static. @see tlayout.c:parms */
export const parms: TParms = {
  useGrid: 0, useNew: 0, seed: 0, numIters: 0, maxIters: 0, unscaled: 0,
  C: 0, Tfact: 0, K: 0, T0: 0, smode: 0, Cell: 0, Wd: 0, Ht: 0,
  pass1: 0, loopcnt: 0,
};

/** Linear cooling schedule. @see lib/fdpgen/tlayout.c:cool */
export function cool(t: number): number {
  return parms.T0 * (parms.maxIters - t) / parms.maxIters;
}

/** @see lib/fdpgen/tlayout.c:reset_params */
export function resetParams(): void {
  parms.T0 = -1.0;
}

// ---------------------------------------------------------------------------
// setSeed — parse the "start" attribute
// ---------------------------------------------------------------------------

/**
 * Parse the graph "start" attribute into an init mode and seed.
 * (The TS neato setSeed has a different shape; this is the C original.)
 *
 * When INIT_RANDOM is selected without a numeric seed, C uses
 * time(NULL); Date.now() seconds substitute (non-deterministic in C
 * too, so parity is unaffected).
 *
 * @see lib/neatogen/neatoinit.c:setSeed (15.0.0)
 */
export function setSeedFdp(
  g: Graph,
  dflt: number,
  seedRef: { value: number },
): number {
  const p = aggetGraph(g, 'start');
  if (p === undefined || p === '') return dflt;
  const { init, rest } = classifyStart(p, dflt);
  if (init === INIT_RANDOM) {
    const m = /^-?[0-9]+/.exec(rest);
    if (m === null) {
      seedRef.value = Math.floor(Date.now() / 1000);
    } else {
      seedRef.value = parseInt(m[0], 10);
    }
  }
  return init;
}

/**
 * Classify the "start" value prefix (self/regular/random keyword or a
 * bare numeric seed). @see lib/neatogen/neatoinit.c:setSeed
 */
export function classifyStart(
  p: string,
  dflt: number,
): { init: number; rest: string } {
  if (/^[0-9]/.test(p)) return { init: INIT_RANDOM, rest: p };
  if (!/^[a-zA-Z]/.test(p)) return { init: dflt, rest: p };
  if (p.startsWith('self')) return { init: INIT_SELF, rest: p.slice(4) };
  if (p.startsWith('regular')) return { init: INIT_REGULAR, rest: p.slice(7) };
  if (p.startsWith('random')) return { init: INIT_RANDOM, rest: p.slice(6) };
  return { init: dflt, rest: p };
}

// ---------------------------------------------------------------------------
// fdp_initParams / init_params
// ---------------------------------------------------------------------------

/**
 * Initialize parameters from the root graph's attributes.
 * @see lib/fdpgen/tlayout.c:fdp_initParams
 */
export function fdpInitParams(g: Graph): void {
  parms.useGrid = fdpParms.useGrid;
  parms.useNew = fdpParms.useNew;
  parms.numIters = fdpParms.numIters;
  parms.unscaled = fdpParms.unscaled;
  parms.Cell = DFLT_CELL;
  parms.C = fdpParms.C;
  parms.Tfact = fdpParms.Tfact;
  parms.maxIters = lateInt(g.attrs.get('maxiter'), DFLT_MAX_ITERS, 0);
  fdpParms.K = parms.K = lateDouble(g.attrs.get('K'), DFLT_K, 0.0);
  if (fdpParms.T0 === -1.0) {
    parms.T0 = lateDouble(g.attrs.get('T0'), -1.0, 0.0);
  } else {
    parms.T0 = fdpParms.T0;
  }
  resolveSeed(g);

  parms.pass1 = Math.trunc(parms.unscaled * parms.maxIters / 100);

  if (parms.useGrid) {
    if (parms.Cell <= 0.0) parms.Cell = 3 * parms.K;
  }
}

/** Seed/smode resolution block of fdp_initParams. @see tlayout.c:168-174 */
function resolveSeed(g: Graph): void {
  parms.seed = DFLT_SEED;
  const seedRef = { value: parms.seed };
  parms.smode = setSeedFdp(g, DFLT_SMODE, seedRef);
  parms.seed = seedRef.value;
  if (parms.smode === INIT_SELF) {
    // C: agwarningf + T_seed = DFLT_smode (verbatim, including the
    // smode-constant-into-seed assignment)
    parms.seed = DFLT_SMODE;
  }
}

/**
 * Set parameters for the expansion phase from the initial-layout
 * parameters; auto-derive T0 from graph size when unset.
 * @returns whether resetParams must be called after this layout pass
 * @see lib/fdpgen/tlayout.c:init_params
 */
export function initParams(g: Graph, xpms: XParams): boolean {
  let ret = false;

  if (parms.T0 === -1.0) {
    const nnodes = g.nodes.size;
    parms.T0 = parms.Tfact * parms.K * Math.sqrt(nnodes) / 5;
    ret = true;
  }

  xpms.T0 = cool(parms.pass1);
  xpms.K = parms.K;
  xpms.C = parms.C;
  xpms.numIters = parms.maxIters - parms.pass1;

  if (parms.numIters >= 0) {
    if (parms.numIters <= parms.pass1) {
      parms.loopcnt = parms.numIters;
      xpms.loopcnt = 0;
    } else if (parms.numIters <= parms.maxIters) {
      parms.loopcnt = parms.pass1;
      xpms.loopcnt = parms.numIters - parms.pass1;
    }
  } else {
    parms.loopcnt = parms.pass1;
    xpms.loopcnt = xpms.numIters;
  }
  return ret;
}
