# T2 — Port trapezoid.c (Seidel trapezoidal decomposition)

## Context
Faithful TS port of Graphviz `lib/ortho/trapezoid.c` (898 LOC) + `trap.h` for the
`graphviz-ts` faithful-port project (root `CLAUDE.md`). This is the algorithmic
heart of ortho: Seidel's randomized-incremental trapezoidal decomposition of the
segment set, producing the trap table the maze (P2) is built from. **Standalone**
— depends only on geometry primitives (`pointf`), NOT on rawgraph/sgraph. The
**largest** P1 task. Tests use **vitest**; TS strict; no Node-only APIs.

## Task
Port every struct, predicate, and function from `trapezoid.c`/`trap.h`, preserving
C function boundaries and side-effect order exactly (ADR-1). Key surface:
- Types: `segment_t {v0,v1,is_inserted,root0,root1,next,prev}`,
  `trap_t {lseg,rseg,hi,lo,u0,u1,d0,d1,sink,usave,uside,is_valid}`,
  `traps_t = LIST(trap_t)`, the internal query-node type + `qnodes_t`.
- Predicates (verbatim, incl. `C_EPS=1.0e-7`): `fp_equal`, `dfp_cmp`, `equal_to`,
  `greater_than`, `greater_than_equal_to`, `less_than`, `cross`, `max_`, `min_`,
  `is_valid_trap` (index `0`/`SIZE_MAX` sentinels → `0`/`Number.MAX_SAFE_INTEGER`).
- Machinery: `newnode`, `newtrap`, `init_query_structure`, `locate_endpoint`,
  `merge_trapezoids`, `update_trapezoid`, `add_segment`, `inserted`,
  `math_logstar_n`, `math_N`, and the entry `construct_trapezoids(nseg, seg, permute)`.
- `construct_trapezoids` MUST take `permute` (number[]) as a parameter (ADR-3) and
  thread `traps_t`/`qnodes_t` context (ADR-2) — no globals, no `rand()`.

Watch: C uses 1-based `permute[segi++]` indexing into `seg` and reserves index 0
as a sentinel in `tr`/`qs`; replicate the off-by-one and sentinel reservations
exactly. `LIST(...)` → `{ data: T[], size: number }` with `newnode`/`newtrap`
appending and returning the new index.

## Write-set
- `src/ortho/trapezoid.ts` (create)
- `src/ortho/trapezoid.test.ts` (create)

## Read-set
- `~/git/graphviz/lib/ortho/trapezoid.c` (full)
- `~/git/graphviz/lib/ortho/trap.h` (types + predicates + macros)
- `decisions.md` (ADR-1, ADR-2, ADR-3, ADR-5, number/type mapping)
- existing TS `pointf` geometry type (grep `interface Pointf`/`pointf`); a vitest example

## Architecture decisions (locked)
ADR-1 (index arrays + sentinels), ADR-2 (context objects), ADR-3 (permute is an
input ⇒ deterministic), ADR-5 (C oracle). If faithful porting needs a global or a
nondeterministic dependency, STOP — that contradicts ADR-2/ADR-3.

## Interface contract (output — consumed by P2 partition, NOT this mission)
```ts
interface SegmentT { v0: Pointf; v1: Pointf; is_inserted: boolean;
  root0: number; root1: number; next: number; prev: number; }
interface TrapT { lseg: number; rseg: number; hi: Pointf; lo: Pointf;
  u0: number; u1: number; d0: number; d1: number;
  sink: number; usave: number; uside: number; is_valid: boolean; }
type TrapsT = { data: TrapT[]; size: number };
function constructTrapezoids(nseg: number, seg: SegmentT[], permute: number[]): TrapsT;
function isValidTrap(index: number): boolean;
```

## Acceptance criteria
- Given 1 segment + identity `permute`, when `constructTrapezoids`, then the trap
  count and the **order-normalized** trap set (sort by `hi`,`lo`,`lseg`,`rseg`)
  equal the C dump.
- Given a triangle (3 segments) with a **C-dumped fixed `permute`**, when
  `constructTrapezoids`, then the order-normalized trap set equals C.
- Given a 4-segment rectangle-with-hole-ish fixture + fixed permute, then the
  normalized trap set equals C (covers merge/update paths).
- Given identical inputs invoked twice, then **identical output** (determinism;
  ADR-3). Variance ⇒ STOP.
- `is_valid_trap(0)===false`, `is_valid_trap(MAX_SAFE_INTEGER)===false`,
  `is_valid_trap(1)===true`.

## Observability requirements
N/A — test-only library code.

## Rollback notes
**Reversible** (ADR-4). New files only.

## Quality bar
`npm run typecheck` 0 · `npm test` (new trapezoid tests pass; baseline unchanged)
· `npm run build` OK · C tree clean. The complexity hook caps files at 500 lines /
CCN 10 — if `trapezoid.ts` exceeds caps, split into `trapezoid.ts` +
`trapezoid-query.ts` (private helpers) keeping C boundaries; both still T2's
write-set if split is needed (update the write-set note in the journal). Return
only the structured result — no preamble/summary.

## Commit
One commit: `feat(T2): port ortho Seidel trapezoidal decomposition`.

## Boundaries
- **Never:** simplify/optimize Seidel; introduce `rand()` or globals; edit outside
  the write-set; leave C instrumentation uncommitted.
- **Ask first (STOP):** parity failure after 3 attempts at one site; any required
  deviation from ADR-1/2/3.
