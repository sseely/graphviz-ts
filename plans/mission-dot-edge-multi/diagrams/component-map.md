# Component map — dot edge-routing dispatch

```mermaid
graph TD
  DS["dot_splines grouping loop<br/>splines.ts (T3)"] -->|cnt-group| RE["make_regular_edge<br/>splines-route.ts (T2)"]
  DS -->|rank(t)==rank(h)| FE["make_flat_edge<br/>splines-flat.ts"]
  DS -->|tail==head| SE["makeSelfEdge (ported)"]
  FE -->|adjacent| FA["make_flat_adj_edges (ported)"]
  FE -->|ED_label set| FL["make_flat_labeled_edge<br/>splines-flat.ts (T1 — G4)"]
  FE -->|bottom/top| FB["make_flat_bottom/top (ported)"]
  RE -->|cnt>1 / labeled / opposing| FP["faithful routeSplines pipeline<br/>(AD-2: new cases only)"]
  RE -->|plain single edge| SF["simplified fitter<br/>(unchanged — 115 goldens)"]
  FP --> CI["clip_and_install"]
  FL --> CI
```

T1 adds the `make_flat_labeled_edge` branch (FL). T2 makes `make_regular_edge`
(RE) route the new cases through the faithful pipeline (FP) while plain edges
keep the simplified fitter (SF). T3 makes the grouping loop (DS) assemble and
dispatch groups in C-faithful order.
