# Mission 2 - osage

Branch: `feature/parity-m2-osage` off `feature/ts-port`.

**Owned tests:** osage-simple, osage-array-mode, osage-sortv, osage-labels, osage-empty-cluster, osage-nested

**C spec:** ~/git/graphviz/lib/osage/osageinit.c (single file; uses lib/pack — already partially ported at src/layout/pack/)
**Our port:** src/layout/osage/ (4 files, ~1257 lines)

**Scoping notes (from project baseline):** Baseline deltas are small (height off by 8-50pt) - likely margin/packing constants and cluster label space. Three tests share identical first-diff (96 vs 88), suggesting one shared cause.

After mission 1: failure set and first diffs for this family are
unchanged (small labels were already at default node size) - see
../baseline-after-m1.md.

Re-check ../baseline-after-m*.md at mission start - earlier missions
may have changed this mission's failure set.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Recon: gap-analysis.md + T2-T6 task specs | claude | this directory only | - | [x] |
| T2 | [Pipeline order: cleanup after render](T2-pipeline-order.md) | claude | src/gvc/context.ts, src/index.ts, src/gvc/context.test.ts (journal) | T1 | [x] |
| T3 | [DFLT_MARGIN=4 + sortv values](T3-margin-sortv.md) | claude | src/layout/osage/index.ts | T2 | [x] |
| T4 | [Cluster labels build + place](T4-cluster-labels.md) | claude | src/layout/osage/index.ts | T3 | [x] |
| T5 | [pack/packmode attr parsing](T5-pack-attrs.md) | claude | src/layout/pack/* (journal) | T3 | [x] |
| T6 | [Verify all goldens; merge](T6-verify-merge.md) | claude | src/layout/osage/*, plans/test-parity/* | T2-T5 | [x] |

## Mission summary (2026-06-10)

- Tasks: 6/6 (T1 recon 1732504, T2 pipeline b0da47d, T3 margins
  0178f52, T4 labels 29a2393, T5 pack attrs f055848, T6 this commit).
- Outcome: suite 978/44 → 984/38. All 6 osage goldens pass. No
  residual fixes needed in T6 — T4 already turned the family green.
- Cross-family win: the M2/T2 pipeline fix (cleanup after render)
  moved patchwork's first diff from missing-element to a pure
  coordinate-translation gap (mission 3 head start).
- Gates: tsc clean throughout; 11 dot goldens green after every task;
  one transient unit-test regression (pack-mode stub channel) fixed
  per D5 within T5.

## T1 recon spec (run as-is)

Context: see ../README.md (canonical rules, gates, stop conditions)
and ../decisions.md. The C source is the spec; the test is the path.

Steps:
1. `npx vitest run test/golden/suite.test.ts -t "osage"` - capture
   every diff (fix the first diff, re-run, the next appears; the
   comparator stops at the first structural mismatch per test).
2. For each owned test: render with a probe script (esbuild-bundle
   pattern in .agent-notes/cluster-hang-2026-06.md), diff the SVG
   against test/golden/refs/ by eye AND by comparator.
3. Read the C spec files; map each divergence to the C function that
   produces the right value.
4. Write gap-analysis.md: per-test root causes, ordered fix plan.
5. Write T2..Tn task files (5-15 min each) with write-sets,
   read-sets (C file:line ranges), and Given/When/Then criteria
   derived from ref values - exactly like
   ../mission-1-node-sizing/T1-poly-sizing.md.

Observability: N/A. Rollback: Reversible (git revert of merge commit).
