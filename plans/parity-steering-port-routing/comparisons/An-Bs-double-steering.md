# Comparison page — `digraph{A:n->B:s}` (compound double-steering)

**Status:** journal-EXCLUDED at SR4 (2026-06-14). Out of batch-2 named scope
(AD4 lists the demo cases as `A:n->B`, `A:e->B`, `A:w->B`, contradictory
compass, record-field side ports — all single-ended). This case has a side
mask on **both** ends (tail `:n` exits the TOP face away from the head; head
`:s` enters the BOTTOM face away from the tail), so the corridor is a
double-loop: up over A, down the right side, around and under B.

Side-by-side renders:
[dot 15.0.0](An-Bs-dot1500.svg) · [graphviz-ts](An-Bs-ts.svg)

## Geometry (first edge path, SVG frame)

| pt | dot 15.0.0 | graphviz-ts | Δ |
|----|-----------|-------------|---|
| 0 (start, tail `:n`) | 27.00,-118.01 | 27.00,-117.36 | 0.65 |
| 1 | 27.00,-130.01 | 27.00,-129.37 | 0.64 |
| 2 | 45.67,-125.65 | 45.67,-125.01 | 0.64 |
| 3 | 54.00,-117.01 | 54.00,-116.36 | 0.65 |
| 4 | **87.50,-82.24** | **70.65,-99.08** | **24.0** |
| 5 | **87.50,-43.13** | **70.65,-25.65** | **24.3** |
| 6 | 54.00,-8.36 | 54.00,-8.36 | 0.00 |
| 7 | 49.44,-3.64 | 49.44,-3.64 | 0.00 |
| 8 | 41.80,-0.19 | 41.80,-0.19 | 0.00 |
| 9 (end → B) | 35.80,0.00 | 35.80,0.00 | 0.00 |
| arrow tip | 28.16,-6.39 | 28.16,-6.39 | 0.00 |

Drawing widths: dot `87pt`, ts `79pt`.

## Diagnosis

- **Endpoints + both loop entries/exits match** (pts 0–3 within 0.65pt; pts
  6–9 and the arrowhead exact). The route is the correct shape — up over A,
  around the right, down under B.
- **The mid-corridor lateral excursion is the only divergence.** dot pushes
  the connecting vertical segment out to `x=87.5`; ts holds it at `x=70.65`
  (pts 4–5). The channel that joins the tail-north loop to the head-south
  loop is **narrower** in ts.
- This is a **box-assembly geometry difference for combined tail+head side
  masks**, not a `Proutespline`/`Pshortestpath` numeric divergence: the spline
  shape is faithful and the controls renormalize correctly at both ends; only
  the width of the assembled mid-corridor differs. It is the same class of
  corridor-spanning question as multi-rank virtual chains (SR7), which SR2's
  `completeregularpath`/`adjustregularpath` port noted is exercised only by
  later batches.

## Why excluded (not fixed) at SR4

- SR4 is validation-only; `edge-route-faithful.ts` / `edge-route.ts` are frozen
  for this task. The fix is a corridor-assembly change, not a 1–3 line
  attachment/clip tweak (the only push-forward edit SR4 permits).
- `A:n->B:s` is not one of AD4's batch-2 demo cases. All six required SR4
  cases (the four sides + one contradictory-compass `A->B:s` + record-field
  side `A:f0:n->B`) pass ≤0.5pt and are pinned in
  `src/layout/dot/edge-route-faithful-oracle.test.ts`.
- Per the mission boundary, a >0.5pt divergence not explainable as a faithful
  improvement is surfaced, not chased. Flagged for batch 3 (compound / spanning
  corridors, SR7-adjacent).
