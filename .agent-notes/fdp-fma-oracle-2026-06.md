# fdp port: FMA contraction + full-precision C oracle

## Observation: Homebrew arm64 graphviz contracts FP mul-add into fmadd/fmsub
- **Context**: Mission 7 fdp port diverged from the oracle at ~1e-16/iter
  (Lyapunov growth to >1e-3 by iteration 150) despite a statement-exact port.
- **Finding**: clang's default `-ffp-contract=on` compiles
  `x*x + y*y` and `disp ± delta*force` into fused `fmadd`/`fmsub` on
  arm64 (verified: `otool -tv libgvplugin_neato_layout.8.dylib`, `_doRep`).
  JS mul-then-add double-rounds. Fix: software fma (Dekker two-product +
  two-sum) in `src/common/fma.ts`, applied at the contracted sites in
  fdp tlayout (dist2, len2, disp accumulation, pos += d*fact). After the
  fix, 300 tlayout iterations match the C binary bit-for-bit.
- **Impact**: ANY iterative double-precision engine ported from this
  binary (sfdp in mission 8!) must fuse the same sites. Check the
  disassembly per function; LLVM fuses the FIRST product of
  `a*b + c*d` and rounds the second.
- **Confidence**: High (bit-exact across all 6 fdp inputs after fix).

## Observation: full-precision oracle via C probe linking installed libs
- **Context**: `-Tplain` prints only 5 significant digits — useless for
  ULP-level divergence hunting.
- **Finding**: Homebrew installs graphviz headers incl. `types.h`.
  A 30-line C file calling `gvLayout` and printing `ND_pos(n)` at
  `%.17g` gives full-precision per-maxiter trajectories:
  `cc -o /tmp/fdp-oracle probe.c -I/opt/homebrew/opt/graphviz/include
   -L/opt/homebrew/opt/graphviz/lib -lgvc -lcgraph -lcdt`
  (source kept at /tmp/fdp-oracle.c; rebuild as needed).
  Combine with `-Gmaxiter=N` (and `-Goverlap=true` to isolate tlayout
  from xlayout) for bisection.
- **Impact**: The mission 8 sfdp recon should start with this probe, not
  with plain output.
- **Confidence**: High.

## Observation: cgraph out-edge iteration is head-seq ordered
- **Context**: fdp-large emitted SVG elements in a different order than
  the ref although positions matched.
- **Finding**: `agfstout` iterates a node's out-edges sorted by
  (AGSEQ of HEAD node, AGSEQ of edge) — `cgraph/edge.c:agedgeseqcmpf` —
  not by edge creation order. `agfstin` likewise by tail seq.
  `Node.outEdges/inEdges` now implement this; it is load-bearing for
  emit order AND force-accumulation order.
- **Impact**: any traversal parity bug should check this first.
- **Confidence**: High.
