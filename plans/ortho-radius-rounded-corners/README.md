<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: ortho-edge rounded-corner rendering (`radius`)

## Objective
Port native dot's orthogonal-edge **rounded-corner** rendering to graphviz-ts.
When an edge has `splines=ortho` and `radius=N>0` (or `style=rounded`), native
emits straight `<polyline>` segments between corners (truncated by `radius`) plus
a `<polyline>` arc at each corner; the port currently ignores `radius` and emits
one sharp-cornered bezier `<path>`. The edge ROUTING is already correct (same
corner points) — this is purely an EMIT feature. Fixes the 6 diverged `radius`
graphs (all maxΔ 0.00, diverging only at edge `childCount`).

## Target graphs (diverged → match)
`graphs-radius`, `linux.i386-radius_dot`, `linux.x86-radius_dot`,
`macosx-radius_dot`, `nshare-radius_dot`, `windows-radius_dot` (one root → 6).

## Branch
`fix/ortho-radius-rounded-corners` (already created off `main`). Merge `--no-ff`;
**user pushes** (push is gated).

## C reference (the spec — port faithfully, "the C is sacred")
- `lib/common/emit.c:2550-2666` — main loop: detect `is_ortho` + `want_rounded`;
  segment polylines between truncated corners; `draw_ortho_corner_markers`;
  bezier fallback when no corners.
- `lib/common/emit.c:2130-2330` — `corner_info_t`, `compare_corners`,
  `calculate_wedge_parameters` (8 cases), `process_corner`, `find_ortho_corners`,
  `find_prev/next_distinct`, `draw_ortho_corner_markers`, `render_corner_arc`.
- `lib/common/ellipse.c:200-280` — `ellipticWedge`→`initEllipse`+`genEllipticPath`
  (xsemi=ysemi=radius ⇒ circular arc). Arc is emitted as a POLYLINE of the
  wedge's bezier control points, slice `[3 .. pn-4]`.

## Constraints
Faithful to C only; no radius-specific hacks (ADR-4). Rollback: Reversible
(single `git revert`; no data/schema/contract change). See
[decisions.md](decisions.md) for ADR-1..4 + stop/push-forward conditions.

## Quality gates (run from repo root)
```
export PATH="$HOME/.npm/_npx/fd45a72a545557e9/node_modules/.bin:$PATH"
npm run typecheck            # tsc, clean
npm test                     # vitest, all pass
npm run survey               # writes parity-rules.json (headless)
npm run survey:gate          # GATE PASS, 0 regressions
# pango baseline (T5): GV_TEXT_MEASURER=lut GVBINDIR=/tmp/gvplugins \
#   ORACLE_CACHE=$TMPDIR/oracle-pango-$(date +%s) PARITY_OUT=parity.json \
#   tsx test/corpus/survey.ts
npm run survey:dashboard
```
Oracle: native `dot` 15.1.0, `GVBINDIR=/tmp/ghl` (headless) / `/tmp/gvplugins`
(pango), corpus `~/git/graphviz/tests/graphs/radius.gv`.

## Definition of done
6 radius graphs diverged→byte/structural-match; `npm test` green; **0 survey
regressions on BOTH baselines**; baselines + PARITY.md refreshed.

## Batches (sequential — each consumes the prior's output)
| # | Goal | Status | Doc |
|---|------|--------|-----|
| 1 | `ellipse-wedge.ts` — arc tessellation | [ ] | [batch-1/overview.md](batch-1/overview.md) |
| 2 | corner detection + truncation | [ ] | [batch-2/overview.md](batch-2/overview.md) |
| 3 | segment + arc emit | [ ] | [batch-3/overview.md](batch-3/overview.md) |
| 4 | `svg.ts endEdge` integration + golden | [ ] | [batch-4/overview.md](batch-4/overview.md) |
| 5 | validate + refresh baselines + merge | [ ] | [batch-5/overview.md](batch-5/overview.md) |

## Index
- [decisions.md](decisions.md) — ADR-1..4 + stop conditions
- [decision-journal.md](decision-journal.md) — appended during execution
- [diagrams/data-flow.md](diagrams/data-flow.md) — emit pipeline
- [diagrams/component-map.md](diagrams/component-map.md) — affected modules
