# Mission 4 - twopi

Branch: `feature/parity-m4-twopi` off `feature/ts-port`.

**Owned tests:** twopi-star, twopi-chain, twopi-tree, twopi-ranksep, twopi-root-attr, twopi-disconnected + unit test src/layout/twopi/twopi.test.ts "hub at origin"

**C spec:** ~/git/graphviz/lib/twopigen/circle.c, twopiinit.c (small)
**Our port:** src/layout/twopi/ (6 files, ~894 lines)

**Scoping notes (from project baseline):** twopi-chain cy is -306 vs -18: placement is wrong, not just sizing (chain root should sit at origin-ish). The failing unit test (hub at (0,0), actual 68.9) points at the same root-placement bug. Per D5, if the unit test contradicts C behavior, fix the test; but first assume the test encodes C behavior here.

**After mission 1 (see ../baseline-after-m1.md):** node sizing is fixed
— twopi-star/twopi-root-attr no longer diff at `ellipse@rx` (27 vs
33.44). All three of star/root-attr/tree now first-diff at
`svg/g[1]/g[3][childCount]` 1 vs 2: an edge `<g>` is missing a child
(likely the edge label or arrowhead element group). chain/disconnected/
ranksep diffs unchanged.

Re-check ../baseline-after-m*.md at mission start - earlier missions
may have changed this mission's failure set.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Recon: gap-analysis.md + tasks | claude | this directory only | - | [x] |
| T2 | setEdgeType + spline_edges wrapper + working clipping (96d20fb) | claude | src/layout/twopi/*, src/common/*, src/model/edgeInfo.ts, src/render/* (journal) | T1 | [x] |
| T3 | ranksep via ccomps root fix (7c28a30) | claude | src/layout/pack/index.ts (journal) | T2 | [x] |
| T4 | chain fan order (agfstedge) + unit test per D5 (62e08a5) | claude | src/layout/twopi/circle.ts, twopi.test.ts | T3 | [x] |
| T5 | polyomino component packing (9fb539f) | claude | src/layout/pack/* (journal), src/layout/twopi/pipeline.ts | T4 | [x] |
| T6 | Verify; re-baseline; tick README; merge | claude | plans/test-parity/* | T2-T5 | [x] |

## Mission summary (2026-06-10)

- Tasks: 6 (recon 8a582ef, then 96d20fb, 7c28a30, 62e08a5, 9fb539f,
  T6 this commit). Suite 990/32 → 997/25; all 6 twopi goldens + both
  twopi/circo-adjacent unit tests owned by this mission pass.
- The mission turned out to be mostly CROSS-CUTTING infrastructure:
  working edge clipping (poly_inside, clip write-back, Center-port
  clip, outline extents), the C spline_edges wrapper, and the
  polyomino component packer — missions 5-8 all consume these.
- Deviations documented in the journal: polygon walk on base ring,
  no rankdir rotation in poly_inside, genPoly l_clust block and
  doSplines edge-fill not ported (no callers yet).
- Gates: tsc clean and 11 dot goldens green after every commit; one
  unit test updated per D5 (hub-at-origin asserted pre-shift coords).

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
