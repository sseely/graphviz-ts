# Batch 1 — the two 1949 fixes

Both tasks are independent (disjoint write-sets) and may run in parallel.
Each is one commit. Diagnosis (Batch 0) is complete; see
`.agent-notes/1949-diagnosis.md`.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | D1: decode HTML entities in HTML-label text runs | done | `src/common/htmltable-lex.ts`, `src/common/html-entities.ts`, `make-label.ts` | — | [x] |
| T2 | D2: cell-border color inherits node pen color | done | `src/common/make-label.ts`, `src/common/htmltable-pos.ts` | — | [x] |

Verification (after both): `1949` must stay layout-valid and move toward
byte-match; run the survey gate — 0 net regressions, and 1949's
`maxDelta`/`firstDiff` must improve (ideally to byte-match).

Note: T1's `htmlEntityUTF8` currently lives in `make-label.ts`; importing it
into the lexer is allowed (read-only use, no signature change). If a circular
import appears, move `htmlEntityUTF8` + `html-entities` usage is already in
`make-label.ts` which imports from `html-entities.ts` — import the decoder
from there rather than creating a cycle.
