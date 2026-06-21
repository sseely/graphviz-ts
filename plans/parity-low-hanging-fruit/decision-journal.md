# Decision Journal

Appended during execution. Every non-trivial judgment call gets a row.

| Date | Batch/Task | Decision | Rationale |
|------|------------|----------|-----------|
| 2026-06-21 | planning | scope = 5 small buckets (62 cases): color-stroke, text-content, attr-or-tag, polygon-points, parser-gap; path-structure/element-count out of scope | user choice "all small buckets"; heavy buckets are deep routing/layout, not low-hanging |
| 2026-06-21 | planning | Batch 2 sequential (not parallel) | user choice; shared golden manifest + possible shared src modules; sequential avoids all write contention |
| 2026-06-21 | planning | baseline parity (post contain_nodes fix, dot 15.1.0): byte-match 237, structural 196, diverged 320, errored 19, timeout 9 | pre-flight measurement reference for the Batch 3 regression diff |
