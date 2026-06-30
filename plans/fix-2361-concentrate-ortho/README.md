# Mission: corpus 2361 — concentrate under-merges edges (splines=ortho)

## Objective

Corpus **2361** is the smallest real `diverged` case (maxΔ=**0.0** — every
coordinate matches; the divergence is purely **structural**). With
`concentrate=true` + `splines=ortho` + `rankdir=LR`, the port emits **7 more
edges than native** (it fails to merge edge pairs that C's concentrate collapses).
Make 2361 `diverged → match` with **zero gate regressions** (verdict + clipping).

(`1472`, the literal smallest-maxΔ diverged, is **fuzzer garbage** — corrupt
input → malformed SVG; skipped. 2361 is the first real one.)

## Symptom (pinned)

```
digraph G { splines=ortho; concentrate=true; rankdir=LR; node[shape=box];
  SW->AC; IW->AC; IV->AC; FF->AF; FF->IK; FF->IV; AC->CI; AC->FS; AC->FW;
  AC->IV; AC->IW; AC->MF; AC->PF; AC->PG; PF->FF; IK->FF; IK->FS; IK->FW;
  IK->GF; IK->MF; IK->PF; IK->PG; PG->GF; MF->IK; MF->IV; GF->IK; GF->IV;
  FS->IK; FS->IV; FW->IK; FW->IV; CI->IK;  ...14 filled box nodes... }
```

- **Size matches:** port 603×464 = native 603×464 (positions correct → maxΔ=0).
- **Element counts (port vs native):** `g` 47 vs 40, `title` 47 vs 40,
  `polygon` 54 vs 46, `path` 32 vs 25. → the port renders **7 extra edge groups**;
  C concentrates them away.

## Root-cause hypothesis (verify first — instrument before editing)

`concentrate=true` merges edges that share a head/tail rank-path into a single
drawn edge. Under `splines=ortho` the port appears to merge **fewer** pairs than
C — either the concentrate pass (`class2` merge / `conc.ts`) skips merges it
should make for this graph, or the ortho routing/emit path emits an edge for a
merged virtual chain that C suppresses (cf. the 2559 merged-trunk work, which was
the *opposite* — a missing second bezier).

Likely loci (confirm with an instrumented count of merges vs C):
- `src/layout/dot/classify.ts` (`class2` — the concentrate merge / `mergeVirtual`),
  `src/layout/dot/conc.ts` (concentrate pass).
- ortho routing/emit for merged chains: `src/layout/dot/splines.ts` ortho
  dispatch + the ortho module.
- C spec: `~/git/graphviz/lib/dotgen/class2.c` (concentrate merge),
  `lib/dotgen/conc.c`, and the ortho edge emit.

First probe: list the 32 port edges vs the 25 native edges (by tail→head title)
to identify exactly which 7 the port failed to merge — that pinpoints the path.

## Quality gates

| command | pass |
|---|---|
| `npx tsc --noEmit --stableTypeOrdering` | exit 0 |
| `npx vitest run` | exit 0 |
| `GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json npx tsx test/corpus/survey.ts` | 2361 → match |
| `npx tsx test/corpus/rules-gate.ts` | `regressions=0`, `clip-regressions=0` |

Oracle: headless 15.1.0 (`GVBINDIR=/tmp/ghl`), Estimate measurer. Refresh
`parity.json` ← `parity-rules.json` + `dashboard.ts` on completion. Add a
position/structure-strict test (e.g. assert 2361 edge-count matches native) —
do NOT rely on conformant (this is an HTML-free ortho graph; structural-match is
the bar).

## Risk / stop conditions

- Concentrate + ortho are both delicate. After each change re-run the full gate;
  STOP on any confirmed verdict or clipping regression (the corpus has other
  concentrate graphs: 2559, b69, b15 — verify they don't move).
- If the fix would require touching the ortho routing core broadly (not just the
  concentrate/merge seam), re-scope and log before widening.

## Memory pointers

- `concentrate-trunk-2559-done` — prior concentrate merged-trunk fix (routing
  side); `ortho-*` memories for the ortho pipeline.
- `parity-json-recipe-estimate-ghl` — baseline refresh recipe.
- the clipping gate (`survey.ts:clipOverflow`, `rules-gate.ts`) now guards
  against any new clipping the change might introduce.
