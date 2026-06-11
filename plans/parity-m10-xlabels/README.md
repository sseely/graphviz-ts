# Mission 10 — xlabels: external label placement (lib/label port)

**Objective:** Port graphviz's `lib/label/` external-label placement
subsystem (Guttman R-tree + Hilbert-ordered map placement, ~1756 C
lines) and `addXLabels` (postproc.c:230-590, wired at gv_postprocess)
so default-attribute head/tail edge labels — and node/edge xlabels
generally — are placed exactly as C places them. Acceptance: the
quarantined `test/golden/quarantine/dot-head-tail-label.{dot,svg}`
golden passes at dot deterministic tolerance and is promoted
(manifest 66 → 67, quarantine emptied and the directory removed).
This closes the gap that stopped mission 9 (see
../parity-m9-gaps/README.md "Mission summary").

## Branch

`feature/parity-m10-xlabels` off `feature/post-parity` (AFTER the
mission 9 merge commit). Merge back into `feature/post-parity` with a
**merge commit** when all gates pass.

## Canonical rules

- The C source at `~/git/graphviz/lib/` (tag 15.0.0) is the spec.
  Refs come from the installed C graphviz 15.0.0 binary only.
- NEVER modify existing refs, manifest entries, or TOLERANCES.
  Promotions APPEND per [decisions.md](decisions.md) AD5.
- One commit per task; re-read this README + decision-journal.md
  after every compaction.
- Agent prompts MUST include: "if a pre-commit/length/CCN hook
  complains, smallest fix, at most 2 attempts per file, then move
  on" (mission 9 lesson — agents died in hook loops).

## Quality Gates (run after every task)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0 AND passed >= 1138 AND failed == 0
  on_fail: fix_and_rerun
- command: git diff --name-only HEAD~1..HEAD
  pass: output within the task's declared write-set
  on_fail: stop
```

Baseline at mission start: **1138 passed / 0 failed**, 66 goldens
(2026-06-11, mission 9 close).

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | [T1 rectangle](batch-1/T1-rectangle.md) | [x] |
| 2 (after 1) | [T2 node + split.q](batch-2/T2-node-splitq.md) | [x] |
| 3 (after 2) | [T3 R-tree index](batch-3/T3-rtree-index.md) | [ ] |
| 4 (parallel, after 3) | [T4 xlabels placeLabels](batch-4/T4-xlabels.md), [T5 addXLabels + wiring](batch-4/T5-addxlabels.md) | [ ] |
| 5 (after 4) | [T6 verify + promote + close](batch-5/T6-promote-close.md) (orchestrator inline) | [ ] |

## Stop conditions

- Change needed outside the active task's write-set (EXCEPT the two
  pre-authorized push-forwards below)
- 2 consecutive gate failures on the same check; same location/
  approach changed 3+ times without resolving the same failure
- Implementation contradicts AD1–AD5
- dot-head-tail-label still fails after T6 wiring AND the divergence
  traces to pre-mission-10 code (M9 postproc/emit) — do not fix other
  missions' code silently
- Numeric divergence from the C oracle with an FMA signature: apply
  src/common/fma.ts only with disassembly evidence (otool) per the M7
  precedent; otherwise STOP
- A required C behavior depends on yet another unported subsystem

## Push-forward conditions (journal entry each)

- TS structural deviations forced by circular imports (M9
  edge-route-helpers precedent): split/merge modules, document with
  @see comments
- Minimal `src/cdt` extension if DtSplay lacks Dtobag
  ordered-duplicate semantics (T4 only; smallest faithful change)
- Probe design under .probes/ (untracked)
- Test-fixture repairs in files the task already owns

## Key references

- [decisions.md](decisions.md) — AD1–AD5
- [decision-journal.md](decision-journal.md) — append-only log
- [diagrams/component-map.md](diagrams/component-map.md),
  [diagrams/data-flow.md](diagrams/data-flow.md)
- ../parity-m9-gaps/decision-journal.md — the T9/T10 stop analysis
  (why place_portlabel does NOT cover default placement)
- .agent-notes/fdp-fma-oracle-2026-06.md — full-precision C oracle
  probe technique
