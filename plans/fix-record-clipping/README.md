# Mission: record-shape nodes clip under rankdir=LR (clipping watchlist)

## Status: DONE (2026-06-27)

Root cause: C's `record_init` sets only `ND_width`/`ND_height`; `ND_lw/rw/ht` come
from `gv_nodesize(n, GD_flip)` which **swaps width↔height under rankdir=LR/RL**.
The port's `recordInit` set `lw/rw/ht` directly from the record's field-flipped
size (unflipped), so the node stayed un-rotated while `gvPostprocess` rotated the
bbox → transposed (too-narrow) bbox → record drew outside the viewport.

Fix (one site, `src/common/record.ts:recordInit`): derive `lw/rw/ht` via
`gvNodesize(info.size.x, info.size.y+1, GD_flip)`, exactly as C does. TB records
unchanged (flip=false is a no-op). Result: `record-LR`/`record-TB` conformant;
**925/hashtable/records clipOverflow → 0**; corpus **conformant 450→454**, 5
graphs diverged→structural-match (b56, b57, triedds family), **0 regressions**,
**clip-watch 15→4** (only fuzzer-garbage/diverged remain). Regression test:
`src/common/record-flip.test.ts`.

## Objective

Fix the dot port so `shape=record` nodes no longer render geometry **outside the
viewport**. The clipping gate (`test/corpus/rules-gate.ts`, added 2026-06-27)
flags these on the `clip-watch` list: the port's graph bbox is far smaller than
the record content, so record field separators and boxes draw beyond the SVG
canvas.

Move the affected graphs off `clip-watch` (port `clipOverflow ≤ 4pt`), matching
headless dot 15.1.0 within the survey's structural-match bar, with **zero gate
regressions** (verdict or clipping).

## Targets

| corpus id | path | clipOverflow | note |
|---|---|---|---|
| **925** | `925.dot` | 134.7pt | clearest repro: `rankdir=LR`, `shape=record style=rounded`, 2 nodes |
| graphs-hashtable (+ share/windows/linux.i386) | `graphs/hashtable.gv` | ~37pt | record-based |
| graphs-records (+ share/windows) | `graphs/records.gv` | ~5.8pt | record-based |

## Symptom (925, pinned)

```
digraph G { rankdir=LR; node[shape=record style=rounded];
  reclat[label="Ok with spaces (en):|{ AAA AAA AAA | BBB BBB BBB | CCC CCC CCC }"];
  recrus[label="Eats spaces (utf):|{ ААА ААА ААА | ВВВ ВВВ ВВВ | ССС ССС ССС }"]; }
```

- **Native:** `336pt × 128pt` (wide, short).
- **Port:** `59pt × 518pt` (narrow, tall) — dimensions essentially **transposed**
  and the record field widths collapsed. The record's internal `<polyline>`
  separators draw at x ∈ [−138, +189] while the viewBox is only 59 wide → the
  record renders far outside the canvas.

## Root-cause hypothesis (verify first — see CLAUDE.md "instrument the C")

Record-node sizing under `rankdir=LR`. dot flips record orientation with rankdir
(`|` splits and `{}` nesting swap axis under flip); the port appears to compute
the record field layout / node `lw`/`rw`/`ht` **without** the LR flip, so the
node width fed into `dot_compute_bb` (the graph bbox) is wrong. The render path
still draws fields at their true (unflipped) extent → bbox ≪ content → clipping.

Likely loci (confirm with a probe before editing):
- `src/common/record.ts`, `src/common/record-port.ts` — record field layout + ports.
- `src/common/poly-init.ts`, `src/common/poly-sizing.ts` — node lw/rw/ht.
- rankdir/flip handling: `GD_flip` / `g.info.flip`, and where record sizing reads it.
- C spec: `~/git/graphviz/lib/common/shapes.c` (record_init / record sizing,
  the `flip` handling), `lib/dotgen/position.c:dot_compute_bb`.

## Detection / quality gates

The clipping gate is the primary signal — it did not exist when this bug shipped.

| command | pass |
|---|---|
| `npx tsc --noEmit --stableTypeOrdering` | exit 0 |
| `npx vitest run` | exit 0 (incl. `record-port.test.ts`, `record.*`) |
| `GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json npx tsx test/corpus/survey.ts` | 925 + hashtable `clipOverflow ≤ 4` |
| `npx tsx test/corpus/rules-gate.ts` | `clip-regressions=0`, target ids leave `clip-watch`; verdict `regressions=0` |

Oracle: headless 15.1.0 (`GVBINDIR=/tmp/ghl`), Estimate measurer. Refresh
`parity.json` ← `parity-rules.json` + `dashboard.ts` on completion
(memory `parity-json-recipe-estimate-ghl`). Add a position-strict golden test
(byte/coords vs native ref) for at least 925 so the fix is pinned — do NOT rely
on the structural-match verdict (it was blind to this; see `plans/...clipping`
work and the clipping-gate commit).

## Risk / stop conditions

- Record sizing is shared by TB and LR; verify a record fix does not regress
  TB-rankdir record graphs (the corpus has many: 1323, records, struct*). Re-run
  the full gate after each change; STOP on any confirmed verdict/clip regression.
- If the fix locus is outside record/poly sizing (e.g. it's a `dot_compute_bb`
  flip bug affecting all flipped nodes), re-scope and log before widening.

## Out of scope

`1314` (fuzzer garbage: `fontsize="991836031967s8"`) and already-`diverged`
clippers (`2796`, `1367`, `2825`, `triedds`) — not record-class; leave on
`clip-watch`.

## Memory pointers

- `route-corpus-25-25-g2-mincross`, `1323-flat-adjacent-record-edge-done` —
  prior record work.
- the clipping gate: `test/corpus/survey.ts:svgOverflow`/`clipOverflow`,
  `rules-gate.ts` CLIP_THRESHOLD — this is how the targets are detected/verified.
