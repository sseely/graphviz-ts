<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: element-count bucket — 8 ids, ~6 causes

**Status: NOT STARTED (authored 2026-07-02).**

## Objective

Clear the `element-count` PARITY bucket (8 tracked ids). Pre-mission
characterization (2026-07-02, fresh renders both sides):

| ids | verified symptom |
|---|---|
| graphs-decorate | port missing ALL 26 `<polyline>`s — `decorate=true` attachment lines unimplemented |
| 1880, 2619_1, 2619_2 | port missing `<a>` anchors (2/4/4) + small path/polygon deltas |
| 2239 | port emits +51 `<polygon>`s (210 vs 159) |
| 1367 | node name carries raw 0x80: oracle emits the raw byte, port re-encodes U+0080; plus g[7] childCount |
| 1581 | ORACLE broken: install_in_rank ERROR + rankset warnings → 0 edges rendered; port clean |
| 2825 | ORACLE broken: C's own dot_concentrate/rebuild_vlists failure → 3 elements; port full graph (mirror of the 2183 port bug, fixed on our side) |

## Branch

`fix/element-count-bucket` from `main`. Merge commit; keep branch.

## Constraints (approved 2026-07-02)

- **D1** per-id pipelines; diagnosis journaled before that id's fix.
- **D2** faithful C at origin; instrument C before hypothesizing.
- **D3** bounded-fix rule per id (≤ ~2-3 files, faithful, gate-clean);
  else disposition artifact + tracked. Complete = every id
  fixed-or-disposed.
- **D4** 1581/2825: read upstream test bodies; verify port inputs to
  C's failing stage (A4 playbook, ratified policy: fix genuine input
  defects even if outputs then track C's broken state; otherwise accept
  with evidence + comparison page + registry entry).
- **D5** decorate = faithful feature port of C's emit branch.

### Stop conditions
- Fix before that id's mechanism journaled → not allowed.
- Fix locus outside provisional write-set → ask (never halt).
- Any currently-conformant id regresses → stop.
- decorate balloons past ~3 files → D3 disposition with spec artifact.
- Same location 3× same failure; 2 gate failures on one check → stop.
- Zero-byte/truncated render or group-count mismatch → comparison
  INVALID, redo (2026-07-02 lesson — hard rule).

### Push-forward
Task order (quick wins first); folding 2619_1/2619_2; instrumentation;
test phrasing.

## Quality gates

```
- npx tsc --noEmit                                   | exit 0 | fix_and_rerun
- npx vitest run                                     | exit 0 | fix_and_rerun
- GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json npx tsx test/corpus/survey.ts
  && GVBINDIR=/tmp/ghl npx tsx test/corpus/rules-gate.ts
  | 0 regressions; movers ⊆ bucket (+explained); ≤2 runs | stop
- canary render-one 2475_2 <180s (if routing/position code changed) | stop
- C tree reverted + oracle byte-verified after any instrumentation | stop
- comparisons validated: non-empty renders + group-count equality
  before positional compares | stop
```

Baseline refresh: survey → gate → `cp test/corpus/parity-rules.json
test/corpus/parity.json` → `npx tsx test/corpus/dashboard.ts`.
CWD DISCIPLINE: all npx/tsx from the repo root, absolute input paths.

## Batches

- [x] [Batch 1 — per-id diagnosis](batch-1/overview.md): T1 decorate,
      T2 anchors, T3 2239, T4 1367, T5 1581+2825
- [x] [Batch 2 — fixes/dispositions](batch-2/overview.md): T6–T10
- [ ] [Batch 3 — verify + close](batch-3/overview.md): T11

## Index

[decisions.md](decisions.md) · [decision-journal.md](decision-journal.md)
· [diagrams/component-map.md](diagrams/component-map.md)

## Operational readiness (approved)

SLIs/on-call N/A (survey+gate). Rollback: **Reversible**. Registry/doc
writes (accepted-divergences.json, known-divergences.md) only via T10
dispositions with guard-test syncs per convention.
