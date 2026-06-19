# Graphviz → TypeScript Port Catalog (SVG-only)

**Purpose.** A complete, checkable inventory of every algorithm / piece in the
C Graphviz source (`~/git/graphviz`) and its port status in `graphviz-ts`,
scoped to what is needed to **produce SVG** (plus the `json` / `xdot` / `dot` /
imagemap intermediate text formats).

The per-engine **gap detail** lives in
`../layout-engine-backlog/gaps/{dot,neato,sfdp,twopi-circo}.md`; the
**prioritized mission sequence** lives in
`../layout-engine-backlog/recommended-sequence.md`. This file is the
project-wide superset and links to those rather than duplicating their C
citations.

## Classification principle (read first)

Per `CLAUDE.md`: **the C source defines completeness — omissions are bugs.**
Two earlier port attempts failed by cutting corners on feature compatibility,
so this catalog does **not** use "looks unused" as a reason to skip anything.

- `[x]` ported — faithful to C
- `[~]` partial — core path works; **named** sub-features still missing
- `[ ]` **not ported — a real gap.** Reachable via some DOT attribute / mode /
  shape / edge case. This is work, not a footnote. "Not exercised by current
  tests" is NOT a reason to downgrade to `N/A`.
- `N/A` reserved for **only two** categories, each with an inline reason:
  1. **Browser-impossible mechanics** that the C does for the native env —
     filesystem/exec/mmap/threads, manual memory arenas, output byte-buffers.
     Where the C reads external data (fonts, images, config), the faithful
     equivalent is a **caller-supplied callback/parameter**, not a deletion —
     note that obligation.
  2. **Output formats you excluded** — raster (PNG/JPG/GIF/WebP/BMP),
     PostScript/PDF/EPS, and GUI/interactive backends. SVG + json + xdot + dot
     + imagemap are in scope.

Architectural replacements (e.g. static plugin registration instead of
`dlopen`, native `Map` instead of a `cdt` dict) are marked `N/A (arch)` **only
when behavior is fully preserved** — if the C structure encodes semantics
(attribute inheritance, ordering), the semantics must be reproduced and
verified, not assumed.

Status reflects an agent-assisted survey on **2026-06-18** (HEAD on
`feature/dot-curved-compound`). Verify the live symbol before acting on any row.

---

## Primary consumer

graphviz-ts is slated to **replace plantuml-js's entire in-house layout code**
(`src/core/dot/` etc.) as the faithful layout backend. PlantUML is **dot-centric**
(class/state/component/activity diagrams emit DOT and consume the `dot` engine),
so **dot-engine edge-case fidelity is the highest-value correctness target** —
the dot rows in this catalog gate real PlantUML output. The library must still
be complete for all engines, but prioritize dot when sequencing.

## Deliberate non-goals (and why)

These are **conscious scope choices**, not gaps. Each is something the C
toolkit does that this port intentionally does **not** reproduce, with the
reasoning recorded so a future contributor doesn't "fix" a deliberate omission.
A non-goal is legitimate only when it falls in one of the categories below; if
something doesn't fit here, it is in scope and must be ported faithfully (see
the Classification principle).

1. **Raster and other output formats** — PNG, JPG, GIF, WebP, BMP, PostScript,
   PDF, EPS, etc.
   *Why:* SVG is a vector format — infinitely scalable, and **trivially
   convertible to any of these by a host of existing tools** (browsers,
   `rsvg-convert`, ImageMagick, Inkscape, headless Chromium, OS print
   pipelines). Reproducing raster/PS backends would re-solve an already-solved
   problem and drag in browser-hostile, font-rasterizing native dependencies
   (cairo, gd, pango raster, ghostscript). We emit one universal vector
   representation and let the ecosystem turn it into "anything."
   *In scope alongside SVG:* the other **text** formats that are cheap and
   useful as data — `json`, `xdot`, `dot` (round-trip), and imagemap.

2. **GUI / interactive rendering backends** — glcomp (OpenGL), xlib, gtk/gdk,
   quartz, the live-editing event system (`gvevent.c`).
   *Why:* this is a layout + vector-render **library**, not an application.
   Consumers build their own UI around the SVG/coordinate output.

3. **Font rasterization** — pango/cairo glyph rendering.
   *Why:* SVG defers actual glyph drawing to the viewer. We only need text
   **metrics** (advance widths / line heights) to size and place labels, which
   the ported FreeType-style LUT model provides. We measure text; we never
   rasterize it.

4. **gvpr + expr** — the graph-stream scripting language and its interpreter.
   *Why:* gvpr *transforms* an existing graph; the DOT→SVG path *builds* the
   graph and only needs layout. Verified unused by the canonical consumer
   (`~/git/plantuml` invokes only `dot -T<fmt>`). Revisit only if a future
   consumer needs scripted graph transformation.

5. **Standalone CLI surface** — `args.c` option parsing, `ingraphs` multi-file
   reading, and the `tred`/`unflatten`/`acyclic`/`gvpr` command-line tools.
   *Why:* a library exposes a programmatic API; argument parsing and
   file-stream plumbing are the caller's concern. (The *algorithms* behind
   `tred`/`unflatten`/etc. are still ported **if** a layout path uses them —
   only the CLI wrapper is a non-goal.)

6. **Native-environment mechanics** — filesystem/`FILE` I/O, executable-path
   discovery, `dlopen` plugin discovery, manual memory arenas, output byte
   buffers.
   *Why:* the target is the browser. External data (the DOT source, fonts,
   images, config) arrives via **caller-supplied parameters/callbacks**; plugin
   selection is **static registration**; memory is GC'd. Behavior is preserved;
   only the mechanism changes.

7. **C++ convenience wrappers** — `cgraph++`, `gvc++`.
   *Why:* port the C API first; an idiomatic-TypeScript convenience layer, if
   wanted, is a separate package (per `CLAUDE.md`).

> **Fidelity caveat within the in-scope surface.** Everything *not* listed
> above is held to byte-faithfulness against the C binary. The one unavoidable
> boundary is **floating-point determinism**: force-directed engines (sfdp/
> neato/fdp) depend on FMA and `Math.pow` rounding that can differ across JS
> engines and CPU architectures (see `src/common/{fma,arm-pow}.ts`). The port
> matches C's FP order where it can; exact reproduction of iterative layouts is
> conditional on that. This is a constraint, not a choice — tracked separately
> from the non-goals above.

## Honest scope summary

Defaults and the core pipeline are solid: all 8 engines run at defaults and
match the C binary byte-for-byte on the golden corpus. But **full attribute /
edge-case compatibility has a real long tail** — exactly where the previous
attempts broke. The remaining `[ ]` / `[~]` work, by area:

### dot engine
1. `splines=curved` + verify `compound` — **active** (`../dot-curved-compound/`)
2. `make_regular_edge` obstacle routing (dense corridors) — `recommended-sequence.md` §1.
   _Multi compass-port ends (G2, `ports both dense`) closed by mission-dot-multiport
   (2026-06-19): a mincross `accumCross` tiebreak fix (tie by port `p.x`, not the
   angular `port.order`; C `mincross.c:593,611`), not a splines fix. Corpus 25/25._
3. `newrank=true`: `fillRanks` + `expand_leaves` — `mission-dot-newrank`
4. `nslimit` position-NS iteration cap — DOT-6 (inline)
5. class1/class2 intercluster-edge merging — confirm completeness

### neato / sgd (largest gap cluster — non-default models & modes)
6. overlap modes: **voronoi, prism, scan, scalexy, nscale** (Voronoi/Delaunay
   stack + prism) — NEA-6
7. distance models: **circuit**, **mds**, **closest-pair** — NEA-1/NEA-2
8. init: **smart_init** (sparse-subspace PCA), **start=regular**, **start=self** — NEA-3/4
9. **`mode=hier`** (digcola) and **`mode=ipsep`** — currently `console.warn` + fallback
10. multi-obstacle edge routing (`multispline.c`) and edge `xlabel` placement — NEA-5
11. supporting solvers the above need: LU, matrix-inverse, QP, embed/PCA

### sfdp / sparse / topfish
12. `post_process` smoothers (Triangle/Spring/StressMajorization)
13. `edge_labeling_scheme > 0`; topfish multilevel coord rescale; sparse
    modularity clustering (`clustering.c`/`mq.c`)

### common rendering
14. `taper.c` tapered edges (`style=tapered`)
15. full `ellipse.c` arc subdivision; `pointset.c`/`intset.c` utilities
16. verify `input.c` graph-init/`setEdgeType`/default-binding equivalents
    survived the peggy-parser substitution

### filters / output / cgraph transforms
17. `mingle` edge bundling; `edgepaint` color-separation filter
18. `-Tplain` text output (`output.c`)
19. cgraph `tred` / `unflatten` / `acyclic` / `agapply` — confirm none are
    called internally by a layout path before deferring
20. raster image embedding into SVG (`<image href>`, `gvloadimage`)

Everything below is the full per-module catalog backing this list.

---

## Layer 0 — Foundation (cdt, cgraph, ast, rbtree, util)

### `lib/cdt/` — container data types
- [x] dttree.c — splay tree → `src/cdt/splay-core.ts`, `splay.ts`
- [x] dthash.c — hash table → `src/cdt/hash-core.ts`, `hash.ts`
- [x] dtstrhash.c → `src/cdt/strhash.ts`; Dtbag (ordered multiset) → `src/cdt/bag.ts`
- [x] dtopen/dtsize/dtwalk — lifecycle/iterate → folded into splay/hash
- [~] **dtview.c** — view-dict over a parent. C uses this for **subgraph
  attribute-default inheritance**. TS replaces dicts with `Map`s — **verify the
  inheritance/override semantics are reproduced** (`agget` walking to root); do
  not assume. The structure is `N/A (arch)`; the *semantics* are load-bearing.
- `N/A (arch)` dtclose/dtextract/dtflatten/dtrenew/dtrestore/dtstat/dtdisc/
  dtmethod — GC / constructor-param equivalents; no behavioral semantics lost

### `lib/cgraph/` — core graph model
- [x] graph.c — agOpen/agClose/agIsSimple → `src/model/graph.ts`, `src/parser/builder.ts`
- [x] node.c → `src/model/cgraph-ops.ts`; edge.c → `src/model/edge.ts` + builder
- [x] subg.c → `src/model/cgraph-ops.ts`; attr.c → native Maps in `graph.ts`
  (**see dtview note** — confirm default inheritance)
- [x] write.c — agWrite → `src/parser/index.ts`
- [~] obj.c — agdelete/agroot/agraphof → partial in `cgraph-ops.ts`; confirm
  full object-kind dispatch
- [ ] **acyclic.c** (cgraph) — standalone acyclic transform (distinct from
  dotgen/acyclic). Confirm not invoked internally, else port.
- [ ] **apply.c** (agapply) — filter/map walk; **may be called internally** —
  verify before deferring
- [ ] tred.c (transitive reduction), unflatten.c — graph-transform filters;
  port if any layout path or supported CLI surface needs them
- [ ] node_induce.c — edge induction
- `N/A (env)` refstr.c (string interning), rec.c (user-records), id.c/imap.c
  (id alloc / id→obj map) — replaced by `info` fields + Map keys; io.c,
  ingraphs.c — FILE / multi-file reading (caller supplies the source string)

### `lib/ast/` — string utilities
- [~] fmtesc.c / chresc.c / stresc.c — escaping → `src/parser/index.ts`,
  `src/common/html-string.ts` (simplified — confirm it covers all C escape cases)
- [ ] **strmatch.c** — glob/grp pattern matching. Used by attribute pattern
  matching; port rather than assume unreachable.
- [ ] chrtoi.c — char→numeric (escape decoding edge cases)
- `N/A (arch)` error.c — error context → `ParseError`

### `lib/rbtree/` — [x] red_black_tree.c → `src/rbtree/index.ts` (faithful)

### `lib/util/`
- [x] list.c, xml.c, random.c (MT19937), gv_math.h → `src/util/*`
- [ ] base64.c — used for embedded data URIs in SVG (`<image>`); port when image embed lands
- `N/A (env)` arena.c, gv_find_me.c, gv_fopen.c — memory/FS/exec

---

## Layer 1 — Common rendering / geometry / text (`lib/common/`, `lib/label/`)

### `lib/common/`
- [x] shapes.c (~4342) — all polygon + record shape families →
  `src/common/{shapes,shapeData,poly-*,record,compass-port,record-port}.ts`
- [x] ns.c (~1414) — network simplex ranking → `src/layout/dot/ns-*.ts`
- [x] splines.c (~1375) — spline clipping, self-edges → `src/common/splines*.ts`
- [~] routespl.c (~1042) — box-sequence routing ported (`splines-routespl.ts`);
  - [ ] `makeStraightEdges` + `bend` + `get_cycle_centroid` — `splines=curved` (active mission)
- [x] arrows.c (~1361) — all arrow types + compound parsing → `src/common/arrows*.ts`
- [x] emit.c (~4365) — render orchestration → `src/render/svg*.ts`, `src/gvc/{device,job}.ts`
- [x] htmltable.c / htmllex.c — HTML-like labels → `src/common/htmltable*.ts`
- [x] colxlate.c + brewer/X11 tables — named/RGB/HSV/gradient/**colorscheme** →
  `src/common/{color,colorData}.ts` (brewer `/accent`,`/blues`,`/spectral`… ported)
- [x] labels.c → `make-label.ts`; postproc.c → `postproc.ts`
- [x] textspan.c + textspan_lut.c — text measurement + font LUT →
  `src/common/textmeasure*.ts` (FreeType 96dpi model — see memory)
- [x] geom.c → `src/model/geom.ts`, `src/common/splines-geom.ts`
- [~] utils.c (~1620) — bezier/cluster/gradient helpers ported; confirm no
  layout-relevant helper left in the CLI/config remainder
- [~] **ellipse.c** — only wedge arcs ported (`svg-multicolor.ts`); **full
  arc→bezier subdivision not ported** — needed for faithful curved shapes
- [ ] **taper.c** — tapered edges (`style=tapered`)
- [ ] **pointset.c / intset.c** — point/int set utilities (currently inlined ad hoc)
- [~] **input.c** — DOT scanning replaced by peggy parser, BUT `graph_init`,
  `setEdgeType`, attribute/default binding, label preprocessing live here —
  **verify each has a ported equivalent**; not purely CLI
- [ ] **output.c** — `-Tplain` text output (faithful text format; deferred, not N/A)
- `N/A (env)` globals.c (no globals — init values reproduced elsewhere),
  timing.c (instrumentation), args.c (CLI args → library API)
- `N/A (PS)` psusershape.c — PostScript user shapes (SVG path via gvusershape)

### `lib/label/` — external `xlabel` placement
- [x] xlabels.c, index.c, split.q.c, node.c, rectangle.c — grid placement +
  R-tree collision index → `src/label/*`

---

## Layer 2 — Layout engines

### `lib/dotgen/` — **dot** (priority engine) → `src/layout/dot/`
- [x] acyclic, cluster, compound→`compound*.ts`, conc, decomp, dotinit→`init.ts`,
  fastgr, flat, sameport, rank(+rank-dot2)
- [~] class1.c / class2.c → `classify.ts` (merged) — **intercluster-edge
  merging partial** — confirm against C
- [~] mincross.c (~1809) → `mincross*.ts` — crossing-min + `fillRanks` +
  `checkLabelOrder` in (see 2471 memory); confirm no residual order desync
- [~] position.c (~1133) → `position*.ts` — mostly ported;
  - [ ] `nslimit` (nsiter2 cap) — DOT-6
  - [ ] `expand_leaves` (newrank leafsets) — DOT-4
- [~] dotsplines.c (~2309) → `splines*.ts`/`edge-route*.ts` — dispatch + flat +
  `line`/`polyline`/`ortho` byte-exact;
  - [ ] `splines=curved` (active mission)
  - [ ] `make_regular_edge` obstacle path (dense/port-constrained) — re-verify scope
  - [x] `splines=compound` clip wired (mission verifies)
- [x] aspect.c → `aspect.ts` (faithful no-op; C also incomplete)

### `lib/neatogen/` — **neato/sgd** + shared math → `src/layout/neato/`
**Ported core:**
- [x] neatoinit→`init.ts`/`index.ts`, stress.c→`stress*.ts`, sgd.c→`sgd.ts`,
  stuff.c, bfs.c, dijkstra.c, conjgrad.c, matrix_ops.c, randomkit→`util/mt19937.ts`
- [x] neatosplines.c → `splines.ts` (self-arcs, cluster shift)
  - [ ] edge `xlabel` post-routing placement — NEA-5
- [~] adjust.c / overlap.c → `overlap.ts`, `sep-factor.ts` — modes none/vpsc/ipsep done

**Real gaps (reachable; previously mislabeled "unused"):**
- [ ] **overlap modes** voronoi/prism/scan/scalexy/nscale (NEA-6) — needs the
  Voronoi stack below + prism scaling
- [ ] **Voronoi/Delaunay stack**: voronoi.c, delaunay.c, hedges.c, heap.c,
  geometry.c, edges.c, site.c, legal.c, call_tri.c — backs `overlap=voronoi`
- [ ] **constraint layout**: constrained_majorization.c,
  constrained_majorization_ipsep.c, constraint.c, quad_prog_solve.c,
  quad_prog_vpsc.c, compute_hierarchy.c — backs **`mode=hier`** and
  **`mode=ipsep`** (confirmed warn+fallback at `init.ts:392`)
- [ ] **distance models**: circuit.c (`model=circuit`), embed_graph.c +
  closest.c (`model=mds`/closest), stress.c circuit/mds branches — NEA-1/2
- [ ] **init**: smart_ini_x.c + pca.c (`smart_init`/`start=N`), start=regular/self — NEA-3/4
- [ ] **edge routing**: multispline.c — multi-obstacle spline routing for neato edges
- [ ] **solver deps** the above need: lu.c, matinv.c, solve.c, opt_arrangement.c, poly.c
- [~] kkutils.c — some APSP ported in bfs/dijkstra/stress; confirm
  neighbor-vector utilities covered

### `lib/vpsc/` — [x] full port (`Solver/Block/Blocks/Constraint/Variable/SweepLine/index`)

### `lib/sfdpgen/` + deps → `src/layout/sfdp/`
- [x] Multilevel.c→`multilevel.ts`, spring_electrical.c→`spring-*.ts`, sfdpinit→`init.ts`/`index.ts`
- [ ] post_process.c — Triangle/Spring/StressMajorization smoothers (attr-reachable)
- [ ] sfdpinit `edge_labeling_scheme > 0`; sparse_solve.c; stress_model.c
- **`lib/sparse/`**: [x] SparseMatrix.c, QuadTree.c (Barnes-Hut), general.c → `src/layout/sfdp/{sparse-matrix*,quadtree}.ts`
  - [x] brewer color tables — ported in `src/common/colorData.ts`
  - [ ] clustering.c (modularity_clustering), mq.c — used by clustering/coloring & mingle
  - [ ] colorutil.c rgb2hex (trivial); DotIO.c — matrix dot-I/O (confirm unused, else port)
- **`lib/topfish/`**: [ ] hierarchy.c, rescale_layout.c — multilevel coordinate
  rescaling; verify whether neato multilevel / `mode=hier` reaches it

### `lib/fdpgen/` — **fdp** → `src/layout/fdp/`
- [x] layout.c, tlayout.c, xlayout.c, grid.c, fdpinit.c, comp.c
- [ ] clusteredges.c — compound cluster-endpoint edge routing in fdp
- `N/A (debug)` dbg.c

### `lib/circogen/` — **circo** → `src/layout/circo/` — [x] fully ported
### `lib/twopigen/` — **twopi** → `src/layout/twopi/` — [x] circle.c, twopiinit.c
### `lib/osage/` — **osage** → `src/layout/osage/` — [x] osageinit.c
### `lib/patchwork/` — [x] patchwork.c, patchworkinit.c, tree_map.c
### `lib/pack/` — [x] pack.c, ccomps.c → `src/layout/pack/`

---

## Layer 3 — Edge routing libraries

### `lib/pathplan/` — obstacle routing → `src/pathplan/`
- [x] route.c, shortest.c, triang.c, visibility.c, solvers.c; shortestpth.c +
  cvt.c → `vispath.ts`; util.c folded into `route.ts`
- [ ] **inpoly.c** (in_poly point-in-polygon) — wire when a routing consumer needs it

### `lib/ortho/` — orthogonal routing → `src/ortho/` — [x] fully ported & oracle-pinned
  (ortho, maze, partition, sgraph, rawgraph, trapezoid→`trap-*.ts`, fPQ)

---

## Layer 4 — Context, output, filters

### `lib/gvc/` — graphviz context → `src/gvc/`
- [x] gvcontext.c, gvc.c → `context.ts`; gvjobs.c → `job.ts`; gvdevice.c →
  `device.ts`; gvtextlayout.c → `textlayout.ts`
- [~] gvrender.c → `device.ts` + callbacks — confirm color resolution / feature
  negotiation parity
- [~] **gvloadimage.c / gvusershape.c** — SVG `<image href>` embedding partial —
  real feature (raster *embed*, not raster *render*); base64 data URIs need util/base64
- `N/A (arch)` gvplugin.c / gvconfig.c / gvlayout.c — dynamic `dlopen` discovery
  → **static registration** (`src/render/index.ts`, direct layout dispatch); behavior preserved
- `N/A (GUI)` gvevent.c — interactive event dispatch

### `lib/xdot/` — [x] xdot.c (parse/emit/json) → `src/xdot/`

### `plugin/core/` — output renderers
- [x] gvrender_core_svg.c — all callbacks → `src/render/svg*.ts`
- [x] gvrender_core_json.c → `json.ts`; gvrender_core_dot.c → `dot.ts`;
  gvrender_core_map.c (imagemap) → `map.ts`
- `N/A (arch)` gvplugin_core.c registration table → `render/index.ts`
- `N/A (output)` ps / pic / pov / vml / tk / fig / **plain** — note: `-Tplain`
  text output IS catalogued as a real `[ ]` under `common/output.c`
- `N/A (raster)` all raster renderers

### `plugin/{dot,neato}_layout/` — `N/A (arch)` TS embeds layouts directly

### `lib/edgepaint/` — color-separation filter (`edgepaint` tool)
- [ ] edge_distinct_coloring.c, node_distinct_coloring.c, lab.c,
  intersection.c, furtherest_point.c — **not ported**. Distinct from
  `color="a:b"` **multicolor edge rendering** (which IS done in
  `src/render/svg-multicolor.ts`). lab_gamut data partly in `colorData.ts`.

### `lib/mingle/` — edge bundling (C++) — [ ] **not ported**
  (edge_bundling, agglomerative_bundling, ink, nearest_neighbor_graph)

### Resolved out of scope
- `lib/gvpr/` + `lib/expr/` — gvpr graph-scripting/stream-editing language and
  its expression interpreter. **Decided out of scope (2026-06-18).** gvpr
  *transforms* an existing graph; PlantUML and any DOT→SVG path *builds* the
  graph and only needs the layout engine. Verified against the canonical Java
  spec `~/git/plantuml`: zero real gvpr usage (only `dot -T<fmt>` invocation).
  Revisit only if a future consumer needs graph-stream transformation.

### Genuinely out of scope (`N/A`)
`lib/glcomp/` (OpenGL), `lib/sfio/` (buffered I/O → caller string),
`lib/cgraph++/`, `lib/gvc++/` (C++ convenience wrappers), and all raster / PS /
GUI plugins (gd, gdiplus, pango/cairo rasterization, lasi, poppler, rsvg,
quartz, webp, devil, gs, kitty, vt, gdk, xlib). Text **metrics** are reproduced
via the FreeType LUT model; only rasterization is excluded.

---

## Verifying fidelity: the graphviz test corpus

The highest-value correctness net is differential testing against graphviz's own
test corpus — it is the long-tail edge-case coverage that broke earlier port
attempts. The approach below is settled, and the **dot-first** slice is now
**realized** — see the dashboard.

### Realized: dot parity dashboard → [`test/corpus/PARITY.md`](../../test/corpus/PARITY.md)

The differential corpus harness lives under `test/corpus/` (`enumerate.ts` →
`survey.ts` → `dashboard.ts`); see [`test/corpus/README.md`](../../test/corpus/README.md).
It is the realized **comparison page / parity dashboard** `CLAUDE.md` requires,
and is a **report, not a gate** — kept separate from the curated golden suite.

Headline, dot engine, oracle `dot 15.1.0`, **796 applicable** inputs
(805 corpus `.gv`/`.dot` − 9 quarantined: 6 engine-deferred, 3 multi-graph):

| verdict | count | |
|---------|------:|---|
| byte-match | 112 | port == oracle within 0.01 |
| structural-match | 218 | same tree, coordinate drift only |
| **diverged** | **422** | structural difference (the backlog) |
| errored | 20 | port threw |
| timeout | 8 | port hung (killed) |
| oracle-error | 16 | no oracle reference (excluded) |

`byte-match + structural-match = 330/796 (41.5%)` structurally equal. The
`diverged` + `errored` sets are triaged into named buckets in PARITY.md — that
bucket list is the prioritized backlog for follow-on oracle-pinned fix missions
(largest first: element-count 157, path-structure 109, color-stroke 56,
font-metrics 49; parser-gap 10). Force engines (neato/fdp/sfdp/circo/twopi/
osage) remain a deferred follow-on (the harness's `iterative` tolerance class
already exists).

The dot-first slice above is done; the **force-engine** extension (neato/fdp/
sfdp/circo/twopi/osage, structural-tolerance comparison) remains a future mission
— recorded here so the approach stays settled before it starts.

### What's actually there

`~/git/graphviz/tests/` is ~1.68M lines total, but that figure is misleading —
it is dominated by reference-output artifacts, not work:

| Bucket | Count | Use |
|--------|-------|-----|
| Input graphs (`.gv` 625, `.dot` 180; + 61 in `graphs/`) | **~800** | the actionable corpus |
| Reference outputs (`.ps` 213, `.png` 159, `.xdot` 147, `.svg` 101, `.jpg` 12) | — | mostly formats we don't emit; bulk of the line count |
| Test harnesses (`.cpp` 62, `.c` 30, `.py` 12) | **~100** | mine for intent, don't port |
| gvpr scripts (`.gvpr` 22) | — | out of scope |

Actionable surface ≈ **800 inputs + 100 harnesses**, and a large slice of both
is inapplicable (ps/png/jpg references, gvpr, C-API memory/lifecycle tests).

### Approach (settled)

1. **Mine, don't port.** The value in the ~100 cpp/py files is *which edge cases
   someone pinned* (issue-number-named `.gv` files especially). Extract intent;
   do not translate assertions verbatim.
2. **Differential corpus harness, not hand-written tests.** Render each
   applicable input through the **native binary oracle** (`dot -Tsvg`, etc. —
   the established oracle pattern) and through graphviz-ts, then diff. Scales to
   ~800 inputs without authoring ~800 tests.
3. **Tier the comparison by engine.** `dot` is **byte-targetable** (goldens
   already byte-exact) → byte-diff is the bar. Force engines (sfdp/neato/fdp)
   are **not** byte-identical cross-platform (the FP/FMA/`pow` boundary above) →
   structural/tolerance comparison (same topology, positions within ε), else
   false failures.
4. **Sequence dot-first.** The primary consumer (plantuml-js) is dot-centric, so
   the dot subset of the corpus carries most of the payoff. A tractable first cut
   is just the `.gv`/`.dot` inputs exercising `dot`, rendered to `-Tsvg`/`-Txdot`.
5. **Parity dashboard.** Per input: `byte-match | structural-match | diverged |
   quarantined-inapplicable`. This doubles as the "comparison page for every
   excluded case" that `CLAUDE.md` requires. **Realized** for dot at
   [`test/corpus/PARITY.md`](../../test/corpus/PARITY.md) (see headline above).

## Maintenance

When a `[ ]`/`[~]` item is finished, check it here **and** update the matching
row in `gaps/*.md` / `recommended-sequence.md`. Before marking any `[ ]` as
`N/A`, prove it falls in one of the two `N/A` categories above — reachability
is never sufficient grounds. Re-run the 7-agent survey if large parts of the
tree change.
