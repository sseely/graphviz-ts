# T3 — Ortho golden fixtures + native-C validation (+ reactive parity fixes)

## Context
Faithful TS port (root `CLAUDE.md`). Prove `splines=ortho` renders correctly
under dot by matching **native C** `dot -Tsvg` (the canonical oracle —
`[[oracle-native-not-wasm]]`). The render pipeline below `orthoEdges`
(`maze`/`partition`/`ortho-route`) is unpinned beyond P1; any divergence is a
faithful bug to fix, not a golden to fudge. Needs T1+T2 (full dispatch).

## Task
1. **Fixtures** `test/golden/inputs/dot-ortho-*.dot` — small, deterministic
   `splines=ortho` digraphs covering distinct routing paths:
   - `dot-ortho-chain` — 3-node linear chain (single corridor)
   - `dot-ortho-branch` — branching (1→2, 1→3) (channel split)
   - `dot-ortho-multirank` — ≥4 ranks with a skip edge (virtual-node corridor)
   - `dot-ortho-label` — an edge with a `label` (exercises T2; C positions label,
     edge crosses it)
2. **Mint refs** `test/golden/refs/dot-ortho-*.svg` from native C
   (`GVBINDIR=/tmp/gvmine dot -Tsvg`), normalized via `test/golden/normalize.ts`.
   Rebuild the dot layout plugin with `make` in `~/git/graphviz/build` only if
   `/tmp/gvmine` is stale; **revert C** after (`git -C ~/git/graphviz checkout --
   lib`).
3. **Register** new entries in `test/golden/manifest.json` (engine `dot`,
   `toleranceClass` matching existing deterministic dot entries). Do **not**
   touch existing entries.
4. **Validate**: `npm test` (golden suite). For each diverging fixture, drill the
   responsible stage with the P1 tiny-harness recipe (dump C `maze`/`partition`/
   trap/route state, compare to TS) and apply the **faithful** fix in
   `src/ortho/*.ts`. Re-run until all ortho goldens pass and every non-ortho
   golden is byte-identical.

## Write-set
- `test/golden/inputs/dot-ortho-*.dot` (create)
- `test/golden/refs/dot-ortho-*.svg` (create)
- `test/golden/manifest.json` (modify — append only)
- `src/ortho/*.ts` (modify — **only** if a golden diverges; faithful fixes to
  `maze.ts`/`partition.ts`/`ortho-route.ts`)

## Read-set
- `test/golden/manifest.json` (entry shape), `test/golden/normalize.ts`,
  `test/golden/run.sh`, `test/golden/suite.test.ts`
- `~/git/graphviz/lib/ortho/{maze,partition,ortho}.c` (only the stage that
  diverges)
- `decisions.md#adr-3`; `[[ortho-p1-already-ported-fpq-invariant]]` (harness
  recipe); `batch-3/overview.md#oracle-recipe`

## Architecture decisions (locked)
ADR-3 (SVG-golden bar; drill on failure), ADR-4 (no non-ortho golden may change),
ADR-5. **No label-routing invention** (ADR-2) even if a label golden diverges.

## Acceptance criteria
- Given each `dot-ortho-*.dot`, when rendered by the TS port to SVG, then it
  matches the native-C ref within the deterministic tolerance class.
- Given the full golden suite, when run, then **every pre-existing non-ortho ref
  is byte-identical** (no regression) and all new ortho refs pass.
- Given a divergence was found, when fixed, then the fix is in `src/ortho/*` and
  is justified by a C dump (cite the C function + harness output in the commit).
- Given the C tree after minting, then
  `git -C ~/git/graphviz status --porcelain lib/` shows no tracked `.c/.h` change.

## Observability requirements
N/A — test/golden assets and pure-layout fixes.

## Rollback notes
**Reversible** (ADR-4). New goldens + optional faithful parity fixes; revert to
restore. No migration. (Parity fixes to `src/ortho/*` also benefit ortho-P1's
neato dispatch — note any in the journal.)

## Quality bar
Full mission gate (see `batch-3/overview.md`). If the same maze/partition site is
changed 3× without converging, **STOP** and document in the journal with the C
dump (consecutive-fix rule). Return only the structured result.

## Commit
One commit (or one per faithful fix): `test(T3): add splines=ortho dot goldens
vs native C` (+ `fix(T3): <stage> parity for splines=ortho` per drill fix).

## Boundaries
- **Never:** edit/regenerate an existing non-ortho ref; relax tolerance to hide a
  divergence; leave C instrumentation uncommitted; invent non-C behavior.
- **Ask first (STOP):** a non-ortho golden changes; a divergence needs
  label-routing (not in C); gvmine/native-C ref can't be produced; 3× non-
  converging fix at one site.
