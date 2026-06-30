# Mission: honda-tokoro labeled-edge spline piece-count divergence

## Objective
Make the port's edge splines for `graphs-honda-tokoro` byte/structurally match
native `dot` — closing the residual that blocks honda's parity verdict AFTER the
x-coord NS fix (merged `fc7b8f7`). The fix must be **faithful to C**
(`lib/dotgen/dotsplines.c` + `lib/common/routespl.c` + `lib/common/splines.c`),
not honda-specific (ADR-3). This is the labeled-edge / fitter piece-count class.

## Branch
- Work branch: `fix/honda-edge-spline`
- Baseline commit: `git log -1` at mission start (currently main @ `fc7b8f7`).
- Merge: `--no-ff` to `main`; **user pushes** (push is gated).

## What we already know (do not re-derive)
- honda NODE positions conformant with native (x-coord NS fully fixed; full NS
  solution + all 18 pivots match C). The residual is **purely edge-spline**.
- Verdict stays "diverged": maxΔ ~27.9 (headless) / ~27.42 (pango),
  firstDiffPath `svg/g[1]/g[5]/path[1]/@d` (an edge path's `@d`).
- Only **2 of 40 edge paths** differ in bezier PIECE COUNT:
  - edge index 2: native **2 segments** / port **1 segment**
  - edge index 27: native **2 segments** / port **4 segments**
  - plus coordinate deltas on labeled edges (`:r:` `:s:` `:u:` `:s/r:` labels
    shift because they are placed relative to the spline).
- honda is `rankdir=LR ranksep=0.2 nodesep=0.2`, `node[width=0 height=0]`,
  `edge[dir=none]`, many parallel/multi-edges (n003->n002, n007->n006,
  n012->n011, n022->n009 each appear twice), several carry headlabel/edge
  labels. Fixture: `~/git/graphviz/tests/graphs/honda-tokoro.gv`.
- DISPROVEN PREMISE: setting the weight=0 edges to weight=1 (two or all four)
  does NOT make it conformant (still diverges ~27.7/26.3). weight=0 was
  never the edge driver — do not chase it.
- Class context + harness: `.agent-notes/xcoord-ns-lrconstraints-int-truncation.md`
  and memory notes `opposing-edge-spline-divergence`, `long-edge-undersegment-done`,
  `edge-routing-order-done`, `faithful-corridor-minw-per-rank`,
  `bbox-class-control-hull-vs-curve`, `active-fitter-no-loop-corridors`,
  `recover-slack-and-c-harness`, `bezier-emit-size-not-length`.

## Constraints
- Faithful to C only; no honda-specific special-casing (ADR-3).
- C-source edits are **temporary instrumentation only**, reverted before final
  validation (T4).
- Full stop/push-forward + the **write-set expansion rule** →
  [decisions.md#stop-conditions](decisions.md).

## Quality gates (run from repo root)
```
export PATH="$HOME/.npm/_npx/fd45a72a545557e9/node_modules/.bin:$PATH"
npm run typecheck            # tsc, must be clean
npm test                     # vitest, all pass
npm run survey               # writes test/corpus/parity-rules.json (headless)
npm run survey:gate          # must print "GATE PASS", 0 regressions
# pango baseline refresh (T4):
GV_TEXT_MEASURER=lut GVBINDIR=/tmp/gvplugins ORACLE_CACHE=$TMPDIR/oracle-pango-$(date +%s) \
  PARITY_OUT=parity.json tsx test/corpus/survey.ts
npm run survey:dashboard     # regenerates test/corpus/PARITY.md
```
Oracle rebuild: `cmake --build ~/git/graphviz/build --target gvplugin_dot_layout dot`
then `sh test/corpus/gen-headless-gvbindir.sh /tmp/ghl` (regens `/tmp/ghl`).
Per-edge piece-count diff recipe: see [batch-1/overview.md](batch-1/overview.md).

## Definition of done (ADR-5)
- REQUIRED: honda-tokoro edge paths byte/structural-match native (no
  piece-count `@d` structural diff; edge-label positions match); `npm test`
  green; **0 survey regressions** on BOTH baselines (`parity-rules.json` +
  `parity.json`).
- STRETCH (must not regress): other labeled-edge / parallel-edge graphs that
  share the same fitter class.

## Batches (sequential — each consumes the prior's output)
| # | Goal | Status | Doc |
|---|------|--------|-----|
| 1 | Capture C spline oracle for honda's 2 divergent edges | [x] | [batch-1/overview.md](batch-1/overview.md) |
| 2 | Instrument port, diff, localize first divergence | [x] | [batch-2/overview.md](batch-2/overview.md) |
| 3 | Apply faithful fix + unit test | [x] | [batch-3/overview.md](batch-3/overview.md) |
| 4 | Revert instrument, validate, commit | [x] | [batch-4/overview.md](batch-4/overview.md) |

## Mission summary (complete 2026-06-26)
- **Tasks**: 4/4 complete (T1 oracle, T2 localize, T3 fix+test, T4 validate+land).
- **Root cause** (not the predicted fitter/piece-count class): `samehead`/
  `sametail` edge attrs were never parsed into `e.info`, so the ported+wired
  `dotSameports` never fired — honda's same-head edges routed to the node center
  instead of C's merged shared head port.
- **Fix** (commit `58cc5cd`): parse samehead/sametail in dotInitEdge; faithful
  `shape_clip` in sameport.ts (rect stub → ellipse/poly bezier clip); parallel-
  group base = port-defined member; groupSize portcmp split. + unit tests
  (attr-init.test.ts).
- **Result**: honda-tokoro **diverged → structural-match** (maxΔ 27.9 → 1.06; 0
  piece-count `@d` diffs — the two target edges conformant). **0 survey
  regressions on BOTH baselines**; +8 improvements each (honda + the arrows
  family `graphs-arrows`/`newarrows` & OS variants went diverged → conformant;
  2193/NaN/b102/b143/ports/xx improved). typecheck + `npm test` (2424) green.
- **Known residual** (sub-pixel, not a structural/grouping issue): n012→n011
  (two parallels with distinct samehead m005/m006) ends 1px off in y — a
  `round(y1)` tie in the ellipse-clip of the shared-port direction. Keeps honda
  at structural-match rather than conformant. Candidate follow-up: align
  `buildSharedPort`/`shapeClip` ellipse-boundary rounding with C `bezier_clip`.
- **Decisions flagged for review**: write-set expansion to init.ts + sameport.ts
  (approved); group-split + base-edge-selection added to splines.ts/splines-
  route.ts (within approved scope, C-faithful, gate-clean).

## Index
- [decisions.md](decisions.md) — ADR-1..5 + stop conditions
- [decision-journal.md](decision-journal.md) — appended during execution
- [diagrams/component-map.md](diagrams/component-map.md) — affected components
- [diagrams/data-flow.md](diagrams/data-flow.md) — spline routing pipeline
- `oracle/` — c-dump.txt / port-dump.txt (created during T1/T2)
