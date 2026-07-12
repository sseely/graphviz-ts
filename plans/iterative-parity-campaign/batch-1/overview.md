# Batch 1 — Injection Harness + Reporting Infra

Builds the tooling batch-2/3/4 depend on. No corpus fixes in this batch —
infra only.

## Tasks

| Task | Subject | Depends on | Status |
|---|---|---|---|
| T1 | Injection attribution harness (`--stage`, oracle-hash guard, POS_INJECT hook) | none | [x] `ed337d9`, `d165453` |
| T2 | Class-acceptance wiring in parity-report + report sections | T1 (needs `attribution-<engine>.json` shape) | [x] `104a233` |
| T3 | Oracle-error classifier (D6) + sidecar report | T1 (shares the harness's rerun/retry plumbing) | [x] `5c1e549` |

T2 and T3 both read T1's output shape but write disjoint files (T2:
`test/corpus/parity-report.ts` + `docs/known-divergences.md` section
scaffold; T3: a new `test/corpus/oracle-error-classifier.ts` +
`test/corpus/oracle-errors-<engine>.json` writer, plus the report hook
T2 exposes for it) — run them in parallel once T1 lands.

## Exit criteria

- `test/corpus/attribute-divergence.ts` (or equivalent name chosen by
  T1) runs end-to-end on a single engine and produces
  `attribution-<engine>.json` matching the T1 interface contract.
- `parity-report.ts` renders A1-drift class membership and an
  oracle-errors sidecar without manual editing.
- All quality gates in `README.md` pass.
