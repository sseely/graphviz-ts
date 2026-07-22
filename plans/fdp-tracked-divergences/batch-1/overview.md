# Batch 1 — B1 frame/postprocess candidates

Depends on Batch 0. **Provisional** — skip if T0.3 marks B1 empty; read T0.3
`findings.md` first for the real id list.

Candidates: edge-label ids (graphs-cairo, 2193) and any id whose injected
residual is a constant frame offset (dx=0, const dy). fdp's postprocess differs
from sfdp's: `fdpLayoutEngine` calls `gvPostprocess(g, false)` (translation
suppressed) after `finalCC` normalizes to origin — so the sfdp fix does NOT
transfer directly. The question is whether `finalCC` / the fdp origin-normalize
runs the drawing into a DIFFERENT frame than C before `addXLabels`
([[neato-addxlabels-pretranslate-frame]] class), tipping the `objplp2rect`
round() and flipping edge-label sides.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T1.1 | Analyze: inject positions, isolate frame vs genuine; state mechanism | debugger | batch-1/findings.md | Batch 0 | [ ] |
| T1.2 | Fix (aggressively) at the frame origin, or accept w/ evidence | general-purpose | (src fix, isolated) + batch-1/findings.md | T1.1 | [ ] |

Method (per diagnosis.md): inject exact native positions; if the residual is a
pure constant translation (dx=0, const dy) or an edge-label `lp` side flip, it is
the addXLabels-frame class — trace `finalCC` / the pre-`addXLabels` shift in
`src/layout/fdp/{index,layout}.ts` vs C `fdp_layout`→`finalCC`→`gv_postprocess(g,0)`.
Fix at the origin (match C's frame). If injection CLEARS it, it's drift → move to
B2. If it's a genuine non-frame residual, state the mechanism and decide fix vs
accept. Re-verify: fresh fdp sweep, 0 regressions; if the fix touches a shared
primitive (postproc/pack), re-sweep every engine using it.
