# Cluster `lp` / record `rects` under patchwork (and circo / twopi / sfdp)

## Observation: the missing attributes are STALE INPUT values, not missing layout data

- **Context**: The xdot comparator widened from 4 to 11 attributes and revealed
  173 patchwork corpus ids (757 → 583) whose only diffs were attributes the port
  never emitted: `cluster:cluster0/lp[missing]`, `node:a/rects[missing]`,
  `edge:c->b#0/lp[missing]`. The obvious hypothesis — the fourth instance of the
  campaign's "engine silently skips a call-site C runs centrally" class
  (`common_init_edge` / `gv_postprocess` / `graph_init`) — is **WRONG here**.
- **Finding**: Under `-Kpatchwork`, C computes NO cluster `lp`, NO edge `lp` and
  NO record `rects` at all. `attach_attrs_and_arrows` (`lib/common/output.c`)
  agsets each computed attribute behind a GATE:
  - `rects` only when `strcmp(ND_shape(n)->name, "record") == 0` (output.c:314) —
    and `patchwork_init_node` (`patchworkinit.c:74`) `agset`s EVERY node to
    `shape=box`, so no node is ever a record;
  - edge `lp`/`xlp`/`head_lp`/`tail_lp` only inside the loop that `continue`s on
    `ED_spl(e) == NULL` (output.c:351) — patchwork routes no edges;
  - graph/cluster `lp`/`lwidth`/`lheight` only when `GD_label(g)` exists
    (`rec_attach_bb`, output.c:239) — patchwork/circo/twopi/sfdp build no cluster
    label object;
  - `bb` only for the root and the `GD_clust` tree (output.c:249) — circo, twopi
    and sfdp lay out no clusters, so their `GD_clust` is empty.

  When a gate FAILS, C does not write — so the attribute slot still holds
  whatever the INPUT file parsed into it, and `agwrite` (which serializes the
  whole attribute table, not just the computed fields) prints that value
  verbatim. Most of the corpus is **re-fed dot output**, so those slots are full:
  `share/labelclust-ndd.gv` ships `lp="43,168"` on cluster0, `share/record2.gv`
  ships `rects="23,108,58,144 ..."`, `share/longflat.gv` ships `lp="160,54"`.
  Native under patchwork echoes them back — in the *previous* run's coordinate
  space, next to a freshly computed `bb` (cluster0: computed
  `bb="7.2825,24.8,38.905,88.046"` beside stale `lp="43,168"`). The port's writer
  emitted computed-or-nothing, so it dropped them.
- **Impact**:
  - **Diagnostic rule**: before assuming a missing attribute means missing layout
    data, check whether the INPUT already carries that attribute. Strip it and
    re-run the oracle: if native's value disappears, it was an echo, not a
    computation. On a corpus of re-fed dot output this is a whole defect class,
    and it looks exactly like the "engine skipped a call-site" class.
  - The port's xdot writer is not `agwrite`: it emits a curated set built from
    layout state. Every attribute `attach_attrs_and_arrows` owns now follows
    C's rule — computed if the gate passes, else echo the object's own input
    value (`echoAttr`, `src/render/dot.ts`). An input-`pos` echo for unrouted
    edges already existed; it was the same mechanism, seen only for one attr.
  - The port still drops non-layout input attributes (`label`, `shape`, ...)
    that native round-trips. Not compared today; a full agwrite round-trip is a
    separate, larger change.
- **Confidence**: High. Controlled experiment isolates the variable: with `lp=` /
  `rects=` stripped from the input, native under `-Kpatchwork` emits only the
  computed root `lp` and zero `rects`. On a clean hand-written graph
  (root label + 2 labelled clusters + labelled edge) native and the port already
  agreed exactly — no cluster `lp`, no edge `lp` — proving the layout was never
  missing anything.

## Observation: circo / twopi / sfdp share the defect; the comparator cannot see it

- **Context**: The sweep showed 0 regressions for circo/twopi/osage, which was
  read as "they are fine".
- **Finding**: They were not fine — the comparator is blind there.
  `collectGraphs` (`test/golden/compare-xdot.ts:189`) only collects a subgraph as
  a comparable `cluster:<name>` object if it carries ≥1 **draw** attribute.
  circo, twopi and sfdp draw no cluster box, so native's cluster block
  (`bb` + `label` + `lp`, all stale echoes) has no `_draw_` and the cluster is
  collected on NEITHER side — the missing `lp`/`bb` were invisible. Patchwork
  DOES draw cluster boxes, which is the only reason its `cluster0/lp[missing]`
  surfaced. Direct oracle comparison on `labelclust-ndd.gv` confirms circo,
  twopi and sfdp all echo the stale `bb="8,32,78,180" lp="43,168"`, and the port
  emitted no cluster attr block at all. **osage does NOT share the defect** — it
  lays out clusters and computes real cluster `lp` (`58,77.2`), which the port
  already matched. neato/fdp likewise compute (fdp matches; neato has a separate,
  pre-existing cluster-bb divergence unrelated to this).
- **Impact**: "0 regressions under engine X" is not evidence that X is correct —
  confirm the comparator can *see* the attribute on X before drawing that
  conclusion. Here the fix lands for circo/twopi/sfdp without moving any
  comparator count.
- **Confidence**: High. Verified per-engine against the native oracle
  (port block vs native block, byte-level), not inferred from sweep counts.
