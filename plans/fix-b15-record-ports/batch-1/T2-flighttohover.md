<!-- SPDX-License-Identifier: EPL-2.0 -->
# T2 — FlightToHover:Target->HoverRest:In late divergence

## Context
This edge's 3 beginpath calls match C byte-for-byte (seed note); its
spline diverges Δ132 at the SVG start (= tail side after swap). Twin
suspect: endpath's resolvePort (splines-path-end.ts:214) or corridor
boxes downstream.

## Task
With T1's mechanism known (it may share the root — check first), dump
endpath resolution + P.end/boxes for this edge both sides; pin the
divergence origin. If bounded → feeds T4 fix; if not → D4 classification
with evidence.

## Depends on: T1.

## Acceptance criteria
- Given the dumps, then the first divergent quantity (end port, end
  boxes, or corridor) is identified with both sides' values.
- Given a deep verdict, then the D4 disposition includes what was ruled
  out and the follow-up seed.

## Observability / Rollback
N/A. Reversible.

## Commit
folded into gate report or `docs(T2): ...`.
