# Architecture decisions — ortho P2 (render-pipeline pinning)

## ADR-1 — Oracle = instrumented native dot via gvmine (not a tiny harness)
- **Context:** `mkMaze`/`partition`/route stages run off a real `graph_t` with
  laid-out node positions; the P1 object-linking harness can't construct that.
- **Decision:** instrument `partition.c`/`maze.c`/`ortho.c` with `fprintf` dumps,
  rebuild the dot layout plugin (`make` in `~/git/graphviz/build`), copy to
  `/tmp/gvmine`, run `GVBINDIR=/tmp/gvmine dot -Tsvg fixture.dot` on
  `splines=ortho` fixtures, capture dumps, then **revert C**.
- **Consequence:** exact native parity; `[[recover-slack-and-c-harness]]` recipe.
  C tree must be clean before any commit.

## ADR-2 — Drive TS from C-dumped node positions
- **Context:** TS layout coords could differ by sub-pixel from C, contaminating a
  pipeline comparison with layout noise.
- **Decision:** dump C node positions/sizes alongside each stage; build the TS
  `OrthoGraph`/maze input from those exact coords so the test isolates
  pipeline logic, not layout.
- **Consequence:** divergences are attributable to maze/partition/route logic, not
  upstream positioning.

## ADR-3 — Bottom-up validation: partition → maze → route
- **Context:** `mkMaze` calls `partition`; route consumes the maze. A higher-stage
  divergence is often a lower-stage bug.
- **Decision:** validate and fix in order partition → maze → ortho-route. Do not
  chase a route divergence before maze+partition are green.
- **Consequence:** localizes bugs to the lowest stage; sequential tasks.

## ADR-4 — Additive, unwired; no rendered-output change
- **Context:** P2 adds tests + faithful fixes to existing `src/ortho/*`; it wires
  nothing into a layout engine (P3 does).
- **Decision:** edit only `src/ortho/*` + tests + `plans/**`. Any existing
  (non-ortho) test or golden change ⇒ STOP — something leaked.
- **Consequence:** zero risk to existing rendered output. (Fixes here also
  benefit neato's existing ortho dispatch — note any in the journal.)

## ADR-5 — Faithful fixes only
- **Decision:** preserve C function boundaries, index-based arrays, and
  side-effect order; `C_EPS`/geometry predicates verbatim. Split a function only
  if the complexity hook forces it (CCN 10 / 30 lines), keeping C boundaries.
- **Consequence:** byte-parity; no algorithmic divergence.

## Determinism (cross-cutting)
`partition` feeds a permute to `construct_trapezoids`. Pin the TS path to the
**C-dumped permute** for each fixture; never guess the ordering. Run-to-run
variance under a fixed permute ⇒ STOP.

## Rollback
**Fully reversible.** New tests + faithful fixes to existing files; revert the
commits. No migration, no API/schema/output change.
