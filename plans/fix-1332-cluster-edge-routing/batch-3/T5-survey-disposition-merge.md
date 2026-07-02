<!-- SPDX-License-Identifier: EPL-2.0 -->
# T5 — Full survey, disposition, merge

## Task
1. Confirm C tree pristine + oracle byte-verified (against 1332's emitted
   SVG — its exit 1 is normal).
2. Full survey (`GVBINDIR=/tmp/ghl PARITY_OUT=parity-rules.json TSX_BIN=<tsx>
   $TSX_BIN test/corpus/survey.ts`) then `$TSX_BIN test/corpus/rules-gate.ts`
   vs COMMITTED HEAD parity. 0 regressions; every mover explained
   (per-element where childCount masks; oracle-crash ids are known noise —
   verify port bytes unchanged before dismissing).
3. Disposition per D1 outcome:
   - Rungs 1–2 (counts match): expect 1332 conformant or structural-match;
     nothing to accept. If a doc claim about 1332 exists anywhere, sync it.
   - Rung 3 (irreducible-fp): add ONE accepted-divergences.json entry (new
     class, e.g. `R-pshortest`, scope parity) + a docs/known-divergences.md
     section with the forced-polygon evidence; keep guard tests green per
     their own conventions.
4. `cp test/corpus/parity-rules.json test/corpus/parity.json`;
   `$TSX_BIN test/corpus/dashboard.ts` → PARITY.md.
5. Mission summary at the bottom of README.md; final journal rows; memory
   update if a durable lesson emerged (e.g. corridor mechanism class).
6. Merge `fix/1332-cluster-edge-routing` → `main` with a **merge commit**;
   do NOT delete the branch. Push only if the user asks.

## Write-set
`test/corpus/{parity.json, parity-rules.json, PARITY.md,
accepted-divergences.json (rung 3 only)}`, `docs/known-divergences.md`
(rung 3 only), `plans/fix-1332-cluster-edge-routing/**`. Guard-test sync
edits follow the push-forward rule (guards' own documented conventions).

## Acceptance criteria
- Given the survey, when rules-gate runs, then exit 0 and 0 regressions.
- Given rungs 1–2, when parity.json is read, then 1332 is no longer
  `diverged` and `firstDiffPath` is not childCount.
- Given rung 3, when the guard tests run, then PASS with the new entry.
- Given PARITY.md, when regenerated, then it reflects the disposition.

## Observability / Rollback
Survey + gates. Reversible (merge revert).

## Commit(s)
`chore(1332): refresh parity + disposition per D1 outcome` + merge commit
`Merge fix/1332-cluster-edge-routing: <outcome one-liner>`.
