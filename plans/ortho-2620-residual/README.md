<!-- SPDX-License-Identifier: EPL-2.0 -->
# Mission: 2620 pure-ortho edge-routing residual

**Objective.** Drive corpus case 2620's residual ortho edge-path divergence
to conformant or documented-irreducible acceptance. Baseline (main 02af46c,
2026-07-05): 2620 = structural-match, ~423 diffs, maxΔ585, `maxDeltaPath`
`svg/g[1]/g[428]/path[1]/@d[4]` (a single edge coordinate). ALL node-order
diffs are gone — F2/F5's mincross transpose-gate fix made the maze INPUT match
C, so this is a PURE edge-routing residual in the ortho corridor/track pipeline.
Distinct from residual-cleanup's three landed ortho fixes (M1 apple-qsort, M2
addPEdges, M3 gcell-ULP — all on main; 2620 still diverges).

**Global invariant:** conformant count must not drop below 754.

## Batches

| Batch | Status | Doc |
|---|---|---|
| 1 — T1 bounded diagnosis (fable, worktree) | [x] | [batch-1/overview.md](batch-1/overview.md) |
| 2 — T2 outcome (fix OR registry accept) + survey gate | [x] | [batch-2/overview.md](batch-2/overview.md) |
| 3 — T3 closeout | [x] | [batch-3/overview.md](batch-3/overview.md) |

## Constraints

**Stop and ask** when: the fix write-set must exceed `src/ortho/`
(standing amendment — name the expanded set, do not auto-expand); two
consecutive survey-gate failures on the same check; the diagnosis contradicts
a landed fix (M1–M3); verdict=split reveals a second, upstream mechanism.

**Push forward** on: which ortho file to instrument first; test-fixture shape;
any maxΔ=0.0 timeout flip (standalone-verify per the 1652/2646 rule, never a
stop).

**Inherited ops (wholesale from residual-cleanup/endgame):** diagnosis agents
worktree-isolated, docs returned as final messages (writes don't persist —
orchestrator writes analysis/*.md); one registry writer per batch if accept;
per-batch survey gate on an OTHERWISE-IDLE box; NEVER rebuild the dot binary
(oracle-cache signature); revert C instrumentation + rebuild the ortho plugin
(/tmp/gvmine or /tmp/gvplugins) with byte-verification; one-branch-per-fix
squash-merged via an integration branch, push, delete; keep plans/ forever.

## Quality gates (per batch)

- `npx tsc --noEmit` → clean
- `npx vitest run` → green (incl. TB_balance qsort pin — gvQsort is global)
- Survey: `GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json npx tsx test/corpus/survey.ts`
  then `npx tsx test/corpus/rules-gate.ts` → 0 regressions (standalone-verify
  any maxΔ=0.0 timeout flip before calling it a regression)
- Snapshot refresh after pass: `cp test/corpus/parity-rules.json
  test/corpus/parity.json && npx tsx test/corpus/dashboard.ts`

## Links
[decisions.md](decisions.md) · [decision-journal.md](decision-journal.md) ·
analysis/ (diagnosis outputs) · [diagrams/component-map.md](diagrams/component-map.md)

Model routing: T1 fable (tricky ortho diagnosis); T2 sonnet (mechanical fix or
registry write); T3 orchestrator inline. Rollback: everything Reversible.

## Mission summary (closed 2026-07-05)

**Result: 2620 root-caused and closed — SPLIT verdict (accept + fix).**
conformant count holds at 754; 2620 stays structural-match, now ACCEPTED.

T1's diagnosis overturned the "corridor tie-break" framing: the ortho pipeline
is **byte-conformant to C given identical inputs** (proven by injecting C's
exact node coords → 378/378 routes byte-identical). The 423-diff residual is a
**compiler fp-contraction (FMA) artifact**: C's `poly_init` polygon
vertex-extent loop, compiled clang-arm64 `-ffp-contract=on`, produces node
sizes 1–2 ULP larger than strict IEEE; the port (V8, strict IEEE, no fma)
can't match. Those ULPs are amplified by ortho's *faithful* per-relax
int-truncation into an equal-cost corridor tie flip on 4 edges (maxΔ585).
Proven irreducible at the 2646 bar by a controlled `-ffp-contract` on/off
experiment (`310.29250168188713` = C, `...707` = port).

| Outcome | Detail |
|---|---|
| **ACCEPT** | 2620 registered under a **broadened A8** class — from the 2646-only "Proutespline knife-edge tangency" to the general "fp-contract/FMA vs strict-IEEE" class, now with two documented instances (2646 spline solve; 2620 poly_init sizing + ortho amplification). Port == strict-IEEE C. |
| **FIX** | `edgeLen` now reads `ND_coord` instead of round-tripping through the bbox (`src/ortho/index.ts`, mirrors `ortho.c:1124`). Harmless on 2620 (0 routes changed) but removes a latent M1-class qsort-tie hazard on other graphs. 15/15 renderable ortho corpus cases byte-unchanged. |

**Tasks:** T1 (fable diagnosis) → T2a fix + T2b registry (sonnet, parallel) →
T3 closeout. **Gate:** survey green, 2620 allowlisted, no regressions beyond
the recurring 1652 marginal-timeout (standalone-verified PASS 0-diff). vitest
2735 green, tsc clean. Decision point (split) surfaced to and approved by user.

**No open follow-ups from 2620.** The residual is fully explained and either
fixed (edgeLen) or accepted (A8). The followup-residuals backlog note for 2620
is now closed.
