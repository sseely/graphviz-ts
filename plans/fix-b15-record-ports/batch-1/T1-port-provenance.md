<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — Port-write provenance trace

## Context
Seed: .agent-notes/b15-record-port-resolution-deep.md. 3 edges' resolved
tail ports diverge at beginpath: FPMCenter C=(-77.09,0,side8/LEFT) vs
port=(-39.14,-18,side1); FPMHoverCenter C=(-78.64,0,8) vs SAME
port value (-39.14,-18,1); HoverStrafeToStop C=(-75.15,-18,1) vs
port=(-125.15,0,8). Identical wrong values across different nodes =
shared-object smell (H2); C sameport centroid replacement = H1;
per-edge resolve = H3 (hypotheses in README — discriminate, don't pick).

## Task
Env-gated tag every port assignment site:
- port: fastgr.ts:138-141 (copyPort), sameport.ts:146-147 (+ its chain
  walkers), splines-clone.ts:72-73, edge-label-init.ts:281/285,
  splines-path-begin.ts:224, splines-path-end.ts:214. Log
  (edge orig names, end, value p/side, WRITE SITE, object identity —
  e.g. a WeakMap<Port,int> id) at each write; plus a READ log at
  beginpath/endpath resolution.
- C: sameport.c assignment loops, beginpath (splines.c:392-393),
  endpath (:599), common init (edge-label-init equiv in common_init_edge).
Run b15 both sides (REPO-ROOT cwd, absolute paths), align per affected
edge, attribute each wrong value to its exact write. State per-edge
mechanism per diagnosis.md; C tree ends reverted + oracle byte-verified.

## Read-set
Seed note; sameport.ts (all, ~180 lines); C sameport.c:120-180;
splines-path-begin.ts:220-244; C splines.c:384-470.

## Interface output (consumed by T3)
Per-edge {cause, origin, chain, ruledOut[], hypothesis: H1|H2|H3|other}.

## Acceptance criteria
- Given the traces, then each wrong (p,side) maps to one write site with
  object identity shown (H2 proven or disproven by identity, not inference).
- Given C, then the same edges' write sequences are captured for line-diff.
- Given the verdict, then ruledOut names the two rejected hypotheses with
  the observations that rejected them.

## Observability / Rollback
N/A — diagnosis. Reversible.

## Commit
`docs(T1): b15 port provenance — <winning hypothesis one-liner>`
