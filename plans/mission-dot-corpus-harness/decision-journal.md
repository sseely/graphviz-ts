# Decision Journal — dot-corpus-harness

Appended during execution (per `~/.claude/rules/autonomous-execution.md`).

| Task | Date | Decision | Rationale | Flagged |
|------|------|----------|-----------|---------|
| T1 | 2026-06-19 | Scope = full recursive walk of `~/git/graphviz/tests` (805 `.gv`/`.dot`); collect only those two extensions so `.svg`/`.xdot`/`.ps`/`.png` reference outputs are excluded by construction. | Brief lists all subdirs (graphs/share/windows/nshare/linux.*/macosx/shapes-reference). `windows/`+`share/` `.gv` carry stale `pos=`/`bb=` but both oracle+port recompute, so they are valid differential inputs (not quarantined). | no |
| T1 | 2026-06-19 | Quarantine taxonomy applied via cheap structural scan only: `engine-deferred` (6, `layout=` non-dot), `multi-graph` (3, >1 top-level graph), else applicable (796). `gvpr`/`include`/`non-graph`/`raster-only-ref`/`parse-unsupported` matched 0 (no `.gvpr`/`#include` collected; parse gaps deferred to T2 per brief). | T1 must not render; obvious-non-DOT only. | no |
| T1 | 2026-06-19 | Graph-keyword regex needed `(?:di)?graph` + case-insensitive `i` flag: plain `\bgraph\b` misses `digraph` (no word boundary inside) and `diGraph` (mixed case, DOT keywords are case-insensitive). Verified b993.gv (`diGraph G{`) reclassified non-graph→applicable. | Faithful DOT lexing; subgraph still excluded (no boundary precedes inner `graph`). | no |
| T1 | 2026-06-19 | Hoisted regexes containing `{`/`}`/`"`/`//`/`/*` out of function bodies into module-scope `new RegExp` built from `String.fromCharCode`. lizard's TS tokenizer mis-reads those chars in regex literals and false-merges adjacent functions (length warning); behavior identical. Logged per global lizard-comment rule. | Quality gate `lizard -L 30` must pass; this is a known tool false positive, not a real length violation. | no |
| T1 | 2026-06-19 | LSP emits spurious `Cannot find name 'node:fs'/'process'` for test/corpus/*.ts; `tsc --noEmit` (the real gate) passes. Trusting tsc. | Standalone LSP server lacks the project's @types/node resolution. | no |
