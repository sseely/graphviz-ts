# Decision Journal — parity-m10-xlabels

| Date | Task | Decision | Rationale | Alternatives considered |
|------|------|----------|-----------|------------------------|
| 2026-06-11 | T1 | Preserved C CombineRect using fmin for BOTH low and high sides (rectangle.c verbatim at 15.0.0) | C is the spec; quirk documented in JSDoc; gates green (tsc clean, 1164/0) | "Fix" to fmax for high sides — rejected, would diverge from oracle |
| 2026-06-11 | T1 | rectArea overflow: throw Error instead of graphviz_exit; negative dim observably matches C (both abort) | No process exit in a browser library | Silent clamp — rejected, hides divergence |
