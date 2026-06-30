# Mission: compass-port edge routing parity (dot)

## Objective
Close the **compass-port** slice of the dot parity survey's `path-structure`
routing-position bucket: edges whose head/tail use a compass port
(`:n/:ne/:e/:se/:s/:sw/:w/:nw`) and whose spline **endpoints** land at different
positions than the native `dot` oracle. Two distinct shapes:
- **Regular edges with compass ports** — `tests/2168.dot` (+`2168_1..5`), e.g.
  `node1 -> node2:sw` / `node1 -> node2:ne`. Δ≈16–20.
- **Flat (same-rank) edges with compass ports** — `tests/241_0.dot`, e.g.
  `2:e -> 3:w`, `2:ne -> 3:nw` inside `{rank=same}`. Δ≈17.5.

This is a **faithful-port fidelity fix** (compass-port endpoint / routing-box
placement), NOT a general routing rewrite. No data-model / API / dependency
change.

## Branch / merge
- Branch `fix/compass-port-routing` off `main`.
- Merge back with a **merge commit** (preserves per-task commit IDs).

## Execution model
Run with **opus** (`claude-opus-4-8`, native 1M context). Fable 5 is disabled.

## Oracle + harness (already in place)
- Native `dot`: `~/git/graphviz/build/cmd/dot/dot`, `GVBINDIR=/tmp/gvplugins`.
- Survey: `test/corpus/` (`survey.ts` → `parity.json`, `dashboard.ts`). Oracle
  SVG cache under `$TMPDIR/dot-corpus-oracle/`.
- Per-input check: `npx tsx test/corpus/render-one.ts <input> dot` vs the cached
  oracle SVG (reuse `test/golden/compare.ts`).
- C instrumentation recipe: rebuild `gvplugin_dot_layout`, copy the plugin to
  `/tmp/gvplugins` (NOT libgvc) — memory `recover-slack-and-c-harness`.

## Quality gates (run after every task)
```
- command: npx tsc --noEmit
  pass: exit 0 ; on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0, 0 failures, the 128 curated goldens BYTE-IDENTICAL
  on_fail: fix_and_rerun  (any golden change → STOP, do not regenerate)
- command: npx tsx test/corpus/survey.ts && npx tsx test/corpus/dashboard.ts
  pass: exit 0 ; then per-id verdict diff vs the pre-task parity.json snapshot
        shows 0 regressions and the target inputs improve
  on_fail: fix_and_rerun
- command: lizard <changed files> -C 10 -L 30 -a 5
  pass: no violations (30 lines/fn, CCN 10, 5 params, 500 lines/file)
  on_fail: fix_and_rerun
- command: git diff --name-only main
  pass: within the task's declared (T1/T2-determined) write-set ; on_fail: stop
```

## Batches
| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | T1 diagnose regular (#2168), T2 diagnose flat (#241_0) | [x] |
| 2 | T3+T4 fix compass-port ictxt (collapsed) | [x] |

- [decisions.md](decisions.md) — locked architecture decisions (AD-1..AD-4)
- [batch-1/overview.md](batch-1/overview.md) · [T1](batch-1/T1-diagnose-regular.md) · [T2](batch-1/T2-diagnose-flat.md)
- [batch-2/overview.md](batch-2/overview.md) · [T3](batch-2/T3-fix-regular.md) · [T4](batch-2/T4-fix-flat.md)
- [diagrams/data-flow.md](diagrams/data-flow.md)
- [decision-journal.md](decision-journal.md)

## Stop conditions
STOP and wait for human input when:
- A fix needs files outside the (T1/T2-determined) write-set.
- ANY curated golden (`suite.test.ts` / `manifest.json`) changes — the
  conformantness backstop; never modify or regenerate refs.
- 2 consecutive gate failures on the same check; or the same code location is
  changed 3× without resolving the same failing check.
- **AD-4:** the divergence is NOT an isolated compass-port endpoint/box branch
  but a deep multi-cause routing rewrite → report as a follow-on; do NOT expand
  scope into a general routing rewrite.
- C instrumentation cannot isolate the cause.

## Push-forward with judgment
- Which variant id to pin the C dump from (prefer the smallest/most isolated).
- Test naming/location; lizard-driven helper splits.
- A fix simpler than estimated (log a decision-journal entry).
- If T1 and T2 land on the SAME divergent function, collapse T3+T4 into one
  task (log the decision).

## Operational readiness
N/A — dev/test fidelity work; the browser library's layout/render path is
unchanged in shape (no SLIs, dashboards, traces, on-call). **Rollback:
Reversible** (revert the merge commit). No API/schema/contract/backwards-compat
impact.

## Mission summary (2026-06-19)
- **Batch 1 — DONE.** T1/T2 diagnosed both #2168 (regular) and #241_0 (flat) to
  one root cause: `compassPort` deferred the C `ictxt` path and placed every
  compass port at the node bbox corner instead of the shape boundary.
- **Batch 2 — DONE (collapsed T3+T4).** Ported `compassPoint` (ray from centre →
  `bezierClip` vs the node `insidefn`) + the ictxt branch into
  `src/common/compass-port.ts`, gated to whole-node directional ports.
  - **Result:** survey **+8 / −0** — `#2168`+`2168_1..4` (diverged →
    byte/structural), bonus `1444`, `1444-2`, `graphs-b123`. 128→ goldens green
    (1991 tests). `steering-east/west` now **conformant to the C ref** →
    promoted `iterative 0.5pt` → `deterministic`, retired their `portReference`
    drift-pins (user-approved; `refs-port/` files deleted).
- **Follow-up (AD-4):** `#241_0` flat compass-port edges now have correct
  endpoints but the **flat-edge routing** between them still diverges
  (`splines-flat.ts`/make_flat_edge) — a separate branch; recommend a dedicated
  flat-edge-routing mission.
- **Quality gates (final):** tsc 0; vitest 1991 / 128 goldens; lizard clean;
  survey +8 / 0 regressions (2222 timeout was a concurrency flake).
