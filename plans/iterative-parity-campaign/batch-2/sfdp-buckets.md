# sfdp — attribution buckets

Generated from `test/corpus/attribution-sfdp.json` (oracle sha1 `5caf7a368dae`, tolerance 0.5).

## Verdicts

| verdict | ids |
|---|---|
| drift-exonerated | 113 |
| not-cleared | 373 |
| harness-error | 3 |
| **total diverged** | **489** |

## Mechanism split (not-cleared)

`count` (a structural diff — the port failed to emit an element): **291**  
`position` (every diff numeric — right elements, drifting coordinates): **82**

Buckets are keyed on `signature` (the full sorted set of `objectType/attr/kind`),
NOT on `shape` (first diff only) — `shape` collapses unrelated mechanisms.

## Families, largest first

| ids | signature | kind |
|---|---|---|
| 138 | `edge/_draw_/numeric+edge/_hdraw_/numeric+edge/pos/numeric+graph/_draw_/numeric+graph/_ldraw_/structural+graph/bb/numeric+…(9)` | count |
| 46 | `edge/_ldraw_/structural` | count |
| 31 | `edge/_draw_/numeric+edge/_hdraw_/numeric+edge/pos/numeric` | position |
| 24 | `graph/_draw_/numeric+graph/_ldraw_/structural+graph/bb/numeric` | count |
| 16 | `edge/_draw_/numeric+edge/_hdraw_/numeric+edge/_ldraw_/structural+edge/pos/numeric+graph/_draw_/numeric+graph/_ldraw_/structural+…(10)` | count |
| 12 | `edge/_draw_/numeric+edge/_hdraw_/numeric+edge/pos/numeric+graph/_draw_/numeric+graph/bb/numeric+node/_draw_/numeric+…(8)` | position |
| 12 | `edge/_draw_/numeric+edge/_hdraw_/numeric+edge/pos/numeric+node/_draw_/numeric+node/_ldraw_/numeric+node/pos/numeric` | position |
| 10 | `edge/_draw_/numeric+edge/pos/numeric` | position |
| 10 | `edge/_ldraw_/structural+graph/_draw_/numeric+graph/bb/numeric` | count |
| 8 | `graph/_draw_/numeric+graph/_ldraw_/structural+graph/bb/numeric+node/_draw_/numeric+node/_ldraw_/numeric+node/pos/numeric` | count |
| 7 | `edge/_draw_/numeric+edge/_hdraw_/numeric+edge/pos/numeric+graph/_draw_/numeric+graph/bb/numeric+node/_draw_/numeric+…(10)` | position |
| 6 | `edge/_draw_/structural+edge/_hdraw_/numeric+edge/_hldraw_/structural+edge/_tdraw_/numeric+edge/_tldraw_/structural+edge/pos/structural` | count |

