# Mission 11 — label initialization parity (node/edge/graph labels + xlabels)

**Objective:** Port label CREATION so node xlabel, edge label, edge
xlabel, and graph label exist on the model and render as C graphviz
15.0.0 does. The downstream machinery is already ported and dormant:
edgelabelRanks rank doubling, classify.ts label vnodes, placeVnlabel,
addXLabels placement (M10), renderEdgeLabels emission (M10) — creation
sets the has_labels bits that wake it. Also: live emission for node
xlabel + root graph label, 5 new goldens (manifest 67 → 72), deletion
of the dead src/common/emit*.ts family after a symbol-level
reachability audit, and a scoping doc seeding the future html-labels
mission. Recon evidence: .agent-notes/label-creation-gaps-2026-06.md,
.agent-notes/m10-emit-dead-code-2026-06.md.

## Branch

`feature/parity-m11-labels` off `feature/post-parity`. Merge back with
a **merge commit** when all gates pass, on Scott's go-ahead.

## Canonical rules

- C source at `~/git/graphviz/lib/` (tag 15.0.0) is the spec; refs only
  from the installed 15.0.0 dot binary.
- NEVER modify existing refs, manifest entries, or TOLERANCES;
  promotions/additions APPEND (carried AD5, [decisions.md](decisions.md)).
- One commit per task; re-read this README + decision-journal.md after
  every compaction.
- Agent prompts MUST include: "if a pre-commit/length/CCN hook
  complains, smallest fix, at most 2 attempts per file, then move on."

## Quality Gates (after every task)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0 AND failed == 0 AND passed >= 1217
  on_fail: fix_and_rerun
- command: OUTDIR=/tmp/m11-x npx tsx .probes/render-all.ts + byte-diff vs pre-task baseline
  pass: existing goldens byte-identical (67 until T6 lands, 72 after)
  on_fail: stop
- command: git diff --name-only HEAD~1..HEAD
  pass: within the task's declared write-set
  on_fail: stop
```

Baseline at mission start: **1217 passed / 0 failed**, 67 goldens
(2026-06-12, mission 10 close).

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 (parallel) | [T1 node xlabel](batch-1/T1-node-xlabel.md), [T2 edge label+xlabel](batch-1/T2-edge-labels.md), [T3 graph label](batch-1/T3-graph-label.md) | [x] |
| 2 (after 1) | [T4 live emission](batch-2/T4-emission.md), [T5 verify vs C + gap-fill](batch-2/T5-verify-gaps.md) | [x] |
| 3 (after 2) | [T6 goldens 67→72](batch-3/T6-goldens.md) (orchestrator inline) | [x] |
| 4 (after 3) | [T7 emit-family audit + delete](batch-4/T7-emit-cleanup.md), then [T8 html scope doc](batch-4/T8-html-scope.md) | [ ] |

## Stop conditions

- Change outside the active task's write-set (EXCEPT T5's declared
  conditional set and the push-forwards below)
- 2 consecutive gate failures on the same check; same location/approach
  changed 3+ times for the same failure
- Implementation contradicts D1–D4/AD5 ([decisions.md](decisions.md))
- A label kind diverges from the C oracle AND the divergence traces to
  code outside this mission's write-set (M10 precedent — do not fix
  other missions' code silently)
- T7 audit finds a LIVE reference to an emit-family symbol
- Numeric divergence with an FMA signature, without disassembly
  evidence (M7 rule, src/common/fma.ts)
- A required C behavior depends on an unported subsystem

## Push-forward conditions (journal entry each)

- Hook-forced module splits; C function boundaries + @see preserved
- Probe design under .probes/ (untracked)
- Test-fixture repairs in files the task owns
- T5 porting the enumerated dotsplines/addLabelBB gaps (its conditional
  write-set)
- Trivially obvious fallback-chain fixes within a task's own files

## Key references

- [decisions.md](decisions.md) — D1–D4 + carried AD5
- [decision-journal.md](decision-journal.md) — append-only
- [diagrams/component-map.md](diagrams/component-map.md),
  [diagrams/data-flow.md](diagrams/data-flow.md)
- .agent-notes/label-creation-gaps-2026-06.md — creation-gap probe
- .agent-notes/m10-emit-dead-code-2026-06.md — live path vs dead family
- plans/parity-m10-xlabels/ — AD precedents, byte-stability probe
  technique (.probes/render-all.ts exists and is reusable)
