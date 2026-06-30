# T3 — Ortho golden fixtures + native-C validation (+ reactive parity fixes)

## Context
Faithful TS port (root `CLAUDE.md`). Prove `splines=ortho` renders correctly
under dot by matching **native C** `dot -Tsvg` (the canonical oracle —
`[[oracle-native-not-wasm]]`). **Precondition: ortho-P2 has pinned
`maze`/`partition`/`ortho-route`**, so the render pipeline is already C-faithful;
this task is golden minting + validation, and any residual divergence should be
**dispatch/adapter-level** (dot-specific coord/obstacle handling), not pipeline
logic. If a divergence implicates `maze`/`partition`/`ortho-route`, that is a
**P2 gap — STOP and fix it in P2**, not here. Needs T1+T2 (full dispatch).

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
4. **Validate**: `npm test` (golden suite). With P2 green the pipeline is
   C-faithful, so a divergence should be **dispatch/adapter-level** — fix it in
   `src/layout/dot/*` (the T1/T2 dot files). If a divergence clearly implicates
   `maze`/`partition`/`ortho-route`, **STOP**: it is a P2 gap (P2's fixture set
   missed it) — extend P2, do not patch `src/ortho/*` from this mission. Re-run
   until all ortho goldens pass and every non-ortho golden is conformant.

## Write-set
- `test/golden/inputs/dot-ortho-*.dot` (create)
- `test/golden/refs/dot-ortho-*.svg` (create)
- `test/golden/manifest.json` (modify — append only)
- `src/layout/dot/*.ts` (modify — only for dispatch/adapter-level fixes; **not**
  `src/ortho/*`, which is P2's domain)

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
  is conformant** (no regression) and all new ortho refs pass.
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
