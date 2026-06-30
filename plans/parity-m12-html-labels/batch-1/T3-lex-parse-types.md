# T3 — html lexer/parser/types completeness

## Context

graphviz-ts port; C at ~/git/graphviz/lib (15.0.0) is the spec. Suite
baseline 1254/0, 72 goldens. Hook rule: smallest fix, ≤2 attempts per
file, then move on.

Recon (plans/parity-html-labels/SCOPE.md §3): htmltable-lex.ts /
htmltable-parse.ts are PARTIAL ports of htmllex.c (1127 LOC) /
htmlparse.y (529 LOC). Known-missing: GRADIENTANGLE (htmllex.c:220)
and SIDES (htmllex.c:498) attributes; PORT attr storage; image size
fields. The C source defines completeness — while in these three
files, port any OTHER small attr/grammar gaps you find vs the C lexer
attribute tables (push-forward condition; journal-worthy, list them
in your report).

## Task

1. Lex: add GRADIENTANGLE and SIDES to the attribute tables matching
   htmllex.c handling (value parsing, validation, warnings — C warns
   on bad values; match it).
2. Types: add the fields to htmltable-types.ts (table + cell level per
   C html_tbl_t/html_cell_t); PORT attr storage per AD6 (store only —
   no attachment semantics); image dimension fields on HtmlImage per
   AD3 prep.
3. Parse: populate the new fields in htmltable-parse.ts per
   htmlparse.y.
4. Sweep the C attribute tables (htmllex.c) against the TS tables;
   port any further missing attrs into the same three files
   (push-forward, journaled). Anything requiring files OUTSIDE the
   three: report, do not touch.
5. TDD: failing tests first.

## Write-set (strict — nothing else)

src/common/htmltable-lex.ts, src/common/htmltable-parse.ts,
src/common/htmltable-types.ts, + co-located test files.

## Read-set

~/git/graphviz/lib/common/htmllex.c (attribute tables, :200-520);
~/git/graphviz/lib/common/htmlparse.y; ~/git/graphviz/lib/common/
htmltable.h (html_tbl_t/html_cell_t/html_img_t fields);
src/common/htmltable-lex.ts; src/common/htmltable-parse.ts;
src/common/htmltable-types.ts

## Architecture decisions

AD4 (GRADIENTANGLE: parse+store; paint deferred), AD6 (PORT:
parse+store; attachment deferred), AD3 (image fields prep).

## Interface contract (consumed by T6, T7)

Table/cell types expose gradientangle, sides (C encoding), port name,
image src/scale fields — names mirroring C struct fields (camelCase).

## Acceptance criteria

- Given `<TABLE GRADIENTANGLE="90" SIDES="LT">`, when parsed, then
  fields populated per C semantics (SIDES bitmask matches C encoding)
- Given `<TD PORT="p1">`, then the cell stores the port name
- Given invalid attr values, then warnings match C behavior
- Given existing html inputs, then parse output unchanged; suite 0
  failed; 72 goldens conformant

## Observability / rollback

N/A — library; gates are the SLI. Reversible (single commit).

## Quality bar

npx tsc --noEmit clean; npx vitest run 0 failed; byte-stability probe
clean. Commit (orchestrator): `feat(T3): complete html lexer/parser
attrs (gradientangle, sides, port, img)`
