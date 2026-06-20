# T2 — Static input-parity diff (aux construction)

## Context
Before instrumenting the aux *layout* passes, rule the *inputs* in or out. C
`make_flat_adj_edges` (`lib/dotgen/dotsplines.c:1122-1213`) builds the aux graph
with several rank-shaping inputs the port may not replicate. The divergence (C
aux size 7 / curl vs port size 4 / straight for the reversed back edge) could be
caused entirely by a missing construction input — cheaper to find by reading
source than by deep C instrumentation (AD-3).

**Prime suspect:** C pins `auxt` to a `rank=source` subgraph
(`dotsplines.c:1170-1178`); the port's `buildFlatAux`
(`splines-flat.ts:149-166`) clones `auxt` straight into `auxg` with no
source-rank pin. Without the pin, `dot_rank` is free to place the reversed pair
on adjacent ranks → no virtual node → straight.

## Task
Produce a **side-by-side input-parity table**, C vs port, for each
aux-construction input. For each: does the port replicate it, and would a
mismatch plausibly change `auxt`/`auxh` rank assignment for the **reversed**
back edge? Inputs to check (≤6, AD-3):
1. **`rank=source` subgraph pinning `auxt`** — C `agsubg` + `agset("rank",
   "source")` + `cloneNode(subg, tn)`. Does the port create an equivalent source
   constraint? Does the port's `dotRank` even honor a `rank=source` constraint on
   a node? (If not, that is a deeper finding.)
2. **`hvye` heavy ordering edge** — weight `10000`, added on the first portless
   edge, else a synthetic pseudo-edge. Port `buildFlatAux:156-164` — same weight,
   same selection rule, same pseudo-edge fallback?
3. **cloneEdge direction** — C `agtail(e)==tn ? auxt→auxh : auxh→auxt`. Port
   `cloneFlatEdge:139-142` keys off `orig.tail === otn`. Confirm the reversed
   back edge clones in the **same direction** on both sides.
4. **`GD_flip` / rankdir setup** — C `cloneGraph` SET_RANKDIR; port
   `cloneGraph:67-87`. Confirm flip/rankdir parity for the non-flipped (TB)
   input case that `#241_0` uses.
5. **`dot_init_node_edge(auxg)`** — C `:1201`. Does the port initialize aux node/
   edge records equivalently before `dotRank`?
6. **`setEdgeType` / `GD_dotroot`** — C `:1199-1200`. Port equivalents present?

Do **not** fix anything (AD-1). This is read + report only.

## Write-set
- `plans/flat-aux-curl-diagnosis/findings-input-parity.md` (Create)

## Read-set
- `decisions.md` (AD-3)
- `src/layout/dot/splines-flat.ts:60-166`
- `src/layout/dot/rank.ts` — search for `source` / rank-constraint handling
  (does the port honor `rank=source`?)
- `lib/dotgen/dotsplines.c:1122-1213` and `cloneGraph`/`cloneNode`/`cloneEdge`
  (`:780-920`) in `~/git/graphviz`

## Interface contract (consumed by T3)
A **suspect-ranked list** (most-likely cause first), each item:
`{ input: string, cReplicated: "yes"|"no"|"partial", rankImpact: "high"|"low",
note: string }`. T3 instruments the highest-`rankImpact` "no"/"partial" item
first.

## Acceptance criteria
- **Given** the six inputs, **when** T2 completes, **then** the
  `rank=source`-subgraph row explicitly states present / absent / not-honorable
  in the port, with the C and port line references.
- **Given** the parity table, **when** read, **then** items are ordered by
  likelihood of changing the reversed edge's rank assignment, highest first.
- **Given** `findings-input-parity.md`, **when** its first 15 lines are read,
  **then** they name the single most-likely cause and whether it is confirmable
  without running C (pure source reasoning) or needs T3's runtime dump.

## Observability
N/A — static analysis, no runtime.

## Rollback
Reversible — documentation only, no code touched.

## Quality bar
No code change → `tsc`/goldens trivially unaffected. `git diff --name-only main`
shows only the one findings file. One commit: `docs(diag): aux-construction
input-parity C vs port (rank=source suspect)`.
