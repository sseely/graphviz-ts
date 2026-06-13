# T6 — rankdir LR/BT/RL implementation

## Context

graphviz-ts port; C source is the spec; suite baseline ~1059/0 after
batch 1 (62 goldens).

The port already has gvNodesize (src/common/poly-sizing.ts:382, called
from src/common/nodeinit.ts:195 with g.root.info.flip) and declares
graphInfo.rankdir/flip — but rankdir is never parsed, flip never set,
and the C postprocess rotation pass is entirely absent. C spec:

- Parse: lib/common/input.c:600-663 graph_init — "LR"→1, "BT"→2,
  "RL"→3, default TB=0; SET_RANKDIR packs realrankdir<<2|rankdir
  (use_rankdir=true for dot). Macros lib/common/types.h:376-378:
  GD_rankdir = bits 0-1, GD_flip = bit 0, GD_realrankdir = bits 2-3.
- Transform: lib/common/postproc.c — gv_postprocess (599-693, Offset
  per rankdir at 657-672), map_point (90-96: ccwrotatepf(p,
  Rankdir*90) then -Offset), translate_bb (127-146: LR/BT cross
  corners), translate_drawing (153-172: maps node coords, splines,
  labels; un-swaps node sizes via gv_nodesize(v,false) — EXCEPT for
  BT, which skips the unswap; preserve this asymmetry exactly).
- Subgraph copy: lib/dotgen/dotinit.c:352.
- Existing workaround to remove: src/layout/dot/splines-flat.ts:37
  hardcodes auxg.info.flip = true.

T4's recon notes (.agent-notes/rankdir-tb-translation-2026-06.md)
identify the port's existing TB translation and recommend AD2 option
A (replace) or B (conditional). READ THEM FIRST.

## Task

1. Port rankdir parsing into the dot init path (graph_init semantics,
   SET_RANKDIR encoding onto g.info.rankdir; set g.info.flip from bit
   0; propagate to subgraphs per dotinit.c:352).
2. Port gv_postprocess/map_point/translate_bb/translate_drawing into
   NEW src/common/postproc.ts (AD1), incl. cluster recursion, label
   handling, and the BT no-unswap asymmetry. Add ccwrotatepf to
   src/model/geom.ts if absent (check first).
3. Wire into the dot pipeline end (src/layout/dot/index.ts) per T4's
   AD2 recommendation: option A = ported pass replaces the existing
   TB translation (delete/bypass what T4's notes list); option B
   fallback = conditional on rankdir ≠ TB, with journal entry.
4. Remove the splines-flat.ts flip workaround; confirm flat-edge
   goldens still pass.
5. HARD GATE (AD2): capture the port's SVG output for ALL current
   goldens BEFORE your changes (script under .probes/, output to a
   temp dir), and byte-diff after. Any diff on an existing golden with
   default rankdir = gate failure. If option A cannot meet it, fall
   back to B (journal); if B also perturbs → STOP.
6. Verify quarantined dot-rankdir-lr and dot-rankdir-bt pass via the
   compare.ts probe approach; ALSO verify RL behavior smoke-level
   (run `dot -Tsvg` C binary vs port on a small rankdir=RL graph in
   .probes/ — T8 adds the real golden). TDD: postproc.test.ts with
   per-rankdir map_point/translate_bb unit tests against hand-computed
   C values.

## Write-set

src/common/postproc.ts (new), src/common/postproc.test.ts (new),
src/model/geom.ts, src/layout/dot/init.ts, src/layout/dot/index.ts,
src/layout/dot/splines-flat.ts, .probes/* (untracked)

## Read-set

.agent-notes/rankdir-tb-translation-2026-06.md (FIRST);
~/git/graphviz/lib/common/postproc.c:80-180, 599-693;
~/git/graphviz/lib/common/input.c:600-665;
~/git/graphviz/lib/common/types.h:370-385;
~/git/graphviz/lib/dotgen/dotinit.c:40-60, 345-360;
src/common/poly-sizing.ts:375-390; src/common/nodeinit.ts:185-200;
src/layout/dot/splines-flat.ts:30-45; plus whatever T4's notes cite

## Architecture decisions

AD1 (location), AD2 (replacement + byte-identity gate), AD3 (RL in
scope). C-is-sacred: preserve the BT asymmetry and per-rankdir Offset
formulas exactly.

## Interface contract (consumed by T8)

Report: LR/BT quarantine comparisons PASS/FAIL with maxDelta; RL smoke
result; which AD2 option landed.

## Acceptance criteria

- Given default/TB graphs (all 62 goldens), when the suite runs, then
  port SVG output is byte-identical to pre-change capture
- Given the quarantined dot-rankdir-lr input, then it passes at dot
  tolerance; same for dot-rankdir-bt
- Given rankdir=RL on a smoke graph, when compared against the C
  binary's output, then geometry matches at dot tolerance
- Given map_point/translate_bb unit tests for all four rankdir values,
  then they pass against hand-computed expectations

## Observability: N/A. Rollback: Reversible.

## Quality bar

npx tsc --noEmit clean; npx vitest run green. Commit:
`feat(T6): port gv_postprocess — rankdir LR/BT/RL support`
