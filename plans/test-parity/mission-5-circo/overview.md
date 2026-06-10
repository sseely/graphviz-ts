# Mission 5 - circo

Branch: `feature/parity-m5-circo` off `feature/ts-port`.

**Owned tests:** circo-simple, circo-star, circo-biconn, circo-disconnected, circo-record, circo-html-label + unit test src/layout/circo/circo.test.ts "equal radius"

**C spec:** ~/git/graphviz/lib/circogen/ - circularinit.c, circular.c, block.c, blocktree.c, blockpath.c, circpos.c, edgelist.c, nodelist.c
**Our port:** src/layout/circo/ (9 files, ~1517 lines)

**Scoping notes (from project baseline):** circo-simple height 105 vs 252: the C layout is much larger - block radius computation likely diverges. The equal-radius unit test fails by 0.05 (close), so the per-node placement is nearly right but the ring size is not.

**After mission 1 (see ../baseline-after-m1.md):** record/html nodes
are now label-sized at layout: circo-html-label height 91 → 111
(target 242), circo-record 91 → 92 (target 222). Remaining gap is the
ring-size computation, not node sizing.

Re-check ../baseline-after-m*.md at mission start - earlier missions
may have changed this mission's failure set.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Recon: render each owned input, diff vs ref (use test/golden/compare.ts CLI or the suite), read the C spec, write gap-analysis.md and T2..Tn task files in this directory | claude | this directory only | - | [ ] |
| T2..Tn | Port tasks defined by T1 - one C function-group each, one commit each, suite-green gate after each | claude | src/layout/circo/* (+ src/common/*, src/layout/pack/* with journal entry) | T1 | [ ] |
| T-final | Full suite; journal entry; tick README checkbox; merge branch | claude | plans/test-parity/* | T2..Tn | [ ] |

## T1 recon spec (run as-is)

Context: see ../README.md (canonical rules, gates, stop conditions)
and ../decisions.md. The C source is the spec; the test is the path.

Steps:
1. `npx vitest run test/golden/suite.test.ts -t "circo"` - capture
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
