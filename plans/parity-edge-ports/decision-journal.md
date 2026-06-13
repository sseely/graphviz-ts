# Decision Journal

Append-only. One row per non-trivial judgment call made during
execution. "Non-trivial" means a reasonable developer might have chosen
differently.

| Task | Date | Decision | Rationale | Flagged |
|------|------|----------|-----------|---------|
| — | 2026-06-13 | Baseline adapted: brief assumed 1466/0 + 82 goldens, but render-styling + multicolor-paint + 3 edge follow-ups merged to main since. Real baseline is **1720/0 + 115 goldens**. Gates use these; byte-stability vs the 115. Branch off **main** (post-parity already merged), not feature/post-parity. | Mission was planned before the intervening missions landed. | — |
| T1,T2 | 2026-06-13 | Batch 1 done inline (small wiring): T1 builder.ts portStringOf → tailport/headport attrs (explicit wins); T2 chkPort + initEdgePorts (exported) at top of initEdgeLabels, runs every edge. portfn type is `compass: string` (not `string\|null` per AD4) and types.ts is outside T2's write-set → pass `''` for C NULL (no-colon case); compassPort (T3) must treat ''/NULL alike. tsc 0; vitest 1730/0; 115 goldens byte-identical (no-port edges → default Center port, unchanged). | AD4 type already differs from brief; '' avoids touching types.ts out of write-set. | — |
