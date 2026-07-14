# fdp graph bb "short" family (60 ids) — RCA

## Observation: fdp's injected graph bb is the port's OWN bb, not a computed one

- **Context**: Chasing the largest not-cleared fdp attribution bucket —
  signature `graph/_draw_/numeric+graph/bb/numeric`, 60 ids, reported as
  "graph bounding box short, mostly in height" (`1909`: native
  `0,0,116.02,140.93` vs port `0,0,114.43,131.4`).

- **Finding**: The bb was never short. `GD_bb` under fdp is a product of
  `fdpLayout` itself (`finalCC` → `setBB`, `lib/fdpgen/layout.c:1030`), and the
  attribution harness's fdp injection point is *downstream* of it — the hook
  fires after `fdpLayout(g)` returns (`src/layout/fdp/index.ts:88`). So
  injecting the oracle's `ND_pos` overwrites the emitted node coordinates but
  leaves `g.info.bb` holding the port's own, un-injected, drifted bb.

  Proof: the port's bb is **bit-identical with and without injection**
  (`1909`: `0,0,114.43,131.4` both ways; `graphs-center`: `0,0,120.63,122.98`
  both ways) while the injected node positions match native exactly. On each
  side the bb equals *that side's own* node extent to 0.01 — both bb formulas
  are correct, they were just fed different layouts.

  The population confirms it: across the 42 family ids carrying a
  `uniformDelta`, the port's bb is short on 24 and **taller on 18**. No
  "bb is short" bug can produce a taller bb. It is layout drift, read through
  the one attribute injection could not overwrite.

- **Impact**: Two reusable lessons.

  1. **neato/sfdp are immune by construction, and that is why fdp looked
     unique.** Their hook sits at the top of `spline_edges`, one line above the
     `compute_bb` that derives `GD_bb` (`neatosplines.c:841`), so their bb is a
     pure function of the injected positions. Any engine whose bb is computed
     *inside* its layout entry point (fdp; check osage/patchwork before
     trusting their attribution) needs the bb injected explicitly. The fix adds
     a `GVTS_BB` dump line at the fdp site — see
     `plans/iterative-parity-campaign/diagrams/injection-recipe.md`.

  2. **An injection harness can only exonerate what it actually injects.**
     Anything derived *upstream* of the injection point silently keeps the
     port's own value and shows up as a residual diff — which reads exactly
     like a real, tightly-clustered defect family. Before chasing a bucket
     whose signature is *only* graph-level attributes, check whether the
     harness can even reach those attributes. Here the tell was free: rendering
     the id with NO injection reproduced the "injected" bb byte-for-byte.

- **Confidence**: High. Mechanism confirmed on both sides with instrumented
  values (native `GVTS_STAGE` probe shows `GD_bb` already final —
  `0 0 116.019 140.933` — at the dump site), and all 60 family ids clear with
  the `GVTS_BB` line and none without it.
