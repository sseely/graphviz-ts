# Decision Journal

Append one row per non-trivial judgment call made during execution.
"Non-trivial" means a reasonable developer might have chosen differently.

| Date | Task | Decision | Rationale | Outcome |
|------|------|----------|-----------|---------|
| 2026-05-27 | T19 | AC3 spec says "color not modified on unknown" but C source (colxlate.c:369) sets black/opaque on COLOR_UNKNOWN. Test written to match C source behavior. | C source is canonical spec per mission brief; T19 spec doc was incorrect. | Test asserts color IS set to black/opaque on unknown input — matches C behavior. |
| 2026-05-28 | T14-fix | vispath.ts: added `if (min === -1) break` in dijkstra and undefined/-1 guards in countPath/extractPath. Dijkstra on disconnected visibility graphs returns dad[V]===-1; JS `dad[-1]` is `undefined` (unlike C's allocated memory), causing infinite loop. Fix matches C intent. | AD-13: never change test assertions; fix implementation. Disconnected path returns direct [p0,p1]. | 51/51 pathplan tests pass. |
| 2026-05-28 | T14-fix | triang.ts: added signedArea helper; `triangulate` reverses polygon when area>0 (Y-up CCW). `isdiagNeighborhood` requires Y-up CW winding; graphviz always pre-normalizes in production, but test polygons were Y-up CCW. Normalization added at `triangulate` entry. | C `Ptriangulate` does not normalize — graphviz callers do. TypeScript port adds it inside `triangulate` to be defensive and match caller contracts. | CCW square→2 tris and CCW pentagon→3 tris both pass. |
| 2026-05-28 | T20 | HTML label parser split into 3 files (lex/types/parse) plus entry point htmltable.ts to stay under the 500-line file limit enforced by check-complexity.py. | Single file would exceed 500 lines. Split at natural layer boundaries. | 4/4 acceptance tests pass; complexity hook clean. |
