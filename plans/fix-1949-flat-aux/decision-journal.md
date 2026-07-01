# Decision journal — fix-1949-flat-aux

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-07-01 | Verified current 1949 = 651×282 (native) vs 651×315 (port). The `.agent-notes` "2.97 residual" note is STALE (pre-480b34a). README numbers are accurate. | Diagnostic-first: measured reality before trusting either doc. |
| 2026-07-01 | C build: `cmake -S . -B build` reconfigure (regenerated missing dotgen build.make) + `make gvplugin_dot_layout` (dot layout is a PLUGIN, not linked into the dot binary). NOT full `rm -rf`. | AD-1 clean-rebuild intent, minimal cost. dotsplines.c lives in libdotgen→plugin. |
| 2026-07-01 | **STOP — did not enter Batch 2/T3.** Root cause is grouping in `edge-route.ts:collectAdjacentFlatGroup` + lead-edge makefwdedge + upstream port resolution — all OUTSIDE `splines-flat.ts`. rank=source (prime suspect) is INERT (auxt already rank 0). | Two explicit README STOP conditions fired (AD-3 scope + rank=source inert). Mission needs re-scoping. |

## T1 C aux-graph dump

C oracle (native, DBG1949=1, GVBINDIR=/tmp/ghl) dump. **Key structural fact:
C calls `make_flat_adj_edges` TWICE, each `cnt=1`** — one call per edge, NOT a
single grouped cnt=2 call. Both calls: `auxt=structDefaultAuto` (rank 0
source), `auxh=structParty` (rank 1).

```
# Call 1 — the :N head-port edge (structDefaultAuto -> structParty:N)
DBG1949 tn=structDefaultAuto hn=structParty flip=1 cnt=1
DBG1949 POSTPOS auxt=structDefaultAuto rank=0 order=0 coord=(0.0000,113.1141)
DBG1949 POSTPOS auxh=structParty rank=1 order=0 coord=(0.0000,32.4000)
DBG1949 POSTREPOS auxt coord=(33.3141,98.0000) auxh coord=(33.3141,-10.0000)
DBG1949 SPL edge structDefaultAuto->structParty tp{def=0 side=0} hp{def=1 side=4 p=(0.00,24.40)}
DBG1949 SPL   size=4 sflag=0 sp=(0.00,0.00) eflag=1 ep=(33.31,17.40)
DBG1949 SPL   cp[0]=(33.3141,64.4682) cp[1]=(33.3141,53.5407)
DBG1949 SPL   cp[2]=(33.3141,41.0335) cp[3]=(33.3141,28.8803)
DBG1949 del=(0.0000,510.1540) flip=1

# Call 2 — the :S tail-port edge (structParty:S -> structDefaultAuto)
DBG1949 tn=structDefaultAuto hn=structParty flip=1 cnt=1
DBG1949 POSTPOS auxt=structDefaultAuto rank=0 order=0 coord=(0.0000,113.1141)
DBG1949 POSTPOS auxh=structParty rank=1 order=0 coord=(0.0000,32.4000)
DBG1949 POSTREPOS auxt coord=(33.3141,143.3715) auxh coord=(33.3141,35.3715)
DBG1949 SPL edge structParty->structDefaultAuto tp{def=1 side=1 p=(0.00,-24.40)} hp{def=0 side=0}
DBG1949 SPL   size=10 sflag=1 sp=(47.32,112.96) eflag=0 ep=(0.00,0.00)
DBG1949 SPL   cp[0..9] loop out to x=79.80 (cp[5]) then back to x=33.31
DBG1949 del=(-45.3715,510.1540) flip=1
```

Note cnt=1 per call → each aux is a clean 2-node graph (auxt source + auxh)
with ONE real edge + a synthetic hvye (weight 10000). rank=source pins auxt.

## T2 port aux-graph dump + diff

Port (`makeFlatAdjEdges` DBG1949) default run — **ONE call, cnt=2** (both edges
grouped):
```
DBG1949 otn=structParty ohn=structDefaultAuto flip=true cnt=2
DBG1949 POSTPOS auxt=structDefaultAuto rank=0 coord=(0,155.1881)   # C: (0,113.1141)
DBG1949 POSTPOS auxh=structParty       rank=1 coord=(0,61.0940)    # C: (0,32.4000)
DBG1949 SPL :S structParty->structDefaultAuto tp{def=1 side=1 p=(0,-35.20)}  # C p=(0,-24.40)
DBG1949 SPL   size=10 sflag=0 sp=(0,0) eflag=1 ep=(15.43,87.91)    # C sflag=1 sp=(47.32,112.96) eflag=0  -> REVERSED
DBG1949 SPL :N structDefaultAuto->structParty hp{def=1 side=4 p=(0,35.20)}   # C p=(0,24.40)
DBG1949 SPL   size=4 ... (matches C size)
```

**First divergence (document order): `cnt` = 2 (port) vs 1 (C).** Everything
downstream (auxt.y, port p.y, spline sflag/direction) follows. cnt=1 experiment
(temp `return [e]` in collectAdjacentFlatGroup): height stayed 315 AND port
still picked wrong auxt for :N — so grouping is necessary-but-not-sufficient;
lead-edge makefwdedge + the ±24.40 port-cell resolution also diverge.

`fixLocus` = **STOP — needs edge-route.ts (+ likely sameport/htmltable)**, NOT
splines-flat.ts. See `.agent-notes/1949-diagnosis.md` for the full artifact.
