# Batch 1 — Attribute init, self-loops, rankdir recon, promotion

T1–T4 run in parallel (disjoint write-sets); T5 runs after T1–T3 and owns
test/golden/ for the batch.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | minlen + constraint attr init ([T1-minlen-constraint.md](T1-minlen-constraint.md)) | sonnet | src/layout/dot/init.ts, src/layout/dot/attr-init.test.ts (new) | — | [ ] |
| T2 | dot self-loop routing ([T2-dot-self-loop.md](T2-dot-self-loop.md)) | sonnet | src/layout/dot/edge-route.ts, src/layout/dot/splines.ts, src/layout/dot/self-loop.test.ts (new) | — | [ ] |
| T3 | twopi/circo self-loop divergence debug+fix ([T3-twopi-circo-self-loop.md](T3-twopi-circo-self-loop.md)) | sonnet | src/layout/neato/splines.ts, src/layout/twopi/pipeline.ts, src/layout/circo/index.ts (as root cause dictates), .probes/* (untracked), new co-located test | — | [ ] |
| T4 | rankdir TB-translation recon ([T4-rankdir-recon.md](T4-rankdir-recon.md)) | sonnet | .agent-notes/rankdir-tb-translation-2026-06.md (read-only otherwise) | — | [ ] |
| T5 | promote batch-1 goldens ([T5-promote-goldens.md](T5-promote-goldens.md)) | sonnet | test/golden/manifest.json, test/golden/suite.test.ts, test/golden/inputs/*, test/golden/refs/*, test/golden/quarantine/* (moves/deletes) | T1, T2, T3 | [ ] |

Write-set conflict check: T1 owns init.ts; T2 owns edge-route/splines;
T3 owns neato/twopi/circo spline files; T4 writes only a notes file;
T5 alone touches test/golden/. No overlaps.
