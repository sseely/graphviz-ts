# Component map — touched vs out-of-scope

```mermaid
graph TD
    subgraph correct["Correct — DO NOT TOUCH"]
        conc["conc.ts<br/>dotConcentrate / mergeVirtual"]
        classify["classify.ts<br/>mergeable"]
    end
    subgraph fix["Fix locus (T1 pins exactly)"]
        chain["edge-route-chain.ts<br/>splineMerge break @290, begin/endSeg"]
        sroute["splines-route.ts<br/>splineMerge consumers"]
        faith["edge-route-faithful.ts<br/>splineMerge(tn/hn) @385-391"]
    end
    subgraph spec["C spec (read-only)"]
        cspl["dotsplines.c<br/>make_regular_edge + spline_merge"]
    end
    subgraph verify["Verification"]
        golden["test/golden/{inputs,refs}/concentrate-2559"]
        survey["test/corpus survey + gate"]
    end

    conc -->|merged virtual chain| chain
    cspl -.spec.-> chain
    cspl -.spec.-> sroute
    chain --> golden
    chain --> survey
    classify -.unused here.-> conc

    style correct fill:#e8f5e9
    style fix fill:#fff3e0
    style spec fill:#e3f2fd
```

- **Green (out of scope):** merge detection + `mergeVirtual` — proven correct.
- **Orange (fix):** one of three routing files; T1 names the exact one.
- **Blue (spec):** C `make_regular_edge`/`spline_merge` — port faithfully (ADR-1).
