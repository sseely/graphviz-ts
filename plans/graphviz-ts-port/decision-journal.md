# Decision Journal

Append one row per non-trivial judgment call made during execution.
"Non-trivial" means a reasonable developer might have chosen differently.

| Date | Task | Decision | Rationale | Outcome |
|------|------|----------|-----------|---------|
| 2026-05-27 | T19 | AC3 spec says "color not modified on unknown" but C source (colxlate.c:369) sets black/opaque on COLOR_UNKNOWN. Test written to match C source behavior. | C source is canonical spec per mission brief; T19 spec doc was incorrect. | Test asserts color IS set to black/opaque on unknown input — matches C behavior. |
