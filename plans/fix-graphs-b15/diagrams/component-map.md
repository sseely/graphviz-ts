<!-- SPDX-License-Identifier: EPL-2.0 -->
# Component map — the collect + group dispatch

The fix is in `dotSplines_`'s collect. Everything else (sort, group, route)
already exists and is correct.

```mermaid
graph TD
  CONC["conc.ts dotConcentrate (DOWN sweep)<br/>merges 6 chains into virtual splineMerge node 'left'<br/>left.out.size = 6, to_virt wired"] --> COLLECT

  COLLECT["splines.ts:521 COLLECT (THE BUG)<br/>iterates g.nodes.values() = NORMAL only<br/>→ virtual 'left' skipped → 6 edges never collected"]:::suspect
  COLLECT --> SORT["splines.ts:218 edges.sort(edgecmp)<br/>(already correct)"]
  SORT --> GROUP["splines.ts:341 groupSize<br/>contiguous same getMainEdge → one group<br/>(already correct)"]
  GROUP --> ROUTE["routeEdgeGroup / dispatchEdgeGroup<br/>routes each group ONCE (already correct)"]
  ROUTE --> SVG["SVG emit: edge g blocks<br/>oracle 153 / port 147 (−6)"]

  FIX["FIX: collect from rank array / nlist<br/>incl. VIRTUAL where splineMerge(n)<br/>= dotsplines.c:281-299"]:::fix
  FIX -.replaces.-> COLLECT

  classDef suspect fill:#fde,stroke:#a33;
  classDef fix fill:#dfe,stroke:#3a3;
```

C spec: `dot_splines_` collects from `GD_rank`/`GD_nlist` including virtual nodes
when `spline_merge(n)` (`dotsplines.c:281-299`), sorts by `edgecmp`, groups by
`getmainedge`, routes each group once (`:328-383`). The port matches every hop
EXCEPT the collect. The prior attempt bypassed the group loop with a side router
→ doubled beziers; the fix routes the new edges through the existing loop so each
`getMainEdge` group routes once.
