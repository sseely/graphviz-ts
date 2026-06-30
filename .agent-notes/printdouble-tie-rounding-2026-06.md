# printDouble rounds exact ties differently from C gvprintdouble

## Observation: toFixed(2) vs snprintf %.2f on exact binary ties
- **Context**: M11 T5 combined-label probe; edge xlabel `ex` at model
  x=34.125 (exactly representable: 273/8). Port SVG prints x="34.13",
  C 15.0.0 prints x="34.12". Single-kind probes unaffected.
- **Finding**: `printDouble` (src/gvc/job.ts:248, ports
  gvdevice.c:gvprintdouble) uses `Number.toFixed(2)`, which rounds
  exact ties half-away-from-zero. C uses `snprintf("%.2f")`, which
  rounds half-to-even under the default FP rounding mode. Verified:
  34.125 → JS "34.13" / C "34.12"; 45.375 → both "45.38" (odd digit
  rounds up either way). Underlying coordinates are bit-identical —
  this is purely a formatting divergence on `.xx5` ties.
- **Impact**: Any golden whose layout produces an exact-tie coordinate
  will byte-diverge from a C ref by 0.01 on that value. The existing
  67 goldens contain no ties (conformant through M11 batch 2).
  Fix is confined to printDouble: implement round-half-to-even at
  2 dp. M11 stop condition hit: divergence traces outside the mission
  write-set (job.ts ported pre-M11).
- **Confidence**: High (node REPL check, C oracle SVG, model-state
  probe all agree).
