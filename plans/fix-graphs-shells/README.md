<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: root-cause and fix `graphs-shells`

## Objective

`graphs-shells` (and identical siblings `share-shells`, `windows-shells`) are
`diverged` in the parity survey. The reported symptom is an edge spline
(`svg/g[1]/g[27]/path[1]/@d`, maxΔ 264), but that is **downstream**. The real
divergence is **within-rank left-right ordering on three `rank=same` flat
groups** in dot mincross. Root-cause the exact mincross stage, apply a faithful
(C-spec-matching) fix, and restore all three variants to conformant or
structural-match with **zero net parity regressions**.

## Confirmed diagnosis (pre-mission)

All node ranks (y-coords) already match the oracle. Only three flat ranks have
swapped order:

| rank (y) | PORT | ORACLE |
|---|---|---|
| -12 | `POSIX ksh-POSIX` | `ksh-POSIX POSIX` |
| -376 | `System-V ksh` | `ksh System-V` |
| -449 | `esh vsh` | `vsh esh` |

Subsystem: `src/layout/dot/mincross*.ts`; C spec
`~/git/graphviz/lib/dotgen/mincross.c`. Full finding:
`.agent-notes/graphs-shells-flat-order-divergence.md`. **Not yet pinned**: init
seed vs iteration tie-break, and crossing-count parity — that is Batch 1's job.

## Branch

`fix/graphs-shells-flat-order` (merge commit on completion — preserves per-task
commit IDs).

## Constraints

**This is a faithful port.** The C source is the spec (project `CLAUDE.md`). Do
not optimize, simplify, reorder, or rewrite the mincross algorithm. The fix must
mirror C behavior at the divergence origin.

### Stop conditions
- Batch 1 finishes → **STOP and report the mechanism** before any fix (gated).
- Crossing counts are genuinely worse in the port AND the C order cannot be
  matched without an algorithm change.
- The fix improves shells but regresses any currently-conformant case.
- Any file outside the declared write-set needs changing.
- 2 consecutive quality-gate failures on the same check; or the same line changed
  3× without resolving the same failure.

### Push-forward conditions
- Choosing which mincross file holds the fix, once Batch 1 pins the origin.
- Test phrasing, instrumentation details, decision-journal wording.
- Stylistic choices with no behavioral effect.

## Quality gates

| command | pass | on_fail |
|---|---|---|
| `npm run typecheck` | exit 0 | fix_and_rerun |
| `npx vitest run src/layout/dot` | exit 0 | fix_and_rerun |
| `npm run survey && npm run survey:gate` | exit 0 (no regressions) | stop |
| 3 shells variants re-rendered | L-R order matches oracle on the 3 flat ranks | stop |
| `git diff --name-only` | matches declared write-set only | stop |

Parity baseline refresh recipe (Batch 2, T3): `npm run survey` (writes
`parity-rules.json`) → `npm run survey:gate` (must be 0 regressions) →
`cp test/corpus/parity-rules.json test/corpus/parity.json` →
`npm run survey:dashboard` (regenerates `PARITY.md`).

## Batches

| Batch | Status | Tasks |
|---|---|---|
| [Batch 1 — Diagnosis (gated)](batch-1/overview.md) | [x] | T1 |
| [Batch 2 — Fix + verify](batch-2/overview.md) | [ ] | T2, T3 |

## Index

- [decisions.md](decisions.md) — architecture decisions
- [batch-1/overview.md](batch-1/overview.md) · [T1](batch-1/T1-instrument-mincross-order.md)
- [batch-2/overview.md](batch-2/overview.md) · [T2](batch-2/T2-apply-faithful-fix.md) · [T3](batch-2/T3-regression-test-and-baseline.md)
- [diagrams/component-map.md](diagrams/component-map.md)
- [decision-journal.md](decision-journal.md)
- Prior finding: `.agent-notes/graphs-shells-flat-order-divergence.md`
