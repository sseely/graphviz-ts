<!-- SPDX-License-Identifier: EPL-2.0 -->
# Architecture Decisions

Confirmed with the user during planning (2026-06-22).

## ADR-1: Faithful C port, not defensive guards

**Context:** RC1–RC3 are null-derefs mid-algorithm; a bare `?.`/early-return
would suppress the crash but mask a real divergence from C.
**Decision:** Each fix reproduces the C control flow (`mincross.c:flat_reorder`,
`cluster.c:map_path`, `cluster.c:build_skeleton`), instrumented against native
dot to find where the port's state diverges. No guard that merely avoids the
throw.
**Consequences:** Correct geometry, but each needs oracle instrumentation;
slower than a guard. The full vitest suite is the proof of faithfulness.

## ADR-2: Batch by subsystem — RC4 first, RC1–3 together

**Context:** RC4 is parser (1 file, no minefield); RC1–3 are cluster/mincross
(sensitive, heavy test coverage; the 2471 ranking saga lives here).
**Decision:** B1 = RC4 alone (quick win, ships value early, de-risks the
toolchain); B2 = RC1/RC2/RC3 as three separate tasks (disjoint write-sets:
`mincross-flat.ts` / `cluster-path.ts` / `cluster.ts`).
**Consequences:** Early signal that the branch/gate flow works before the hard
cluster work.

## ADR-3: RC1–3 tasks run sequentially despite disjoint files

**Context:** All three touch cluster/mincross runtime state and share the full
vitest suite as the regression gate.
**Decision:** Execute sequentially (one task → full suite → next) even though
write-sets don't overlap.
**Consequences:** No parallel speedup, but a regression is trivially attributed
to the one task that introduced it — essential in a minefield.

## ADR-4: "Stops crashing + faithful to C" is success, even if it surveys `diverged`

**Context:** A correct fix may land at `diverged` (right structure, layout
differs on an unrelated axis), exactly as the arrowhead-geometry cases
re-bucketed off the arrow primitive onto spline `path/@d`.
**Decision:** Success = no longer `errored` AND the fixed code path matches C
ground truth. The byte/structural verdict is the headline metric, but a faithful
fix that re-buckets to `diverged` on an unrelated axis is still a win, documented
per case.
**Consequences:** Mirrors the arrowhead mission's ADR-6 + the re-bucketing
memory; avoids chasing unrelated layout diffs inside this mission.

## ADR-5: Parity regeneration + 0-regression is the gate

**Decision:** B3 regenerates `parity.json`/`PARITY.md`; the committed delta with
**0 per-id regressions** (judged by per-id verdict rank deltas, oracle-error
transitions excluded as noise) is the measured outcome.
**Consequences:** Deterministic, oracle-grounded success criterion.

## Rollback classification

**Reversible.** Every task is a localized code change + colocated tests; `git
revert` per commit. No data/schema/migration.
