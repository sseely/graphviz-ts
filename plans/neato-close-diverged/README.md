<!-- SPDX-License-Identifier: EPL-2.0 -->

# Mission: Close up the neato diverged items

## Objective

Drive `test/corpus/parity-neato.json` from **95 diverged** toward **all
passing-or-classified**. Neato runs at the 0.5pt iterative tolerance yet these
95 exceed it; the neato stress loop is bounded to ~1e-6 (measured), so these are
**real chaseable defects**, not accepted FP drift. Fix each at its origin per
the diagnosis discipline; where an item proves irreducible (A1 drift / A4 oracle
bug), classify and document it — that also counts as closed.

## Branch

`feature/neato-close-diverged` (squash-merge is DISALLOWED here — use a merge
commit; per-task commit IDs are referenced in the journal).

## Baseline (parity-neato.json, generated 2026-07-19)

- pass **660** · diverged **95** · oracle-error **7** (out of scope)
- The 95 collapse to 5 root-cause buckets — see `buckets.json` for exact id lists:
  - **B1 graph-bb/packing (44)** · **B2 splines (37)** · **B3 cluster (4)** ·
    **B4 edge-labels (7)** · **B5 arrowheads (3)**

## Confirmed root cause (B1, the lever)

On `nhg`/`b`/`b117`: every connected node matches to 1e-3; only the *disconnected*
`"Machine: a"` plaintext node sits 11pt too far left (149.29 vs 160.29) →
graph bb shrinks 11pt → the graph `_draw_` background-fill polygon (which traces
the bb) diverges. Root = **disconnected-component packing / lone-node placement**
(`src/layout/neato/index.ts:197-260`, `src/layout/pack/*`). Node placement
cascades into B2/B4/B5, so B1 lands first and the residual is re-swept before
triaging the rest.

## Constraints

**Stop and wait for input when:**
- A fix requires editing files outside the task's declared write-set (and not in
  another task's write-set).
- Two consecutive broad-gate failures on the same check, or the same code
  location is changed 3× without resolving the same failure.
- A B1 fix would regress the **dot** corpus or any deterministic engine (shared
  packing/sizing code) and the faithful fix is unclear.
- An item's faithful behavior contradicts the oracle in a way that looks like an
  oracle bug — classify as A4 candidate, do NOT force a matching-but-unfaithful fix.
- The C source is ambiguous about the correct behavior.

**Push forward with judgment when:**
- A bucket splits into >1 root cause — journal it, land one commit per cause.
- An item turns out to be a pure cascade of an already-fixed parent — mark
  cascade-of-known-parent, no new fix.
- A residual item is irreducible FP drift — write a `known-divergences.md` entry
  and move on.

**Definition of "closed" (per item):** passes at 0.5pt, OR root-caused AND
classified (fix-landed / accept-drift / oracle-bug / cascade-of-known-parent)
with a `known-divergences.md` entry.

**Sweep discipline (non-negotiable):** never edit `src/` while a sweep runs;
always run a **fresh (deleted-JSONL)** full sweep before committing. Parallel
residual tasks (Batch 3) run in **git worktrees** (isolated source trees) so
their sweeps don't read each other's live edits.

## Quality gates (run between every batch)

```
- command: bash test/golden/gates.sh
  pass: exit 0 (tsc clean, vitest green, golden 50/50, file<600, bundle<500KB)
  on_fail: fix_and_rerun
- command: rm -f test/corpus/parity-neato.jsonl && \
           GVBINDIR=/tmp/ghl npx tsx test/corpus/engine-walk.ts neato
  pass: diverged count strictly < prior batch; 0 previously-passing ids regress (BY ID)
  on_fail: fix_and_rerun
- command: for e in circo twopi osage patchwork; do \
             rm -f test/corpus/parity-$e.jsonl && \
             GVBINDIR=/tmp/ghl npx tsx test/corpus/engine-walk.ts $e; done
  pass: 0 previously-passing ids regress in any deterministic engine (BY ID)
  on_fail: stop
- command: npm run survey   # dot corpus (parity.json)
  pass: 0 previously-conformant dot ids regress (BY ID)
  on_fail: stop
```
Setup once per session: `npm run survey:setup` builds the headless `/tmp/ghl`.

## Batches

| Batch | Task | Status |
|-------|------|--------|
| 1 | [T1 · B1 packing / lone-node placement](./batch-1/T1-b1-packing-placement.md) | [x] |
| 2 | [T2 · fresh re-sweep + residual triage](./batch-2/T2-resweep-triage.md) | [ ] |
| 3 | [T3 · B3 cluster-draw](./batch-3/T3-cluster-draw.md) (worktree) | [ ] |
| 3 | [T4 · B4 edge-labels](./batch-3/T4-edge-labels.md) (worktree) | [ ] |
| 3 | [T5 · B2+B5 splines & arrowheads](./batch-3/T5-splines-arrows.md) (worktree) | [ ] |
| 4 | [T6 · closeout: final sweep + classify all](./batch-4/T6-closeout-classify.md) | [ ] |

## Index

- [decisions.md](./decisions.md) — locked architecture decisions
- [buckets.json](./buckets.json) — exact id lists per bucket (B1–B5) + baseline counts
- [residual-tracker.md](./residual-tracker.md) — produced by T2; per-id verdicts
- [decision-journal.md](./decision-journal.md) — appended during execution
- [batch-N/overview.md](./batch-1/overview.md) — per-batch task tables
- [diagrams/data-flow.md](./diagrams/data-flow.md) · [diagrams/component-map.md](./diagrams/component-map.md)

## Recommended executor

`claude-fable-5` (long-horizon, native 1M). Enable autonomous mode:
`~/.claude/hooks/autonomous-toggle.sh on .`
