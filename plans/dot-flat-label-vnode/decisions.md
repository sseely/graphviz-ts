# Architecture Decisions

## AD-1: the fix is the aux label-vnode reposition, scoped to the aux/regular router

**Context:** Deep C-instrumented dive proved the algorithms are identical
(dispatch → `make_flat_adj_edges`; `cloneGraph`→LR; `map_point`;
`place_vnlabel`). The label-Y error is solely that TS's aux label vnode is
not repositioned onto the routed spline during the aux `dot_splines_`
routing loop (C: `make_regular_edge` moves it 33→11.71; TS: stays 51).

**Decision:** T1 ports C's label-vnode reposition in `make_regular_edge`
(the aux's regular-edge router). First step: pin the exact C line/step with
the instrumentation harness (dump the vnode coord across `make_regular_edge`
internals), then port it. The aux graph runs the same TS routers as a real
graph, so the fix must NOT change regular-edge label placement for non-aux
graphs — verify the 1855 goldens stay byte-identical.

**Consequences:** The fix lives in the regular-edge routing path
(`edge-route*.ts` / wherever the labeled cross-rank edge positions its
label vnode). Risk: shared with all regular labeled edges — gate hard on
goldens. If C's reposition only applies under a condition absent in
regular graphs, replicate that condition faithfully.

## AD-2: do not touch the coordinate-origin normalization

**Context:** TS's main coords are +27 (aux +18) vs C at flat-route time
(normalization-timing difference). This washes out for the spline and is
NOT the fix target — changing normalization timing is global and risky.

**Decision:** Leave the coordinate origins alone. The reposition (AD-1)
puts the label vnode on the spline regardless of origin, which is what
makes C correct.

## AD-3: DOT-10 copy-back reuses existing updateBB

**Context:** C copy-back (`dotsplines.c:1273-1277`) transforms the aux
label pos back. `copyOneFlatSpline` takes `bb` not `g`.

**Decision:** Swap `copyOneFlatSpline`'s `bb` param for `g` (derive bb),
add `copyFlatLabel(orig, auxe, del, flip, g)`, export the private
`updateBB` from `splines-label.ts`. Stays ≤5 params.

**Consequences:** Lands the label byte-exact once T1 positions the aux
vnode correctly.

## AD-4: rollback / compatibility

Reversible — revert the merge. No data/API/schema change. Additive
correctness for a previously-broken flat case.
