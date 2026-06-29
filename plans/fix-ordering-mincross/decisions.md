# Architecture decisions

## AD-1: Instrument C before any fix (Batch 0 spike)

- **Context**: the exact divergence (wrong constraint set vs lost-through-passes)
  is not yet pinned; the project mandates `instrument-c-before-quarantine`.
- **Decision**: Batch 0 dumps C `do_ordering_node`/`ordered_edges` (the
  FLATORDER/aux constraint edges it installs + the resulting per-rank order
  after each mincross pass) and the port's `doOrderingNode`/`doOrderingAddFlatEdges`
  equivalents, on `graphs/b58.gv` (and `ordering_dot1`), and pins the FIRST
  diverging value.
- **Consequences**: Batch 1 consumes a pinned divergence; no guessing.
  Temporary, env-gated C/port instrumentation, reverted after capture.

## AD-2: Root-cause-driven write-set (decided by Batch 0)

- **Context**: the fix is either in constraint CONSTRUCTION (`mincross-build.ts`
  `doOrderingNode`/`doOrderingAddFlatEdges`) or in PRESERVATION of the order
  through median/transpose (`mincross-order.ts`), or invocation order
  (`mincross.ts`).
- **Decision**: do NOT pre-commit the write-set. Batch 0 determines which file
  holds the first divergence; Batch 1's write-set is exactly that file (+ its
  tests). If both construction and preservation need changes they are one logical
  unit (one task, one commit).
- **Consequences**: minimal blast radius; the change is bisectable to one cause.

## AD-3: Hard invariant — no byte-match regression

- **Context**: mincross is a shared, tie-break-fragile primitive (see memory
  notes `mincross-perf-is-perop-not-iteration`, `ncross-nan-multicomponent-done`,
  `2371`). 12 `ordering` graphs already byte-match; 492 graphs byte-match overall.
- **Decision**: full survey after EVERY change; any byte-match→worse is STOP +
  revert. The 12 matching `ordering` graphs are explicit canaries.
- **Consequences**: ~17 min/iteration accepted. A fix that can't clear b58
  without regressing others is deeper than scoped → stop + document.

## AD-4: Scope = `ordering=out` and `ordering=in`; per-node if same root cause

- **Context**: the 13 diverged graphs use graph-level `ordering=out` (b58,
  ordering_dot1, …) and possibly `=in` (`graphs-in`). The port also supports
  per-node `ordering` via `doOrderingForNodes`.
- **Decision**: fix both `out` and `in`. Per-node `ordering` is in scope only if
  it shares the pinned root cause; otherwise note it as a separate follow-up.
- **Consequences**: covers the whole diverged set's mechanism without expanding
  into an unrelated per-node code path.

## AD-5: Outcome bar — clear what's faithfully fixable, document the rest

- **Context**: some of the 13 may carry a SECONDARY divergence (e.g. an x-NS or
  spline residual) beyond the ordering bug.
- **Decision**: a graph is "done" when its in-rank node order matches C. If a
  secondary cause keeps it diverged, document the residual (which graph, which
  cause) and move on — do not chase unrelated causes in this mission.
- **Consequences**: 2368-style honest outcome; the mission closes on the
  ordering root cause, not on every graph reaching byte-match.

## stop-conditions

1. Any byte-match→worse regression in the survey. STOP + revert that change.
2. 2 consecutive gate failures on the same check. STOP.
3. A fix needs to write outside its declared write-set. STOP.
4. 3 consecutive edits to the same site without resolving it. STOP (deeper
   design problem).
5. A fix cannot make b58 match C (in-rank order) without regressing other
   graphs. STOP + document (shared-invariant problem, not a localized fix).

## Key C references (read-only spec)

- `lib/dotgen/mincross.c`: `do_ordering_node` (432), `do_ordering` (471),
  `do_ordering_for_nodes` (480), `ordered_edges` (504), called from
  `init_mincross` (537) and `dot_mincross` (331). FLATORDER edge type +
  `flat_edges`/`install_in_rank`/`build_ranks` (704) for how the order is
  installed and preserved; `mincross_step`/`transpose`/`medians` for where it
  could drift.
- `lib/common/const.h`: FLATORDER edge-type constant.
- Port mirror: `src/layout/dot/mincross-build.ts` (`doOrderingNode`,
  `doOrderingAddFlatEdges`, `orderedEdges`, `doOrderingForNodes`),
  `mincross-order.ts` (median/transpose/reorder), `mincross.ts` (orchestration,
  `orderedEdges` calls).

## Ground-truth data (b58, this session)

- C node x: `{1:27,6:45,3:81,2:99,8:117,5:171,7:207,4:243}`.
- port node x: `{1:27,6:63,2:243,3:135,7:135,5:171,8:207,4:99}`.
- Both render bbox 278×188; all-ellipse nodes; the divergence is in-rank ORDER.
- `ordering_dot1` shows the same signature (nodes mis-ordered, coord-count
  swaps on edges), confirming a shared root cause.
