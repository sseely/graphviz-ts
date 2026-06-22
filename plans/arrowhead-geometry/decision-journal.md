# Decision Journal

Appended during execution. Every non-trivial judgment call gets a row.

| Date | Batch/Task | Decision | Rationale |
|------|------------|----------|-----------|
| 2026-06-21 | planning | scope = full Arrowtypes table (8 types + modifiers + compound + arrowsize); fix 16 deep arrowhead-geometry cases | user choice "port the full arrow-type table" |
| 2026-06-21 | planning | geometry at layout time, centralized in arrows-shapes.ts (ADR-2); typed draw-op list (ADR-1); type-aware clip length (ADR-4) | confirmed in Phase 3 |
| 2026-06-21 | planning | baseline parity (post low-hanging-fruit, dot 15.1.0): byte-match 245, structural 219, diverged 295, errored 13, timeout 9, oracle-error 15 | pre-flight reference for the Batch 3 regression diff |
