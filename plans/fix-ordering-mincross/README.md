# Mission: fix `ordering=out`/`in` mincross enforcement

## Objective

Graphs with the `ordering` attribute get the WRONG in-rank node order in the
port, which cascades into wrong x-positions and edge paths (they sit in the
PARITY.md `path-structure` tracked-diverged bucket). The port already has the
machinery (`doOrderingNode`/`orderedEdges`, wired at `mincross.ts:164,274`) — so
this is a BUG in constraint construction or its preservation through the
median/transpose passes, NOT a missing feature. Make the port honor `ordering`
the way C does, clearing as many of the ~13 diverged `ordering` graphs as
possible WITHOUT regressing the 12 that already byte-match.

## Reproducer (pinned facts)

`~/git/graphviz/tests/graphs/b58.gv` (14 lines, graph-level `ordering=out`):
node 7 has `7->5` then `7->4`, so C places 5 left of 4; the port places 4 left
of 5. Node x: **C** `{1:27,6:45,3:81,2:99,8:117,5:171,7:207,4:243}` vs **port**
`{1:27,6:63,2:243,3:135,7:135,5:171,8:207,4:99}` (2↔4 swapped; 3/6/7/8 shifted).

## Branch

`feature/fix-ordering-mincross` off `main` (merge-commit, per mission convention).

## Corpus reach

27 graphs set `ordering=`; 12 byte-match, ~13 diverge: `graphs-b58`,
`{linux.x86,macosx,nshare}-ordering_dot1`, `{graphs,share,windows}-pgram`,
`{graphs,share,windows}-trapeziumlr`, `1472`, `1990`, `graphs-in`.

## Constraints

**Stop** when: any byte-match→worse regression (revert); 2 consecutive gate
failures on the same check; a fix needs files outside its write-set; 3
consecutive edits to one site without resolving it; a fix can't make b58 match C
without regressing others (deeper than scoped — document + stop). See
[decisions.md](decisions.md#stop-conditions).

**Push forward** when: reading C-trace geometry; env-gated temp instrumentation
(reverted after capture); marking a graph's residual a documented secondary
cause; refreshing the baseline once the gate is green.

## Method rule (non-negotiable)

C is the spec. Instrument C before hypothesizing (rule
`instrument-c-before-quarantine`): rebuild `gvplugin_dot_layout` under
`~/git/graphviz/build`, env-gate prints, capture, then
`git -C ~/git/graphviz checkout` the source and rebuild clean.

## Quality gates

- `command: npx tsc --noEmit` — pass: exit 0 — on_fail: fix_and_rerun
- `command: npx vitest run` — pass: exit 0 — on_fail: fix_and_rerun
- `command: GVBINDIR=/tmp/ghl PARITY_OUT=parity-probe.json npx tsx test/corpus/survey.ts && npx tsx test/corpus/rules-gate.ts test/corpus/parity-probe.json`
  — pass: `GATE PASS`, 0 regressions — on_fail: stop (revert the change)
  — note: ~17 min; run after each mincross change and before any commit.
- `command: git diff --name-only` — pass: matches declared write-set — on_fail: stop

## Batches

| Batch | Goal | Status |
|-------|------|--------|
| [0](batch-0/overview.md) | Instrument C `do_ordering`/`ordered_edges` vs port; pin first divergence on b58; fix flat-geom-diff ellipse blind spot | [x] |
| [1](batch-1/overview.md) | Implement the fix at the pinned site + `ordering=out`/`in` unit tests | [ ] |
| [2](batch-2/overview.md) | Validate full survey (0 regressions) + baseline refresh | [ ] |

## Recipes (verified this session)

- C oracle / survey use headless `GVBINDIR=/tmp/ghl` (regen:
  `sh test/corpus/gen-headless-gvbindir.sh /tmp/ghl`).
- Render one (port): `GVBINDIR=/tmp/ghl npx tsx test/corpus/render-one.ts <path> dot`.
- Render one (C): `GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg <path>`.
- Rebuild C plugin after instrumenting: `make -C ~/git/graphviz/build gvplugin_dot_layout`,
  then regen `/tmp/ghl`.
- Node-order check (ellipse-safe after T0): compare `<text>` x per node title.
- Refresh baseline ONLY at Batch 2:
  `cp parity-probe.json parity-rules.json && cp parity-probe.json parity.json && npx tsx test/corpus/dashboard.ts`.

## Docs

- [decisions.md](decisions.md) — architecture decisions + stop conditions + C refs
- [diagrams/data-flow.md](diagrams/data-flow.md) — ordering enforcement through mincross
- [diagrams/component-map.md](diagrams/component-map.md) — affected components
- [decision-journal.md](decision-journal.md) — appended during execution
