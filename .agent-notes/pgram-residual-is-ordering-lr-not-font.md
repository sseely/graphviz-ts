# pgram residual = ordering=out over-enforcement under rankdir=LR (NOT label/font)

## Observation: the "pgram ~0.41px label/font residual" was a MISCHARACTERIZATION
- **Context**: after activating `ratio=fill` (which fixed pgram's dimensions to the
  exact 504×683), pgram stayed `diverged`. Earlier notes called this a "~0.41px
  label/font residual" — WRONG. That number was a `flat-geom-diff` artifact: pgram
  has 26 edges all titled `Parallelogram->Octagon`, which breaks the harness's
  title-keyed element alignment (reports `max delta = count/missing`).
- **Finding**: the real residual is the **A–Z target-rank node ORDER** (~600px
  deltas, not 0.41px):
  - **C**: `A C E G I K M O Q S U W Y B D F H J L N P R T V X Z` — DECLARATION order
    (the `rank=same` block declares houses A,C,E,…,Y first, then invhouses B,D,…,Z).
  - **Port**: `A B C D E F … Z` — strict ALPHABETICAL = full `ordering=out`
    FLATORDER enforcement (PP→A,→B,…,→Z edge order). The port OVER-enforces.
  - The a–z rank matches C exactly; only the `ordering=out` target rank diverges.
- **Pre-existing**: rendering pgram at the pre-session commit `1b2280c` (before the
  `left2right` and `ratio=fill` work) ALSO gives alphabetical. So neither of those
  changes caused it; `ratio=fill` correctly fixed the dims and EXPOSED this
  underlying ordering divergence. NOT the `left2right` GD_flip swap I rejected
  (proven inert: both consumers test only `!= 0`).

## Trigger pinned by bisection
- `rankdir=LR` is required: the SAME graph in default TB → C==port (`ACEBDF`).
- The `ordering=out` node must be a MIDDLE node (have an in-edge) AND have a flat
  out-edge to a same-rank sibling. `n1->PP->OCT` (in-edge n1→PP + flat PP→OCT, like
  pgram's `a->Parallelogram->Octagon`) triggers it; a bare in-edge `n1->PP` does NOT.
- **Minimal repro (8 nodes)**: `test/diagnostic/pgram-ordering-lr-repro.gv`.
  C=`ACEBDF`, port=`ABCDEF`. Drop `rankdir=LR` → both `ACEBDF`.

## Mechanism (direction; exact site needs C instrumentation)
Both C and the port build the same FLATORDER chain (PP's ordered out-edges →
A→B→…). Under LR (`GD_flip`) with the ordering node holding in- and flat-edges,
the port's mincross OVER-applies the chain to a full alphabetical sort of the
target rank, while C stops at declaration order (the all-to-one fan-out has zero
crossings, so C leaves the initial install/declaration order). Pinning WHICH
mincross pass/function diverges (build_ranks flip-reversal `buildRanksFlip`
mincross-build.ts:240 / `flat_reorder` / install order) requires the same
C-instrumentation spike used for b58's `left2right` (rebuild gvplugin_dot_layout,
ENFDBG-gate the flat order through the passes, diff). Scope = a separate mission.

## Impact
- pgram×3 stay `diverged` on THIS cause (ordering=out + LR), independent of the
  resolved ratio=fill. The 0.41px/font framing in
  `.agent-notes/pgram-trapeziumlr-is-ratio-fill-gated.md` and memory
  `ratio-fill-activation-done` is corrected by this note.
- **Confidence**: High (bisected to an 8-node minimal repro, C-spec-confirmed,
  pre-session-confirmed pre-existing).
