# T1 — Oracle-pin partition.ts

## Context
Faithful TS port (root `CLAUDE.md`; C is spec). `partition(cells, bb)`
(`src/ortho/partition.ts:132`, port of `lib/ortho/partition.c`) splits the gcell
obstacle set into a set of rectangles, using the P1-pinned `construct_trapezoids`
plus the monotone-chain logic. Pin it byte-for-byte to native C. Tests: vitest;
TS strict.

## Task
1. Pick 2-3 small `splines=ortho` fixtures (reuse/anticipate the P3 fixtures:
   a 2-node pair, a 3-node chain, a branch).
2. Via the gvmine oracle (see `batch-1/overview.md`), dump for each fixture: the
   **permute** partition feeds to `construct_trapezoids`, the input gcell bbs, and
   the output rectangle set (order + coords).
3. Write `partition.test.ts`: build the input cells from the C-dumped gcell bbs,
   invoke `partition` with the **C-dumped permute**, assert the rectangle set
   (order-normalized if C order isn't reproducible, else exact) equals C.
4. If divergent, drill (it sits directly on P1's `construct_trapezoids`, which is
   pinned — so a divergence is in partition's own chain/monotone logic) and apply
   a faithful fix to `partition.ts`.

## Write-set
- `src/ortho/partition.test.ts` (create)
- `src/ortho/partition.ts` (modify — only on parity divergence)

## Read-set
- `~/git/graphviz/lib/ortho/partition.c` (full — 155 LOC region of interest)
- `src/ortho/partition.ts`, `src/ortho/trapezoid.ts` (P1 entry it calls)
- `decisions.md` (ADR-1 oracle, ADR-2 dumped-inputs, ADR-5 faithful, determinism)
- `[[recover-slack-and-c-harness]]` (gvmine recipe); one vitest example

## Architecture decisions (locked)
ADR-1 (gvmine oracle), ADR-2 (drive from C-dumped gcells+permute), ADR-3
(bottom-up — partition is the bottom of this mission), ADR-4 (additive/unwired),
ADR-5 (faithful). STOP on any required deviation.

## Interface contract
`partition(cells: Cell[], bb: OrthoBox): OrthoBox[]` — unchanged signature;
output rect list pinned to C.

## Acceptance criteria
- Given a fixture's C-dumped gcells + permute, when `partition`, then the output
  rectangle set equals the C dump (exact if C order reproduces; else
  order-normalized by `(LL.x, LL.y, UR.x, UR.y)`).
- Given identical inputs twice, then identical output (determinism; variance ⇒ STOP).
- Given a divergence, when fixed, then the fix is faithful (cite C function + dump
  in the commit) and confined to `partition.ts`.
- C tree clean (`git -C ~/git/graphviz status --porcelain lib/` empty) post-mint.

## Observability requirements
N/A — test-only library code.

## Rollback notes
**Reversible** (ADR-4). New test + optional faithful fix.

## Quality bar
`npm run typecheck` 0 · `npm test` (new tests pass; baseline unchanged) ·
`npm run build` OK · C tree clean. CCN 10 / 30-line / 500-file caps apply. If a
site is fixed 3× without converging, STOP (consecutive-fix rule). Return only the
structured result.

## Commit
`test(T1): oracle-pin ortho partition vs native C` (+ `fix(T1): …` per faithful fix).

## Boundaries
- **Never:** edit outside the write-set; leave C instrumentation uncommitted;
  guess the permute; optimize the partition algorithm.
- **Ask first (STOP):** C-oracle parity fails after 3 attempts at one site;
  partition output is nondeterministic under a fixed permute.
