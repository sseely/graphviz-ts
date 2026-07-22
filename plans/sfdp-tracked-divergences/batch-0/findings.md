# Batch 0 findings — re-bucketed sfdp not-cleared residual

Source: fresh `attribution-sfdp.jsonl` (oracle sha1 `8fdd1294`, generated
2026-07-21), regenerated in T0.1. Tracked residual collapsed **57 → 17
not-cleared** (0 harness-error). The 3 pgram `harness-error` entries resolved to
`drift-exonerated` (space-named-node parser fix, [[injection-parser-space-named-blindspot]]).

## Headline

Every originally-named batch representative that was NOT one of the 17 has
cleared:

| Original rep | Batch | New status | Effect |
|--------------|-------|-----------|--------|
| graphs-unix | B1 | drift-exonerated | B1 **repurposed** to the b106 node-size residual |
| 2521_1 | B2 | drift-exonerated | dropped from B2 |
| rankdir_dot / _dot1 / _dot2 | B3 | not even diverged (passing) | **B3 EMPTY** |
| graphs-pgram / share / windows | B4 | drift-exonerated | dropped from B4 |
| 2475_2 | B5 | drift-exonerated | dropped from B5 |
| nshare-arrows_dot | B5 | drift-exonerated | dropped from B5 |

## Platform-family note (ADR-3 does NOT apply here)

The stems that look like platform duplicates are **not** byte-identical inputs:

- `graphs-b106` (48 933 B) / `share-b106` (92 301 B) / `linux.i386-b106`
  (92 005 B) — three different graphs. Injection behaviour proves it:
  linux.i386-b106 clears to inj=5 (RTree-label class) while graphs/share-b106
  hold at inj≈4400 (genuine node-size residual).
- `graphs-b29` (62 931 B) / `linux.i386-b29` (136 753 B) — different.
- `graphs-trapeziumlr` (1 484 B, unlaid source) / `share-trapeziumlr`
  (7 233 B, pre-laid variant 1) / `windows-trapeziumlr` (7 229 B, pre-laid
  variant 2) — three distinct inputs (share vs windows differ in the baked
  `pos=` values, not just CRLF).
- `linux.x86-root_twopi` / `linux.x86-root_circo` — different inputs.
- `2095` (4 865 B) / `2095_1` (105 083 B) — different.

**Consequence:** each of the 17 is its own representative; nothing collapses.
Verdicts are still applied per-input, not per-stem.

## Discriminator

`firstDiff` is the graph background polygon (`[graph]/_draw_/op[2].filled_polygon`)
for almost every id — it is emitted first, so it is NOT the mechanism. The
mechanism is read from the injection **signature** (what survives exact native
positions) and `injectedDiffs`:

- signature = `edge/lp/numeric + edge/_ldraw_/numeric` ONLY, small inj → the
  edge-label xlabel-RTree floor-boundary class ([[sfdp-edge-label-rtree-lossy]]),
  irreducible A-class.
- inj ≈ base (injection no reduction) → divergence is downstream of pre-routing
  positions (ratio=fill scale-to-fit).
- large multi-kind inj on a plain graph → node-size (label text-measure) residual.
- edge structural (`[opCount]`/`[ptCount]`) → edge routing / FP-tie.

## Bucket table (interface contract for Batches 1-5)

| representative | copies | bucket | firstDiffKind | attrs | inj/base | hypothesis |
|---|---|---|---|---|---|---|
| graphs-b106 | — | B1 | graph-bb (node-size-driven) | plain | 4406/8626 | box widths are label-driven; port's Estimate text-measure vs native → wider boxes → bb ~308pt wider; survives center-injection |
| share-b106 | — | B1 | graph-bb | plain | 4427/8679 | same class, different graph |
| 42 | — | B2 | edge structural (`opCount 3 vs 6`) | plain | 75/200 | edge spline piece-count: port emits fewer bezier ops |
| 241_0 | — | B2 | edge structural (`ptCount 8 vs 20`) | plain | 21/20 | known FP compass-port tie ([[flat-edge-241]]); inj > base |
| 2095 | — | B2 | edge+node numeric | plain | 27/6014 | small residual after injection; edge/node position FP-tie |
| graphs-trapeziumlr | — | B4 | graph-poly + all | ratio=fill, size="7,9.5", rankdir=LR | 971/971 | ratio=fill scale-to-fit factor divergence; injection no-op ⇒ downstream of positions |
| share-trapeziumlr | — | B4 | graph-poly + all | ratio=fill, rankdir=LR | 971/971 | pre-laid variant; same ratio=fill scaling |
| windows-trapeziumlr | — | B4 | graph-poly + all | ratio=fill, rankdir=LR | 971/971 | pre-laid variant; same ratio=fill scaling |
| 1855 | — | B4 | graph-poly + edge + node | ratio=fill, size≈10 | 493/665 | ratio=fill scaling; partial injection reduction |
| 2470 | — | B5 | edge/lp + _ldraw_ | rankdir=RL | 56/20258 | RTree-lossy edge-label (KNOWN irreducible) |
| 1652 | — | B5 | edge/lp + _ldraw_ | plain | 288/114202 | RTree-lossy edge-label (KNOWN irreducible) |
| graphs-b29 | — | B5 | edge/lp + _ldraw_ | plain | 4/12087 | RTree-lossy edge-label class |
| linux.i386-b29 | — | B5 | edge/lp + _ldraw_ | plain | 2/12108 | RTree-lossy edge-label class |
| linux.i386-b106 | — | B5 | edge/lp + _ldraw_ | plain | 5/8619 | RTree-lossy edge-label class |
| 2095_1 | — | B5 | edge/lp + _ldraw_ | plain | 32/55818 | RTree-lossy edge-label class |
| linux.x86-root_twopi | — | B5 | edge/lp + _ldraw_ | plain | 4/35482 | RTree-lossy edge-label class |
| linux.x86-root_circo | — | B5 | edge/lp + _ldraw_ | plain | 4/35482 | RTree-lossy edge-label class |

## Bucket counts / batch disposition

| Bucket | # ids | Batch action |
|--------|-------|--------------|
| B1 node-size / text-measure | 2 (graphs-b106, share-b106) | **Batch 1** — repurposed from graphs-unix; investigate label text-measurement → box-width → bb |
| B2 edge FP-tie / structural | 3 (42, 241_0, 2095) | **Batch 2** — reps 241_0 (known FP tie), 42 (opCount), 2095 |
| B3 rankdir_dot edge family | 0 | **Batch 3 SKIPPED** — all rankdir_dot ids passing/exonerated |
| B4 ratio=fill aspect-scaling | 4 (graphs/share/windows-trapeziumlr, 1855) | **Batch 4** — rep graphs-trapeziumlr (clean source) |
| B5 RTree edge-label (accept-lean) | 8 (2470, 1652, graphs-b29, linux.i386-b29, linux.i386-b106, 2095_1, linux.x86-root_twopi, linux.x86-root_circo) | **Batch 5** — 1652/2470 known irreducible; verify class membership for the other 6, then accept-registry |

## Caveats for downstream batches

- **B4 (`inj=base=971`)**: per [[injection-parser-space-named-blindspot]], verify
  the injection actually took effect (match count > 0) before trusting
  "positions irrelevant". trapeziumlr node names are single chars (no spaces),
  so a no-op is unlikely, but confirm before concluding downstream-scaling.
- **B5**: each of the 6 non-known ids must be shown to reduce to the same
  single floor-boundary-rect + lossy-RTree mechanism as 1652/2470 before it may
  join the accept registry (ADR-2 forbids "looks like the same class"). A
  controlled experiment (native rect vs port rect at the divergent object) is
  the evidence pointer.
- **B1**: if the b106 residual is a systematic text-measure gap it may be
  reducible (fix the measurer) OR an irreducible sub-pixel font-metric drift
  (accept). Batch 1 decides with a per-node width A/B (native `width` vs port).
