# Recommended Sequencing

## Promotion criteria

A gap is worth promoting to a mission when:
1. **Reachable at defaults** — no special attributes required, OR
2. **High user-visible impact** when the attr is set, AND the attr is
   commonly used in real DOT files.

## Top-priority missions (promote now)

### 1. `mission-dot-splines` — DOT-1 + DOT-2 — ✅ **COMPLETE (2026-06-19)**

**✅ DONE — do NOT promote.** The REQUIRED pre-step (corpus diff vs the C
binary) was run; the diverging subset was driven to zero by follow-on missions.
The routing re-verification corpus (`.probes/route-corpus.ts`) is now **23 MATCH
+ 2 near + 0 DIVERGE = 25/25 conformant** vs `dot` 15.0.0. DOT-1 (`make_regular_edge`
+ pathplan), DOT-1b (fitter retired), DOT-2 (flat edges), and the residue gaps
(G1 opposing/labeled-parallel, G3 nested clusters, rankdir-LR, **G2** multi
compass-port mincross tiebreak via `mission-dot-multiport`) are all closed and
oracle-pinned. The 2 remaining `near` (compass/record ports) are pre-existing
sub-pixel residuals, not gaps. See `route-reverification.md` and `gaps/dot.md`.
The historical scoping below is retained for context only.

**Correction (2026-06-13):** The original "DOT-1 is DEFAULT/CRITICAL — all
edges are straight lines" rationale was disproven by an oracle check —
standard multi-rank routing already matches `dot` 15.0.0 conformant
(see gaps/dot.md DOT-1 and README correction). The 82 goldens are
generated from the C binary, not the port, and they pass. So this is
**not** confirmed as the top correctness gap.

**Why it might still matter:** the `pathplan` obstacle router is genuinely
deferred; it affects harder routing (dense corridors, port-constrained
endpoints, routing around cluster boxes). The size is large (~1,600 LOC
incl. pathplan).

**Pre-mission step (REQUIRED before promotion):** assemble a corpus of
varied dot graphs (clusters, ports, dense ranks, many parallel edges) and
diff each against `dot -Tsvg`. The subset that diverges IS the mission
scope. If that subset is small/rare, this drops well below the priority
the draft assigned it.

**Scope (only the parts the re-verification confirms are needed):**
1. Port `lib/pathplan/` (route.c, shortest.c, vis.c, triang.c): Delaunay
   triangulation + Dijkstra visibility-graph planner. ~1,200 LOC new.
2. Implement `make_regular_edge` in `src/layout/dot/splines-route.ts`
   ONLY for the diverging cases.
3. Implement `make_flat_edge` in `src/layout/dot/splines-flat.ts`.
4. Wire `clip_and_install` for both.
5. Mint goldens for the newly-correct cases (existing 82 stay
   conformant — they already match C).

**Tasks (rough outline for mission brief):**
- T1: Port `lib/pathplan/shortest.c` (visibility graph, Dijkstra on polygon obstacles)
- T2: Port `lib/pathplan/triang.c` (Delaunay triangulation of obstacles)
- T3: Port `lib/pathplan/route.c` (`routesplines` — Bezier fitting onto visibility path)
- T4: Implement `make_regular_edge` + `clip_and_install` wiring
- T5: Implement `make_flat_edge` wiring
- T6: Regenerate goldens + verify against C binary oracle

**Blocking note:** This mission unlocks correct edge routing for all
downstream missions that add labels to edges (DOT-2, NEA-5, etc.).

---

### 2. `mission-neato-overlap` — NEA-6 + TWO-1 + CIR-1 + SFDP-3 + FDP-3

**⚠️ STALE — disproven by oracle verification (2026-06-17). Do NOT
promote as written.** Evidence from a 5-engine corpus (fdp/sfdp/twopi/
circo/neato × dense graphs) diffed against the C binary (15.1):
- **VPSC is already complete** (`src/vpsc/` — VPSC/IncVPSC/Solver/
  Rectangle), not "scaffolded." NEA-6's `removeOverlap` (X+Y VPSC passes)
  is implemented and wired in `neato/index.ts`.
- **No default crash.** fdp/sfdp/twopi/circo/neato throw on ZERO default
  inputs. FDP-3's "default-risk throw" is false — the prism/`ntry` throw
  is attr-gated and unreachable at defaults (x_layout converges; comments
  in `fdp/xlayout.ts`, `sfdp/spring-driver.ts` are correct).
- **Defaults are faithful.** fdp/sfdp/twopi/circo produce 0 overlapping
  pairs; neato keeps overlaps at default AND matches C conformant.
- **The real (smaller) gap:** neato overlap-removal *modes* diverge — TS
  maps every `overlap=` value to VPSC, but C uses distinct methods
  (`false`/`prism` → prism scaling, `voronoi`, `scalexy`, `scan`). On
  `neato K6 overlap=prism` C puts b at x≈300 vs TS x≈116. **ATTR-gated,
  medium value.** Re-scope to a focused "neato overlap modes" mission
  (port `lib/neatogen/adjust.c` prism/voronoi/scan/scalexy) if/when
  non-default neato overlap layouts matter. The original 5-gap framing
  below is obsolete.

**Why second (ORIGINAL, obsolete):** NEA-6 (`adjustNodes` / VPSC) is shared
infrastructure that unblocks 4 other gaps (TWO-1, CIR-1, SFDP-3, FDP-3). The
prism path for fdp (FDP-3) is a DEFAULT-risk throw: for any fdp graph where
9 tries of `x_layout` do not converge, the port throws rather than applying
the prism fallback.

**Scope:**
1. Complete the VPSC solver integration (`src/lib/vpsc/` was scaffolded in T11).
2. Implement `adjustNodes` in `src/layout/neato/overlap.ts`.
3. Implement `removeOverlapAs` for the `prism` mode.
4. Wire for twopi (`src/layout/twopi/init.ts:146`).
5. Wire for circo (`src/layout/circo/circular.ts:147`).
6. Wire for sfdp (`src/layout/sfdp/spring-driver.ts:180`).
7. Remove the fdp xlayout throw (`src/layout/fdp/xlayout.ts:309`).

**Tasks (rough outline for mission brief):**
- T1: Audit `src/lib/vpsc/` — identify what was scaffolded vs what is missing
- T2: Complete VPSC solver (variable placement with separation constraints)
- T3: Implement prism OverlapSmoother calling VPSC
- T4: Implement `adjustNodes` + `removeOverlapAs` in neato
- T5: Wire twopi, circo, sfdp, fdp

---

## Medium-priority missions (promote after top-2)

### `mission-neato-models` — NEA-1 + NEA-2 + NEA-3 + NEA-4

**Why:** `model=circuit` (NEA-1) silently substitutes the wrong distance
metric for graphs that explicitly request circuit distance. Users setting
this attr get wrong layouts with no warning in stress mode (only a
console.warn in SGD mode). Medium priority because the attr is uncommon.

**Order within the mission:** NEA-1 → NEA-2 → NEA-3 → NEA-4 (increasing
implementation complexity but decreasing visual impact).

---

### `mission-dot-newrank` — DOT-3 + DOT-4

**Why:** `newrank=true` is used in compound graphs with complex rank
constraints. Without `fillRanks`, the layout silently produces wrong
rank alignment. Medium priority because `newrank` is non-default.

---

### `mission-sfdp-beautify` — SFDP-1

**Why:** Currently throws, preventing any output. A THROW is always
higher priority than a silent degradation. The algorithm is simple
(~50 LOC C). Should be a quick win once prioritised.

---

### `mission-fdp-clusters` — FDP-1

**Why:** Compound fdp graphs with cluster-endpoint edges silently drop
those edges. Medium priority; the feature is legitimate but niche.

---

### `mission-neato-xlabels` — NEA-5

**Why:** External edge labels are a common DOT feature. They are
suppressed in neato output. Medium priority because dot xlabels are
handled separately.

---

## Gaps safe to leave guarded indefinitely

These gaps are ATTR-triggered, have LOW visual impact, and/or are
nearly unreachable in practice. They do not need missions:

| Gap | Reason |
|-----|--------|
| DOT-6 `nslimit` | Only affects convergence speed; 20 LOC inline fix whenever convenient |
| NEA-3 `smart_init` | Better start position only; random init converges to same quality |
| NEA-4 `start=regular/self` | Affects only starting positions; extremely rare attrs |
| SFDP-4 `QUAD_TREE_FAST/NONE` | Pure performance variants; NORMAL is more accurate |
| SFDP-5 `smoothing != none` | Throws, but the attr is very rarely set; fix if a user reports |
| FDP-2 `PSinputscale` | 30 LOC inline; only matters when user sets both `inputscale` + `pos` |
| FDP-4 coincident-node fallback | Essentially unreachable with continuous drand48 init |
| CIR-1 adjustNodes (circo) | Radial formula already separates nodes; overlap is unusual |

**Note on SFDP-5 (`smoothing`):** currently THROWS, which is misleading
for a LOW-impact gap. Consider changing the throw to a `console.warn`
(silent skip) rather than a hard error, which is safer for users.

## Dependency ordering for multi-mission sequencing

The dot-engine routing track is **complete** (corpus 25/25). Remaining open work
is off-dot or quick inline fixes.

```
mission-dot-splines        ✅ DONE (2026-06-19) — corpus 25/25, incl. G2 multiport
mission-dot-newrank        ✅ DONE (2026-06-17) — newrank parity merged
mission-dot-flat-labels    ✅ DONE — DOT-9/10/11/12 flat residue merged
mission-neato-overlap      STALE as written — re-scope to "neato overlap modes"
mission-sfdp-beautify      DONE (SFDP-1 beautify_leaves)
mission-neato-models       open (no deps) — circuit/mds/smart_init, ATTR-gated
mission-fdp-clusters       open (no deps) — FDP-1 cluster-endpoint edges
mission-neato-xlabels      open (no deps) — NEA-5 edge xlabel placement
```

**Next-mission candidates (2026-06-19):** with dot routing closed, the highest-
leverage remaining work is the differential corpus harness (~800 real graphviz
inputs vs the oracle — the project's long-tail net) or the off-dot neato/sfdp
gaps above. dot itself has only DOT-6 `nslimit` (trivial inline) left.
