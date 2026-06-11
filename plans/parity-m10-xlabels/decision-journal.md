# Decision Journal — parity-m10-xlabels

| Date | Task | Decision | Rationale | Alternatives considered |
|------|------|----------|-----------|------------------------|
| 2026-06-11 | T1 | Preserved C CombineRect using fmin for BOTH low and high sides (rectangle.c verbatim at 15.0.0) | C is the spec; quirk documented in JSDoc; gates green (tsc clean, 1164/0) | "Fix" to fmax for high sides — rejected, would diverge from oracle |
| 2026-06-11 | T1 | rectArea overflow: throw Error instead of graphviz_exit; negative dim observably matches C (both abort) | No process exit in a browser library | Silent clamp — rejected, hides divergence |
| 2026-06-11 | T2 | Push-forward (pre-authorized): node.ts/split-q.ts circular import resolved via registerSplitNode late-binding shim; C function boundaries preserved | AddBranch→SplitNode→LoadNodes→AddBranch is a genuine cycle; ESM runtime cycles are fragile | Types-only third module — more files, same effect |
| 2026-06-11 | T2 | C uint64 wraparound (PickBranch increase, PickSeeds waste) simulated via BigInt mod 2^64 | fmin-both-sides CombineRect makes underflow the COMMON case; number arithmetic would pick wrong seeds | Plain number subtraction — provably diverges from C |
