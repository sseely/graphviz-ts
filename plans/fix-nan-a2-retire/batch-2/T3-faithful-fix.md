<!-- SPDX-License-Identifier: EPL-2.0 -->
# T3 — Faithful fix at the mechanism's origin

## Context
T2 produced a mechanism artifact (`.agent-notes/nan-edge-endpoint-diagnosis.md`)
with `classification: port-defect` and a `fixLocus`. The C source
(`~/git/graphviz/lib/…`) is the spec — port the C behavior exactly at the
origin; no compensating tweaks downstream of it (diagnosis.md scope-of-change
rule).

## Task
1. Read the mechanism artifact. If `fixLocus` ⊄ this task's write-set:
   **STOP — write-set expansion ask** (decisions.md protocol). Do not edit
   outside the declared set without approval.
2. Implement the faithful fix at `mechanism.origin`, mirroring the C code
   (cite `@see` C file:line). No boolean guards special-casing NaN; the fix
   must be the general C behavior.
3. Add/extend a unit test capturing the mechanism (not just the symptom) in
   the module's `.test.ts`.
4. Gate: render `graphs/`, `share/`, `windows/NaN.gv` — per-element compare
   (title-keyed, path/polygon lists) vs oracle.

## Write-set (PROVISIONAL — expansion via ask)
- `src/layout/dot/edge-route*.ts`, `src/layout/dot/splines-route*.ts`,
  `src/common/splines-clip.ts`
- matching `.test.ts` files
- **EXPANDED 2026-07-01 (user-approved, see decision-journal):**
  `src/layout/dot/splines-groups.ts`, `src/layout/dot/splines-groups.test.ts`
  (new) / `src/layout/dot/multi-edge.test.ts`

## Read-set
- `.agent-notes/nan-edge-endpoint-diagnosis.md` (the spec for this task)
- The C function(s) named in `mechanism.origin`'s causal chain
- `plans/fix-nan-a2-retire/decisions.md#write-set-expansion-protocol`

## Acceptance criteria
- Given the fix, when the 3 NaN renders are compared per-element, then
  edges-differing = 0 and nodes-differing = 0 on all three.
- Given `npx tsc --noEmit` / `npx vitest run` / `npx vitest run test/golden`,
  then 0 errors / all pass / all pass.
- Given the diff, when reviewed, then changes trace to `mechanism.origin`
  (single-origin fix; a spread across symptom sites = stop and re-diagnose).
- Given lizard caps (file 500 / CCN 10 / params 5), when the hook runs, then
  no new violations.

## Observability / Rollback
N/A — library layout code; gates are the observability. Reversible.

## Commit
`fix(dot): <mechanism, one line> — closes NaN edge-endpoint residual`
(body: mechanism summary + C refs; references T3)
