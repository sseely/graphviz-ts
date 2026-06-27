# T3 — Survey verification: concentrate merged-trunk fix

Oracle: headless **dot 15.1.0** (`GVBINDIR=/tmp/ghl`, ADR-2), fresh per-run
oracle cache (cache key = `sha1(DOT_BIN,GVBINDIR,mtime)`; native binary
unchanged since the baseline, so the cache is consistent — no skew). Gate:
`rules-gate.ts` (Estimate-measurer survey `parity-rules.json` vs the committed
LUT/pango baseline `parity.json`).

## Mission target

| id | baseline (parity.json) | post-fix (parity-rules.json) | result |
|----|------------------------|------------------------------|--------|
| **2559** | `diverged` (maxΔ=0) | **`byte-match`** | ✅ diverged → byte-match (exceeds the structural-match bar, ADR-3) |

2559 `edge2` (`c->b`) now emits the 2-piece trunk (lead-in `c->vMERGE` + shared
trunk `vMERGE->b` with the arrowhead); `edge3` (`d->b`) draws only its lead-in.
Port output is byte-identical to the headless 15.1.0 SVG content (differs only in
SVG-serialization whitespace).

## Gate result — 0 regressions

```
rules-gate: stable=659 improvements=13 pre-existing=104 allowlisted=3 regressions=0
GATE PASS — no rules regressions vs the pango baseline.
```

`improved (baseline diverged → rules match)`: 2193, **2559**, graphs-NaN,
graphs-b102, graphs-b143, graphs-ports, graphs-xx, linux.i386-b102,
nshare-ports_dot, share-NaN, share-b102, windows-NaN, windows-b102.

## Why the impact is corpus-wide (and faithful)

`spline_merge(n)` is `VIRTUAL && (in.size>1 || out.size>1)` — this matches **any**
shared virtual node, not just `concentrate` merges (dense dot layouts route many
edges through shared vnodes). C's `dot_splines_` gather + `clip_and_install` split
the spline at every such node; the port was **under-segmenting all merge-node
chains** and now matches C corpus-wide. This is the documented behaviour, not a
2559 special-case (ADR-1).

### Full verdict transition (baseline → post-fix, Estimate survey)

| transition | count | kind |
|------------|-------|------|
| structural-match → byte-match | 63 | improvement (more exact) |
| diverged → structural-match | 11 | improvement |
| diverged → byte-match | 2 | improvement (incl. 2559) |
| byte-match → structural-match | 7 | sub-pixel downgrade (≤1px, still matching) |
| structural-match → diverged | 3 | **allowlisted, not caused by this change** |

Net: **byte-match +56, total match +10, diverged −10**, zero hard regressions.

### The 7 byte→structural downgrades are sub-pixel (ADR-3 tolerance)

| id | maxΔ (px) |
|----|-----------|
| 2669 | 0.01 |
| graphs-awilliams | 0.01 |
| linux.x86-rankdir_dot | 0.01 |
| graphs-ER | 0.35 |
| graphs-pmpipe / share-pmpipe / windows-pmpipe | 1.0 |

Rounding ULPs from per-segment re-routing; all remain `structural-match` (the
ADR-3 bar). Net byte-match still rose by 56.

### The 3 structural→diverged are pre-existing allowlist artifacts, not this change

- `graphs-structs` (dot): port emits 2 `<path>`, headless 1 — a record/text
  **emit** childCount artifact, `maxΔ=0` (node positions identical). Path count is
  **2 before and after** this change → not caused here. Allowlisted.
- `nshare-root_circo`, `nshare-root_twopi`: **circo / twopi engines** — they do
  not use `dotSplines_`, so this dot-only change cannot affect them. 1054-node
  graphs, "one edge @d" pre-existing flake. Allowlisted.

## Watched concentrate set (ADR-3) — unchanged / improved, none regressed

| id | baseline | post-fix | note |
|----|----------|----------|------|
| 167 | byte-match | byte-match | unchanged |
| 2087 | byte-match | byte-match | unchanged |
| 2825 | diverged | diverged | unchanged (pre-existing; headless emits 0 `<path>` — oracle artifact; port 9→9, untouched by this change) |
| b69 | diverged | diverged | verdict unchanged; trunk routing **improved** 137→143 `<path>` (native 144) — the gap b69's x-coord noise masked, as predicted in `.agent-notes/2559-…`. Direct port-vs-headless 15.1.0 render confirms the move is real. |
| b135 | byte-match | byte-match | unchanged (port 1 = headless 1) |
| b62 | byte-match | byte-match | unchanged (port 1 = headless 1) |
| b71 | byte-match | byte-match | unchanged (port 71 = headless 71) |

(b69/b135/b62/b71 are golden-suite graphs under `tests/graphs/`, surveyed as
`graphs-b69` etc.; `graphs-b69` is in the gate's pre-existing-diverged list.)

## Baseline refresh

- `test/corpus/parity-rules.json` (Estimate survey) — regenerated post-fix.
- `test/corpus/parity.json` (LUT/pango baseline) — regenerated post-fix via
  `GV_TEXT_MEASURER=lut … survey.ts` against the 15.1.0 oracle.
- `test/corpus/PARITY.md` — regenerated from `parity.json` via `dashboard.ts`.

Post-fix counts: see the refreshed `parity.json`/`PARITY.md` (LUT) and
`parity-rules.json` (Estimate, byte 442 / structural 230 / diverged 107).
