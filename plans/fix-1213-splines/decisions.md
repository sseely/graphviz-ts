<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture decisions

## AD-1: Diagnosis-first, gated execution
**Context:** The subsystem is narrowed (constraint=false edge-spline routing) but the
exact stage (edge classification, box/corridor, or spline fitter) is not, and the
project rule is "no fix before a stated mechanism" (`~/.claude/rules/diagnosis.md`).
**Decision:** Batch 1 instruments and pins the mechanism, then STOPS for human
confirmation. Batch 2 fixes only after the mechanism artifact exists.
**Consequences:** Slower than fix-and-iterate, but prevents symptom-chasing in a
load-bearing routing pipeline; the fix lands at the origin, not a downstream patch.

## AD-2: Fix file is determined by diagnosis, not pre-chosen
**Context:** Candidate origins span `src/layout/dot/edge-route*.ts`,
`splines*.ts`, `classify.ts`. The control-point delta could originate in how
`constraint=false` edges are classified, how their routing boxes/corridors are built,
or in the spline fitter's control-point generation.
**Decision:** Batch 1 names the single origin file + line; Batch 2 writes only that
file (plus its test). T2's write-set is finalized from Batch 1's output.
**Consequences:** If diagnosis shows the fix must span >1 routing file, that is a stop
condition (re-scope with human).

## AD-3: Fidelity bar = match the C spline output (deterministic tolerance)
**Context:** Project treats C as spec; conformant = numeric coords within ±0.01 and
non-numeric content exactly equal (`compareSvg(…, 'deterministic')`).
**Decision:** The fix must make the port produce the **same control points as C** for
the three `constraint=false` edges (within deterministic tolerance) — not merely "a
plausible spline". Mirror the exact C primitive responsible.
**Consequences:** Resolves both 1213 variants together and avoids re-introducing the
delta under another graph with non-constraint cross/back edges.

## AD-4: Oracle exits 1 (init_rank) — treated as a valid baseline, NOT reproduced
**Context:** C emits `Error: trouble in init_rank` (exit 1, unfixed xfail #1213) but
still produces a near-correct SVG that matches the port on all nodes and 14/17 edges.
The survey already classifies 1213 as `diverged` (using C's emitted SVG), not
`oracle-error`.
**Decision:** Treat C's emitted SVG as the reference. Do **not** reproduce C's
init_rank error path or its degraded ranking — node ranks already match. If Batch 1
finds the spline delta genuinely traces to the init_rank-degraded state (not a routing
bug), that is a stop condition (AD-1 re-scope), since it would change the mission.
**Consequences:** Keeps the mission a routing fix. The init_rank gap in `ns.ts` is out
of scope and left as a separate tracked observation.

## AD-5: Rollback classification — Reversible
**Context:** Pure in-memory layout routing change in a library; no data model, schema,
API, or persisted artifact.
**Decision:** Reversible by reverting the commit. The only persisted artifacts are
`parity.json`/`parity-rules.json`/`PARITY.md` (regenerated baselines), also revert-safe.
**Consequences:** No migration, no flag, no staged rollout needed.

## Operational readiness (N/A surfaces)
No data model, API contract, service dependency, SLI/SLO, dashboard, on-call, or
backwards-compat surface — this is an internal layout-routing fidelity fix in a browser
library. The parity survey + `survey:gate` (0 regressions) is the "observability"
equivalent: the automated fitness function for layout fidelity.
