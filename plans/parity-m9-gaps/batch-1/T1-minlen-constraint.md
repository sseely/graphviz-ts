# T1 — minlen + constraint attribute initialization

## Context

graphviz-ts: faithful browser-targeted TS port of C graphviz; C source at
~/git/graphviz/lib is the spec. Vitest 1.6, strict TS, tests co-located.
Suite baseline 1054/0.

The dot engine's downstream plumbing for `minlen` and `constraint` is
already ported and correct — but the attributes are NEVER READ from the
parsed graph, so `e.info.minlen` stays at the default 1 and
`e.info.constraint` stays undefined:

- C reads minlen at lib/dotgen/dotinit.c:85 — `ED_minlen(e) =
  late_int(e, E_minlen, 1, 0)` (default 1, min 0); attr handle from
  lib/common/input.c:779.
- C constraint predicate: lib/dotgen/rank.c:587-597 `is_nonconstraint`
  (attr present, non-empty, and !mapbool → true).
- Port: src/layout/dot/init.ts:86 hardcodes `e.info.minlen ??= 1`; the
  consumers (rank-dot2.ts xgMerge/eMinlen, classify.ts:59
  nonconstraintEdge / class1Edge skip) already exist.

## Task

In src/layout/dot/init.ts, before the existing defaulting, read the
edge attrs and populate `e.info.minlen` (late_int semantics: integer,
default 1, minimum 0) and `e.info.constraint` (mapbool semantics —
match C's mapbool in lib/common/utils.c; port it locally if no TS
equivalent exists yet, or reuse one if it does — grep `mapbool` under
src/ first). Match dotinit.c's initialization order. TDD: write the
failing tests first in a NEW file src/layout/dot/attr-init.test.ts.

Verify the two quarantined goldens now pass WITHOUT touching
test/golden/: run the comparison directly (see how
test/golden/suite.test.ts invokes compare.ts and call the same helpers
against test/golden/quarantine/dot-minlen.{dot,svg} and
dot-constraint-false.{dot,svg}) — e.g. a throwaway script under
.probes/ (untracked). Report the result; T5 does the promotion.

## Write-set

src/layout/dot/init.ts, src/layout/dot/attr-init.test.ts (new),
.probes/* (untracked, throwaway)

## Read-set

~/git/graphviz/lib/dotgen/dotinit.c:60-110; ~/git/graphviz/lib/dotgen/
rank.c:580-600; ~/git/graphviz/lib/common/utils.c (mapbool);
src/layout/dot/init.ts; src/layout/dot/classify.ts:50-130;
test/golden/suite.test.ts + test/golden/compare.ts (comparison entry
points, read-only)

## Architecture decisions

AD5 (promotion is T5's job, not yours). C-is-sacred: late_int/mapbool
semantics exactly, including mapbool's accepted spellings.

## Interface contract (consumed by T5)

Report: per golden (dot-minlen, dot-constraint-false) — PASS/FAIL with
maxDelta. T5 promotes only on your reported PASS.

## Acceptance criteria

- Given `A->B[minlen=2]`, when ranks are assigned, then b.rank - a.rank
  = 2 and the quarantined dot-minlen comparison passes at dot tolerance
- Given `A->B[constraint=false]`, when ranks are assigned, then the
  edge is skipped in ranking but still routed; quarantined comparison
  passes
- Given `minlen="0"` and invalid values, then late_int semantics hold
  (unit tests)
- Given the existing 57 goldens, when the suite runs, then 1054+/0
  (default path unchanged)

## Observability: N/A. Rollback: Reversible.

## Quality bar

npx tsc --noEmit clean; npx vitest run green. Commit:
`feat(T1): read minlen and constraint edge attrs in dot init`
