# Decision Journal — Structured Errors

Append one row per non-trivial judgment call made during execution.

| When | Task | Decision | Rationale |
|------|------|----------|-----------|
| start | plan | Execute T1→T4 directly (not via typescript-pro subagents) | Each task is a small, well-scoped contract file <30min; full design context already loaded. parallelism.md: default single-agent, no demonstrated bottleneck. Batch 2 (T2/T3) touch distinct files but are small enough to do inline sequentially. |
| T2 | T2 | Token-level SYNTAX_ERROR test uses `digraph { @ }` not `123abc` | `123abc` parses cleanly (lexer accepts it as an ID); `@` is the simplest input that yields a peggy error with `found !== null` + a populated `expected[]`. |
| T4 | T4 | `classifyError` GENERIC fallback, render-stage GvError-passthrough, and the non-Error `String()` coercions are genuinely unreachable via the public API (parse only throws ParseError; renderSvg normalizes every render-stage throw to GvError-like). Kept per ADR-3 + the render-wrap spec; isolated into `v8 ignore`d helpers + `v8 ignore next` on the two unreachable call/branch lines, documented inline. | Brief mandates these defensive paths (spec = completeness), but no DOT input reaches them. Coverage counts only reachable branches (100% 8/8) rather than reporting a false gap or adding an unlisted public export to force a test. |
