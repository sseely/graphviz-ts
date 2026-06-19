# Architecture decisions — ortho P1

## ADR-1 — Index-based arrays, not object references
- **Context:** C addresses trapezoids/query-nodes/segments by integer index into
  growable struct arrays (`tr.data[i]`, `seg[segnum].next`, `qs.data[r]`).
- **Decision:** Mirror exactly — `traps_t`/`qnodes_t`/`segment_t[]` as TS arrays
  with `number` index links; preserve the sentinel index `0` and `SIZE_MAX`
  ("unset") semantics (`is_valid_trap`).
- **Consequence:** index arithmetic ports 1:1; no pointer-graph reconstruction;
  `is_valid_trap(i) = i !== 0 && i !== Number.MAX_SAFE_INTEGER` (port `SIZE_MAX`).

## ADR-2 — Context objects, matching C (no globals)
- **Context:** modern `trapezoid.c` threads `traps_t *tr`, `qnodes_t *qs` through
  every function; `sgraph`/`pq_t` are explicit structs.
- **Decision:** port as TS context objects (`{ data: T[], size: number }` for the
  `LIST(...)` types) passed identically; no module-level mutable state.
- **Consequence:** faithful; unit tests get fresh state per case (no pollution).

## ADR-3 — Trapezoidation takes `permute` as input → deterministic
- **Context:** randomization lives in `partition.c` (P2); `construct_trapezoids`
  consumes a supplied permutation array.
- **Decision:** P1 ports `construct_trapezoids(nseg, seg, permute)` with `permute`
  as a parameter; tests pass a fixed (C-dumped or identity) permutation.
- **Consequence:** P1 output is fully deterministic and byte-oracle-verifiable;
  random-ordering is a P2 concern. Run-to-run variance under fixed permute = STOP.

## ADR-4 — P1 is standalone library code, unwired
- **Context:** `orthoEdges` (pipeline entry) and the `splines.ts` dispatch are P3.
- **Decision:** P1 creates only `src/ortho/*`; it edits NO layout/splines file;
  unit tests are the only consumers.
- **Consequence:** **zero risk to existing layout/goldens** — P1 cannot alter any
  rendered output. Any existing-test/golden change ⇒ STOP (something leaked).

## ADR-5 — Oracle = instrumented native lib/ortho
- **Context:** project rule — validate against native C, not approximation
  (`[[oracle-native-not-wasm]]`).
- **Decision:** dump fPQ pop-sequences, rawgraph adjacency + topsort, sgraph
  node/edge sets + shortPath chains, and trapezoid sets (order-normalized) from
  instrumented C for fixture inputs; pin TS to them; **revert C after** (build via
  `make` in `~/git/graphviz/build`, plugins to `/tmp/gvmine`).
- **Consequence:** exact parity; C tree clean before any commit.

## Rollback
- **Fully reversible.** New files only, unwired; revert the commits. No migration,
  no data, no deployed behavior, no API/schema/output change.

## Number / type mapping
- C `double`→`number`; `size_t`/`int` indices→`number`; `SIZE_MAX`→
  `Number.MAX_SAFE_INTEGER` (used only as the "invalid trap" sentinel, compared by
  equality — never arithmetic, so precision is irrelevant). `pointf {x,y:double}`
  reuse the existing TS geometry type. `C_EPS = 1.0e-7` ported verbatim.
- `snode.cells[2]` references `cell` (P2 maze) → P1 declares a minimal opaque
  `Cell` forward type; P2 replaces it. P1 code must not deref `cell` internals.
