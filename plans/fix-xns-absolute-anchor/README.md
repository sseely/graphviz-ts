# Mission: align the x-NS absolute anchor to C

## Objective

Make the port's **internal (pre-`gvPostprocess`) x-coordinate frame** match
Graphviz C's exactly — not just the relative layout (which already byte-matches).
The x-coord network simplex (NS, `balance=2`/`LR_balance`, un-normalized) produces
a solution that is a **perfectly uniform shift** of C's (e.g. +146 for corpus
`2368_1`, +228 for `2368`): identical relative positions, different absolute
anchor. The anchor diverges because of NS **pivot order** (nlist + edge-list
iteration driving `leaveEdge`/`enterEdge`/`update`/`rerank`/`lrBalance`).

C leaves **spline-less edge labels untranslated** (`map_edge` early-returns when
`ED_spl==NULL`); `edge_in_box` then draws such a label iff its un-normalized
position overlaps the final clip. The port can't reproduce this until its internal
x-anchor matches C. Aligning the anchor (Batch 1) + wiring the degenerate
labeled-flat path (Batch 2) byte-matches `2368` and the opposing-labeled-flat
family.

Full root cause: `.agent-notes/2368-degenerate-labeled-flat-edge_in_box.md`.

## Approach (locked — see decisions.md)

**A: incremental bit-exact NS pivot replication.** Instrument both NS pivot
sequences, fix the *first* ordering divergence the trace shows, re-trace, survey,
repeat. Each step keeps the relative solution identical → final coords unchanged.

## Branch

`feature/xns-absolute-anchor` off `main` (merge-commit, per mission convention).

## Hard invariant (the whole mission rides on this)

Batch 1 must NOT change any graph's **final** coordinates. The 490 byte-match
corpus graphs stay byte-match throughout. Batch-1 success is measured by the
**internal-coordinate trace converging to C** (instrumented), with the survey
staying green. Output only changes in Batch 2 (degenerate labels), where `2368`
flips diverged→byte-match.

## Quality gates

- `command: npx tsc --noEmit` — pass: exit 0 — on_fail: fix_and_rerun
- `command: npx vitest run` — pass: exit 0 — on_fail: fix_and_rerun
- `command: GVBINDIR=/tmp/ghl PARITY_OUT=parity-probe.json npx tsx test/corpus/survey.ts && npx tsx test/corpus/rules-gate.ts test/corpus/parity-probe.json`
  — pass: `GATE PASS`, 0 regressions — on_fail: stop (relative solution changed)
  — note: ~17 min; run after each anchor change and before any commit.
- `command: git diff --name-only` — pass: matches declared write-set — on_fail: stop

## Constraints

**Stop** when: a pivot alignment changes the relative solution (any byte-match
regression); a survey regression isn't resolved by the next candidate; the trace
doesn't converge after T1–T5; 2 consecutive gate failures on the same check; a
write outside the write-set. See `decisions.md#stop-conditions`.

**Push forward** when: choosing the next candidate from the trace diff; all
C/port instrumentation (temporary, env-gated, reverted after capture); refreshing
the committed baseline once the gate is green.

## Method rule (non-negotiable)

C is the spec. Instrument C before hypothesizing (rule: instrument-c-before-quarantine).
Rebuild `gvplugin_dot_layout` / `dot` under `~/git/graphviz/build`, gate every
print by an env var, capture, then `git checkout` the C source and rebuild clean.

## Batches

| Batch | Goal | Status |
|-------|------|--------|
| [0](batch-0/overview.md) | x-NS pivot-trace harness + baseline divergence capture | [x] |
| [1](batch-1/overview.md) | ~~Align the absolute anchor (T1–T5)~~ **RE-SCOPED: remove port-only `normalizeXcoords`** | [x] |
| [2](batch-2/overview.md) | Degenerate labeled-flat wiring (map_edge / edge_in_box) | [x] |
| [3](batch-3/overview.md) | Full survey + baseline refresh | [x] |

> **Batch-0 finding re-scopes the mission.** The port's x-NS pivot order is
> already bit-exact with C (T0 trace: internal frame byte-identical). The locked
> premise AD-1 ("anchor diverges due to NS pivot order") is empirically wrong.
> The entire internal-frame divergence is the **port-only** `normalizeXcoords`
> call in `dotPosition` (C has no such step). Batch 1 is now a single change —
> remove `normalizeXcoords` — proven 0-regression by the `XNS_NONORM` survey.
> Batch-1 tasks T1–T5 (NS-pivot replication) are no-ops. See `decision-journal.md`.

## Docs

- [decisions.md](decisions.md) — approach, stop conditions, key C references
- [diagrams/data-flow.md](diagrams/data-flow.md) — x-coord pipeline + the anchor leak
- [decision-journal.md](decision-journal.md) — appended during execution

## Recipes (verified this session)

- C oracle / survey use headless `GVBINDIR=/tmp/ghl` (regen:
  `sh test/corpus/gen-headless-gvbindir.sh /tmp/ghl`).
- Render one: `GVBINDIR=/tmp/ghl npx tsx test/corpus/render-one.ts <path> dot`.
- C render: `GVBINDIR=/tmp/ghl ~/git/graphviz/build/cmd/dot/dot -Tsvg <path>`.
- Rebuild C plugin after instrumenting: `make -C ~/git/graphviz/build gvplugin_dot_layout`
  (or `make -C ~/git/graphviz/build dot` for emit.c/libcommon), then regen `/tmp/ghl`.
- Survey writes to a probe file; refresh baseline only at Batch 3
  (`cp parity-probe.json parity.json && cp … parity-rules.json && npx tsx test/corpus/dashboard.ts`).

## Session summary (mission complete)

**Outcome: core objective delivered; the locked approach was wrong and was
re-scoped from instrumented evidence.**

- **Tasks**: Batch 0 (T0), Batch 1 (re-scoped B1; T1–T5 no-op), Batch 2 (T6),
  Batch 3 (T7) — all complete. 5 commits on `feature/xns-absolute-anchor`.
- **Key finding (re-scope)**: the port's x-network-simplex is ALREADY bit-exact
  with C (T0 trace: internal `set_xcoords` frame byte-identical). AD-1 ("anchor
  diverges due to NS pivot order") was empirically false. The whole divergence
  was a port-only `normalizeXcoords` step C lacks. Batch 1 = remove it (not the
  planned NS-pivot replication).
- **Delivered**: internal x-frame now == C; faithful `edge_in_box`/`overlap_label`
  emit gate replacing the band-aid skip; degenerate labeled flats draw/suppress
  by clip overlap exactly as C. **2368_1 + 1624 byte-match** (the
  degenerate-labeled-flat core); **2368 childCount divergence resolved** (6→11
  edges, 9 paths, all 22 labels).
- **Quality gates**: `tsc --noEmit` clean; `vitest run` 2467 pass / 1 skip;
  survey GATE PASS, **0 regressions, 0 clip-regressions** (verdict counts
  unchanged: 492 byte-match / 198 structural / 89 diverged / 11 oracle-error).
- **Not achieved / follow-ups**: full **2368 byte-match** is blocked by TWO
  separate, pre-existing issues the childCount divergence had masked —
  (1) ~5pt flat-label-rank vertical spacing, (2) adjacent/merged labeled-flat
  channel geometry (straight-stub vs C curve, e.g. 376→76). Both are flat-edge
  routing fidelity gaps outside the degenerate-label scope; documented in
  `.agent-notes/2368-residual-flat-label-ranksep.md`. 13 diverged graphs' maxΔ
  shifted (some better, some worse) as previously-suppressed labeled flats now
  draw imperfectly — no verdict regressions. User accepted the partial outcome
  and the baseline refresh.
- **Decision journal**: 12 entries; the re-scope (B0) and the Batch-3 stop point
  flagged for review.
</content>
