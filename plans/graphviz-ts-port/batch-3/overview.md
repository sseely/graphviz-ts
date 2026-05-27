# Batch 3 — DOT Parser

## Summary

Batch 3 implements the DOT language parser as a Peggy-generated PEG grammar
derived directly from the Bison/Flex source in `lib/cgraph/`. The grammar
file is the canonical faithfulness artifact for the parser — every production
is annotated with its Bison equivalent so divergence can be detected by
inspection.

Batch 3 runs in parallel with Batch 2. Both depend only on Batch 1.

Within the batch, T12 (grammar) must complete before T13 (TypeScript wrapper)
can start, because T13 wraps the parser generated from T12's `.pegjs` file and
imports from the model types in `src/model/`.

## Dependencies

- Requires: Batch 1 complete
- Parallel with: Batch 2
- Blocks: Batch 4

## Task Table

| ID | Description | ‖/→ | Writes | Depends On |
|----|-------------|-----|--------|------------|
| T12 | Peggy grammar file (dot.pegjs) | ‖ | src/parser/dot.pegjs | — |
| T13 | Parser TypeScript wrapper + tests | → T12 | src/parser/index.ts, src/parser/parser.test.ts | T12 |
