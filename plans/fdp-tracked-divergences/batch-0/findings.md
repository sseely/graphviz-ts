# Batch 0 findings — fdp not-cleared re-bucket (post fresh attribution)

Source: `test/corpus/attribution-fdp.{jsonl,json}` regenerated 2026-07-21
against rebuilt oracle sha1 `8fdd1294b3726c2a19fe384ca48f44a2954d1944`
(GVTS_POS + GVTS_BB + GVTS_CLUST_BB dump restored, T0.1).

**146 diverged → 142 drift-exonerated (A1-drift accept), 4 not-cleared.**
The stale attribution's "20 tracked" was an artifact of the broken oracle
(dump emitted 0 lines for `-Kfdp`). Real tracked residual = **4**.

## Bucket table

| representative | copies | bucket | components | signature | attrs | hypothesis |
|----------------|--------|--------|-----------|-----------|-------|------------|
| graphs-fdp | — | B1 | 3 | node/_draw_+_ldraw_+pos+width **structural** (`node:clusterB`) + graph bb/polygon numeric Δ=31.11 const | cluster; node-name==cluster-name collision (`e -- clusterB`, `subgraph clusterB`) | Port emits a visible node draw for a node whose name collides with a cluster name; oracle suppresses that node's `_draw_`/`_ldraw_`. The phantom node inflates the port bb by a constant 31.11pt (the numeric residual is downstream of the structural one). |
| graphs-b145 | — | B1 | 2 | node/_draw_+_ldraw_+pos+width+height **structural** (`node:cluster_foo`) + edge bezier numeric | cluster; node-name==cluster-name collision (`cluster_foo -> …[lhead="cluster_foo"]`, `subgraph cluster_foo`) | Same mechanism as graphs-fdp: a node named `cluster_foo` collides with `subgraph cluster_foo`; port draws the node, oracle does not. Edge bezier residual is the incident edge re-routing around the phantom node. |
| 241_0 | — | B3 | 1 | edge/_draw_+_hdraw_+pos **numeric**, maxΔ=3.39pt | plain (no clusters/labels/ratio/size) | Clean A9 FP-tie: 11 sub-pixel edge-bezier diffs, same CDT-incircle / hypot tie class already accepted for sfdp 241_0. Injection base 446 → 11. |
| 2095 | — | B3* | 1 | edge/_draw_+_hdraw_+pos + node numeric; **45/52 big-Δ (>5pt), 7 small-Δ (≤5pt)** | 1 empty-named node (`""`); 1 edge label (lp) | **HARNESS BLINDSPOT, not a clean A9.** 45 of 52 residual are on exactly 3 objects — the single empty-named `node:`, edge `->4#0`, edge `461->#0` — because the port inject regex `/^GVTS_POS (.+) …/` requires ≥1 name char, so the empty-named node never injects and drags its 2 incident edges ~1000pt. The genuine residual is the **7 small-Δ FP-tie** (A9, like 241_0). Base 8256 → 52; would likely be ~7 with the injector fixed. |

`*` 2095's not-cleared count of 52 **overstates** the real divergence — see the
empty-name blindspot note ([[injection-parser-space-named-blindspot]]).

## Bucket status for Batches 1–3

- **B1 — structural cluster-name collision** (NEW; repurposes the old
  "frame/postprocess" slot). Members: **graphs-fdp, graphs-b145**.
  The mission's predicted B1 candidates (**graphs-cairo, 2193**) both
  **drift-exonerated** → the predicted edge-label/frame bucket is **EMPTY**.
  This is a genuine structural porting gap (node whose name equals a cluster
  name), not a frame/postprocess offset. → **Batch 1 targets this.**
- **B2 — force-drift (unix family etc.)**: **EMPTY.** Every unix-genealogy id
  (unix, lsunix1-3, size, unix2/2k, weight, crazy) drift-exonerated as
  predicted → A1 accept (batch-final registry). → **Batch 2 SKIPPED** (log).
- **B3 — FP-tie (A9)**: **241_0** (clean A9), **2095** (A9 tail masked by the
  empty-name injection blindspot). → **Batch 3 targets these**, but 2095 needs
  the injector blindspot resolved (or the empty node injected manually) before
  its residual can be attributed A1-vs-A9 honestly.

## Copies

No platform-duplicate copies among the 4 (each is a distinct input path:
`graphs/fdp.gv`, `graphs/b145.gv`, `241_0.dot`, `2095.dot`). Every not-cleared
id is its own representative.

## Component-count note (postprocess path)

graphs-fdp (3) and graphs-b145 (2) are **multi-component** → packed frame
(`finalCC`/`packSubgraphs` path). 241_0 and 2095 are **single-component**. The
B1 structural bug is orthogonal to component count (it is per-node emission),
but the multi-component packing frame is recorded in case a B1 fix touches bb.
