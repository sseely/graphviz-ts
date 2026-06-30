<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions

## AD-1: Diagnosis-first, gated execution
**Context:** The subsystem is narrowed (dot multi-rank edge-spline routing) but
the exact stage (classification, box/corridor, fitter, or routing order) is not,
and the project rule is "no fix before a stated mechanism" (`diagnosis.md`).
**Decision:** Batch 1 instruments and pins the mechanism, then STOPS for human
confirmation. Batch 2 fixes only after the mechanism artifact exists.
**Consequences:** Slower than fix-and-iterate, but the fix lands at the origin,
not a downstream patch in a load-bearing routing pipeline.

## AD-2: Fix file is determined by diagnosis, not pre-chosen
**Context:** Candidate origins span `edge-route*.ts`, `edge-route-chain.ts`,
`splines*.ts`. The control-point delta could originate in chain classification,
box-corridor construction (`maximalBbox`/`rankBox`), the spline fitter
(`routeSplines`), or routing order (`recover_slack` vnode mutation).
**Decision:** Batch 1 names the single origin file + line; Batch 2 writes only
that file (plus its test).
**Consequences:** If diagnosis shows the fix must span >1 routing file, that is a
stop condition (re-scope with human).

## AD-3: Fidelity bar = match the C spline output, full conformance
**Context:** Project treats C as spec; conformant = numeric coords within ±0.01
and non-numeric content exactly equal (`compareSvg(…, 'deterministic')`). The
user's target is **all 58 diverging edges within ±0.01**, not just the 2
dominant ones.
**Decision:** The fix must make the port produce the **same control points as C**
for every diverging edge (within deterministic tolerance). Batch 1 must classify
the ~56 sub-2pt residuals: shared-cause (resolved by the fix) vs independent
noise.
**Consequences:** Resolves `nshare-root_twopi` to `conformant`. If a residual is
proven irreducible (AD-4), that is an explicit stop-and-report, not a silent
accept.

## AD-4: Irreducible libm/FMA tie-break → stop and report, do NOT silently accept
**Context:** The corpus already documents A1 (force-model FP determinism) and A3
(Apple libm hypot position-dependence) as accepted, non-portable tie-breaks. A
sub-2pt residual here could be the same class.
**Decision:** If Batch 1/2 proves a residual traces to an irreducible
cross-platform libm/FMA/hypot tie-break (via a controlled experiment isolating
the variable, not an assertion), STOP and report it for sign-off before
classifying it as an accepted A-class delta. The user's stated goal is a real
fix; accepting a residual is a deliberate, human-approved exception.
**Consequences:** Keeps the success bar honest. Any accepted residual is paired
with prose in `docs/known-divergences.md` + a per-id `accepted-divergences.json`
entry (the test guard enforces this).

## AD-5: Reconcile the stale accepted-divergences entry
**Context:** `accepted-divergences.json` has a `nshare-root_twopi` entry
(`class R-emit`, `scope: rules`) claiming "geometry exact; one edge `@d`." Scout
shows a real 21pt geometry edge delta AND a structural 4-vs-7 edge — the prose is
stale and there are 58 diverging edges, not one.
**Decision:** Batch 2 (T3) updates this entry + `rules-known-divergences.md` to
match the post-fix reality. If the case becomes conformant, the `scope: rules`
entry is removed (the case no longer needs a rules-gate exception); if a residual
is accepted per AD-4, the entry is rewritten to the true bound/reason.
**Consequences:** The accepted list stays honest; the
`accepted-divergences.test.ts` guard (which asserts listed ids are still
non-conformant) passes either way.

## AD-6: Rollback classification — Reversible
**Context:** Pure in-memory layout routing change in a browser library; no data
model, schema, API, or persisted artifact beyond regenerated baselines.
**Decision:** Reversible by reverting the commit. `parity.json`/
`parity-rules.json`/`PARITY.md`/`accepted-divergences.json` are revert-safe.
**Consequences:** No migration, flag, or staged rollout needed.

## Operational readiness (N/A surfaces)
No data model, API contract, service dependency, SLI/SLO, dashboard, on-call, or
backwards-compat surface — this is an internal layout-routing fidelity fix in a
browser library. The parity survey + `survey:gate` (0 regressions) is the
"observability" equivalent: the automated fitness function for layout fidelity.
