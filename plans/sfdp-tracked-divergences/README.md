# Mission: sfdp tracked divergences → solve or accept

## Objective

Drive the sfdp **tracked** divergence count to zero — every remaining
tracked id ends as either a landed fix (with 0-regression proof) or a
documented, evidence-backed accept-registry entry. Post-`bagInsert` the sfdp
engine sits at **520 pass / 234 diverged** (184 accepted A1-drift, **50
tracked**). The 50 are the work; they split into 5 probable-cause buckets.
The attribution that produced the 50/184 split is **stale** (2026-07-14,
pre-`bagInsert`), so Mission 0 regenerates it first — that alone is expected
to reclassify the majority.

Policy (user-confirmed): **fix aggressively** — attempt a fix in every bucket,
even FP-tie/boundary cases; accept only when a controlled experiment proves
the cause is a platform-FP floor the port cannot reproduce. Platform-duplicate
families (graphs-/share-/windows-/linux.i386- copies of one input) are
**analyzed once at a representative and the verdict applied to all copies.**

## Branch

`feature/sfdp-tracked-divergences` (merge-commit to main per commits.md;
one commit per task, referencing the task id).

## Quality gates (run between batches; see per-task specs)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npm test
  pass: exit 0
  on_fail: fix_and_rerun
- command: fresh sfdp engine-walk to a SCRATCH jsonl, diff verdicts vs baseline
  pass: 0 pass->diverged regressions
  on_fail: stop
```

Sweep discipline (CLAUDE.md + [[corpus-silence-is-not-coverage]]): never edit
`src/` while a sweep runs; always run a FRESH (scratch-jsonl) sweep — resume
hides regressions; `pgrep` before trusting any sweep handoff (a stray second
sweep corrupts the jsonl — happened this session).

## Constraints

**Stop and wait** when: a fix touches files outside the task write-set and no
other task owns them; 2 consecutive gate failures on the same check; the same
code location is changed 3× without resolving the check ([[bucket-fix-rebucketing]]);
an accept is proposed without the required controlled-experiment evidence
(diagnosis.md forbids "good enough").

**Push forward** when: the fix is obvious and self-contained; an id is a
byte-identical platform copy of an already-verdicted representative; a bucket
turns out empty after Mission 0's regen (skip it, log why).

## Key mechanisms already proven this session (do not re-derive)

- sfdp iterative drift is chaotic/irreducible; the injection-attribution
  harness is the classifier ([[iterative-drift-regimes-measured]]).
- edge-label (2470/1652) divergence = single objplpmks floor()-boundary rect
  amplified by the intentionally-lossy xlabel RTree — irreducible
  ([[sfdp-edge-label-rtree-lossy]]).
- multispline/flat edges carry CDT incircle + hypot FP-ties (A9 class,
  [[multispline-port-landed]], [[fma-ccw-emulated]]).
- native `GVTS_POS_DUMP` patch is applied in `~/git/graphviz`
  neatosplines.c (env-gated); inject recipe in
  `plans/iterative-parity-campaign/diagrams/injection-recipe.md`.

## Batches

| Batch | Focus | Depends | Done |
|-------|-------|---------|------|
| [0](batch-0/overview.md) | Root-cause the majority: regenerate attribution + re-bucket | — | [ ] |
| [1](batch-1/overview.md) | B1 graph-bb residual (rep graphs-unix) | 0 | [ ] |
| [2](batch-2/overview.md) | B2 edge FP-ties (reps 42, 241_0, 2521_1) | 0 | [ ] |
| [3](batch-3/overview.md) | B3 rankdir_dot edge family | 0 | [ ] |
| [4](batch-4/overview.md) | B4 ratio=fill aspect-scaling (trapeziumlr, pgram, 1855) | 0 | [ ] |
| [5](batch-5/overview.md) | B5 known (2475_2, 2470, nshare-arrows_dot) | 0 | [ ] |
| [6](batch-6/overview.md) | Finalize: registry, docs, full sweep | 1-5 | [ ] |

Links: [decisions.md](decisions.md) · [decision-journal.md](decision-journal.md) ·
[diagrams/data-flow.md](diagrams/data-flow.md) ·
[diagrams/component-map.md](diagrams/component-map.md)

## Reading order for the executor

Read this file, then `decisions.md`, then `decision-journal.md`. Start Batch 0.
Do NOT read all batch files up front — Batches 1-5 are refined by Batch 0's
`findings.md`; read each batch's `overview.md` only when you reach it.
