# Architecture Decisions

## AD-1: reposition iterates the aux node list (`nlist`), not the Map

**Context:** C `make_flat_adj_edges` reposition loops `GD_nlist(auxg)` —
the full ordered node list including VIRTUAL nodes. TS `repositionFlatAux`
loops `aux.auxg.nodes.values()` (named nodes only), so virtual label and
routing nodes keep their un-rotated `y`. Diagnosis confirmed: NLIST had
`a, b, <label-vnode x=51>, <routing-vnode x=18>`; the Map had only `a, b`.

**Decision:** Iterate `aux.auxg.info.nlist` via `.info.next` (mirroring
`GD_nlist` / `ND_next`), special-casing `auxt`/`auxh` exactly as before.

**Consequences:** Virtual nodes get `y = midx`; the labeled-flat spline
becomes byte-exact and the label X corrects. Proven safe: 1853 pass, zero
golden churn. This is [[active-fitter-no-loop-corridors]]-adjacent: the
Map-vs-nlist split is the same hazard family as [[calloc-zero-vs-undefined-port-hazard]].

## AD-2: fix the aux label Y within the aux pipeline only

**Context:** After AD-1 the aux label `pos.y` is still 59.25 (pre-reposition)
vs the repositioned vnode `coord.y=72`. The label vnode has `in:1,out:1`
(so it is not the `in.size==0` flat skip). `placeRegularEdgeLabels` →
`placeVnlabel` should set `l.pos.y = vnode.coord.y`, but the final label
object retains 59.25 — likely a label-object identity mismatch (the vnode's
label vs the edge's label) or a placement that ran before reposition.

**Decision:** First step of T2 is to read `placeVnlabel`/`placeRegularEdgeLabels`
against the aux graph's actual vnode/edge/label object graph and identify
why the edge label is not updated from the repositioned vnode. Fix
faithfully to C's `dot_splines_ → setEdgeLabelPos` ordering (label placed
after reposition). **Scope the fix to the aux/flat-adj path** — do NOT
change label placement for regular non-aux graphs (would risk the 1853
goldens). If the only correct fix is global, STOP and surface it.

**Consequences:** Bounded to the aux pipeline. If the label object identity
is the cause, the fix is local (point placement at the right label / refresh
after reposition).

## AD-3: DOT-10 copy-back reuses the existing `updateBB`

**Context:** C copy-back (dotsplines.c:1273-1277) transforms the aux label
pos back and calls `updateBB(g, ED_label(e))`. `copyOneFlatSpline` receives
`bb` not `g`; threading both would exceed the 5-param hook limit.

**Decision:** Swap `copyOneFlatSpline`'s `bb` param for `g` (derive bb
internally), add `copyFlatLabel(orig, auxe, del, flip, g)`, and `export`
the existing private `updateBB` from `splines-label.ts`.

**Consequences:** Stays at 5 params, reuses `updateBB` (DRY). Lands the
label byte-exact once T1+T2 are in. Validated end-to-end in diagnosis
(label X already 72 after T1; T2 fixes Y).

## AD-4: rollback / compatibility

Reversible — revert the merge. No data migration, no API/schema change.
Additive correctness for a previously-broken flat case.
