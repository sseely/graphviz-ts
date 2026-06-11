# Mission 8 - sfdp

Branch: `feature/parity-m8-sfdp` off `feature/ts-port`.

**Owned tests:** sfdp-simple, sfdp-medium, sfdp-large, sfdp-weighted, sfdp-disconnected

**C spec:** ~/git/graphviz/lib/sfdpgen/ - sfdpinit.c, spring_electrical.c, Multilevel.c, post_process.c; lib/sparse QuadTree + SparseMatrix

**SPEC VERSION (2026-06-10, see decision journal):** the local C repo
is 82 commits past 15.0.0. sfdpgen/sparse churn since the tag looks
refactor-only (static fns, array prealloc removal,
QuadTree_get_supernodes signature), but the refs are 15.0.0 output —
prefer `git -C ~/git/graphviz show 15.0.0:<path>` when porting, and
treat any HEAD-vs-15.0.0 difference in formulas as out of spec.
**Our port:** src/layout/sfdp/ (9 files, ~1834 lines)

**Scoping notes (from project baseline):** Largest numeric port (multilevel coarsening + Barnes-Hut). Uses src/common/random.ts from mission 6. Expect the recon task to split this into many small port tasks; the QuadTree/SparseMatrix substrate may deserve its own sub-batch.

After mission 1: failure set and first diffs for this family are
unchanged (small labels were already at default node size) - see
../baseline-after-m1.md.

Re-check ../baseline-after-m*.md at mission start - earlier missions
may have changed this mission's failure set.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Recon: gap-analysis.md + task files ([gap-analysis.md](gap-analysis.md)) | claude | this directory only | - | [x] |
| T2 | Substrate: minstd rand + SparseMatrix subset ([T2-substrate.md](T2-substrate.md)) | claude | src/common/crand.ts, src/layout/sfdp/* | T1 | [x] |
| T3 | Multilevel + spring-electrical core ([T3-spring-electrical.md](T3-spring-electrical.md)) | claude | src/layout/sfdp/* | T2 | [x] |
| T4 | QuadTree supernodes ([T4-quadtree.md](T4-quadtree.md)) | claude | src/layout/sfdp/* | T3 | [x] |
| T5 | Pipeline integration + tests ([T5-pipeline.md](T5-pipeline.md)) | claude | src/layout/sfdp/* (+ shared w/ journal) | T4 | [x] |
| T-final | Full suite; journal entry; tick README checkbox; merge branch | claude | plans/test-parity/* | T5 | [ ] STOPPED — see summary |

## T1 recon spec (run as-is)

Context: see ../README.md (canonical rules, gates, stop conditions)
and ../decisions.md. The C source is the spec; the test is the path.

Steps:
1. `npx vitest run test/golden/suite.test.ts -t "sfdp"` - capture
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

## Mission summary (2026-06-11) — STOPPED on the iterative-engine condition

**Tasks:** T1–T5 complete (5/6); T-final's merge withheld pending a human
decision. Commits: 17c4029 (T1), c9cb1db (T2), 26f90a4 (T3+T4), b80429b (T5).

**Suite:** 1001/5 at mission start (re-baselined 1025/5 after T2–T4 added
unit tests) → **1025 passed / 2 failed**. Goldens: sfdp-simple,
sfdp-weighted, sfdp-disconnected PASS (disconnected validates the
cross-component rand() stream threading end-to-end). All other families
stay green (11 dot goldens included).

**Stop condition** (README: "iterative engine converges to a
different-but-valid layout and the 0.5pt tolerance looks unreachable"):

- sfdp-medium first-diffs at viewBox width 698 vs 697 (1pt);
  sfdp-large at height 723 vs 724 (1pt).
- Root cause (T3 journal): the repulsive pow(dist, 1−p) rounding. The
  refs come from Apple's proprietary libm; the port uses ARM
  optimized-routines pow (MIT/Apache-2.0 — the legally clean choice
  after the Apple transcription was reverted). ~0.5-ULP argument-level
  differences are chaotically amplified by the embedding on the two
  larger graphs.
- Structural-equivalence evidence (T3 journal): Procrustes residual
  0.073% (medium) / 0.331% (large), edge crossings 14=14 EXACT on
  large, ≥96.5% 3-NN preservation. Same picture, different similarity
  transform; oracle parity on sfdp-simple is ≤2e-7 inches.

**Decision needed:** accept structural equivalence for sfdp-medium/-large
(and how to encode that without touching refs/tolerances, which the brief
forbids), regenerate those two refs from a build with a redistributable
libm, or pursue another pow source. Merge of feature/parity-m8-sfdp
(strict suite improvement) also awaits that call.
