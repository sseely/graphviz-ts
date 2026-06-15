# Comparison page — steering-port goldens & the drawing-bbox divergence (SR8)

**Status:** SR8 minted 4 steering-port goldens; the remaining steering cases are
journal-EXCLUDED here because of a **drawing-bbox** (not edge-geometry) divergence.

## Minted (APPENDED to manifest, ≤0.5pt vs dot 15.0.0 + 0.01pt TS drift pin)

| id | input | full-SVG Δ vs dot 15.0.0 |
|----|-------|--------------------------|
| dot-port-compass-aligned | `A:s->B:n` | 0.000 (exact; cleared T8's 11pt blocker) |
| dot-port-steering-east | `A:e->B` | ≤0.5 |
| dot-port-steering-west | `A:w->B` | ≤0.5 |
| dot-port-record-aligned | `A:f0->B` | 0.000 (exact) |

Each carries a `portReference` (the TS render) compared at 0.01pt, so future
drift is caught tightly even though the C ref is compared at 0.5pt. All four
exercise the SR8 `<title>` fix (ports + `&#45;` hyphen + compass-replaces-field).

## Excluded — drawing bbox diverges (edge geometry is faithful)

`digraph{A:n->B}` (TOP steering) —
[dot 15.0.0](port-bbox-An-B-dot1500.svg) · [graphviz-ts](port-bbox-An-B-ts.svg)

| attribute | dot 15.0.0 | graphviz-ts | Δ |
|-----------|-----------|-------------|---|
| viewBox width | 68.00 | 73.00 | 5 |
| viewBox / height | 125.00 | 129.00 | 4 |

The **edge path itself is within 0.5pt** of dot 15.0.0 (pinned in
`edge-route-faithful-oracle.test.ts` — `A:n->B` Δ0.32, tip exact). The full-SVG
golden comparison fails only on `svg/@viewBox`, `svg/@height`, and the graph
`g/@transform` that derives from them: TS's **drawing bounding box** is ~4–5pt
larger than dot's for an edge whose loop bulges beyond the node column.

Same pattern (edge faithful, bbox off) for the other unminted steering cases:

| input | bbox Δ | edge geometry |
|-------|--------|---------------|
| `A:n->B` (TOP steering) | ~5pt | ≤0.5pt (SR4 pinned) |
| `A->B:s` (contradictory head) | ~5pt | ≤0.5pt (SR4 pinned) |
| `A:f0:n->B` (record + side) | ~2.3pt | exact (SR4 pinned) |
| `A:n->C; A->B->C` (multi-rank) | ~4pt | ≤0.32pt (SR7 pinned) |

## Diagnosis

- This is a **bbox-extent computation** difference (`position-bbox.ts` /
  postproc graph-bb), not edge routing and not the `svgBeginEdge` title seam SR8
  owns. The edge control points match dot 15.0.0; the union that forms the
  drawing bb extends ~4–5pt further in TS for steering loops.
- It is **not** a `Proutespline`/`Pshortestpath` numeric divergence — the spline
  is faithful; only the reported drawing bounds differ.

## Why excluded (not fixed) at SR8

- SR8's seam is the edge `<title>` fix + minting refs. The bbox computation is a
  separate subsystem; changing it risks perturbing the 115 existing no-port
  goldens (AD3), which is out of SR8 scope.
- The four cleanly-passing goldens establish the 0.5pt steering-port golden
  class (aligned compass, lateral steering, record field). The bbox-divergent
  cases' edge geometry is already pinned by the SR4/SR7 oracle unit tests; only
  the golden (full-SVG) mint is deferred.
- Flagged as a follow-up: steering-loop drawing-bbox parity (`position-bbox`).
  The compound `A:n->B:s` (= `tailport=n,headport=s`) remains separately excluded
  ([An-Bs-double-steering.md](An-Bs-double-steering.md), ~17pt mid-corridor), and
  the adjacent flat case is structural ([flat-bottom-port-offset.md](flat-bottom-port-offset.md)).
