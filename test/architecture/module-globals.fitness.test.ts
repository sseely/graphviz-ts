// SPDX-License-Identifier: EPL-2.0

/**
 * Fitness function: enforce the multi-diagram global-state invariant.
 *
 * graphviz-ts must render 2+ diagrams on one page without cross-diagram
 * interaction (the consumer renders many diagrams per page). `renderSvg` is
 * self-contained (fresh Graph + GVC per call) and synchronous, so the only
 * way to break this is a MODULE-LEVEL MUTABLE GLOBAL whose state survives one
 * render into the next.
 *
 * This test pins the complete set of module-scope `let` declarations under
 * `src/` to a reviewed allowlist. Each entry records WHY it is safe — it is
 * either reset/re-seeded at render entry, an immutable one-time init, or a
 * process-wide DI hook that rendering never mutates. Adding a new module
 * global fails this test until the author either:
 *   1. resets/re-seeds it at the start of each render and adds it here with
 *      the reset site, OR
 *   2. moves the state onto the per-render Graph / GVC context instead.
 *
 * Scope: top-level `let` (and `export let`) only — that is where every ported
 * C global lives. Immutable `const` lookup tables are not state and are out of
 * scope. See memory `multi-diagram-global-state-safety`.
 *
 * @see lib/common — C graphviz is non-reentrant; the port must not inherit that.
 */

import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { renderSvg } from '../../src/index.js';
import type { EngineName } from '../../src/gvc/context.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const SRC = join(ROOT, 'src');

/**
 * Reviewed module globals, keyed `relativePath::name` → why it is safe.
 * Every entry is a promise that the global cannot leak across renders.
 */
const ALLOWLIST: Readonly<Record<string, string>> = {
  // --- Re-seeded/overwritten at the start of each render before any read ---
  'src/common/random.ts::state':
    'drand48 PRNG; re-seeded via srand48 by every engine that uses it (neato/fdp/ortho) before use; dot uses no randomness',
  'src/common/crand.ts::state':
    'crand PRNG; re-seeded via csrand by sfdp before use',
  'src/common/color.ts::colorScheme':
    'set only through withColorScheme (color-resolve.ts), which save/restores in try/finally — no leak even on throw',
  'src/common/postproc.ts::Rankdir':
    'overwritten from g.info.rankdir at postproc start before any read',
  'src/common/postproc.ts::Offset':
    'recomputed at postproc start before any read',
  'src/layout/fdp/xlayout.ts::xMarg':
    'set from sepFactor(g) at fdp layout start before any read',
  'src/layout/dot/mincross-cross.ts::reMincross':
    'reset via setReMincross(false) at the start of each mincross run',
  'src/layout/dot/mincross-build.ts::fillSeq':
    'reset to 0 within fillRanks before reuse',
  'src/common/htmltable-emit-rules.ts::anchorSeq':
    'reset to 0 per anchor environment before reuse',
  'src/common/htmltable-emit-fill.ts::htmlFillPen':
    'gvrender penwidth leak for bgcolor fills; reset to 1.0 via resetHtmlFillPenWidth() at each top-level table (emitHtmlLabel entry)',

  // --- Currently never mutated (latent: must reset if ever wired) ---
  'src/layout/dot/rank.ts::clType':
    'clusterrank type; setClType is currently never called so it stays LOCAL. IF wired to the clusterrank attr, it MUST be reset to LOCAL per render',

  // --- Immutable / one-time / DI wiring — not per-render render state ---
  'src/gvc/usershape.ts::activeSizer':
    'process-wide image-sizer DI hook set via setImageSizer; not mutated by rendering (shared config, last-write-wins by design)',
  'src/common/textmeasure-factory.ts::override':
    'process-wide text-measurer DI hook set via setTextMeasurer; not mutated by rendering (shared config, last-write-wins by design), analogous to activeSizer',
  'src/common/textmeasure-factory.ts::adviceShown':
    'one-time process latch for the interactive host-faithful advice note; emitted at most once per process, never per-render output state',
  'src/label/node.ts::_splitNodeImpl':
    'DI wiring for the record split-node impl; set once at import, not per render',
  'src/layout/dot/mincross-order.ts::mincrossTrace':
    'debug trace hook; null in production, never set during rendering',
  'src/layout/twopi/twopi-test-helpers.ts::_id':
    'test-only helper module; not reachable from the render path',
};

/** Recursively collect every .ts file under dir, skipping *.test.ts. */
function collectTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) out.push(...collectTsFiles(full));
    else if (ent.name.endsWith('.ts') && !ent.name.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

/** Match a top-level `let`/`export let` declaration; capture the binding name. */
const TOP_LEVEL_LET = /^(?:export\s+)?let\s+([A-Za-z_$][\w$]*)/;

/** Scan one file for module-scope `let` globals, returning `relPath::name` keys. */
function scanGlobals(file: string): string[] {
  const rel = relative(ROOT, file).split('\\').join('/');
  const keys: string[] = [];
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = TOP_LEVEL_LET.exec(line);
    if (m) keys.push(`${rel}::${m[1]}`);
  }
  return keys;
}

/** Every module-scope `let` global found under src/. */
function findAllGlobals(): string[] {
  return collectTsFiles(SRC).flatMap(scanGlobals).sort();
}

describe('fitness: module-level globals (multi-diagram safety)', () => {
  it('introduces no module global outside the reviewed allowlist', () => {
    const unlisted = findAllGlobals().filter((k) => !(k in ALLOWLIST));
    expect(
      unlisted,
      'New module-level `let` found. A mutable global can leak state from one ' +
        'rendered diagram into the next (renderSvg is reused per diagram on a ' +
        'page). Either reset/re-seed it at render entry and add it to ALLOWLIST ' +
        'in this file with the reset site, or move the state onto the per-render ' +
        'Graph / GVC context. See memory multi-diagram-global-state-safety.\n' +
        `Unlisted: ${unlisted.join(', ')}`,
    ).toEqual([]);
  });

  it('keeps the allowlist honest (no stale entries)', () => {
    const found = new Set(findAllGlobals());
    const stale = Object.keys(ALLOWLIST).filter((k) => !found.has(k));
    expect(
      stale,
      `ALLOWLIST entries no longer present in src — delete them:\n${stale.join(', ')}`,
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Dynamic counterpart: prove the invariant HOLDS behaviorally, not just that
// every global is allowlisted. The static check above trusts each "safe"
// justification; this one exercises the render path and fails if a global is
// read-before-set in a way that changes OUTPUT. Render a probe, render a
// pollution battery touching the known globals, render the probe again, require
// conformant output.
//
// Coverage model: this catches GEOMETRY-AFFECTING leaks — proven against a
// broken Rankdir reset (which would rotate every subsequent graph). It does NOT
// claim to behaviorally trip every global: some are inherently low-risk and
// won't change output even with their reset removed (reMincross only flips on
// the rare re-mincross path; fillSeq is an order tiebreak; the PRNGs are
// re-seeded by every consumer; colorScheme is try/finally-scoped). Those are
// guarded by the static allowlist above (any new global declaration must be
// reviewed and justified). The two tests together: static = the declaration
// gate; dynamic = a behavioral backstop for position-affecting leaks.
// ---------------------------------------------------------------------------

/** Probes whose render must be invariant to preceding renders. */
const PROBES: ReadonlyArray<readonly [string, EngineName]> = [
  // dot: 2-cycle + multi-node ranks (exercises back-edge/mincross/x-NS order)
  ['digraph{a->b;b->a;c->a;c->b;a->d;b->e;d->f;e->f}', 'dot'],
  ['digraph{rankdir=LR; x->y; y->x; x->z; z->w}', 'dot'],          // flip/Rankdir
  // cross-cluster cycle: exercises reMincross/fillSeq + cluster left2right ordering
  ['digraph{subgraph cluster0{a;b} subgraph cluster1{c;d} subgraph cluster2{e;f} a->c;c->e;b->d;d->f;e->a;f->b}', 'dot'],
  ['digraph{subgraph cluster0{a->b->c} subgraph cluster1{d->e->f} a->d;b->e;c->f;f->a}', 'dot'],
  ['graph{n1--n2; n2--n3; n3--n1}', 'neato'],                      // PRNG (srand48)
];

/** Pollution battery — renders that mutate the known module globals. */
const POLLUTERS: ReadonlyArray<readonly [string, EngineName]> = [
  ['digraph{rankdir=BT; a->b->c; c->a}', 'dot'],                   // Rankdir/Offset, back edge
  ['digraph{rankdir=RL; subgraph cluster0{m->n} n->o; o->m}', 'dot'], // reMincross + flip
  ['digraph{a->b;b->a;a->b}', 'dot'],                              // 2-cycle + parallel
  ['digraph{a[label=<<table bgcolor="red:blue"><tr><td>x</td></tr></table>>]}', 'dot'], // htmlFillPen/anchorSeq
  ['digraph{node[colorscheme=accent3]; a[color=1]; b[color=2]; a->b}', 'dot'], // colorScheme
  ['graph{a--b--c--a; c--d}', 'sfdp'],                             // crand PRNG (csrand)
  ['graph{r--a; r--b; r--c; a--b}', 'fdp'],                        // srand48 PRNG
  ['digraph{a->a; b->b; a->b}', 'dot'],                            // self-loops
];

describe('fitness: render determinism (no global leaks in practice)', () => {
  it('every probe renders identically after a full pollution battery', () => {
    for (const [src, engine] of PROBES) {
      const before = renderSvg(src, engine);
      for (const [psrc, pengine] of POLLUTERS) renderSvg(psrc, pengine);
      const after = renderSvg(src, engine);
      expect(
        after === before,
        `Render of (${engine}) "${src}" changed after rendering other diagrams — ` +
          'a module global leaked across renders (read-before-set). Find the ' +
          'global whose ALLOWLIST "safe" justification is wrong and fix its reset.',
      ).toBe(true);
    }
  });
});
