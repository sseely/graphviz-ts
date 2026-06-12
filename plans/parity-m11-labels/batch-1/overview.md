# Batch 1 — label creation (parallel)

Three creation sites, disjoint write-sets. All use the existing
`makeLabel` (src/common/make-label.ts) — plain text only per D2.
Every task's gate includes the 67-golden byte-stability probe: with no
label attributes present, output must not change.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | ND_xlabel creation ([T1-node-xlabel.md](T1-node-xlabel.md)) | sonnet | src/common/nodeinit.ts (+ its test file) | — | [ ] |
| T2 | ED_label + ED_xlabel creation ([T2-edge-labels.md](T2-edge-labels.md)) | sonnet | src/common/edge-label-init.ts (+ its test file) | — | [ ] |
| T3 | root doGraphLabel + place_root_label ([T3-graph-label.md](T3-graph-label.md)) | sonnet | src/layout/dot/init.ts, src/common/postproc.ts (+ postproc.test.ts) | — | [ ] |
