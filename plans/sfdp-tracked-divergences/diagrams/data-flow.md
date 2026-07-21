# Data flow — root-cause + solve/accept loop

## Mission 0: attribution regen re-splits the diverged set

```mermaid
flowchart TD
  D[234 sfdp diverged] --> H{injection-attribution<br/>harness T0.1}
  H -->|inject exact pos<br/>clears diff| EX[drift-exonerated<br/>= ACCEPT A1]
  H -->|residual survives| NC[not-cleared<br/>= tracked]
  NC --> RB[T0.2 re-bucket<br/>B1..B5 by rep]
  RB --> B1 & B2 & B3 & B4 & B5
```

## Per-bucket: analyze → fix-or-accept (diagnosis.md gate)

```mermaid
sequenceDiagram
  participant A as Analysis task (TN.1)
  participant N as native dot (POS_DUMP)
  participant P as port render (POS_INJECT)
  participant F as fix task (TN.2)
  participant S as fresh scratch sweep
  A->>N: GVTS_POS_DUMP -Ksfdp
  N-->>A: full-precision positions
  A->>P: GVTS_POS_INJECT render
  P-->>A: injected xdot
  A->>A: still diverges? instrument predicate/extent
  A->>A: state mechanism (file:line, ruled-out)
  alt fixable
    F->>F: fix at origin + pinning test
    F->>S: fresh sfdp engine-walk (scratch jsonl)
    S-->>F: 0 pass->diverged? target passes?
  else irreducible (controlled experiment)
    F->>F: append accept proposal + evidence to findings.md
  end
```

## Finalize: consolidate + prove

```mermaid
flowchart LR
  FN[batch-*/findings.md<br/>accept proposals] --> R[T6.1 registry<br/>SOLE writer]
  R --> V[full cross-engine sweep]
  V -->|0 regressions| DOCS[regen PARITY*.md<br/>+ parity-*.json/jsonl]
  V -->|any regression| STOP[STOP: bisect to bucket]
```
