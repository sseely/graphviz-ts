<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions

## AD-1: Diagnosis-first, gated execution
**Context:** The subsystem is known (mincross flat ordering) but the exact stage
(initial seed vs iteration tie-break) is not, and the project rule is "no fix
before a stated mechanism" (`~/.claude/rules/diagnosis.md`).
**Decision:** Batch 1 instruments and pins the mechanism, then STOPS for human
confirmation. Batch 2 fixes only after the mechanism artifact exists.
**Consequences:** Slower than fix-and-iterate, but prevents symptom-chasing in a
load-bearing algorithm; the fix lands at the origin, not a downstream patch.

## AD-2: Fix file is determined by diagnosis, not pre-chosen
**Context:** Candidate origins: `mincross-flat.ts` (flat-group order),
`mincross-order.ts` (init/medians/transpose), `mincross.ts` (best-order capture/
iteration loop).
**Decision:** Batch 1 names the single origin file + line; Batch 2 writes only
that file (plus its test). The write-set in T2 is finalized from Batch 1's output.
**Consequences:** T2's write-set has one mincross source file. If diagnosis shows
the fix must span >1 mincross file, that is a stop condition (re-scope with human).

## AD-3: Fidelity bar = match the C mincross order exactly
**Context:** Project treats C as spec; byte/structural match is the bar
(memory: "BYTE-MATCH is the bar").
**Decision:** The fix must make the port produce the **same within-rank order as
C** for the three flat ranks — not merely "an order with equal crossings". If C's
order is a tie-break artifact, port the exact tie-break (e.g. `<` vs `<=`,
`reverse` flag, best-capture comparison), do not invent a different stable rule.
**Consequences:** Resolves all three shells variants together and avoids
re-introducing the swap under a different graph.

## AD-4: Rollback classification — Reversible
**Context:** Pure in-memory layout algorithm change in a library; no data model,
schema, API, or persisted artifact.
**Decision:** Reversible by reverting the commit. The only persisted artifacts
are `parity.json`/`PARITY.md` (regenerated baselines), also revert-safe.
**Consequences:** No migration, no flag, no staged rollout needed.

## Operational readiness (N/A surfaces)
No data model, API contract, service dependency, SLI/SLO, dashboard, on-call, or
backwards-compat surface — this is an internal layout-algorithm fidelity fix in a
browser library. The parity survey + `survey:gate` (0 regressions) is the
"observability" equivalent: it is the automated fitness function for layout
fidelity.
