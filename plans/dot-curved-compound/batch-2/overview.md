# Batch 2 — curved + compound goldens vs native C

Prove `splines=curved` (T1) and `splines=compound`/`compound=true` render to match
native C. Compound is verify-then-fix (ADR-2): it's already wired/ported (T38), so
divergence is the trigger for any fix, not an assumption.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T2 | curved + compound fixtures + native-C refs + manifest; validate; fix on divergence | sonnet | `test/golden/inputs/dot-{curved,compound}-*.dot`, `test/golden/refs/dot-{curved,compound}-*.svg`, `test/golden/manifest.json`, `src/layout/dot/splines.ts` (curved group fix), `src/layout/dot/compound.ts`+`index.ts` (compound wiring fix) | T1 | [x] |

**Outcome:** 4 of 5 goldens pass byte-exact vs native C (curved-single,
curved-parallel, curved-cycle, compound-splines). 1 quarantined with a
comparison page (`quarantine/`): `dot-compound-lhead` (compound path clips
correctly after the wiring fix; arrow-clip `arrowEndClip` unported — a
T38-completion sub-task). The `makeStraightEdges` port is byte-exact to C.
(`dot-curved-cycle` was briefly quarantined on a wrong hypothesis, then fixed
via C instrumentation — see decision journal.)

## Dependency / file ownership
- T2 needs T1 (curved routing). `manifest.json` appended (new entries only —
  **do not modify existing entries**).

## Gate after batch (full mission gate)
- `npm run typecheck` 0 · `npm test` (new curved/compound goldens pass vs native-C
  refs; **every existing golden byte-identical**) · `npm run build` OK.
- `git -C ~/git/graphviz status --porcelain lib/` clean.
- `git diff --name-only` shows only `src/layout/dot/**`, `test/golden/**`,
  `plans/**`.
- **STOP** if a non-curved/non-compound golden changes, or a curved fix can't reach
  C parity after 3 attempts at one site.

## Oracle recipe
Native `dot -Tsvg` via `/tmp/gvmine` (`GVBINDIR=/tmp/gvmine dot`), normalized by
`test/golden/normalize.ts`. Fixtures (small, deterministic):
- curved: single `a->b`; 3 parallel `a->b`; a 2-cycle `a->b->a`.
- compound: `compound=true` with `a->b [lhead=clusterB]` / `[ltail=clusterA]`;
  one `splines=compound` graph (should route as spline).
