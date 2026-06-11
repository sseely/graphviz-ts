# Mission 7 - fdp

Branch: `feature/parity-m7-fdp` off `feature/ts-port`.

**Owned tests:** fdp-simple, fdp-large, fdp-cluster, fdp-nested-cluster, fdp-edge-both, fdp-disconnected

**C spec:** ~/git/graphviz/lib/fdpgen/ - fdpinit.c, layout.c, grid.c, xlayout.c, dbg.c; clusters via recursive layout

**SPEC VERSION (2026-06-10, see decision journal):** the local C repo
is now 82 commits past 15.0.0, and fdpgen changed after the tag:
tlayout/xlayout doRep got ULP-level float reorderings (hypot vs
sqrt(x²+y²)) and a NEW `Mlimit` force cutoff (`-Lm`, default off).
The golden refs are 15.0.0 output — read the spec via
`git -C ~/git/graphviz show 15.0.0:lib/fdpgen/<file>` and do NOT port
the Mlimit branch.
**Our port:** src/layout/fdp/ (8 files, ~1679 lines)

**Scoping notes (from project baseline):** Uses src/common/random.ts from mission 6. fdp-cluster height 46 vs 162: cluster handling collapses - check fdp recursive cluster layout (clust.c) before the force loop constants.

After mission 1: failure set and first diffs for this family are
unchanged (small labels were already at default node size) - see
../baseline-after-m1.md.

Re-check ../baseline-after-m*.md at mission start - earlier missions
may have changed this mission's failure set.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Recon: gap-analysis.md (oracle workflow, 15.0.0-tag plan) | claude | this directory only | - | [x] |
| T2 | Flat fdp rewrite: derived graphs, grid, tlayout, xlayout, packed components ([T2-flat-fdp.md](T2-flat-fdp.md)) | claude | src/layout/fdp/* (+ common/pack/neato w/ journal) | T1 | [x] |
| T3 | Cluster scheme: ports, recursion, cluster bbs ([T3-clusters.md](T3-clusters.md)) — absorbed into T2 (see journal) | claude | src/layout/fdp/* | T2 | [x] |
| T-final | verify 6 goldens; re-baseline; merge | claude | plans/test-parity/* | T3 | [x] |

## Result (2026-06-10)

All 6 fdp goldens pass; suite 1013/11 → 1001/5 (only sfdp remains).
End-to-end node positions match the 15.0.0 C binary to ≤1.3e-15
inches; the tlayout pass is bit-exact (after the software-fma fix —
see decision journal and .agent-notes/fdp-fma-oracle-2026-06.md).

## T1 recon spec (run as-is)

Context: see ../README.md (canonical rules, gates, stop conditions)
and ../decisions.md. The C source is the spec; the test is the path.

Steps:
1. `npx vitest run test/golden/suite.test.ts -t "fdp"` - capture
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
