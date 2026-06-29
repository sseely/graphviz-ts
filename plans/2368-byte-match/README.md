# Mission: byte-match 2368.dot

## Objective

Close the remaining `2368.dot` divergence so it byte-matches the C oracle.
The prior mission (`fix-xns-absolute-anchor`) fixed 2368's structural childCount
divergence (degenerate labeled-flat emission); that **unmasked two pre-existing
geometry residuals** the childCount diff had hidden:

1. **Flat-label-rank vertical spacing** — 2368's bbox is 5pt short (608×148 in C
   vs 604×143 in port); the top `{rank=same line7;136}` group sits 5pt low. The
   256→316 label vnode is byte-identical to C, so this is a rank-separation /
   `flatNode` height issue, NOT label placement.
2. **Adjacent labeled-flat curve geometry** — 376→76, 196→376, 256→436 (adjacent
   labeled flats) draw straight stubs (`makeSimpleFlatLabels` installs
   `[tp,tp,hp,hp]`) where C draws shallow arcs (maxΔ 65 on 376→76).

A likely third, smaller residual is a ~1pt node-x delta (the 2371-class x-NS
optimal-face tie-break) — pursued only conditionally (AD-3).

Full context: `.agent-notes/2368-residual-flat-label-ranksep.md` and the prior
mission `plans/fix-xns-absolute-anchor/`.

## Branch

`feature/2368-byte-match` off `main` (merge-commit, per mission convention).

## Risk profile (higher than the last mission)

Both fixes touch flat-edge geometry shared corpus-wide (`makeSimpleFlatLabels`
runs for every adjacent labeled flat; `flatNode`/rank spacing for every
edge-labeled graph). Unlike the last mission (which removed a port-only
deviation), this CHANGES geometry that currently byte-matches on many graphs.
**Every change is full-survey-gated; any byte-match→worse is STOP + revert.**

## Constraints

**Stop** when: any byte-match→worse regression (revert); 2 consecutive gate
failures on the same check; a fix needs files outside its write-set; 3
consecutive edits to one site without resolving it; **a 2368 geometry fix can't
be made faithful to C without regressing other graphs** (deeper root cause —
document + stop). See `decisions.md#stop-conditions`.

**Push forward** when: reading geometry details from the C trace; env-gated temp
instrumentation (reverted after capture); marking T3 no-op if the x delta is
≤1pt and not localized; refreshing the baseline once the gate is green.

## Method rule (non-negotiable)

C is the spec. Instrument C before hypothesizing (rule:
instrument-c-before-quarantine). Rebuild `gvplugin_dot_layout` under
`~/git/graphviz/build`, gate prints by an env var, capture, then
`git -C ~/git/graphviz checkout` the C source and rebuild clean.

## Quality gates

- `command: npx tsc --noEmit` — pass: exit 0 — on_fail: fix_and_rerun
- `command: npx vitest run` — pass: exit 0 — on_fail: fix_and_rerun
- `command: GVBINDIR=/tmp/ghl PARITY_OUT=parity-probe.json npx tsx test/corpus/survey.ts && npx tsx test/corpus/rules-gate.ts test/corpus/parity-probe.json`
  — pass: `GATE PASS`, 0 regressions — on_fail: stop (revert the change)
  — note: ~17 min; run after each geometry change and before any commit.
- `command: git diff --name-only` — pass: matches declared write-set — on_fail: stop

## Batches

| Batch | Goal | Status |
|-------|------|--------|
| [0](batch-0/overview.md) | Instrument + isolate both residuals (C-vs-port flat-geom trace) | [x] |
| [1](batch-1/overview.md) | Fix Issue 2: adjacent labeled-flat curve geometry | [x] |
| [2](batch-2/overview.md) | Fix Issue 1: flat-label-rank vertical spacing | [x] (no-op — resolved by B1) |
| [3](batch-3/overview.md) | Conditional x-NS tie-break (T3) + validate & baseline refresh (T4) | [ ] |

## Docs

- [decisions.md](decisions.md) — architecture decisions + stop conditions + C refs
- [diagrams/data-flow.md](diagrams/data-flow.md) — flat-labeled-edge routing + bbox flow
- [diagrams/component-map.md](diagrams/component-map.md) — affected components
- [decision-journal.md](decision-journal.md) — appended during execution

## Recipes (verified, from the prior mission)

- C oracle / survey use headless `GVBINDIR=/tmp/ghl` (regen:
  `sh test/corpus/gen-headless-gvbindir.sh /tmp/ghl`).
- Render one: `GVBINDIR=/tmp/ghl npx tsx test/corpus/render-one.ts <path> dot`.
- C render: `GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg <path>`.
- Rebuild C plugin after instrumenting: `make -C ~/git/graphviz/build gvplugin_dot_layout`,
  then regen `/tmp/ghl`.
- Compare port vs C geometry (comment/ws-normalized): see
  `.agent-notes/2368-residual-flat-label-ranksep.md` recipe.
- Refresh baseline ONLY at Batch 3:
  `cp parity-probe.json parity-rules.json && cp parity-probe.json parity.json && npx tsx test/corpus/dashboard.ts`.
