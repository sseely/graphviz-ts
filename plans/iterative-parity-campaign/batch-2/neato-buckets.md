# neato — attribution buckets

Generated from `test/corpus/attribution-neato.json` (oracle sha1 `5caf7a368dae`, tolerance 0.5).

## Verdicts

| verdict | ids |
|---|---|
| drift-exonerated | 121 |
| not-cleared | 364 |
| harness-error | 3 |
| **total diverged** | **488** |

## Mechanism split (not-cleared)

`count` (a structural diff — the port failed to emit an element): **286**  
`position` (every diff numeric — right elements, drifting coordinates): **78**

Buckets are keyed on `signature` (the full sorted set of `objectType/attr/kind`),
NOT on `shape` (first diff only) — `shape` collapses unrelated mechanisms.

## Families, largest first

| ids | signature | kind |
|---|---|---|
| 121 | `cluster/_draw_/numeric+cluster/_ldraw_/numeric+cluster/bb/numeric+edge/_draw_/numeric+edge/_hdraw_/numeric+edge/pos/numeric+…(12)` | position |
| 53 | `edge/_draw_/numeric+edge/_hdraw_/numeric+edge/pos/numeric` | position |
| 43 | `edge/_ldraw_/structural` | count |
| 25 | `graph/_draw_/numeric+graph/_ldraw_/structural+graph/bb/numeric` | count |
| 17 | `edge/_draw_/numeric+edge/_hdraw_/numeric+edge/pos/numeric+graph/_draw_/numeric+graph/bb/numeric+node/_draw_/numeric+…(8)` | position |
| 16 | `edge/_draw_/numeric+edge/_hdraw_/numeric+edge/pos/numeric+graph/_draw_/numeric+graph/_ldraw_/structural+graph/bb/numeric+…(9)` | count |
| 16 | `edge/_draw_/numeric+edge/_hdraw_/numeric+edge/_ldraw_/structural+edge/pos/numeric+graph/_draw_/numeric+graph/_ldraw_/structural+…(10)` | count |
| 10 | `edge/_ldraw_/structural+graph/_draw_/numeric+graph/bb/numeric` | count |
| 7 | `edge/_draw_/numeric+edge/_hdraw_/numeric+edge/_ldraw_/structural+edge/pos/numeric+graph/_draw_/numeric+graph/bb/numeric+…(9)` | count |
| 7 | `cluster/_draw_/numeric+cluster/_ldraw_/numeric+cluster/bb/numeric+graph/_draw_/numeric+graph/_ldraw_/structural+graph/bb/numeric+…(9)` | count |
| 5 | `edge/_draw_/structural+edge/_hdraw_/numeric+edge/_hldraw_/structural+edge/_tdraw_/numeric+edge/_tldraw_/structural+edge/pos/structural` | count |
| 4 | `edge/_draw_/numeric+edge/pos/numeric` | position |

