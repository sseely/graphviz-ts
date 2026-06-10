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
| T2 | Route all engines through shape-aware init | claude | src/common/nodeinit.ts, src/common/poly-init.ts, src/layout/dot/init.ts | T1 | [ ] |
| T3 | Re-baseline; update mission 2–8 scopes | claude | plans/test-parity/* (journal, baselines) | T2 | [ ] |
