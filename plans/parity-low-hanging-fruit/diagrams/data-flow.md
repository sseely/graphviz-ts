# Data flow — triage → fix → regenerate

```mermaid
flowchart TD
  P[parity.json<br/>320 diverged + 19 errored] --> B1
  subgraph B1[Batch 1 — Triage read-only]
    T1[color-stroke 9] --> D1[triage/*.md<br/>per-case root cause + simple/deep]
    T2[text-content 7] --> D1
    T3[attr-or-tag 33] --> D1
    T4[polygon-points 3] --> D1
    T5[parser-gap 10] --> D1
  end
  D1 --> B2
  subgraph B2[Batch 2 — Fixes sequential]
    F6[T6 color] --> F7[T7 text] --> F8[T8 attr] --> F9[T9 poly] --> F10[T10 parser]
  end
  B2 -->|simple fix + golden| G[golden suite + src]
  B2 -->|deep case| C[comparisons/&lt;id&gt;.md]
  G --> B3
  C --> B3
  subgraph B3[Batch 3 — Regenerate]
    S[survey.ts] --> DB[dashboard.ts] --> R{0 regressions?}
  end
  R -->|yes| DONE[byte-match increased]
  R -->|no| STOP[STOP + investigate]
```

## Oracle render (each triage/fix step)

```mermaid
sequenceDiagram
  participant A as Agent
  participant Port as renderSvg (src/index.js)
  participant Dot as native dot -Tsvg
  A->>Port: renderSvg(input, engine)
  A->>Dot: dot -Tsvg input (GVBINDIR=/tmp/gvplugins)
  Port-->>A: port SVG
  Dot-->>A: oracle SVG
  A->>A: first-diff → root cause → simple/deep
```

> Probe scripts: write the `.mjs` at the REPO ROOT (not `/tmp`) — relative
> `./src/*.js` imports only resolve from the repo root.
