# Recommended Sequencing

## Promotion criteria

A gap is worth promoting to a mission when:
1. **Reachable at defaults** — no special attributes required, OR
2. **High user-visible impact** when the attr is set, AND the attr is
   commonly used in real DOT files.

## Top-priority missions (promote now)

### 1. `mission-dot-splines` — DOT-1 + DOT-2 — **RE-SCOPE FIRST**

**Correction (2026-06-13):** The original "DOT-1 is DEFAULT/CRITICAL — all
edges are straight lines" rationale was disproven by an oracle check —
standard multi-rank routing already matches `dot` 15.0.0 byte-for-byte
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
   byte-identical — they already match C).

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

**Why second:** NEA-6 (`adjustNodes` / VPSC) is shared infrastructure that
unblocks 4 other gaps (TWO-1, CIR-1, SFDP-3, FDP-3). The prism path for
fdp (FDP-3) is a DEFAULT-risk throw: for any fdp graph where 9 tries of
`x_layout` do not converge, the port throws rather than applying the
prism fallback. Addressing VPSC+prism in one mission eliminates all of
these at once.

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

```
mission-dot-splines        (no deps — start here)
mission-neato-overlap      (no deps — can run in parallel with dot-splines)
mission-dot-newrank        (no deps — can run in parallel)
mission-sfdp-beautify      (no deps — quick win, can be done any time)
mission-neato-models       (no deps — can run in parallel)
mission-fdp-clusters       (no deps — can run in parallel)
mission-neato-xlabels      (no deps — can run in parallel)
mission-dot-flat-labels    (should follow dot-splines for pathplan)
```
