# x-coord pipeline and the anchor leak

```mermaid
flowchart TD
  A[dotPosition: create_aux_edges<br/>make_LR_constraints + make_edge_pairs] --> B[rank g,2 — x-NS]
  B --> B1[init_rank<br/>identical port=C, non-negative]
  B1 --> B2[feasible_tree]
  B2 --> B3[main simplex loop<br/>leaveEdge/enterEdge/update/rerank]
  B3 --> B4[LR_balance<br/>NO scan_and_normalize]
  B4 --> C[set_xcoords: coord.x = ND_rank]
  C --> D[dotSplines<br/>make_flat_labeled sets label.pos = coord ln]
  D --> E[gvPostprocess / translate_drawing]
  E --> E1[map_edge: if spl==NULL RETURN<br/>label NOT translated]
  E1 --> F[emit / edge_in_box<br/>draw label iff overlaps clip]

  B3 -. pivot ORDER differs .-> X[absolute anchor differs<br/>uniform shift +146/+228]
  B4 -. rerank side/order .-> X
  X -. leaks only via .-> E1
```

The relative solution out of B is identical port vs C (final coords conformant
after E). The absolute anchor (X) differs and is invisible everywhere EXCEPT the
untranslated spline-less label at E1→F. Batch 1 fixes B3/B4 pivot order so X→0;
Batch 2 wires D/E1/F faithfully.
