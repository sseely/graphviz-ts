# Data flow — diagnose-then-fix, parity-gated

```mermaid
sequenceDiagram
  participant T1 as Batch 1 (T1 diagnose)
  participant J as decision-journal
  participant T2 as Batch 2 (T2/T3 fix)
  participant T4 as Batch 3 (T4 validate)
  participant C as C oracle (mincross.c)

  T1->>C: instrument transpose (pass-count, delta); revert
  T1->>T1: instrument TS transpose; measure mid-size + bounded 2471
  T1->>J: route = {a pass-count | b non-convergence | c constant-factor} + target site + parity baseline
  J-->>T2: read routing
  T2->>T2: apply parity-preserving fix (match C)
  T2->>C: order-probe diff (mc3, mid-size) == C ?
  C-->>T2: conformant (else STOP)
  T2->>J: speedup factor, parity evidence
  J-->>T4: read results
  T4->>T4: render 2471 to completion; full golden suite
  T4->>C: order == C on all reproducers ?
  T4->>T4: add permanent order-signature + perf-smoke regression
  T4->>J: summary + next mission (x-coord under clusters)
```

Parity gate (AD-1) is enforced at **every** fix commit, not just at the end:
order-probe == C + zero golden churn, or STOP.
