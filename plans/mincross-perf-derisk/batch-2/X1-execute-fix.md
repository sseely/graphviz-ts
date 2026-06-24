<!-- SPDX-License-Identifier: EPL-2.0 -->

# X1 — Implement the fix the diagnosis names

## Context

`findings.md` (D3) has named one path: an **iteration-count faithfulness fix**
(port runs more reorder/transpose passes or counts crossings differently than C)
or a **per-op optimization** (counts match C; `reorderInner`/`accumCross` are
constant-factor slow). The C spec is `~/git/graphviz/lib/dotgen/mincross.c`.

## Task

Implement exactly the fix the verdict specifies. Do NOT broaden it.

- **Iteration-count path:** correct the divergence so the port's pass count /
  `ncross()` sequence matches C. Likely sites: the crossing-count function and
  its tiebreak (`mincross-cross.ts`), or the convergence test / `MinQuit` /
  `maxthispass` handling (`mincross.ts`). Mirror C line-for-line at the
  divergence. The output must be **identical** (C produces the same SVG with the
  correct pass count) — if it changes, the fix is wrong.
- **Per-op path:** optimize the named hot loop (`reorderInner` in
  `mincross-order.ts` or `accumCross`/`rcross` in `mincross-cross.ts`):
  match C's crossing-count data structure, hoist repeated `.info` reads, remove
  per-iteration allocation. Iteration count and results stay identical.

Add a unit test (`mincross-*.test.ts`) that locks it: per-pass crossing counts /
pass count pinned to C's values (iteration path), or optimized-vs-reference
equality on fixtures (per-op path).

## Write-set

- `src/layout/dot/mincross*.ts` (+ matching `*.test.ts`) — the fix and its test.
- **Any other file → AD-4 ask-gate**: STOP, name the file + reason, request
  permission, then proceed. (Expected candidates if they arise: `fastgr.ts`,
  `mincross-utils.ts`, a shared geom/array util.)

## Read-set

- `findings.md` (the verdict + exact divergence with line refs)
- the C function(s) the verdict names, in `mincross.c`
- `decisions.md#ad-2`, `#ad-3`, `#ad-4`

## Interface contracts

No public API change. `dot_mincross`-equivalent entry and all exported mincross
functions keep their signatures. Any new module-level `let` must reset per
render and be registered in `module-globals.fitness` allowlist
(memory `multi-diagram-global-state-safety`).

## Acceptance criteria

- **Given** the prior vitest suite, **when** X1 lands, **then** `npm test` +
  `npm run typecheck` pass with zero expected-output changes.
- **Given** 2108 rendered before/after, **when** SVGs are diffed, **then**
  **byte-identical**.
- **Given** the named metric (pass count or `reorderInner` time), **when**
  re-measured, **then** it moves toward C's value as the verdict predicted.
- **Given** a unit test, **when** run, **then** it pins the new behavior to C
  (iteration path) or to the reference implementation (per-op path).

## Observability / Rollback

N/A — pure library change. Reversible (revert the commit).

## Quality bar

`npm run typecheck` + `npm test` + `npm run build:js` exit 0. Functions under the
repo caps (file 500 / CCN 10 / params 5 — extract helpers if the fitness hook
fires; do not fight it more than twice, finish small residue inline). One commit:
`perf(mincross): <specific fix>` or `fix(mincross): match C <metric>`.
