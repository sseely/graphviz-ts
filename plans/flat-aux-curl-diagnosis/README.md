# Mission: flat-adj aux curl — structural diagnosis (#241_0)

## Objective
Name the **exact divergent structural decision** that makes C's flat-adj aux
graph give the reversed back edge `3:sw->2:se` a curl (aux spline size 7) while
the port routes it straight (size 4). This is **diagnosis only** — the
deliverable is a side-by-side C-vs-port dump of the aux graph's **ranks +
virtual-node chains** and a one-line statement of where they first diverge. No
fix; no edit to the layout path. A fix is a separate, later mission.

This is the 5th mission on `#241_0`. The prior four ratcheted the diagnosis
deeper but never landed a clean aux-internal dump; three ended at the same
resume point ("get a clean aux rank / virtual-chain dump for 3->2") because the
dump was folded into a *fix* attempt against the *full* graph and hit
golden-risk. This mission designs that out: pure diagnosis, minimal repro,
canary-validated harness, input-parity before layout instrumentation.

## Prime suspect (lead, not a conclusion)
Port `buildFlatAux` (`src/layout/dot/splines-flat.ts:149-166`) does **not**
replicate C's `rank=source` subgraph that pins `auxt` before `dot_rank`
(`lib/dotgen/dotsplines.c:1170-1179`). A missing rank-shaping input changes
where normalize inserts virtual nodes — which is the curl. **T2 checks this
first.** Do not assume it; confirm by dump.

## Branch / merge
- Branch `fix/flat-aux-curl-diagnosis` off `main`.
- Merge back with a **merge commit** (preserves per-task commit IDs).

## Execution model
Run with **opus** (`claude-opus-4-8`, native 1M context). Fable 5 is disabled
(memory `fable-disabled-use-opus`).

## Oracle + harness (already in place)
- Native `dot`: `~/git/graphviz/build/cmd/dot/dot`, `GVBINDIR=/tmp/gvplugins`.
- C instrumentation recipe: rebuild `gvplugin_dot_layout`, copy the plugin to
  `/tmp/gvplugins` (NOT libgvc) — memory `recover-slack-and-c-harness`.
  **Restore the clean plugin + keep the oracle cache native-C-faithful when
  done** (AD-6).
- Per-input check (only for the final #241_0 confirmation, T3):
  `npx tsx test/corpus/render-one.ts <input> dot` vs the cached oracle SVG.

## Quality gates (run after every task)
```
- command: npx tsc --noEmit
  pass: exit 0 ; on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0, 0 failures, the curated goldens BYTE-IDENTICAL
  on_fail: STOP — a diagnosis mission must not change any golden
- command: git diff --name-only main
  pass: within the task's declared write-set (layout path NOT touched)
  on_fail: STOP (if a layout-path edit was needed to proceed, it is a fix — AD-1)
- command: lizard <changed files> -C 10 -L 30 -a 5
  pass: no violations (30 lines/fn, CCN 10, 5 params, 500 lines/file)
  on_fail: fix_and_rerun
```
The survey/parity gate is intentionally omitted: no behavior change is expected,
so `parity.json` must be unchanged. T3 confirms 0 delta as its own criterion.

## Batches
| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | T1 build+canary aux dump harness (synthetic repro); T2 static input-parity diff | [ ] |
| 2 | T3 runtime rank/chain dump → name the divergent line | [ ] |

- [decisions.md](decisions.md) — locked decisions (AD-1..AD-6)
- [batch-1/overview.md](batch-1/overview.md) · [T1](batch-1/T1-harness-canary.md) · [T2](batch-1/T2-input-parity.md)
- [batch-2/overview.md](batch-2/overview.md) · [T3](batch-2/T3-structural-dump.md)
- [diagrams/data-flow.md](diagrams/data-flow.md)
- [decision-journal.md](decision-journal.md)

## Stop conditions
STOP and wait for human input when:
- **AD-1 breached:** proceeding with diagnosis would require editing the layout
  path (`splines-flat.ts`, `rank.ts`, `mincross.ts`, `splines.ts`). That means a
  fix is needed — bank the diagnosis and scope the fix mission.
- The harness **canary fails** (T1): it does not reproduce the *agreeing*
  forward `2->3` case (size 7) on either C or the port. An unvalidated harness
  cannot be trusted on `3->2`.
- C instrumentation cannot isolate the cause (the prior recurring failure).
- ANY curated golden changes (should be impossible; no src change).
- The same probe/location is changed 3x without resolving the same question.

## Push-forward with judgment
- Exact minimal-repro `.dot` content — construct the smallest graph that
  reproduces aux size 4-vs-7 for a both-bottom-port back edge.
- Harness output format and file locations under `test/diagnostic/`.
- If T2 isolates the cause outright (e.g., the missing `rank=source` subgraph),
  collapse T3 to a one-line confirming dump rather than a full stage sweep (log
  the collapse in the journal).

## Context (5th #241_0 mission)
Prior (all on main): compass-port endpoints fixed; `flat-edge-routing-241` STOP;
`flatedge-box-x` STOP (frame artifact); `flat-curl-y` isolated the residual to
one edge then banked the fix as "aux geometry, unpinned." This mission lands the
dump those stops kept deferring. Memory: `flat-edge-241-is-y-only`,
`instrument-c-before-quarantine`, `large-port-batch-oracle`,
`recover-slack-and-c-harness`.

## Operational readiness
N/A — dev/test diagnosis; no source behavior change, no SLIs/dashboards/traces/
on-call. **Rollback: Reversible** (revert the merge commit). No API / schema /
contract / backwards-compat impact.
