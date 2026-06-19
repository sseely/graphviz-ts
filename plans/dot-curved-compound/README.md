# Mission: finish DOT-8 — `splines=curved` (+ verify `compound`) under dot

## Objective

Render `splines=curved` correctly under the dot engine by porting
`makeStraightEdges` (`lib/common/routespl.c:975`) and dispatching
`EDGETYPE_CURVED` to it, mirroring `lib/dotgen/dotsplines.c:381-387`. Also
**verify** `splines=compound` + `compound=true` (`lhead`/`ltail`) clipping
against native C — the clipping is already ported (T38) and wired
(`dot/index.ts:128`), so it likely already works; this mission proves it with
goldens and fixes only on divergence. Completes the `splines=` family
(`line`/`polyline`/`ortho` already done; `curved`+`compound` are the last two).

## Carried-in facts (do NOT re-derive)

- `splines=curved` routes each edge group via `makeStraightEdges(g, edgelist,
  cnt, EDGETYPE_CURVED, &sinfo)` (`dotsplines.c:381-387`), which for one edge does
  `bend(dumb, get_cycle_centroid(g, e))` then `clip_and_install`; for parallel
  edges it spreads control points along the perpendicular. `makeStraightEdges`
  (routespl.c:975), `bend`, and `get_cycle_centroid` (routespl.c:904) are
  **unported**. `clip_and_install` IS ported (used by the ortho adapter).
- Curved also needs the top-of-`dot_splines_` handling (`dotsplines.c:241-247`:
  `resetRW(g)` + a *non-downgrading* label warning — curved still routes) and the
  finish guards (`dotsplines.c:461-465`: curved skips `routesplinesterm`).
  `resetRW` is already ported (ortho-P3).
- **Curved is NOT a goto-finish early dispatch like ortho** — it runs inside the
  normal edge-group routing loop, replacing per-group spline routing with
  `makeStraightEdges`.
- **Compound is already wired**: `dotCompoundEdges(g)` runs when `g.info.compound`
  (`dot/index.ts:128`); `compound.ts`/`compound-clip.ts`/`compound-geom.ts` +
  `clipCompound{Head,Tail}` (T38) port `compound.c`. `EDGETYPE_COMPOUND` routing
  does not branch in `makeStraightEdges` (only `CURVED`/`PLINE` do) → it routes as
  a normal spline. So compound = **verify, fix on divergence** (ADR-2).
- Goldens render via `renderSvg` (`src/index.ts`) vs native C `dot -Tsvg`
  (gvmine). `[[oracle-native-not-wasm]]`. No CLI build needed.

## Branch

`feature/dot-curved-compound` (new, off `main`).

## Cardinal rule

**The C code is the oracle.** Make the *same decisions* C makes — same control
points, same dispatch order, same warnings, same edge cases — only expressed in
TypeScript. Where C does something that looks redundant or odd (the perp-spread,
the cycle-centroid bend, warn-but-don't-downgrade on curved labels), preserve it
exactly; it is load-bearing. Never substitute a cleaner or TS-idiomatic decision
for the one C made. When in doubt, read the C and match it; validate every result
against native `dot` (`[[oracle-native-not-wasm]]`).

## Constraints

- **Faithful port.** Mirror `makeStraightEdges` + the curved dispatch position
  and side-effect order exactly (ADR-5). Do not simplify the perp-spread or the
  cycle-centroid bend.
- **Behavior change scoped to `splines=curved`/`compound`.** Any change to an
  existing golden/test for other `splines` values is a **STOP** (ADR-4).
- **C source is sacred.** Revert any instrumentation;
  `git -C ~/git/graphviz status --porcelain lib/` clean before any commit.

## Quality gates

```
- command: npm run typecheck                  # pass: exit 0
- command: npm test                           # pass: exit 0 (baseline + new curved/compound tests + goldens)
- command: npm run build                      # pass: esbuild bundles
- command: git -C ~/git/graphviz status --porcelain lib/   # pass: no tracked .c/.h modification
- command: git diff --name-only HEAD~1        # pass: only src/layout/dot/**, test/golden/**, plans/** touched
```
Regression sub-gate: **no existing non-curved/non-compound golden changes.**

## Batches

| Batch | Goal | Status |
|-------|------|--------|
| [1](batch-1/overview.md) | T1 — port `makeStraightEdges`(+`bend`/`get_cycle_centroid`) + curved dispatch + finish guards | [x] |
| [2](batch-2/overview.md) | T2 — curved + compound goldens vs native C; verify compound, fix on divergence | [ ] |

## Index

- [decisions.md](decisions.md) — ADR-1..ADR-5
- [batch-1/T1-curved-routing.md](batch-1/T1-curved-routing.md)
- [batch-2/T2-goldens-validate.md](batch-2/T2-goldens-validate.md)
- [diagrams/dispatch.md](diagrams/dispatch.md)
- [decision-journal.md](decision-journal.md)
- **C spec:** `~/git/graphviz/lib/common/routespl.c:904-1045` (`makeStraightEdges`,
  `get_cycle_centroid`, `bend`), `~/git/graphviz/lib/dotgen/dotsplines.c:241-247,
  381-387, 461-465` (dispatch+finish), `~/git/graphviz/lib/dotgen/compound.c`
- **Oracle:** `[[oracle-native-not-wasm]]`, `[[recover-slack-and-c-harness]]`,
  `/tmp/gvmine`
