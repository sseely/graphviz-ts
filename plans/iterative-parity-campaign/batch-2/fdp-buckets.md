# fdp — attribution buckets

Generated from `test/corpus/attribution-fdp.json` (oracle sha1 `5caf7a368dae`, tolerance 0.5).

## Verdicts

| verdict | ids |
|---|---|
| drift-exonerated | 4 |
| not-cleared | 424 |
| harness-error | 1 |
| **total diverged** | **429** |

## Mechanism split (not-cleared)

`count` (a structural diff — the port failed to emit an element): **305**  
`position` (every diff numeric — right elements, drifting coordinates): **119**

Buckets are keyed on `signature` (the full sorted set of `objectType/attr/kind`),
NOT on `shape` (first diff only) — `shape` collapses unrelated mechanisms.

## Families, largest first

| ids | signature | kind |
|---|---|---|
| 169 | `graph/_draw_/numeric+graph/_ldraw_/structural+graph/bb/numeric` | count |
| 40 | `graph/_draw_/numeric+graph/bb/numeric` | position |
| 37 | `edge/_ldraw_/structural` | count |
| 33 | `edge/_draw_/numeric+edge/_hdraw_/numeric+edge/pos/numeric` | position |
| 17 | `edge/_ldraw_/structural+graph/_draw_/numeric+graph/bb/numeric` | count |
| 16 | `edge/_draw_/numeric+edge/_hdraw_/numeric+edge/_ldraw_/structural+edge/pos/numeric+graph/_draw_/numeric+graph/_ldraw_/structural+…(7)` | count |
| 11 | `edge/_draw_/numeric+edge/_hdraw_/numeric+edge/pos/numeric+graph/_draw_/numeric+graph/bb/numeric+node/_draw_/numeric+…(8)` | position |
| 10 | `edge/_draw_/numeric+edge/_hdraw_/numeric+edge/pos/numeric+graph/_draw_/numeric+graph/bb/numeric` | position |
| 9 | `edge/_draw_/structural+edge/_hdraw_/numeric+edge/pos/structural` | count |
| 8 | `cluster/_draw_/numeric+cluster/bb/numeric+graph/_draw_/numeric+graph/bb/numeric` | position |
| 6 | `cluster/_draw_/numeric+cluster/_ldraw_/numeric+cluster/bb/numeric+graph/_draw_/numeric+graph/bb/numeric` | position |
| 4 | `edge/_draw_/numeric+edge/_draw_/structural+edge/_hdraw_/numeric+edge/pos/numeric+edge/pos/structural+graph/_draw_/numeric+…(7)` | count |

