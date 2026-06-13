# Layout-Engine Porting Gaps — Triage Backlog

**Objective:** Catalogue, prioritise, and sequence the layout-engine
porting gaps in graphviz-ts so each gap can be promoted to a mission
brief or explicitly left guarded.

This is NOT a single executable mission. Each row in the priority
table is an independent future mission (or deliberate deferral).
Read the per-engine gap files for full C citations and task outlines.

## Canonical Rules

- C source at `~/git/graphviz/lib/` tag **15.0.0** is the spec.
- Quality bar per gap mission: `tsc --noEmit` exit 0, `vitest run`
  passed >= 1466, goldens byte-identical for all unrelated engines.
- One commit per task; merge commit (not squash) back to main.
- Hook limits per file: 30 lines/fn, CCN 10, 5 params, 500 lines/file.

## Key References

| Path | Purpose |
|------|---------|
| `src/layout/dot/` | dot engine TypeScript |
| `src/layout/neato/` | neato/sgd TypeScript |
| `src/layout/sfdp/` | sfdp TypeScript |
| `src/layout/twopi/` | twopi TypeScript |
| `src/layout/circo/` | circo TypeScript |
| `src/layout/fdp/` | fdp TypeScript |
| `~/git/graphviz/lib/dotgen/` | dot C source |
| `~/git/graphviz/lib/neatogen/` | neato/sgd/twopi C source |
| `~/git/graphviz/lib/sfdpgen/` | sfdp C source |
| `~/git/graphviz/lib/circogen/` | circo C source |
| `~/git/graphviz/lib/fdpgen/` | fdp C source |
| `~/git/graphviz/lib/pathplan/` | pathplan C source (routing dep) |

## Priority Table (all gaps)

Reachability key:
- **DEFAULT** = triggered by everyday dot/neato/sfdp/fdp input at engine defaults
- **ATTR** = requires a specific graph attribute
- **RARE** = requires uncommon combination of attrs rarely set together

| Gap | Engine | Reachable via | Visual impact | Est. size | Suggested mission |
|-----|--------|--------------|--------------|-----------|------------------|
| DOT-1: `make_regular_edge` / pathplan spline routing | dot | **NEEDS RE-VERIFICATION** (NOT all edges — see note below) | UNCLEAR — standard multi-rank routing already matches C byte-for-byte; deferral likely bites only hard obstacle/port-constrained cases | ~1,200 LOC + pathplan port | `mission-dot-splines` |
| DOT-2: `make_flat_edge` / flat spline routing | dot | ATTR (`rank=same` + label) | HIGH — labeled flat edges missing Bezier arcs | ~300 LOC (needs DOT-1 first) | `mission-dot-splines` (sub-task) |
| DOT-3: `fillRanks` / `newrank` mode | dot | ATTR (`newrank=true`) | HIGH — rank assignment wrong for compound multi-graph layouts | ~250 LOC (isolated) | `mission-dot-newrank` |
| DOT-4: `expand_leaves` | dot | ATTR (leafset clusters) | MEDIUM — LEAFSET nodes mispacked in rank slots | ~150 LOC | `mission-dot-newrank` (sub-task) |
| DOT-5: `checkLabelOrder` / `recResetVlists` | dot | ATTR (flat labeled edges + mincross) | MEDIUM — label-node ordering not corrected; edge crossings may increase | ~200 LOC | `mission-dot-flat-labels` |
| DOT-6: `nslimit` attribute (nsiter2) | dot | ATTR (`nslimit=N`) | LOW — iteration cap for position NS ignored; slower convergence only | ~20 LOC | inline fix |
| NEA-1: `MODEL_CIRCUIT` (circuitModel) | neato/sgd | ATTR (`model=circuit`) | HIGH — circuit shortest-path used instead; distances wrong for cyclic graphs | ~200 LOC | `mission-neato-models` |
| NEA-2: `MODEL_MDS` in SGD | neato/sgd | ATTR (`model=mds` + `mode=sgd`) | MEDIUM — falls back to shortpath; MDS initialization skipped | ~150 LOC | `mission-neato-models` |
| NEA-3: `smart_init` / sparse subspace (`start=N`) | neato | ATTR (`start=N` integer) | LOW — random init used; positions differ but converge to same quality | ~300 LOC | `mission-neato-models` (sub-task) |
| NEA-4: `start=regular` / `start=self` | neato | ATTR (`start=regular` or `start=self`) | LOW — silently uses random init; only affects starting positions | ~100 LOC | `mission-neato-models` (sub-task) |
| NEA-5: xlabels on edges (neato) | neato | ATTR (`xlabel=` on edge) | MEDIUM — external edge labels not positioned post-spline-routing | ~100 LOC | `mission-neato-xlabels` |
| NEA-6: `adjustNodes` VPSC overlap removal (neato full) | neato | ATTR (`overlap=...` non-default) | MEDIUM — node overlaps not removed for non-default overlap modes | ~400 LOC | `mission-neato-overlap` |
| SFDP-1: `beautify_leaves` | sfdp | ATTR (`beautify=true`) | MEDIUM — leaf nodes not repositioned for aesthetic improvement; throws | ~150 LOC | `mission-sfdp-beautify` |
| SFDP-2: `edge_labeling_scheme` (label_scheme > 0) | sfdp | ATTR (`label_scheme=1..4`) | MEDIUM — edge label nodes not repositioned per scheme | ~250 LOC | `mission-sfdp-labels` |
| SFDP-3: `prism` overlap removal (ntry > 0) | sfdp | ATTR (`overlap=prism` with ntry) | MEDIUM — prism OverlapSmoother not applied; throws if reached | ~400 LOC (shared with NEA-6) | `mission-neato-overlap` |
| SFDP-4: `QUAD_TREE_NONE` / `QUAD_TREE_FAST` | sfdp | ATTR (`quadtree=none`/`fast`) | LOW — falls back to NORMAL scheme; only perf difference at scale | ~150 LOC | `mission-sfdp-quadtree` |
| SFDP-5: `smoothing != none` | sfdp | ATTR (`smoothing=spring`/etc) | LOW — throws; smoothing post-process skipped | ~300 LOC | `mission-sfdp-smoothing` |
| TWO-1: `adjustNodes` VPSC overlap removal (twopi) | twopi | ATTR (`overlap=...` non-default) | MEDIUM — same as NEA-6, twopi stub | ~50 LOC (wires NEA-6) | `mission-neato-overlap` |
| CIR-1: `adjustNodes` stub (circo) | circo | ATTR (`overlap=...` non-default) | LOW — circo radius formula spaces nodes; overlap only with dense graphs | ~50 LOC (wires NEA-6) | `mission-neato-overlap` |
| FDP-1: `processClusterEdges` (compound edges) | fdp | ATTR (edge endpoint = cluster) | MEDIUM — cluster-endpoint edges silently absent from layout | ~200 LOC | `mission-fdp-clusters` |
| FDP-2: `PSinputscale` / inputscale attr | fdp | ATTR (`inputscale=N`) | LOW — pos attr not scaled; only affects init from user pos | ~30 LOC | inline fix |
| FDP-3: `removeOverlapAs` / prism (fdp xlayout) | fdp | DEFAULT for graphs where xlayout does not converge | MEDIUM — throws if x_layout never converges in 9 tries | ~400 LOC (shared with NEA-6) | `mission-neato-overlap` |
| FDP-4: `doRep`/`applyAttr` coincident-node fallback | fdp | EDGE CASE (rand() path) | LOW — throws only when two nodes land at exactly the same position | ~30 LOC | inline fix |

> **Orchestrator correction (2026-06-13, DOT-1):** The drafting agent
> rated DOT-1 as "DEFAULT / CRITICAL — all regular edges are straight
> lines." An oracle spot-check disproves that: `digraph { a->b->c; a->c }`
> renders edge Beziers **byte-identical to `dot` 15.0.0**, including the
> `a→c` edge bowing around `b`. The default rank-corridor spline path
> (splines-route.ts + edge-route-poly.ts) is ported and working. The
> `pathplan` deferral is real but narrower — it likely affects only hard
> obstacle-avoidance / port-constrained / dense cases. **Before promoting
> `mission-dot-splines`, re-verify exactly which inputs hit the stub vs
> the working path.** Do not treat DOT-1 as the top correctness fix until
> that reachability is pinned. The "top-2 next missions" recommendation in
> recommended-sequence.md inherits this caveat.

## Files

- [gaps/dot.md](gaps/dot.md) — dot engine gaps (DOT-1 through DOT-6)
- [gaps/neato.md](gaps/neato.md) — neato/sgd gaps (NEA-1 through NEA-6)
- [gaps/sfdp.md](gaps/sfdp.md) — sfdp gaps (SFDP-1 through SFDP-5)
- [gaps/twopi-circo.md](gaps/twopi-circo.md) — twopi + circo + fdp gaps
- [diagrams/dependency-graph.md](diagrams/dependency-graph.md)
- [recommended-sequence.md](recommended-sequence.md)
