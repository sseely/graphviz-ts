# Batch 2 — dispatch + font flags (parallel, after batch 1)

Disjoint write-sets. T4 consumes T1's unified entry; T5 consumes T2's
variant measurement. After this batch the live node-html path renders
bold/italic correctly — the 0.4pt AD5 hypothesis gets its first
informal check here (T9 formalizes it).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T4 | Creation dispatch, 7 slots ([T4-creation-dispatch.md](T4-creation-dispatch.md)) | sonnet | src/common/nodeinit.ts, edge-label-init.ts, src/layout/dot/graph-label.ts (+tests) | T1 | [x] |
| T5 | Font-flag chain pos→emit ([T5-font-flags.md](T5-font-flags.md)) | sonnet | src/common/htmltable-pos.ts, htmltable-emit.ts, src/render/svg-helpers.ts (+tests) | T2 | [x] |
