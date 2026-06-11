# Batch 1 — Attribute init, self-loops, rankdir recon, promotion

T1–T4 run in parallel (disjoint write-sets); T5 runs after T1–T3 and owns
test/golden/ for the batch.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | minlen + constraint attr init ([T1-minlen-constraint.md](T1-minlen-constraint.md)) | sonnet | src/layout/dot/init.ts, src/layout/dot/attr-init.test.ts (new) | — | [~]¹ |
| T2 | dot self-loop routing ([T2-dot-self-loop.md](T2-dot-self-loop.md)) | sonnet | src/layout/dot/edge-route.ts, src/layout/dot/splines.ts, src/layout/dot/self-loop.test.ts (new) | — | [x]² |
| T3 | twopi/circo self-loop divergence debug+fix ([T3-twopi-circo-self-loop.md](T3-twopi-circo-self-loop.md)) | sonnet | src/layout/neato/splines.ts, src/layout/twopi/pipeline.ts, src/layout/circo/index.ts (as root cause dictates), .probes/* (untracked), new co-located test | — | [~]³ |
| T4 | rankdir TB-translation recon ([T4-rankdir-recon.md](T4-rankdir-recon.md)) | sonnet | .agent-notes/rankdir-tb-translation-2026-06.md (read-only otherwise) | — | [x] |
| T5 | promote batch-1 goldens ([T5-promote-goldens.md](T5-promote-goldens.md)) | sonnet | test/golden/manifest.json, test/golden/suite.test.ts, test/golden/inputs/*, test/golden/refs/*, test/golden/quarantine/* (moves/deletes) | T1, T2, T3 | [x]⁴ |

¹ T1 code complete + committed (1ecb5af); dot-constraint-false PASS and
promoted. dot-minlen still FAILS (4.32pt node-position offset, distinct
emitter/position bug — see .agent-notes/dot-minlen-offset-2026-06.md).
Deviation: dot.test.ts expectation fix outside write-set (journaled).
² T2 complete + committed (9fb1e2e); dot-self-loop exact PASS, promoted.
Deviation: new module src/layout/dot/self-loop.ts (journaled).
³ T3 partial + committed (d5ecf99): circo-self-loop PASS (nodesep 16→18),
promoted. twopi-self-loop still FAILS (18pt viewBox) — fix is outside
the T3 write-set (STOP condition, see journal Bug 2 entry).
⁴ T5 promoted the 3 PASS goldens (manifest 57→60) + re-baselined the
fdp-tiny-self-loop port-pin (d2305d6); 2 goldens stay quarantined.

Write-set conflict check: T1 owns init.ts; T2 owns edge-route/splines;
T3 owns neato/twopi/circo spline files; T4 writes only a notes file;
T5 alone touches test/golden/. No overlaps.
