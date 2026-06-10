# Mission 5 - circo

Branch: `feature/parity-m5-circo` off `feature/ts-port`.

**Owned tests:** circo-simple, circo-star, circo-biconn, circo-disconnected, circo-record, circo-html-label + unit test src/layout/circo/circo.test.ts "equal radius"

**C spec:** ~/git/graphviz/lib/circogen/ - circularinit.c, circular.c, block.c, blocktree.c, blockpath.c, circpos.c, edgelist.c, nodelist.c

**SPEC VERSION (2026-06-10, see decision journal):** circogen is
identical between 15.0.0 and current HEAD, but if any existing TS circo
code was ported from 14.1.5: find_longest_path gained a null-guard at
15.0.0 (a24556435, returns an empty nodelist when no common ancestor
exists — 14.1.5 crashed there). Port the 15.0.0 form.
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
| T1 | Recon: gap-analysis.md (units + pipeline root causes) | claude | this directory only | - | [x] |
| T2 | Units (inches) + C pipeline (edge type, splineEdgesShifted, l_node packing, recordInit width) | claude | src/layout/circo/*, src/common/record.ts (journal) | T1 | [ ] |
| T3 | Residuals per test; equal-radius unit test; re-baseline; merge | claude | src/layout/circo/*, plans/test-parity/* | T2 | [ ] |

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
