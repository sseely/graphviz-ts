# Mission: flat-edge curl-Y parity for #241_0 (dot)

## Objective
Close the remaining #241_0 divergence: ~7pt of bbox HEIGHT (oracle viewBox 86
vs port 79). The port's same-rank (flat) compass-port edges **curl less far in
Y** than native C, shorting the bbox and shifting every node's Y (the visible
7.88 miss on the cardinal `:e->:w` edges). The topmost edge `5:ne->8:nw`
(non-adjacent) peaks at oracle -90.24 vs port -83.44 with a wholly different
spline shape; the bottom `3:sw->2:se` (adjacent) curls below in the oracle but
not the port. This is flat-edge curl-Y geometry across two code paths
(`routeFlatEdgeFaithful` non-adjacent; `make_flat_adj_edges` adjacent).
Faithful-port fidelity fix; no data-model / API / dependency change.

NB: the flat-edge X already matches C byte-for-byte; the divergence is Y-only
(memory `flat-edge-241-is-y-only`). Compare FINAL SVG coords, not internal box
coords (internal frame is +27 in x and compensates at emit).

## Branch / merge
- Branch `fix/flat-curl-y` off `main`.
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
  `/tmp/gvplugins` (NOT libgvc) — memory `recover-slack-and-c-harness`. Restore
  the clean plugin when done (oracle cache must stay native-C-faithful).

## Quality gates (run after every task)
```
- command: npx tsc --noEmit
  pass: exit 0 ; on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0, 0 failures, the 128 curated goldens BYTE-IDENTICAL
  on_fail: fix_and_rerun  (any golden change -> STOP, do not regenerate)
- command: npx tsx test/corpus/survey.ts && npx tsx test/corpus/dashboard.ts
  pass: exit 0 ; per-id verdict diff vs the pre-task parity.json snapshot shows
        0 regressions and 241_0 improves
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
| 1 | T1 diagnose non-adjacent curl, T2 diagnose adjacent curl | [x] |
| 2 | T3 fix | STOP (banked — aux back-edge routing, resumable) |

- [decisions.md](decisions.md) — locked architecture decisions (AD-1..AD-5)
- [batch-1/overview.md](batch-1/overview.md) · [T1](batch-1/T1-diagnose-nonadj.md) · [T2](batch-1/T2-diagnose-adj.md)
- [batch-2/overview.md](batch-2/overview.md) · [T3](batch-2/T3-fix.md)
- [diagrams/data-flow.md](diagrams/data-flow.md)
- [decision-journal.md](decision-journal.md)

## Stop conditions
STOP and wait for human input when:
- A fix needs files outside the (T1/T2-determined) write-set.
- ANY curated golden changes — never modify or regenerate refs.
- 2 consecutive gate failures on the same check; or the same code location is
  changed 3x without resolving the same failing check.
- **AD-4:** neither path is isolable (deep multi-cause) -> report; if one is
  isolable, fix it and defer the other.
- **AD-5:** a "divergence" turns out to be an internal-frame artifact that
  compensates at emit (final coords match) -> it is NOT a bug; report and stop.
- C instrumentation cannot isolate the cause.

## Push-forward with judgment
- Which exemplar to pin (T1: `5:ne->8:nw`; T2: `3:sw->2:se`).
- Helper splits; test naming/location.
- A fix simpler than estimated (log it); collapse T3 if both paths share a cause.

## Context (this is the 4th #241_0 mission)
Prior (all on main): compass-port endpoints fixed; flat-edge-routing-241 STOP
(multi-cause); flatedge-box-x STOP (premise invalid — the +27 box-x was a frame
offset, not a bug). This mission targets the genuine residual: curl-Y geometry.

## Operational readiness
N/A — dev/test fidelity work; the browser library's layout/render path is
unchanged in shape (no SLIs, dashboards, traces, on-call). **Rollback:
Reversible** (revert the merge commit). No API/schema/contract/backwards-compat
impact.
