# Mission: flat-edge routing parity for #241_0 (dot)

## Objective
Close the flat-edge routing divergence in `tests/241_0.dot`: same-rank
(`rank=same`) edges with diagonal compass ports (`2:ne->3:nw`, `3:sw->2:se`,
`1:se->6:sw`, `5:ne->8:nw`). The compass ENDPOINTS are already correct (prior
compass-port mission); the flat-edge ROUTING between them diverges — diagonal
flat edges curl in the oracle but route straight/wrong-bulge in the port (Δ up
to 126), and the long bottom edge `1:se->6:sw` routes at y=0 vs the oracle's
y=-7.88, setting the bbox bottom and shifting the WHOLE graph 7.88 (so even the
correct cardinal `:e->:w` edges miss). Faithful-port fidelity fix in the
flat-edge router; no data-model / API / dependency change.

## Branch / merge
- Branch `fix/flat-edge-routing-241` off `main`.
- Merge back with a **merge commit** (preserves per-task commit IDs).

## Execution model
Run with **opus** (`claude-opus-4-8`, native 1M context). Fable 5 is disabled.

## Oracle + harness (already in place)
- Native `dot`: `~/git/graphviz/build/cmd/dot/dot`, `GVBINDIR=/tmp/gvplugins`.
- Survey: `test/corpus/` (`survey.ts` -> `parity.json`, `dashboard.ts`). Oracle
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
  on_fail: fix_and_rerun  (any golden change -> STOP, do not regenerate)
- command: npx tsx test/corpus/survey.ts && npx tsx test/corpus/dashboard.ts
  pass: exit 0 ; then per-id verdict diff vs the pre-task parity.json snapshot
        shows 0 regressions and 241_0 improves
  on_fail: fix_and_rerun
- command: lizard <changed files> -C 10 -L 30 -a 5
  pass: no violations (30 lines/fn, CCN 10, 5 params, 500 lines/file)
  on_fail: fix_and_rerun
- command: git diff --name-only main
  pass: within the task's declared (T1-determined) write-set ; on_fail: stop
```

## Batches
| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | T1 diagnose flat-edge routing (instrument C) | [ ] |
| 2 | T2 fix the divergent flat-routing branch + test | [ ] |

- [decisions.md](decisions.md) — locked architecture decisions (AD-1..AD-5)
- [batch-1/overview.md](batch-1/overview.md) · [T1](batch-1/T1-diagnose.md)
- [batch-2/overview.md](batch-2/overview.md) · [T2](batch-2/T2-fix.md)
- [diagrams/data-flow.md](diagrams/data-flow.md)
- [decision-journal.md](decision-journal.md)

## Stop conditions
STOP and wait for human input when:
- A fix needs files outside the (T1-determined) write-set.
- ANY curated golden (`suite.test.ts` / `manifest.json`) changes — never modify
  or regenerate refs.
- 2 consecutive gate failures on the same check; or the same code location is
  changed 3x without resolving the same failing check.
- **AD-4:** the divergence is a deep multi-cause flat-routing rewrite, not an
  isolated box/curl branch -> report as a follow-on; do NOT expand scope.
- C instrumentation cannot isolate the cause.

## Push-forward with judgment
- Which exemplar edge to pin the C dump from (prefer `3:sw->2:se`, the clearest
  straight-vs-curl case).
- Helper-extraction location/naming per AD-5 (new `splines-flat-boxes.ts`).
- A fix simpler than estimated (log a decision-journal entry).

## Operational readiness
N/A — dev/test fidelity work; the browser library's layout/render path is
unchanged in shape (no SLIs, dashboards, traces, on-call). **Rollback:
Reversible** (revert the merge commit). No API/schema/contract/backwards-compat
impact.
