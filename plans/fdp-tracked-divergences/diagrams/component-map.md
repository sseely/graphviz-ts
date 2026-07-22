# Component map — fdp mission

```mermaid
graph TD
    subgraph native["~/git/graphviz (oracle, rebuild in T0.1)"]
        FL["fdpgen/layout.c fdp_layout<br/>ADD GVTS_POS_DUMP @ ~:1062"]
        SE1["spline_edges1 (fdp routes here)"]
        SE["neatosplines.c spline_edges<br/>(existing dump — fdp bypasses)"]
    end

    subgraph port["src/layout/fdp (port — likely unchanged)"]
        IDX["index.ts fdpLayoutEngine<br/>:91 injectOraclePositions (correct)<br/>:102 gvPostprocess(g,false)"]
        LAY["layout.ts finalCC / compute_bb"]
    end

    subgraph shared["shared primitives (fix here ⇒ re-sweep all engines)"]
        PP["common/postproc.ts addXLabels/translate"]
        PATH["pathplan triang.ts (fmadd) / route.ts (hypot)"]
    end

    subgraph corpus["test/corpus (regenerated)"]
        ATTR["attribution-fdp.{jsonl,json}"]
        PAR["parity-fdp.{json,jsonl}"]
        REG["accepted-divergences-engines.json (fdp block)"]
        DOC["docs/known-divergences.md"]
    end

    FL --> ATTR
    IDX --> PAR
    LAY --> IDX
    IDX --> PP
    IDX --> PATH
    ATTR --> REG
    REG --> DOC

    classDef fix fill:#fdd
    class FL fix
```

**Fix-locus by bucket:**
- B1 (frame) → `src/layout/fdp/{index,layout}.ts` and/or `common/postproc.ts`
  (shared — re-sweep all engines).
- B2 (drift) → no code (A1-drift class, computed).
- B3 (FP-tie) → no code expected (levers applied); accept A9.
