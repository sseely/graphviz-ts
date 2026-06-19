# T2 — curved + compound goldens vs native C (verify, fix on divergence)

## Cardinal rule
**The C binary is the oracle.** The TS port must produce the *same* result C does
for every fixture — same control points, same clip, same label position — because
it makes the *same decisions* as C, only in TypeScript. A golden is not "close
enough"; it matches native `dot -Tsvg` within the deterministic tolerance, or the
port is wrong and gets fixed to match C. Never adjust a fixture or tolerance to
hide a divergence.

## Context
Faithful TS port (root `CLAUDE.md`). Validate `splines=curved` (T1) and
`splines=compound`/`compound=true` end-to-end against native C via `renderSvg` vs
`dot -Tsvg` (gvmine). Compound clipping is already ported (T38) + wired
(`dot/index.ts:128`); this is verify-then-fix (ADR-2). Tests: vitest.

## Task
1. **Fixtures** `test/golden/inputs/`:
   - `dot-curved-single` — `digraph{splines=curved; a->b}`
   - `dot-curved-parallel` — 3 parallel `a->b` (perp spread)
   - `dot-curved-cycle` — `a->b->a` (cycle centroid bend)
   - `dot-compound-lhead` — `compound=true; …; a->b[lhead=clusterB,ltail=clusterA]`
   - `dot-compound-splines` — `splines=compound; a->b->c` (routes as spline)
2. **Mint refs** from native C (`GVBINDIR=/tmp/gvmine dot -Tsvg`), normalized via
   `test/golden/normalize.ts`. Rebuild the dot plugin (`make` in
   `~/git/graphviz/build`) only if `/tmp/gvmine` is stale; **revert C** after.
3. **Register** in `test/golden/manifest.json` (append only; engine `dot`,
   deterministic tolerance to match existing dot entries).
4. **Validate** (`npm test`). On divergence, fix to match C:
   - curved → `src/layout/dot/straight-edges.ts` (T1 code)
   - compound → `src/layout/dot/compound*.ts` (cite the diverging C function +
     dump). Do **not** weaken the golden.

## Write-set
- `test/golden/inputs/dot-{curved,compound}-*.dot` (create)
- `test/golden/refs/dot-{curved,compound}-*.svg` (create)
- `test/golden/manifest.json` (modify — append only)
- `src/layout/dot/straight-edges.ts` (curved fixes)
- `src/layout/dot/compound*.ts` (compound fixes — only on divergence)

## Read-set
- `test/golden/manifest.json`, `test/golden/normalize.ts`, `suite.test.ts`
- `~/git/graphviz/lib/common/routespl.c:975-1045` (curved) and
  `~/git/graphviz/lib/dotgen/compound.c` (only the diverging function)
- `decisions.md#adr-2,#adr-4`; `[[recover-slack-and-c-harness]]` (gvmine recipe)

## Architecture decisions (locked)
ADR-2 (compound verify-then-fix), ADR-4 (native-C oracle; no non-curved/compound
golden may change), ADR-5 (faithful fixes traced to a C line). STOP on deviation.

## Acceptance criteria
- Given each `dot-curved-*` / `dot-compound-*` fixture, when rendered by the TS
  port, then it matches the native-C ref within the deterministic tolerance.
- Given the full golden suite, then **every pre-existing ref is byte-identical**
  (no regression) and all new curved/compound refs pass.
- Given a divergence was fixed, then the fix is traced to a C function + dump in
  the commit message, and confined to `straight-edges.ts`/`compound*.ts`.
- C tree clean (`git -C ~/git/graphviz status --porcelain lib/` empty) post-mint.

## Observability requirements
N/A — test/golden assets + pure-layout fixes.

## Rollback notes
**Reversible** (ADR-4). New goldens + faithful fixes; revert to restore.

## Quality bar
Full mission gate (`batch-2/overview.md`). If a curved fix can't reach C parity
after 3 attempts at one site, **STOP** and document with the C dump
(consecutive-fix rule). Return only the structured result.

## Commit
`test(T2): add splines=curved + compound dot goldens vs native C`
(+ `fix(T2): <curved|compound> parity vs <C function>` per fix).

## Boundaries
- **Never:** edit/regenerate an existing non-curved/non-compound ref; relax
  tolerance to mask a divergence; leave C instrumentation uncommitted; "improve"
  on what C does.
- **Ask first (STOP):** a non-curved/compound golden changes; native-C ref can't
  be produced; 3× non-converging fix at one site.
