# T3 — Oracle-pin ortho-route.ts (routing / segment / track assignment)

## Context
Faithful TS port (root `CLAUDE.md`). `ortho-route.ts` (339 LOC, port of the
routing half of `lib/ortho/ortho.c`) turns per-edge `shortPath` results into
orthogonal route point lists: `convertSPtoRoute` (path→segments),
`assignSegs`/channel extraction, `segCmp` ordering, `assignTracks`
(`vtrack`/`htrack`), and final route emission. This is the largest unpinned
stage and the main P3 risk. Pin route point lists + track assignment to native
C. Depends on T2 (maze green). Tests: vitest; TS strict.

## Task
1. Reuse the T1/T2 fixtures. Via the gvmine oracle (instrument `ortho.c`), dump
   per edge: the `shortPath` node chain, the assigned segments (channel, track,
   p1/p2), and the **final route point list** (the orthogonal polyline installed
   into the edge). Also dump the channel/track structures (`extractHChans`/
   `extractVChans`/`assignTracks`).
2. Write `ortho-route.test.ts`: reconstruct the maze (via `mkMaze` on C-dumped
   positions, T2-pinned) + drive the same edges; assert the route point lists and
   track numbers equal the C dump (exact; routing is deterministic given the maze).
3. Drill divergences (only after T1+T2 green for the fixture). Watch `segCmp` and
   its helpers (`overlapSeg`/`ellSeg`/`segCmpInner`) — the channel ordering is the
   subtle, load-bearing part. Faithful fixes confined to `ortho-route.ts`.

## Write-set
- `src/ortho/ortho-route.test.ts` (create)
- `src/ortho/ortho-route.ts` (modify — only on parity divergence)

## Read-set
- `~/git/graphviz/lib/ortho/ortho.c` (extractHChans:305, extractVChans:341,
  assignSegs:395, assignTracks:1021, vtrack/htrack:1051-1069, attachOrthoEdges:1069)
- `src/ortho/ortho-route.ts`, `src/ortho/maze.ts` (T2), `src/ortho/sgraph.ts` (P1)
- `decisions.md` (ADR-1/2/3/5); `[[recover-slack-and-c-harness]]`

## Architecture decisions (locked)
ADR-1 (gvmine oracle), ADR-2 (C-dumped positions), ADR-3 (T1+T2 green first),
ADR-4 (additive), ADR-5 (faithful). STOP on required deviation.

## Interface contract
`convertSPtoRoute`, `assignSegs`, `assignTracks` (and `segCmp`) — unchanged
signatures; route point lists + track numbers pinned to C.

## Acceptance criteria
- Given a fixture (C-dumped positions → `mkMaze` → same edges), when routed, then
  each edge's final orthogonal route point list equals the C dump exactly.
- Given the same, then per-segment channel + track assignments (`vtrack`/`htrack`)
  equal C.
- Given identical inputs twice, then identical routes (determinism).
- A divergence fix is faithful (cite C function + dump) and confined to
  `ortho-route.ts`.
- C tree clean post-mint.

## Observability requirements
N/A — test-only library code.

## Rollback notes
**Reversible** (ADR-4). New test + optional faithful fix. (Fixes also harden
neato's existing ortho dispatch — note in journal.)

## Quality bar
Full mission gate (`batch-3/overview.md`). CCN/length caps; **consecutive-fix
STOP** (3× at one site without converging — `segCmp` is the likely hot spot;
document with the C dump if hit). Return only the structured result.

## Commit
`test(T3): oracle-pin ortho route/seg/track assignment vs native C`
(+ `fix(T3): …` per faithful fix).

## Boundaries
- **Never:** edit outside the write-set; leave C instrumentation uncommitted;
  optimize routing/`segCmp`; chase a route divergence before T1+T2 are green.
- **Ask first (STOP):** parity fails after 3 attempts at one site (esp. `segCmp`);
  routing is nondeterministic for a fixture.
