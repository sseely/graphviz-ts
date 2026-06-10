# Mission 6 - neato

Branch: `feature/parity-m6-neato` off `feature/ts-port`.

**Owned tests:** neato-simple, neato-weighted, neato-diamond, neato-circle, neato-polygon, neato-cluster, neato-disconnected

**C spec:** ~/git/graphviz/lib/neatogen/ - neatoinit.c, stress.c (mode=major default), kkutils.c, matinv.c, distances via shortest paths; lib/common drand48 usage
**Our port:** src/layout/neato/ (15 files, ~3710 lines)

**Scoping notes (from project baseline):** FIRST TASK after recon: port srand48/drand48 to src/common/random.ts (shared with m7/m8) and replace any Math.random in layout code. Tolerance 0.5pt requires exact replication of initial placement (C: random with fixed seed via start=regular?) and majorization iterations. Check what GD_drawing/start attr defaults the refs imply.

After mission 1: failure set and first diffs for this family are
unchanged (small labels were already at default node size) - see
../baseline-after-m1.md.

Re-check ../baseline-after-m*.md at mission start - earlier missions
may have changed this mission's failure set.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Recon: gap-analysis.md (oracle fingerprint, call path) | claude | this directory only | - | [x] |
| T2 | src/common/random.ts: exact drand48/srand48 + tests | claude | src/common/random.ts(+test) | T1 | [x] |
| T3 | stress.c parity: distance matrix, jitter/init draw order, CG kernel, convergence | claude | src/layout/neato/* | T2 | [x] |
| T4 | pipeline tail: spline wrapper, packing, clusters | claude | src/layout/neato/* | T3 | [x] |
| T5 | verify 7 goldens; re-baseline; merge | claude | plans/test-parity/* | T4 | [x] |

## T1 recon spec (run as-is)

Context: see ../README.md (canonical rules, gates, stop conditions)
and ../decisions.md. The C source is the spec; the test is the path.

Steps:
1. `npx vitest run test/golden/suite.test.ts -t "neato"` - capture
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

## Mission summary (2026-06-10)

- Suite 1004/18 -> 1013/11; all 7 neato goldens pass.
- The float32 stress kernel reproduces C bit-for-bit (oracle stress
  traces and -Tplain positions match digit-for-digit); drand48 ported
  exactly and libc-verified. Divergences were isolated with the
  installed 15.0.0 oracle via -Gmaxiter bisection and -Gnotranslate.
- fdp/sfdp (missions 7-8) inherit: random.ts, the stress kernel,
  matrix-ops, effective-polygon shape_info, outline-ring clipping,
  spline-aware component packing.
