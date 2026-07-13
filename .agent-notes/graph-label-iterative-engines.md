# Root graph label under the neato-family engines (neato / fdp / sfdp)

## Observation: the port has no shared `graph_init`, so root-graph init is per-engine and drifts

- **Context**: 218 corpus ids (fdp 169, neato 25, sfdp 24) in the
  `graph/_draw_/numeric + graph/_ldraw_/structural + graph/bb/numeric` family.
  Minimal repro `digraph { label="G"; a -> b }`: native emits a graph `_ldraw_`
  and a `bb` tall enough to hold it under -Kneato/-Kfdp/-Ksfdp; the port emitted
  no graph `_ldraw_` and a `bb` short by exactly the label height (24.8).
- **Finding**: The root graph label object is created by C's **engine-agnostic**
  `graph_init` (`lib/common/input.c:719` → `do_graph_label(g)`), which
  `gvLayoutJobs` calls for **every** engine at `lib/gvc/gvlayout.c:81`, before
  dispatching to `gvle->layout(g)`. The port has **no `graph_init` analogue at
  all** — that call was replicated into each engine's own init
  (`dot/init.ts:202`, circo, twopi, osage, patchwork). neato/fdp/sfdp never got
  it: they called `doGraphLabel` only for *cluster* subgraphs, never the root.
  So `g.info.label` stayed `undefined` and `gv_postprocess`'s
  `GD_label(g) && !GD_label(g)->set` gate (postproc.ts:314 / :391, mirroring
  postproc.c:619 / :675) short-circuited on `!label`, skipping BOTH the bb
  expansion and `place_root_label`. Everything downstream was already correct
  and already wired — only the object was missing.
- **Impact**:
  - **The port has no shared `graph_init`.** Every field `graph_init` sets
    (input.c:600-730: ratio/size, dpi, concentrate, clusterrank, rankdir,
    nodesep/ranksep, fontnames, *and* the root graph label) is re-derived
    per-engine. Any engine added later, and any *existing* engine, can silently
    miss any one of them. When a "feature X is missing under engine Y" defect
    appears, check whether X originates in `graph_init` and whether engine Y's
    init reproduces it — do NOT assume a shared init ran.
  - This is the **third** instance of the same class in this campaign
    (`common_init_edge` → no `ED_label`; `gv_postprocess` → no `addXLabels`;
    now `graph_init` → no `GD_label`). The pattern is always: C puts the call in
    engine-agnostic plumbing, the port put it inside dot.
  - Creating the root label also sets `has_labels |= GRAPH_LABEL`, which gates
    `n_clbls = countClusterLabels(gp)` in `addXLabels`. This is **safe**: C's
    `countClusterLabels` (postproc.c:389-396) skips the root (`g != agroot(g)`)
    and counts only `set` labels, and the port's copy
    (xlabels-place.ts:167) matches — so the root label is never an xlabel
    obstacle and edge/xlabel placement is unchanged.
  - fdp's negative `LL.y` (e.g. `bb="0,-24.8,119.46,45.78"`) is **not a bug**:
    `fdp_layout` passes `allowTranslation=0` (layout.c:1076), so the label
    extends below the origin instead of translating the drawing up. neato/sfdp
    pass 1 and translate. Both behaviors fall out of the already-correct
    `gvPostprocess` once the label object exists.
- **Confidence**: High. Established by instrumenting BOTH sides. C probes in
  `do_graph_label` and `gv_postprocess` show, for all four engines,
  `isroot=1 str=G` and `label!=NULL set=0 pos_flag=0 dimen=(10.110,16.800)`;
  the port probe at `gvPostprocess` entry showed `label=undefined has_labels=0`
  under -Kneato while the **bb entering the pass already matched C exactly**
  ((0,0)-(125.210,46.639) both sides) — proving the divergence originates at
  label creation, not in layout, bb computation, expansion or placement.
  Candidate "something pre-sets `label.set = true`" was ruled out by the same
  probe: there is no label object at all to have `set` on it.
</content>
</invoke>
