<!-- SPDX-License-Identifier: EPL-2.0 -->
# 2825 diagnosis — dot_position failure propagation (fix/2825-rebuild-vlists)

## Verdict

```json
{
  "mechanism": {
    "cause": "dotLayoutPipeline (index.ts:183, pre-fix) discarded dotPosition's return code and unconditionally ran dotPhasePost (removeFill/dotSameports/dotSplines/dotCompoundEdges/gvPostprocess), where C's static dotLayout (dotinit.c:320-325) checks `const int r = dot_position(g); if (r != 0) return r;` and never reaches dot_splines or dotneato_postprocess on failure.",
    "origin": "src/layout/dot/index.ts:183 (pre-fix `dotPosition(g);` — return value not captured); C ref lib/dotgen/dotinit.c:320-325",
    "causalChain": "2825.dot: cross-cluster `{rank=same; H; B}` plus cluster_outer/cluster_inner membership triggers mark_clusters' rankset-conflict deletion (B and H dropped from cluster_outer — IDENTICAL in port and C, confirmed by byte-identical warning text). This leaves cluster_inner rank 1 with no node that survives as a rankleader candidate reachable from rebuild_vlists' infuse walk. C's rebuild_vlists (conc.c:158-161) hits `lead == NULL` for rank 1, agerrorf's 'rebuild_vlists: lead is null for rank 1', and returns -1; dot_concentrate's own top-level cluster loop (conc.c:239-242, a DIFFERENT call site from rebuild_vlists' own recursive nested-cluster loop) catches that -1, emits the AGPREV continuation 'concentrate=true may not work correctly.' (no prefix — AGPREV reuses the previous call's AGERR level), and returns -1. dot_position (position.c:133-136) propagates that as its own return value. dotLayout propagates it again and returns BEFORE dot_splines/dotneato_postprocess run. Downstream, gvLayoutJobs always returns 0 regardless (no error check), so rendering proceeds anyway — but init_gvc (emit.c:3272) reads `gvc->bb = GD_bb(g)` directly, and GD_bb was only ever going to be set by set_aspect (position.c, inside dot_position, never reached). GD_bb stays at its zero-initialized default, so job->clip derived from it is degenerate, and emit_node's `node_in_box(n, job->clip)` gate (emit.c:1806-1809) rejects every node. Only the two cluster frames (drawn unconditionally by emit_clusters from the same zero GD_bb) reach the page — hence C's 4-element output (background rect + 2 cluster frames... actually background + 2 clusters = 3 <g>, root svg itself is the 4th countable top-level child in the survey's childCount metric).",
    "ruledOut": [
      "conc.ts rebuild_vlists/fillAllRankVlists logic itself: instrumented (temporary console.error) and confirmed it ALREADY returns -1 for cluster_inner rank 1, matching C's exact trigger rank — not the defect.",
      "position.ts dotPosition: instrumented and confirmed it ALREADY propagates dotConcentrate's -1 correctly (`if (rc !== 0) return rc;`) — matches C's dot_position wrapper exactly, not the defect.",
      "dotConcentrate's own return value: confirmed -1, correctly reaches dotPosition — not the defect."
    ]
  },
  "fixLocus": [
    "src/layout/dot/index.ts:183 — capture dotPosition's return code and return early on failure (mirrors the F8 fix for dotMincross, eb8cb97)",
    "src/layout/dot/conc.ts — port the three missing C messages (rebuild_vlists' two agerrorf sites + the degenerate-rank agwarningf) and dot_concentrate's own AGPREV continuation message + -1 normalization, previously silent"
  ]
}
```

## Fix applied (in write-set)

1. `src/layout/dot/index.ts` `dotLayoutPipeline`: capture `dotPosition`'s
   return code and `return` before `dotPhasePost` on failure — C's
   `if (r != 0) return r;` after `dot_position` (dotinit.c:322-325).
2. `src/layout/dot/conc.ts`:
   - `fillRankVlist`: emit `Error: rebuild_vlists: lead is null for rank
     ${r}` (conc.c:158-160) and `Error: rebuild_vlists: rank lead ${name}
     not in order ${order} of rank ${r}` (conc.c:162-164), both now
     returning -1 (collapsed the port's prior -1/-2 split — C returns -1
     from both sites and no caller distinguished them).
   - `fillRankVlist`: emit `Warning: degenerate concentrated rank
     ${g.name},${r}` when `computeMaxi` returns -1 (conc.c:166-168,
     previously silently dropped).
   - `dotConcentrate`: stopped delegating its final cluster loop to
     `rebuildClusterVlists` (which is ALSO called recursively from inside
     `rebuildVlists` for nested clusters, where C does NOT emit this
     message) and instead ported conc.c's own loop (conc.c:237-243)
     directly: iterate `g`'s top-level clusters, call `rebuildVlists`, and
     on any non-zero rc emit `concentrate=true may not work correctly.`
     (no prefix — `agerr(AGPREV, ...)`) and return -1.

Verification: `GVBINDIR=/tmp/ghl dot -Tsvg 2825.dot` stderr now matches the
port's stderr byte-for-byte (both: the two rankset-deletion warnings, the
`Error: rebuild_vlists: lead is null for rank 1`, then the unprefixed
`concentrate=true may not work correctly.` — verified message ORDER too).
Port SVG no longer contains `class="edge"` elements or the invis point node
`P` (dot_splines/dotneato_postprocess correctly skipped); cluster frames are
now degenerate `0,0 0,0 0,0 0,0 0,0` polygons (set_aspect correctly never
ran), matching C exactly.

## Residual gap — stop condition triggered, NOT fixed here

2825 is still `diverged` (not conformant): the port emits all 9 real
`A..I` node ellipses (with real, non-degenerate coordinates), where C emits
**zero** nodes. This is a **separate, pre-existing defect** in the render/
emit layer, outside this task's write-set (`src/layout/dot/conc.ts`,
`index.ts`):

- **Origin 1**: `src/gvc/device.ts:430-432` (`render()`) —
  ```
  const gbb = g.info.bb;
  const hasValidBb = gbb && (gbb.ur.x > gbb.ll.x || gbb.ur.y > gbb.ll.y);
  job.bb = hasValidBb ? gbb : computeSubgraphBB(g, 0);
  ```
  When `g.info.bb` is unset (exactly C's post-abort state — `set_aspect`
  never ran), the port synthesizes a plausible bbox from actual node
  positions (`computeSubgraphBB`) instead of using the degenerate value as
  C does (`gvc->bb = GD_bb(g)` directly, emit.c:3272 — no fallback
  recompute exists in C at all).
- **Origin 2** (the more fundamental gap): `src/gvc/emit-walk.ts`
  (`nodeShown`, `walkNodesAndEdges`) has **no port at all** of C's
  `node_in_box(n, job->clip)` gate in `emit_node` (emit.c:1806-1809).
  `nodeShown` only checks the `outputorder`/layer gate — never a
  clip-box test. Even with origin 1 also fixed, without this gate every
  node would still emit (job.bb only shapes the computed viewBox, it
  doesn't exclude nodes from the walk in the port today).

Both files are render-pipeline code shared by every render path, not
`dot`-engine-specific — outside this task's declared write-set
(`conc.ts`/`index.ts`/`accepted-divergences.json`/`docs`). Per the mission's
stop condition ("Fix needs files beyond the write-set → stop and report"),
this residual is documented here and left for a follow-up mission rather
than expanded into scope. In the normal (non-aborted) rendering path this
gap is invisible: `job.bb` is ordinarily computed correctly by `set_aspect`
and covers every node's own extent by construction, so `node_in_box` would
always pass even if it existed — the gap only manifests on this rare
abort-before-`set_aspect` path (and would also matter for genuine
multi-page/`-Npages` clipping, separately out of scope here).

## Verification

- `2825`: stderr byte-identical to oracle (message text + order). SVG
  narrowed from 22-vs-4 top-level-childCount divergence to a 9-node-only
  divergence (edges/splines/point-node no longer emitted). See survey
  numbers logged in the accepted-divergences.json entry update.
- Regression sweep (concentrate corpus, before/after,
  `test/diagnostic/flat-geom-diff.mjs`): `1436`, `2087`, `167`, `2368_1`,
  `2559`, `graphs/b135`, `graphs/b15`, `graphs/b69`, `graphs/b62`,
  `graphs/b71`, `2183` all **0 element(s) diverge**, unchanged. `1453`
  (51 diverge, maxΔ 457), `2368` (1 diverges, maxΔ 10.22), `2361` (6
  diverge, maxΔ 144.13) — confirmed **byte-identical to pre-fix baseline**
  via `git stash`, so unaffected (none of these three hit the
  `dot_position`-failure path).
- `src/layout/dot/conc.test.ts`: added 3 tests (message
  sequence/order, edges-and-point-node-skipped, degenerate cluster boxes)
  using the verbatim 2825.dot repro; all pass.
- `npm run test`: 206 files / 2609 tests, all pass.
- `npx tsc --noEmit`: clean.

## Part 2 (fix/2825-rebuild-vlists, follow-up mission) — render-layer gap closed

The residual gap documented above ("Residual gap — stop condition triggered,
NOT fixed here") is now closed. `2825` is `conformant` (4-element output,
byte-identical structurally to the oracle: `<svg>` + background polygon + 2
degenerate cluster frames).

### Verdict

```json
{
  "mechanism": {
    "cause": "src/gvc/emit-walk.ts / src/gvc/device.ts had no port of C's emit_node node_in_box(n, job->clip) gate (emit.c:1636-1639, 1806-1809); device.ts:render() additionally recomputed a plausible bbox from live node positions (computeSubgraphBB fallback) whenever g.info.bb was unset, masking the degenerate GD_bb C leaves on this abort path (part 1) instead of propagating it faithfully.",
    "origin": "src/gvc/device.ts:430-432 (pre-fix render(), the computeSubgraphBB fallback) and src/gvc/emit-walk.ts/device.ts:renderNode (missing gate); C ref lib/common/emit.c:1636-1639 node_in_box, :1806-1809 emit_node gate, :3272 init_gvc (gvc->bb = GD_bb(g))",
    "causalChain": "On 2825's abort path (part 1), dot_position fails before set_aspect ever runs, so g.info.bb stays at its zero default (mirrors C's calloc-zero GD_bb). C's init_gvc reads gvc->bb = GD_bb(g) verbatim (no fallback), and init_job_viewport/setup_page derive job->clip from that degenerate bb (job->clip == GD_bb ± pad for the single-page, no-page= case this port implements -- Z and rotation algebraically cancel out of the derivation, verified by hand from emit.c:3356-3427 + :1532-1583). emit_node's node_in_box(n, job->clip) gate then rejects every real node (their ND_bb is far from the degenerate near-origin clip box), leaving only the unconditionally-drawn cluster frames (emit_clusters has no clip/box gate at all, confirmed by grep -- only clust_in_layer). The port instead recomputed a REAL bbox from actual node positions whenever g.info.bb was unset (device.ts:430-432, dating to the batch-11 golden-harness commit, f1bf494, for engines that at the time never set g.info.bb themselves), so job.bb was never degenerate, and emit-walk.ts had no node_in_box gate to apply even if it had been.",
    "ruledOut": [
      "computeSubgraphBB fallback being load-bearing for any live (non-abort) engine path: audited every layout engine -- dot (position-bbox.ts:85, set_aspect), neato (index.ts:169/183/213), circo (index.ts:50), sfdp (index.ts:152/154), fdp (layout.ts:361), osage (index.ts:354/368), twopi (via splineEdgesShifted -> neato/splines.ts:474, which itself ports compute_bb, called from BOTH layoutSingle and layoutMulti) all set g.info.bb themselves before render() runs, on every successful path. Confirmed empirically too: git-stash A/B rendered 6 healthy graphs across dot/twopi-shaped inputs before and after removing the fallback -- byte-identical. Not the load-bearing case the stop condition warned about.",
      "job->clip needing a stored/paginated field on RenderJob (multi-page pagesArrayElem/pagesArraySize machinery): traced setup_page's clip derivation by hand for the single-page (`page=` unset) case -- job->clip algebraically reduces to job->bb (padded GD_bb) once pagesArraySize={1,1}/pagesArrayElem={0,0}, independent of zoom Z (cancels) and rotation (pagesArrayElem/Size symmetric exch is a no-op for {0,0}/{1,1}). The port has no `page=` pagination model at all (RenderJob has no pagesArraySize field), so this reduction is exact for every case this port implements -- no new state needed, node_in_box computes clip inline from job.bb/job.pad.",
      "a cluster-level clip/box gate being needed: grepped emit.c's cluster emission path (emit_begin_cluster, emit_clusters) for any boxf_overlap/node_in_box-style test against job->clip -- none exists, only clust_in_layer (a layer gate, already ported). Matches the observed oracle (cluster frames drawn unconditionally even when degenerate) and the port's pre-existing behavior (already correct per part 1's note) -- no new cluster gate added, would have been unfaithful invention.",
      "edge_in_box needing to switch from job.bb (unpadded) to a padded clip: edges are covered by a separate, already-faithful port (src/render/svg.ts:edgeHasDrawableContent, pre-existing, carefully tuned against corpus regressions per its own comment) that made 2825's edges disappear as a side effect of part 1 (no splines routed on the abort path). Left untouched -- switching its bb source was outside this task's identified mechanism and risked the tuned overlap-suppression behavior documented in its comment (2368/2368_1)."
    ]
  },
  "fixLocus": [
    "src/model/geom.ts -- added exported boxOverlap (C's OVERLAP macro), replacing a private duplicate in src/render/svg.ts (DRY; both are now the same primitive)",
    "src/gvc/device.ts -- render(): job.bb = g.info.bb verbatim (no computeSubgraphBB fallback), matching init_gvc's gvc->bb = GD_bb(g); renderNode(): added nodeBBox()+nodeInBox() and an early-return gate before emitNodeBody, computing clip = job.bb ± job.pad inline (no new RenderJob field)"
  ]
}
```

### Verification

- `2825`: `test/diagnostic/flat-geom-diff.mjs` reports 0 elements diverge
  (structural match); raw SVG diff shows only the pre-accepted generator-
  comment/attribute-formatting differences. `parity-rules.json` (fresh
  survey) marks it `"verdict": "conformant"`.
- Sanity sweep (git-stash A/B, byte-identical before/after on 6 healthy
  graphs spanning dot with/without clusters/records and `size=`): `1436`,
  `graphs/unix.gv`, `graphs/clust.gv`, `1332`, `2183`, `graphs/size.gv` --
  all identical.
- `npm run test`: 206 files / 2609 tests, all pass, no golden diffs.
- `npx tsc --noEmit`: clean.
- Full corpus survey (789 items) + `rules-gate.ts`: `stable=765
  improvements=1 pre-existing=12 allowlisted=0 regressions=0
  clip-regressions=0 clip-watch=1`. The one improvement is `2825` itself
  (diverged -> conformant). `clip-watch: 1314` unchanged (pre-existing,
  not a regression). `test/corpus/parity-rules.json` reverted after the
  gate per convention (scratch file, not the committed baseline).
- `accepted-divergences.json`: removed the stale `2825` A4 entry (guard
  `npx vitest run test/corpus/accepted-divergences.test.ts` passes: 6/6).
- `docs/known-divergences.md`: updated the A4 section (2825 moved to the
  "conformant, no entry" list alongside 1939, with the closure mechanism
  documented) and the concentrate-arrowhead section's stale "still
  diverges" note for 2825.

## Diagnostic method note

Instrumented BOTH sides with temporary env-gated `console.error` calls
(`process.env.DEBUG_2825`) at `conc.ts:rebuildVlists`,
`position.ts:dotPosition`, and `index.ts:dotLayoutPipeline` to capture the
actual rc at each pipeline stage before forming any hypothesis; all three
were reverted before the final diff. Read C's `emit.c` (`init_gvc`,
`emit_node`, `emit_view`) and `gvc.c`/`gvlayout.c` to trace exactly why a
degenerate `GD_bb` produces a near-empty page (`node_in_box` gate) rather
than assuming it — this is what surfaced the render-layer gap as a
*separate* mechanism from the pipeline-propagation defect that was actually
in scope.
