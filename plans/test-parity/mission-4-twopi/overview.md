# Mission 4 - twopi

Branch: `feature/parity-m4-twopi` off `feature/ts-port`.

**Owned tests:** twopi-star, twopi-chain, twopi-tree, twopi-ranksep, twopi-root-attr, twopi-disconnected + unit test src/layout/twopi/twopi.test.ts "hub at origin"

**C spec:** ~/git/graphviz/lib/twopigen/circle.c, twopiinit.c (small)
**Our port:** src/layout/twopi/ (6 files, ~894 lines)

**Scoping notes (from project baseline):** twopi-chain cy is -306 vs -18: placement is wrong, not just sizing (chain root should sit at origin-ish). The failing unit test (hub at (0,0), actual 68.9) points at the same root-placement bug. Per D5, if the unit test contradicts C behavior, fix the test; but first assume the test encodes C behavior here.

Re-check ../baseline-after-m*.md at mission start - earlier missions
may have changed this mission's failure set.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Recon: render each owned input, diff vs ref (use test/golden/compare.ts CLI or the suite), read the C spec, write gap-analysis.md and T2..Tn task files in this directory | claude | this directory only | - | [ ] |
| T2..Tn | Port tasks defined by T1 - one C function-group each, one commit each, suite-green gate after each | claude | src/layout/twopi/* (+ src/common/*, src/layout/pack/* with journal entry) | T1 | [ ] |
| T-final | Full suite; journal entry; tick README checkbox; merge branch | claude | plans/test-parity/* | T2..Tn | [ ] |

## T1 recon spec (run as-is)

Context: see ../README.md (canonical rules, gates, stop conditions)
and ../decisions.md. The C source is the spec; the test is the path.

Steps:
1. `npx vitest run test/golden/suite.test.ts -t "twopi"` - capture
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
