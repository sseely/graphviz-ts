# Mission 1 — Shared label-driven node sizing

Port C's `poly_init` size computation and route every engine through
it. This is the highest-leverage fix: wrong node sizes inflate or
shrink layouts in every family (e.g. twopi-star ellipse rx 27 vs 33.44).

Branch: `feature/parity-m1-node-sizing` off `feature/ts-port`.

No golden test is "owned" by this mission; success = suite failure
count strictly decreases (or specific first-diffs shrink) AND all 11
dot goldens still pass.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Port poly_init sizing → poly-sizing.ts + tests | claude | src/common/poly-sizing.ts (new), src/common/poly-sizing.test.ts (new) | — | [x] |
| T2 | Route all engines through shape-aware init | claude | src/common/nodeinit.ts, src/common/poly-init.ts, src/layout/dot/init.ts | T1 | [x] |
| T3 | Re-baseline; update mission 2–8 scopes | claude | plans/test-parity/* (journal, baselines) | T2 | [x] |

## Mission summary (2026-06-10)

- Tasks: 3/3 complete, one commit each (63c848f T1, aa9a988 T2, T3
  this commit).
- Outcome: suite 957/44 → 978/44. No golden flipped, but the
  cross-cutting sizing gap is closed: twopi-star/root-attr `ellipse@rx`
  27 vs 33.44 fixed, circo-html-label height 91 → 111, and every
  engine now sizes every node from its label exactly as C
  common_init_node does. All 11 dot goldens stayed green.
- Decisions flagged for review: none blocking; see decision-journal
  entries for skipped C hooks (cylinder size_gen, image sizing) and
  the measurer-less fallback path.
- Quality gates: tsc clean, suite green-or-baseline after every task,
  write-set respected (osage call site journal-logged).
