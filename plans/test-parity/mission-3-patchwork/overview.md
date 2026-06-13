# Mission 3 - patchwork

Branch: `feature/parity-m3-patchwork` off `feature/ts-port`.

**Owned tests:** patchwork-simple, patchwork-weighted, patchwork-cluster, patchwork-nested, patchwork-default-area, patchwork-html-label

**C spec:** ~/git/graphviz/lib/patchwork/patchwork.c (single file; squarified tree-map)
**Our port:** src/layout/patchwork/ (4 files, ~859 lines)

**Scoping notes (from project baseline):** All six fail with childCount (one element short at the top level, e.g. 7 vs 8) - we emit one box/label too few. Likely the root cluster box or a graph label. Find the missing element first; sizes may already be close.

After mission 1: failure set and first diffs for this family are
unchanged (small labels were already at default node size) - see
../baseline-after-m1.md.

**After mission 2 (see ../baseline-after-m2.md):** the childCount gap
is GONE — the missing element was being destroyed by engine cleanup
running before render (fixed in M2/T2, src/gvc/context.ts). All six
now first-diff at `svg/g[1]/g[1]/polygon[1]/@points[0]` (e.g. -35.36
vs 0): patchwork output is not translated to the root bb origin —
check C patchwork's coordinate finalisation (dotneato_postprocess /
translate to LL=0) vs our port.

Re-check ../baseline-after-m*.md at mission start - earlier missions
may have changed this mission's failure set.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Recon: gap-analysis.md + T2 spec (single root cause) | claude | this directory only | - | [x] |
| T2 | [Translate cluster bbs with the drawing](T2-translate-clusters.md) | claude | src/layout/patchwork/index.ts, src/layout/pack/index.ts (journal) | T1 | [x] |
| T3 | Verify goldens; re-baseline; tick README; merge | claude | plans/test-parity/* | T2 | [x] |

## Mission summary (2026-06-10)

- Tasks: 3 (T1 recon bad8b19, T2 fix e4b4576, T3 this commit).
- Outcome: suite 984/38 → 990/32; all 6 patchwork goldens pass.
  Single root cause: cluster bbs were never translated with the
  drawing (C translate_bb / pack shiftGraph). The mission-2 pipeline
  fix had already exposed this as the only remaining diff.
- Decisions: pack shiftOneGraph extended to the full C shiftGraph
  semantics (journal entry); no patchwork-only workaround.
- Gates: tsc clean; 11 dot goldens green; no regressions.

## T1 recon spec (run as-is)

Context: see ../README.md (canonical rules, gates, stop conditions)
and ../decisions.md. The C source is the spec; the test is the path.

Steps:
1. `npx vitest run test/golden/suite.test.ts -t "patchwork"` - capture
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
