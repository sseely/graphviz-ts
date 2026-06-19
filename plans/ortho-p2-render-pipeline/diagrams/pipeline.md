# Ortho render pipeline — what P2 pins

```mermaid
flowchart LR
    G[OrthoGraph<br/>C-dumped node coords] --> MM["mkMaze (T2)"]
    subgraph MM_inner["mkMaze internals"]
        GC[build gcells] --> PT["partition (T1)<br/>trapezoid→rects"]
        PT --> CL[assemble cells]
        CL --> MG["mkMazeGraph → sg"]
    end
    MM --> RT["ortho-route (T3)"]
    subgraph RT_inner["routing"]
        SP[per-edge shortPath<br/>P1-pinned sgraph/fPQ] --> CV[convertSPtoRoute]
        CV --> AS["assignSegs + segCmp<br/>(channel ordering)"]
        AS --> AT["assignTracks<br/>vtrack/htrack"]
        AT --> RP[route point lists]
    end

    classDef pinned fill:#cce5ff,stroke:#007bff;
    classDef t1 fill:#d4edda,stroke:#28a745;
    classDef t2 fill:#fff3cd,stroke:#ffc107;
    classDef t3 fill:#f8d7da,stroke:#dc3545;
    class PT t1
    class GC,CL,MG t2
    class CV,AS,AT,RP t3
    class SP pinned
```

**Validation order (ADR-3, bottom-up):** T1 partition → T2 maze → T3 route.
Blue = already pinned (ortho-P1). Each stage is dumped from instrumented native
`dot` via gvmine and pinned in TS, driven by C-dumped node positions (ADR-2).
`segCmp` channel ordering (T3) is the load-bearing hot spot.
