# Batch 1 — aux flat-edge label vnode

Two sequential tasks, one executor (inline — deep C ground truth in
session). T2 depends on T1 (label must be correctly positioned in the aux
before the copy-back surfaces it).

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1 | reposition aux label vnode onto spline (DOT-12) | inline | regular-edge router (`edge-route*.ts`) + test | — | [ ] |
| T2 | copy label back (DOT-10) | inline | `splines-flat.ts`, `splines-label.ts`, `splines-flat.test.ts` | T1 | [ ] |

## C spec anchors

- aux routing loop / `make_regular_edge` — `dotsplines.c:411,419,1700+`
- vnode reposition — inside `make_regular_edge` (pin exact line via harness)
- label copy-back — `dotsplines.c:1273-1277`

## Diagnosis artifacts (planning session)

- C aux label vnode: position (33,66.38) → reposition (33,45) → **after
  routing (11.71,45)** → label (19.96,45) → final (72,−32.91).
- TS aux label vnode: stays (51,72) → label (60.75,59.25) → final (72,−54.2).
- Spline conformant on main (DOT-11a). Only the label vnode x-reposition
  is missing in TS.
