# Batch 1 — foundations (parallel)

Three foundation tasks, disjoint write-sets. None changes rendered
output for existing inputs: the 72-golden byte-stability probe must
pass byte-identical for every task.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Unified make_label entry ([T1-make-label.md](T1-make-label.md)) | sonnet | src/common/make-label.ts, src/common/poly-init.ts (+tests) | — | [x] |
| T2 | Variant-aware measurement ([T2-measure-variants.md](T2-measure-variants.md)) | sonnet | src/common/textmeasure.ts, src/common/htmltable.ts (+tests) | — | [x] |
| T3 | Lex/parse/types completeness ([T3-lex-parse-types.md](T3-lex-parse-types.md)) | sonnet | src/common/htmltable-lex.ts, htmltable-parse.ts, htmltable-types.ts (+tests) | — | [x] |
