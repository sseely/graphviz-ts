<!-- SPDX-License-Identifier: EPL-2.0 -->
# Data flow — why 6 edges drop, and route-once

## The drop (current port)

```mermaid
sequenceDiagram
  participant CONC as dotConcentrate DOWN sweep
  participant LEFT as virtual node 'left' (splineMerge)
  participant COLLECT as dotSplines_ collect
  participant ROUTE as group dispatch
  CONC->>LEFT: merge 6 back-edge chains → left.out = 6 (to_virt wired)
  Note over COLLECT: iterates g.nodes.values() = NORMAL only
  COLLECT->>ROUTE: HoverRest→left (the 1 surviving NORMAL edge)
  Note over LEFT: 'left' is VIRTUAL → never visited
  ROUTE-->>ROUTE: routes representative chain only → 5 secondaries get no ED_spl
  Note over ROUTE: +1 the same pattern from Stand → 6 edges have no g block
```

## The faithful fix (route-once via getMainEdge)

```mermaid
sequenceDiagram
  participant COLLECT as dotSplines_ collect (FIXED)
  participant SORT as edges.sort(edgecmp)
  participant GROUP as groupSize (getMainEdge)
  participant ROUTE as routeEdgeGroup
  COLLECT->>SORT: rank array incl. virtual splineMerge 'left' → all edges incl. 6 secondaries
  SORT->>GROUP: equivalent edges contiguous (getMainEdge key)
  GROUP->>ROUTE: each getMainEdge group ONCE
  Note over ROUTE: secondary edge + its main share getMainEdge → one group → one route
  ROUTE-->>ROUTE: each orig routes exactly once → 153 edges, maxDelta ~0
```

The trap: the prior side-router visited an orig from BOTH the NORMAL tail and the
merge node → two clip_and_install → doubled bezier. Grouping by `getMainEdge`
(C's model) coalesces them into one route.
