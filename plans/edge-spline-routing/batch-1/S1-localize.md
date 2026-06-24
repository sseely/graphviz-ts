<!-- SPDX-License-Identifier: EPL-2.0 -->

# S1 — Localize the long-edge extra-segment divergence (spike)

## Context

Faithful port; `~/git/graphviz` is the spec. After the font fix, rankdir_dot*
nodes/text match the oracle but 3 long edges emit 1 extra cubic bezier piece
(port subdivides where C fits one bezier). The recursive fitter
`src/pathplan/route.ts` matches C `reallyroutespline` constants exactly, so the
cause is upstream: the **box corridor** (barriers), the **input-point chain**,
or the **endpoint slopes** passed to `Proutespline`. This spike pins which one.

## Task

1. **Reproduce.** Regenerate `/tmp/le_long.gv` (rankdir=LR n0..n15 + spans
   n0->n15, n0->n12, n2->n14, n1->n13 + even skip edges). Confirm path 23
   diverges (oracle 1 cubic / port 2). Identify the diverging edge by endpoints.
2. **Instrument the port.** Dump, for the diverging edge, the exact arguments to
   the port's `Proutespline` call (in `src/common/splines-routespl.ts` /
   `src/pathplan/route.ts`): the box corridor (barrier segments), the
   input-point polyline, and the two endpoint slope vectors. Use a scratch
   throw/console dump under `.probes/` (delete before commit).
3. **Instrument C.** Add `fprintf(stderr, …)` to C `routesplines`
   (`lib/dotgen/dotsplines.c`) and/or `Proutespline` (`lib/pathplan/route.c`)
   dumping the same: boxes, input points, endpoint slopes, and the resulting
   piece count. Rebuild `gvplugin_dot_layout` and copy to `/tmp/gvplugins` (per
   the v8-prof / oracle recipe in memory `recover-slack-and-c-harness` /
   `oracle-native-not-wasm`). Render the reproducer through it.
4. **Diff.** Compare port vs C for the diverging edge:
   - boxes (count + coordinates),
   - input points (count + coordinates),
   - endpoint slopes.
   The FIRST field that differs is the root cause.
5. **Record.** Fill [decisions.md#d-fixsite](../decisions.md#d-fixsite) with the
   instrumented diff and the precise fix. Rewrite
   [T2-fix.md](../batch-2/T2-fix.md) with the concrete write-set, approach, and
   acceptance. Append a journal entry. Remove all instrumentation (revert the C
   tree; delete `.probes/` scratch).

## Write-set

- `plans/edge-spline-routing/decisions.md` (#d-fixsite)
- `plans/edge-spline-routing/batch-2/T2-fix.md` (rewrite from template)
- `plans/edge-spline-routing/decision-journal.md`
- `.probes/*` scratch (transient — delete before the gate)
- C instrumentation in `~/git/graphviz` is TEMPORARY — revert it
  (`git -C ~/git/graphviz checkout .`) after dumping.

## Read-set

- `src/.agent-notes/edge-spline-extra-segments.md` (the investigation)
- `src/pathplan/route.ts` (`Proutespline`, `reallyRoutespline`, `splineIsInside`)
- `src/common/splines-routespl.ts` (the routesplines/box-corridor port)
- `src/layout/dot/edge-route-chain.ts`, `edge-route-routing.ts` (corridor build)
- `~/git/graphviz/lib/pathplan/route.c:60-157` (`Proutespline`,
  `reallyroutespline`, `splinefits`)
- `~/git/graphviz/lib/dotgen/dotsplines.c` (`routesplines`, box construction)

## Architecture decisions

D1 (spike first), D2 (pin to instrumented C), D3 (long-edge class only). See
[decisions.md](../decisions.md).

## Interface contracts

Produces, for the dependent T2: the `#d-fixsite` decision = `{ site:
'box-corridor'|'input-chain'|'endpoint-slopes'|'other', file: string, cDump:
…, portDump: …, fix: prose }`. T2 consumes it as its full spec.

## Acceptance criteria

- Given the reproducer, when both C and port dump the diverging edge's
  `Proutespline` inputs, then the first differing field (boxes / input points /
  slopes) is identified with concrete coordinates from each.
- Given that diff, when `#d-fixsite` is written, then it names the exact file +
  change and predicts which currently-matching edges (if any) the fix touches.
- Given the spike is complete, when `git diff --name-only main` runs, then NO
  production source file is changed (only the plan docs) and the C tree is
  reverted clean.
- Given the diff shows the fitter (`route.ts`) is at fault (contradicts the
  premise), then STOP and re-scope with the user (do not invent a fix).

## Observability

N/A — investigation spike; no runtime operations.

## Rollback

**Reversible** — no production change; instrumentation is reverted.

## Quality bar

`git -C ~/git/graphviz status` clean after revert; `.probes/` removed; the
filled T2 spec is concrete enough to execute without further discovery. No
commit of S1 itself beyond the plan-doc updates (which are gitignored) — record
the outcome in the journal. If a tiny obvious fix emerges AND is ≤3 lines pinned
to C, T2 may be folded in early (log the decision).

## Boundaries

- **Never:** change production source in S1; leave C instrumentation in
  `~/git/graphviz`; guess the fix site without the instrumented diff.
- **Ask first:** if localization needs touching the faithful `route.ts` fitter
  (premise violation) or an unrelated routing subsystem (D3).
