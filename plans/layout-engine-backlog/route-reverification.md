# Routing Re-verification Corpus — Results (2026-06-16)

The `recommended-sequence.md` REQUIRED pre-step for `mission-dot-splines`:
diff a corpus of varied dot graphs against the C binary and let the diverging
subset define the mission scope. Run via `.probes/route-corpus.ts` (full diff)
and `.probes/route-diverge.ts` (title-matched per-edge diff) against a locally
built `dot` (15.1.0-dev, geometry identical to 15.0.0 spec), GVBINDIR plugins
in /tmp/gvplugins.

Metric: parse both SVGs, match edges by `<title>`, compare path control points
(Euclidean), viewBox, and structural counts (paths/polygons/ellipses/texts).

> **Update 2026-06-19:** the corpus is now **23 MATCH, 2 near, 0 DIVERGE
> (25/25, 0 structural)**. The original 6 divergences have all been closed by
> follow-on missions; the last, **G2** (`ports both dense`), was closed by
> `mission-dot-multiport` — a mincross tiebreak fix, not a splines fix (see the
> G2 row below). The 2 remaining `near` are pre-existing sub-pixel port residuals.

## Result: 17 MATCH, 2 near, 6 DIVERGE (of 25)  *(original 2026-06-16 snapshot)*

MATCH = pathΔ ≤ 0.5pt and viewBox Δ ≤ 1pt and structure identical.

**Byte-identical / MATCH (17):** multi-rank transitive, diamond, parallel
edges x3 (unlabeled), long skip edge, back edge, dense fan in/out, flat
unlabeled, self-loop, self-loop labeled, cluster basic, cluster edge endpoint,
two clusters (sibling), node shapes, undirected chain, edge label mid (regular
edge), wide tree, flat-adjacent port (0.32pt). The default rank-corridor
spline path is solid across the common cases.

**near (2) — known, already-pinned port residuals:** compass ports (0.65pt,
start-clip renorm), record ports (1.0pt). Not new work.

## The 6 divergences reduce to 4 distinct gaps

| Gap | Cases | Evidence | Existing backlog id |
|-----|-------|----------|---------------------|
| **G1: opposing / labeled parallel edges not lane-separated** | bidirectional (53pt), multi parallel labeled (23pt) | dot splays `a->b`+`b->a` into two lanes (x=21 / x=33 around center 27); TS draws one straight + one malformed. Plain unlabeled parallel-x3 MATCHES, so it's specifically opposing-direction and label-bearing parallel edges. | new — closest to DOT-2/DOT-5 (label virtual nodes) |
| **G2: multiple compass ports off one node** ✅ **RESOLVED** (mission-dot-multiport, 2026-06-19) | ports both dense (66pt → 0.25pt MATCH) | ~~`a:w->c` stays at node center x=99 instead of the west face x=70~~. **Root cause was not splines** — mincross `accumCross` broke same-`ND_order` ties by the angular `port.order` instead of the geometric `p.x` that C `in_cross`/`out_cross` (`mincross.c:593,611`) uses, swapping rank-1 c/d and mispositioning `a` to x=126. Fix: tie by `p.x`. | DOT-1 residue → done |
| **G3: nested clusters** | nested cluster (path 53pt, **vbΔ=64**) | node placement + drawing bbox wrong for a cluster inside a cluster; the edge just follows mis-placed nodes. Sibling clusters (two clusters) MATCH — only NESTING breaks. | not a routing gap — cluster layout |
| **G4: flat labeled edge label dropped** | flat labeled (STRUCT: C 3 texts, TS 2) | TS emits no `<text>` for the label on a `rank=same` labeled edge. | DOT-2 / DOT-5 (`make_flat_labeled_edge`) |
| (narrow) rankdir=LR skip edge | rankdir LR (8.3pt) | `a->b`,`b->c` conformant; only the transitive `a->c` is ~3.5pt off in LR. | low priority |

## Implication for mission-dot-splines

The original "all edges are straight / pathplan blocks everything" framing is
**confirmed dead** — pathplan is ported and the default + cluster + self +
flat-adjacent + simple-parallel cases all match dot. The residue is narrow and
splits cleanly:

1. **G1 (opposing/labeled-parallel lane separation)** — most user-visible;
   real DOT files have bidirectional and labeled-parallel edges. Highest value.
2. **G4 (`make_flat_labeled_edge`)** — small, well-scoped; pairs naturally with
   `mission-dot-flat-labels` (DOT-2/DOT-5).
3. **G2 (multi-port-per-node routing)** — extends the steering-port work.
4. **G3 (nested clusters)** — a cluster *layout* gap, not spline routing; own
   mission.
5. rankdir=LR skip edge — narrow, low priority.

Recommended: promote **G1 + G4** as the next mission (`mission-dot-edge-multi`
or fold into `mission-dot-flat-labels`); treat **G3** as a separate cluster
mission; **G2** as dot-splines residue.

Corpus probes retained at `.probes/route-corpus.ts` and
`.probes/route-diverge.ts` (re-runnable; require the built dot + GVBINDIR).
