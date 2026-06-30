<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: Errored-cluster — fix 8 dot-layout crashes

## Objective

Fix the 8 **errored** dot-corpus cases — outright `RenderError` crashes during
`dot` layout (surveyed in `test/corpus/PARITY.md`, errored bucket). Convert each
`errored` → `conformant`/`structural-match`/`diverged` with **0 per-id
regressions**, measured by `test/corpus/survey.ts`. Faithful per CLAUDE.md "the C
is sacred": root causes 1–3 are cluster/mincross invariant gaps that must be
ported from C (`mincross.c`/`cluster.c`), never patched with defensive `?.`
guards. Root cause 4 is an isolated parser-heuristic bug.

Baseline (post arrowhead-geometry, dot 15.1.0): conformant **249**, structural
**222**, diverged **288**, errored **13**, timeout 9, oracle-error 15.

## Branch

`feature/errored-cluster` — merge commit (one commit per task, referenced in the
decision journal). Do NOT squash.

## Root causes (pre-investigated; real inner stack traces)

| RC | Site | Cases | Subsystem |
|----|------|-------|-----------|
| RC1 | `mincross-flat.ts:189` `flatReorderRank` — `temprank[i]` undefined when `temprank.length < rk.n` | 121, 2239, 258 | mincross (clusters) |
| RC2 | `cluster-path.ts:154` `mapPathLongSingle` — `e.head.info.out!.list[0]` null walk | 1332, graphs-b53 | cluster path |
| RC3 | `cluster.ts:267` `buildSkeletonEdgeCounts` — null `rankleader[r]`/`.out` | 1767 | cluster skeleton |
| RC4 | `index.ts` `Stripper.strip` leaks `--` from `\`-continued multi-line strings into `validateEdgeOperators` | graphs-big, graphs-biglabel | parser heuristic |

RC4 is the grammar-independent pre-parse edge-operator check (`dot.js` parses
both files fine) — no `dot.js`/peggy regeneration needed.

## Constraints

### Stop conditions
- STOP if a task needs changes outside its write-set not owned by another task.
- STOP on 2 consecutive quality-gate failures on the same check, or 3 consecutive
  fixes to the same location for the same case.
- STOP if a fix makes an existing vitest test fail and the fix (not the test) is
  the faithful one — a cluster/mincross change that breaks coverage means it
  diverges from C; rework it, do not edit the test.
- STOP if a per-id **regression** (byte→structural/diverged, structural→diverged,
  anything→errored/timeout caused by the change) cannot be resolved in the task.
- STOP if the oracle (native `dot`) is unavailable or unstable.

### Push forward
- Helper/file decomposition within a task's write-set.
- Whether a fixed case lands byte/structural/diverged (ADR-4: faithful = success).
- Wording of journal/memory/regression notes.
- Minor test-fixture graph selection for the colocated regression tests.

## Quality gates (run between every batch)

```
- command: npm run typecheck      # pass: exit 0
- command: npm test               # pass: exit 0 (full suite, ~2241 — the RC1-3 gate)
- command: npm run build          # pass: exit 0
- command: git diff --name-only   # pass: matches the batch write-set only
```

Oracle: native `dot` 15.1.0 at `~/git/graphviz/build/cmd/dot/dot`,
`GVBINDIR=/tmp/gvplugins`, corpus `~/git/graphviz/tests`. Never approximate —
validate against the spawned native binary. C-instrument recipe: rebuild
`gvplugin_dot_layout`, copy to `/tmp/gvplugins`, dump intermediate values (see
project memory `recover-slack-and-c-harness`, `v8-prof-for-hangs`).

## Architecture decisions

See [decisions.md](decisions.md). Summary: faithful C port not guards (ADR-1);
RC4 first then RC1–3 (ADR-2); RC1–3 sequential despite disjoint files (ADR-3);
"stops crashing + faithful to C" is success even if it surveys as `diverged`
(ADR-4); parity regen + 0-regression is the gate (ADR-5).

## Batches

| Batch | Theme | Tasks | Status |
|-------|-------|-------|--------|
| [1](batch-1/overview.md) | Parser fix (isolated quick win) | T1 Stripper string-strip (RC4) | [x] |
| [2](batch-2/overview.md) | Cluster/mincross crashes (sequential) | T2 flatReorderRank (RC1) done; T3 mapPath (RC2) + T4 skeleton (RC3) deferred to derisk | [~] |
| [3](batch-3/overview.md) | Verify + finalize | T5 survey regen + 0-regression + memory | [ ] |

## Outcome (paused 2026-06-22)

**Fixed (committed):** RC4 (big, biglabel) via T1; RC1 (121, 2239, 258) via T2 —
which also resolved RC2's `mapPath` crash. 5/8 original crashes gone, 0 vitest
regressions (2250 pass).

**Re-classified + deferred:** RC2 (1332, b53) and RC3 (1767) both bottom out in
**cluster node/edge membership + cluster ranking** infrastructure — deeper and
cross-module, outside this mission's per-file write-sets. The brief's RC2/RC3
crash-site hypotheses were symptoms, not root causes (confirmed against native C).
See the new derisk mission: [`plans/cluster-membership-derisk/`](../cluster-membership-derisk/README.md).

## Diagrams

- [data-flow.md](diagrams/data-flow.md) — crash paths per root cause
- [component-map.md](diagrams/component-map.md) — modules touched

## Decision journal

Appended during execution: [decision-journal.md](decision-journal.md).

## Operational readiness

Pure layout/render library bug fixes. **Reversible** (git revert per commit). No
SLI/dashboard/on-call (the "SLI" is the parity survey). Backwards-compat:
strictly positive — `renderSvg` signature unchanged; 8 inputs that threw now
return SVG; no consumer (plantuml-js) contract change.
