# flat / dot_root / has_labels resolution under `pack`

## Observation: under `pack`, "which graph do I read this field from?" is the whole bug class

- **Context**: Fixing two audited defects in `src/layout/dot/flat.ts` (wrong graph for
  the rank table) and `abomination` (destroyed rank sentinel). Reproduced with a
  2-component graph, `pack=true`, and a labeled flat edge.
- **Finding**: `pack` lays out each connected component as **its own dot-root**
  (`_cc_0`, `_cc_1`), while the cgraph **root** (`G`) is never ranked and has **no rank
  table at all**. So under `pack` there are three distinct graphs a field can be read
  from — the component, the true root, and a cluster — and C picks a *different* one per
  call site. Reading the wrong one is silent, not fatal.

  C's three resolutions, which the port must keep distinct:
  | C expression | resolves to | port equivalent |
  |---|---|---|
  | `dot_root(x)` = `GD_dotroot(agroot(x))` | the graph **currently being laid out** (the component) — a MUTABLE slot re-pointed by `dot_init_subg` on every layout | thread the layout graph in |
  | `g->root` / `agroot(g)` | the **true cgraph root** | `g.root` |
  | `g` | the layout graph itself | `g` |

  Because `GD_dotroot` is a mutable slot on the root, C's `dot_root(some_node)` yields
  the component. The port's `dotRoot(g) = g.info.dotroot ?? g.root` is **per-graph**, so
  `dotRoot(node.root)` yields the TRUE root — a hole that only opens under `pack`.
- **Impact**:
  1. `flat.ts` read `e.tail.root.info.rank` (true root → `undefined`).
     `checkFlatAdjacent` bailed on `if (!rank) return` (a guard C does not have), then
     `flatNode` dereferenced the absent table → **hard crash**
     (`Cannot read properties of undefined (reading '0')`) on any packed graph with a
     labeled NON-adjacent flat edge. Fixed by threading the layout graph (proven by
     instrumentation to be exactly what C's `dot_root(agtail(e))` evaluates to).
  2. `GD_has_labels` is set by C on **`agraphof(agtail(e))` — the true root** — and read
     back by nearly every dotgen site as **`GD_has_labels(g->root)`**
     (`position.c:234`, `dotsplines.c:243/1552/1650/1776`). The ONE exception is
     `edgelabel_ranks` (`rank.c:170`), which C scopes to the layout graph `g`. The port
     set the flag on the *component* and read it from the *layout graph*, so under `pack`
     both were 0 and every `g->root` reader took the wrong branch — most visibly
     `make_LR_constraints` used the full nodesep on odd ranks instead of C's `sep[1] = 5`.
- **Confidence**: High — confirmed by instrumenting BOTH sides and printing the resolved
  graph identity (C: `dot_root(tn) = _cc_0`, has_labels(root)=1; port: `e.tail.root = G`,
  has_labels(root)=0).

## Observation: do NOT "fix" this by re-pointing `dotRoot` at the cgraph root

- **Context**: The obvious faithful move is to mirror C's mutable slot — write
  `agroot(g).info.dotroot = droot` and resolve `dotRoot(g)` via `g.root`.
- **Finding**: This **breaks other call sites**. The port uses `dotRoot()` at sites where
  C means `dot_root` AND at sites where C means plain `agraphof`. Concretely,
  `straight-edges.ts:219 addEdgeLabels` does `dotRoot(e.tail.root)`, whose C counterpart
  (`splines.c:makePortLabels`) is `updateBB(agraphof(agtail(e)), ...)` — it *wants* the
  TRUE root. Today `dotRoot(trueRoot) === trueRoot`, so it is correct; re-pointing the
  root's slot would silently redirect it to the component.
- **Impact**: `straight-edges.ts:219` is **not** a bug — leave it. The safe fix is to
  thread the layout graph explicitly where C says `dot_root`, and use `g.root` where C
  says `g->root`/`agraphof`. Blast radius: zero on non-pack (there `g === g.root` and all
  three resolutions coincide, which is exactly why this class hides).
- **Confidence**: High — read the C for each call site.

## Observation: `abomination` silently dropped C's rank-table sentinel

- **Context**: C `allocate_ranks` is `gv_calloc(GD_maxrank(g) + 2)` (`mincross.c:1155`) —
  index `maxrank+1` is always a **zeroed sentinel**, for root and clusters alike.
- **Finding**: C's `abomination` preserves it by allocating **three** extra slots and
  re-basing the pointer (`GD_rank(g) = rptr + 1`), putting the new rank at index **-1**
  and leaving `maxrank` unchanged. The port has no negative index, so it renumbers +1 and
  shifts the table UP in place — which writes the old top rank OVER the sentinel and then
  raises `maxrank`, leaving `rank[maxrank+1] === undefined`.
- **Impact**: Latent (no reachable unguarded read found *today*), but a real structural
  divergence: `transposeCounts`' useOut gate reads `rank[r+1].n` (`mincross.c:650`) and
  `mergeRanks` reads `rank[mx+1].valid` (`cluster.c:245`) — both would fault. Fixed by
  re-establishing a fresh empty entry at the new `maxrank+1` in BOTH `abomination` and
  `shiftClusterRanks`.
- **Confidence**: High.

## Observation: a pre-existing, UNFIXED divergence found nearby (not in scope)

- **Context**: Auditing every `has_labels` reader while fixing the above.
- **Finding**: `splines-label.ts:370 placePortLabels` gates head/tail label placement on
  `g.info.has_labels & HEAD_LABEL/TAIL_LABEL`. C's counterpart (`dotsplines.c:440`) has
  **no `GD_has_labels` gate at all** — it gates on the `E_headlabel`/`E_taillabel` attrs
  and then per-edge on `ED_head_label(e)`. Under `pack` the component's flag is 0, so the
  port skips port labels that C would place.
- **Impact**: A packed graph with `headlabel`/`taillabel` + `labelangle`/`labeldistance`
  will drop those labels. Left unfixed deliberately (outside this task's scope; it is a
  port-added gate, a different shape of defect). Worth a follow-up.
- **Confidence**: Medium — read the C, but did not build a repro.
