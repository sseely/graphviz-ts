<!-- SPDX-License-Identifier: EPL-2.0 -->

# Data flow — diagnosis & verification loop

## Per-id reproduction (fast inner loop, no commit)

```mermaid
sequenceDiagram
  participant Dev as executor
  participant Oracle as dot -Kneato -Txdot (GVBINDIR=/tmp/ghl)
  participant Port as render-one-xdot.ts <path> neato
  participant Cmp as compareXdot (tol 0.5)
  Dev->>Oracle: run on corpus path
  Dev->>Port: run on same path
  Port-->>Dev: port xdot
  Oracle-->>Dev: oracle xdot
  Dev->>Cmp: compare
  Cmp-->>Dev: firstDiff (object/attr/path: actual vs expected)
  Note over Dev: instrument BEFORE hypothesizing —<br/>dump C values via /tmp/ghl harness if needed
```

## Per-batch gate (before commit)

```mermaid
sequenceDiagram
  participant Dev as executor
  participant Gate as test/golden/gates.sh
  participant Sweep as engine-walk.ts (fresh, deleted-JSONL)
  Dev->>Gate: bash test/golden/gates.sh
  Gate-->>Dev: tsc + vitest + golden 50/50 + file<600 + bundle
  Dev->>Sweep: neato (target) — diverged must drop, 0 id regressions
  Dev->>Sweep: circo/twopi/osage/patchwork + npm run survey (dot)
  Sweep-->>Dev: 0 previously-passing ids regress BY ID
  Note over Dev: only then — one commit per task,<br/>fix(TN): ... ; append decision-journal
```
