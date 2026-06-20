# FLATEDGE end-box x-placement — data flow

## Where the flat-end box x is set

```mermaid
flowchart TD
  A["make_flat_edge (non-adjacent)<br/>splines-flat.ts"] --> B["makeFlatEndBox<br/>splines-flat.ts:339"]
  B --> C["maximalBbox (full node x-extent)<br/>edge-route-faithful.ts:123"]
  B --> D["beginPath / endPath (FLATEDGE)<br/>splines-path-begin.ts / -end.ts"]
  D --> E["end-box x = coord.x +/- rw/lw  (PORT, node EDGE)"]
  E -. "DIVERGENCE: C uses coord.x (node CENTRE)" .-> F["correct: coord.x"]
  F --> G["routeSplines through the corrected corridor"]
  G --> H['emit: svgEdgePath -> d="M.. C.."']
```

T1 instruments C `beginpath`/`endpath` FLATEDGE to confirm the centre-vs-edge
reference and pin the exact port line; the fix (T2) is FLATEDGE-gated so the
regular-edge box-x (which shares these helpers) is untouched.

## Verification loop (per task)

```mermaid
flowchart LR
  I["241_0.dot"] --> P["render-one.ts (port)"]
  I --> O["native dot (oracle, cached)"]
  P --> CMP{"compare.ts<br/>@d coords + bbox"}
  O --> CMP
  CMP -->|match| OK["byte/structural-match"]
  CMP -->|differ| FIX["adjust the FLATEDGE box-x; re-instrument C"]
  OK --> SURV["survey.ts -> per-id diff<br/>0 regressions + 128 goldens green<br/>(esp. regular-edge goldens = gating proof)"]
```
