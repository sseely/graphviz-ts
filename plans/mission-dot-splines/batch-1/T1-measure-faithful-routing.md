# T1 — Measure-first divergence inventory

## Context

graphviz-ts is a faithful TS port of graphviz C (tag 15.0.0, `~/git/graphviz`).
Regular dot edges default to the simplified fitter, which diverges from dot on
edge-condition geometries (see `.agent-notes/dot-splines-reverification.md`).
The mission (AD-1) migrates all regular edges to the faithful pathplan path.
Before migrating, measure the true scope: which of the 115 goldens shift under
faithful-all routing, grouped by edge category, and which corpus cases gain dot
parity.

## Task

1. Add a measurement harness `.probes/dot-splines-faithful-measure.ts` that, for
   each of the 115 golden inputs AND the divergence corpus
   (`.probes/dot-splines-corpus.ts` cases), renders twice: (a) current default,
   (b) forcing every regular edge through the faithful path. Compare each against
   the stored golden / dot oracle (edges matched by `<title>` + occurrence;
   control-point Δ; tol 0.5).
2. To force faithful routing, prefer a non-invasive switch: a module-level flag
   in `edge-route.ts` read by the dispatch (default OFF — no production change),
   OR drive `routeRegularEdgeFaithful` / `routeMultiRankEdgeFaithful` directly in
   the harness. If a flag is added, it must default OFF and not alter any
   committed behavior (goldens conformant with the flag off).
3. Produce the **divergence inventory**: list every golden that shifts under
   faithful-all, tagged by edge category (adjacent-plain / multi-rank-plain /
   back / non-forward / rankdir), with worst Δ. Also list which corpus cases
   (fanout, merge, lr-fan, lr-long) reach dot parity under faithful-all.
4. Write the inventory into `decision-journal.md` (a compact table) so Batches
   2–6 can be refined from it. If the shift set is large (> ~20 goldens), flag
   it and STOP for scope reassessment (per README constraints).

## Write-set

- `.probes/dot-splines-faithful-measure.ts` — new measurement harness
- `plans/mission-dot-splines/decision-journal.md` — the inventory table
- (optional) `src/layout/dot/edge-route.ts` — a default-OFF measurement flag ONLY
  if needed; must keep goldens conformant with the flag off

## Read-set

- `.agent-notes/dot-splines-reverification.md`
- `.probes/dot-splines-corpus.ts` (corpus + diff helpers to reuse)
- `src/layout/dot/edge-route.ts:249-360` (`routeOneEdge` / `routeForwardEdge` dispatch)
- `src/layout/dot/edge-route-faithful.ts:284` (`routeRegularEdgeFaithful`)
- `src/layout/dot/edge-route-chain.ts:133` (`routeMultiRankEdgeFaithful`)
- `test/golden/` (golden inputs + `compare.ts`)

## Interface contract (consumed by T2–T6)

A decision-journal table: `| golden | category | worstΔ | notes |` for every
shifting golden, plus a corpus-parity summary. Categories: `adj-plain`,
`mr-plain`, `back`, `nonfwd`, `rankdir`.

## Acceptance criteria

- **Given** the harness, **when** run, **then** it prints, per golden+corpus
  case, the faithful-vs-default and faithful-vs-oracle deltas.
- **Given** the inventory, **when** written to the journal, **then** every
  shifting golden is tagged with a category and worst Δ.
- **Given** the flag is OFF (or no flag added), **then** `npx vitest run` is
  **1800 passed / 0 failed, 115 goldens conformant** (no behavior change).
- **Given** the shift set exceeds ~20 goldens, **then** STOP and flag for scope
  review.

## Quality bar

`tsc --noEmit` 0; lizard clean on any changed `src` file; vitest green per gates.
Commit: `chore(T1): measure faithful-routing divergence inventory`.

## Observability / Rollback

N/A — measurement only. Reversible (revert; no production behavior change).
