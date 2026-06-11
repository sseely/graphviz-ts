# Mission 9 — Parity gaps: self-loops, rankdir, edge attributes

**Objective:** Close the three gap clusters found by post-parity T2 golden
mining: (1) self-loop rendering in dot/twopi/circo, (2) rankdir=LR/BT/RL
in the dot engine, (3) dot edge attributes (minlen, constraint=false,
multi-edge offset, headlabel/taillabel). The 9 quarantined inputs+refs in
test/golden/quarantine/ are the acceptance tests; each cluster's tasks
move its goldens into the manifest once they pass. End state: quarantine
empty, manifest 57 → 67 (incl. one new dot-rankdir-rl golden).

## Branch

`feature/parity-m9-gaps` off `feature/post-parity` (the quarantine corpus
and 1054 baseline live there, not on feature/ts-port). Merge back into
`feature/post-parity` with a **merge commit** when all gates pass; the
paused post-parity mission resumes afterward.

## Canonical rules

- The C source at `~/git/graphviz/lib/` (tag 15.0.0) is the spec. Refs
  come from the installed C graphviz 15.0.0 binary only.
- NEVER modify existing refs, existing manifest entries, or TOLERANCES
  in compare.ts. Promotions APPEND manifest entries per
  [decisions.md](decisions.md) AD5.
- One commit per task; re-read this README + decision-journal.md after
  every compaction (per ~/.claude/rules/autonomous-execution.md).

## Quality Gates (run after every task)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0 AND passed >= current baseline AND failed == 0
  on_fail: fix_and_rerun
- command: git diff --name-only HEAD~1
  pass: output within the task's declared write-set
  on_fail: stop
```

Baseline at mission start: **1054 passed / 0 failed** (2026-06-11,
feature/post-parity after batch-1 close).

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 (parallel) | [T1 minlen+constraint](batch-1/T1-minlen-constraint.md), [T2 dot self-loop](batch-1/T2-dot-self-loop.md), [T3 twopi/circo self-loop debug](batch-1/T3-twopi-circo-self-loop.md), [T4 rankdir recon](batch-1/T4-rankdir-recon.md), then [T5 promote goldens](batch-1/T5-promote-goldens.md) | [ ] |
| 2 (after 1) | [T6 rankdir impl](batch-2/T6-rankdir-impl.md), [T7 multi-edge offset](batch-2/T7-multi-edge-offset.md), then [T8 promote + RL golden](batch-2/T8-promote-goldens.md) | [ ] |
| 3 (after 2) | [T9 head/tail labels](batch-3/T9-head-tail-labels.md), then [T10 promote + close](batch-3/T10-promote-close.md) | [ ] |

## Stop conditions

- Change needed outside the active task's write-set
- 2 consecutive gate failures on the same check
- Implementation contradicts AD1–AD7
- AD2 gate breach: ported postprocess can't keep TB byte-identical AND
  the conditional fallback also perturbs an existing golden
- Consecutive-fix rule: same location/approach changed 3+ times without
  resolving the same failing comparison (esp. T3) — journal and stop
- A promoted-cluster golden still fails beyond the established pin
  pattern (AD5 — no silent re-quarantine in this mission)
- The C source shows a feature depends on another unported subsystem

## Push-forward conditions (journal entry each)

- Tolerance + portReference pinning for promoted iterative-engine goldens
- AD2 fallback A→B when the byte-identity gate forces it
- Placement of attribute parsing within init.ts (match dotinit.c order)
- Probe design/location under .probes/ (untracked)
- A task turning out simpler than estimated (e.g. T3's two engines
  sharing one root cause)
- Neighboring type tightening ≤3 lines

## Key references

- [decisions.md](decisions.md) — AD1–AD7
- [decision-journal.md](decision-journal.md) — append-only execution log
- [diagrams/component-map.md](diagrams/component-map.md),
  [diagrams/data-flow.md](diagrams/data-flow.md)
- ../post-parity/decision-journal.md — quarantine provenance + failure
  signatures
- .agent-notes/fdp-fma-oracle-2026-06.md — C oracle probe technique
  (AD4); .agent-notes/cluster-hang-2026-06.md — hang debugging (--prof,
  never guard-bisect)
