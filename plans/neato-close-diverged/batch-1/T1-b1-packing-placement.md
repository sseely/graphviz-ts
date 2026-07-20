<!-- SPDX-License-Identifier: EPL-2.0 -->

# T1 · B1 — disconnected-component packing / lone-node placement

## Context

`graphviz-ts` is a faithful TypeScript port of Graphviz C (canonical spec at
`~/git/graphviz/lib`). Neato = force-directed engine; its deterministic loop is
bounded to ~1e-6, so a >0.5pt divergence is a real defect. The **B1 bucket (44
ids)** shows the graph `_draw_` background-fill polygon diverging — that polygon
traces the graph bounding box, so the true defect is an **upstream node/bb
placement** mismatch.

## Confirmed diagnosis (start here — do not re-derive)

On `graphs-nhg` (`~/git/graphviz/tests/graphs/nhg.gv`):
- Every *connected* node matches the oracle to 1e-3.
- Only the *disconnected* `"Machine: a"` `shape=plaintext` node is 11pt too far
  left: port `pos="149.29,18"` vs oracle `pos="160.29,18"`.
- Graph bb width is exactly 11pt short (188.58 vs 199.58); the fill polygon
  corner follows.
- `graphs-b`, `graphs-b117` give the identical `188.58 vs 199.58` — same cause.

So the origin is **disconnected-component packing** (how lone/multi components
are laid out and shifted into the packed drawing), and/or the **width** computed
for a lone plaintext node (a too-narrow node shifts its packed center — compare
`~/.claude` memory "star/cylinder size_gen": a too-small node shrinks the layout).

## Task

Find the mechanism at its origin and fix it faithfully against the C.

1. Reproduce `nhg` per `diagrams/data-flow.md` (oracle vs `render-one-xdot.ts`).
2. Instrument BEFORE hypothesizing. Compare, in order:
   - the lone node's computed **width/size** (port vs C `~/git/graphviz` neato
     node-size path) — is 149.29 vs 160.29 a half-width delta (~11pt = ~half a
     22pt width gap)?
   - the **pack offset / translate** applied to each component
     (`packGraphs` → `computeSubgraphBB` → translate at
     `src/layout/neato/index.ts:258-260`; `src/layout/pack/{poly,array}-pack.ts`).
   - Dump C values via the `/tmp/ghl` harness recipe if the TS/C split is unclear
     (`~/.claude` memory "C harness for raw intermediates").
3. Fix at the origin (packing placement or node sizing — whichever the evidence
   proves). Preserve C branch structure; note any deviation.
4. Re-check the full B1 set (`buckets.json` → `B1_graphfill`, 44 ids). Expect
   most to pass; the large-delta ids (`2609` 122 vs 282, `2258` 69 vs 93) MAY be
   a structurally distinct second packing/label-extent cause — if so, journal it
   and land a second commit `fix(T1): ...` (or flag as follow-up if it needs
   files outside this write-set).

## Write-set

- `src/layout/pack/poly-pack.ts`
- `src/layout/pack/array-pack.ts`
- `src/layout/neato/index.ts`
- `src/layout/neato/init.ts` — **only** if node sizing is proven to be the cause

Do NOT edit spline/label/cluster files here (those are Batch 3).

## Read-set

- `decisions.md#order`, `decisions.md#closed`
- `src/layout/neato/index.ts:190-262` (ccomps → packGraphs → computeSubgraphBB → translate)
- `src/layout/pack/poly-pack.ts`, `src/layout/pack/array-pack.ts`
- C spec: `~/git/graphviz/lib/neatogen/neatoinit.c` (`neato_layout`, Pack>=0
  branch) and `~/git/graphviz/lib/pack/pack.c`
- `buckets.json` (B1 id list) · `~/git/graphviz/tests/graphs/nhg.gv`

## Architecture decisions in force

D1 (broad gate), D2 (closed = pass or classified), D5 (no worktree — sole task).
`calloc`-zero vs `undefined` hazard applies: a C field zeroed by calloc that the
port leaves `undefined` inverts `!= 0` guards — coerce `?? 0`.

## Interface output (consumed by T2, T6)

```
{ b1RootCause: string,          // one-sentence mechanism
  b1FilesTouched: string[],
  b1SecondCause: string | null } // null if the 44 were one cause
```
Record this in `decision-journal.md`.

## Acceptance criteria

- **Given** `nhg`, **when** neato-rendered, **then** `"Machine: a"` x = 160.29
  (±0.5) and graph bb width = 199.58 (±0.5).
- **Given** the 44 B1 ids, **when** re-swept, **then** graph-fill diffs are gone
  or the residual is reclassified (large-delta second cause journaled).
- **Given** `bash test/golden/gates.sh`, **then** exit 0.
- **Given** the broad sweep (neato + circo/twopi/osage/patchwork + `npm run
  survey`), **then** diverged neato count drops and **0** previously-passing ids
  regress in any engine (BY ID).

## Observability

N/A — no runtime service. The observable metric is the parity sweep diverged
count + per-id verdict deltas.

## Rollback

Reversible (`git revert`). No migration.

## Commit

One commit per proven cause: `fix(T1): <mechanism> in neato component packing`.
Body explains why (the C behavior being matched) if >3 files change.
