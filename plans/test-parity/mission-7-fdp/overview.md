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
| T2 | fdp_tLayout + grid + parms (flat graphs) | claude | src/layout/fdp/* | T1 | [ ] |
| T3 | cluster scheme (layout.c derived graphs, xLayout sans Mlimit) | claude | src/layout/fdp/* | T2 | [ ] |
| T4 | components + pipeline tail | claude | src/layout/fdp/* | T3 | [ ] |
| T5 | verify 6 goldens; re-baseline; merge | claude | plans/test-parity/* | T4 | [ ] |

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
