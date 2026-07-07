# Component map — what this mission touches

```mermaid
graph TD
    subgraph new[New — test harness Batch 1]
        R1[render-one-xdot.ts]
        C1[compare-xdot.ts + .test.ts]
        W1[xdot-walk.ts]
        D1[xdot-dashboard.ts]
        A1[accepted-divergences-xdot.json]
    end
    subgraph reuse[Reused seams — read-only]
        RO[render-one.ts]
        SV[survey.ts spawnCapture + oracle cache]
        CMP[compare.ts tolerance model]
        PJ[parity.json conformant set]
        XP[src/xdot parseXDot + types]
        DB[dashboard.ts]
    end
    subgraph fix[Modified — Batch 2 renderer]
        DOT[src/render/dot.ts XdotRenderer]
        DEV[src/gvc/device.ts emit-state / color state -- SHARED with SVG]
    end

    R1 -.mirrors.-> RO
    C1 -.uses.-> XP
    C1 -.mirrors.-> CMP
    W1 --> R1
    W1 --> C1
    W1 -.reuses.-> SV
    W1 --> PJ
    W1 --> A1
    D1 --> W1
    D1 -.mirrors.-> DB
    W1 == surfaces divergence ==> DOT
    DOT -. only if shared .-> DEV
    DEV -. RISK: SVG regression .-> PJ
```

**Risk edge:** `device.ts` is shared with the SVG renderer. The dashed
`DEV → parity.json` edge is the regression hazard — guarded by the SVG
`rules-gate.ts` gate after any device.ts change.
