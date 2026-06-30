# T4 — Survey verification + baseline refresh

Oracle: headless dot **15.1.0** (`GVBINDIR=/tmp/ghl`), Estimate measurer
(`parity-json-recipe-estimate-ghl`). Gate methodology per ADR-5.

## Result: 2458 flipped, zero regressions

`rules-gate.ts`: **stable=672, improvements=2, pre-existing=105, allowlisted=0,
regressions=0.**

Survey counts (committed baseline → post-fix):

| verdict | baseline | post-fix | Δ |
|---|---|---|---|
| conformant | 442 | 449 | **+7** |
| structural-match | 230 | 225 | −5 |
| diverged | 107 | 105 | **−2** |
| errored | 0 | 0 | 0 |
| oracle-error | 11 | 11 | 0 |

Net: 2 graphs left `diverged` (→ conformant) and 5 more tightened
structural→byte; **no downgrades**.

## Verdict transition matrix (all 7 moves — every one an improvement)

| id | baseline | post-fix | cause |
|---|---|---|---|
| **2458** | diverged (maxΔ=74.8) | **conformant** | THIS fix (dot pack branch) — verified byte vs headless |
| **2682** | diverged (maxΔ=80.8) | **conformant** | THIS fix (dot pack branch) — verified byte vs headless |
| 1724 | structural-match | conformant | not this change (dot pack branch is inert for it); stale-baseline tighten, improvement |
| linux.x86-pack_neato1 | structural-match | conformant | neato engine (untouched by this fix); stale-baseline tighten, improvement |
| linux.x86-pack_neato2 | structural-match | conformant | neato engine; improvement |
| nshare-pack_neato1 | structural-match | conformant | neato engine; improvement |
| nshare-pack_neato2 | structural-match | conformant | neato engine; improvement |

The two `diverged → conformant` moves are the dot pack branch (T2), each proven
real by a direct port-vs-headless-15.1.0 render. The five `structural → byte`
moves are not produced by this dot-only change (neato graphs / inert case); they
are pre-existing improvements the committed baseline had not yet captured. All
seven are improvements, so per T4 there is no STOP — only regressions would halt.

## Watched clustered cases (unchanged — T3 deferred)

| id | verdict | note |
|---|---|---|
| 2592 | diverged (maxΔ=564) | clustered multi-component; falls back via `graphHasCluster` guard (T3 deferred — see decision journal) |
| 2683 | structural-match (maxΔ=410) | clustered; falls back; unchanged from baseline |

## Baseline refresh

`cp test/corpus/parity-rules.json test/corpus/parity.json` then
`npx tsx test/corpus/dashboard.ts` (regenerates `test/corpus/PARITY.md`).

## Scope note

T1+T2 complete (2458 + 2682 conformant, 0 regressions). T3 (clustered
multi-component packing) is deferred to a dedicated cluster-mincross derisk
mission — see `decision-journal.md` (T3 rows) for the cascade map.
