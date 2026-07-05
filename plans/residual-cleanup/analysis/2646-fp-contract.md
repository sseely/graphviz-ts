<!-- SPDX-License-Identifier: EPL-2.0 -->
# R5 — 2646 (diagnosed 2026-07-05) — ACCEPT: new fp-contract/FMA family (A6)

mechanism: 3 divergent edges (edge2575 g[4639], edge3905 g[7777], edge15467
g[30201]; all record-port :c->:nb_part) are smode long-edge routes; only the
final routesplines call (PL=2, straight leg into head port) diverges. Its
endpoint lies bit-exactly ON the barrier polygon's bottom wall with tangent
parallel to it (evs[1]=(1,-1.22e-16)) — every splinefits candidate is tangent
to barrier ei=9 at t=1 (near-double root of the intersection cubic).
points2coeff computes that cubic through catastrophic cancellation
(~7446 → ~0.099); the oracle (clang/arm64, -ffp-contract=on) contracts
`v3 + 3*v1 - (v0 + 3*v2)` into FMAs while V8 does strict IEEE rounding →
c3/c2 differ ~9.1e-13 on BIT-IDENTICAL inputs → solve3 discriminant sign
flips: C 1 root (866.7, inside); port 3 roots with partner t=0.9999975 <
1−EPSILON2 → spurious crossing → one extra a-halving → final-piece tangent
magnitude ×2/÷2 (flips BOTH directions across the 3 edges) → maxΔ42.09
post-clip (26 SVG diffs).

origin: src/pathplan/route.ts:40-45 (points2coeff) + src/pathplan/solvers.ts
(solve3) vs route.c/solvers.c — NO source-level infidelity; divergence is the
oracle compiler's FMA contraction, below C source semantics. Decision
surfaces route.c:245 (splineisinside), route.c:273 (a /= 2).

ruledOut: upstream input divergence (all 6 routesplines calls dumped both
sides — BOX/POLY/PL/START/END/EVS byte-identical; call-A output splines
byte-identical); A3 findMaxDev/hypot (leaf fit, no split, not mirror-shaped);
over-allocated-list (counts identical); port source bug (standalone pristine
C harness: -ffp-contract=off reproduces the PORT bit-exactly ×3; default
contraction reproduces the ORACLE bit-exactly ×3).

fix REFUTED as insufficient: hand-fma'ing points2coeff fixes 2575/15467 but
NOT 3905 (its flip sits in solve3-internal contraction). Complete fix =
compiler/arch-specific software-fma emulation across the fitter — hot-loop
cost + corpus-wide rounding blast radius. Not recommended.

verdict: ACCEPT — NEW registry class (A6 "fp-contract/FMA knife-edge
tangency in Proutespline", sibling of A3, distinct mechanism). Irreducibility
proven by single-variable controlled experiment (-ffp-contract flips the C
reference between both observed behaviors; strict-IEEE C agrees with the
port). Registry reason text supplied in R5's report — R6 writes the trio.
Cleanup verified: routespl.c reverted + gvc rebuilt + clean render
byte-identical to cached oracle; worktree reverted, tsc clean; dot binary
and /tmp/ghl never touched.
