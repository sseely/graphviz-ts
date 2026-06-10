# Architecture Decisions

## D1: One project directory, missions as sequential sub-briefs
Context: 44 failures across 7 engines; far more than one session of work.
Decision: `plans/test-parity/` holds 8 mission directories; each is an
independently executable brief; the root README tracks project status.
Consequences: one canonical decisions/journal; missions runnable across
sessions; status survives compaction.

## D2: Port C poly_init sizing fully; every engine uses it (dot included)
Context: `commonInitNode` never sizes nodes from labels; dot has partial
per-case hooks (record/html only). twopi-star expects rx 33.44 vs our 27.
Decision: faithful port of `common_init_node` + `poly_init` sizing into
`src/common/`, routed through all engines.
Consequences: per-case scaffolding folds away; risk to the 11 passing
dot goldens — they are the canary and must stay green.

## D3: Replicate C numerics exactly for iterative engines
Context: neato/fdp/sfdp tolerance is 0.5pt; refs are deterministic C
output (fixed seed).
Decision: port `drand48`/`srand48` to `src/common/random.ts`; same
initial placement, solver modes (neato `mode=major`), iteration and
convergence constants as C. `Math.random` is forbidden in layout code.
Consequences: bit-faithful porting effort, but tests become reachable;
never relax tolerances or regenerate refs.

## D4: Mission order = leverage first, then smallest C surface to largest
Decision: sizing → osage → patchwork → twopi → circo → neato → fdp → sfdp.
Each mission re-baselines first and prunes failures already fixed.
Consequences: monotonically greener suite; later missions get smaller.

## D5: Goldens beat unit tests
Context: 2 pre-existing unit tests (circo equal-radius, twopi
hub-at-origin) may encode non-C expectations.
Decision: when a unit test contradicts C-derived golden behavior, fix
the unit test to assert C behavior, with a decision-journal entry.
Consequences: C remains the single spec; no dual sources of truth.

## Rollback classification
Every mission is **Reversible**: pure source changes on a feature
branch; rollback = `git revert` of the mission merge commit. No
migrations, flags, or deploys. (Library is pre-publication; output
changes to non-dot engines are the goal, not a compat break.)
