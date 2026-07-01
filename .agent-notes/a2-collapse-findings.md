<!-- SPDX-License-Identifier: EPL-2.0 -->
# A2 (font-metric) class re-assessment — 2026-06-30

Investigation triggered by: "we tackled several font-measuring issues, has A2
collapsed?" Done read-only while the fix/graphs-b15 T3 survey ran. All renders use
the survey recipe: `GV_TEXT_MEASURER=estimate GVBINDIR=/tmp/ghl`.

## Verdict: A2 has substantially collapsed. Only the NaN family remains.

### proc3d — COLLAPSED to conformant (doc says "structural-match" → STALE)
- Committed HEAD `parity.json`: `graphs-proc3d`, `share-proc3d`, `windows-proc3d`
  all **conformant**, maxDelta=None.
- Fresh render of `tests/graphs/proc3d.gv` vs oracle: bbox identical
  (viewBox 0 0 205 720), **0** differing edge `d="M…"` paths, **0** differing
  `<text>` anchors. Fully conformant.
- The doc's canonical A2 visual (the ~2620pt proc3d with file-path ovals like
  `/home/ek/work/src/lefty/lefty.c`) is `graphs/directed/proc3d.gv` — **NOT in the
  parity corpus** (corpus uses `tests/{graphs,share,windows}/proc3d.gv`, the small
  one). So the doc's headline A2 example isn't even surveyed.

### The doc's A2 measurement framing is outdated
- Doc table: native-C 176.00 vs graphviz-ts 176.75 for
  `"/home/ek/work/src/lefty/lefty.c"` @ Times-Roman 14pt — that's
  **port-estimate vs FreeType-C**.
- But the survey runs BOTH sides on `estimate_textspan_size` (headless `/tmp/ghl`,
  no FreeType/pango). Current `EstimateTextMeasurer` probe:
  - `"/home/ek/work/src/lefty/lefty.c"` → **173.78** (doc claimed 176.75)
  - `"93736-32246"` → **74.66** (doc claimed 96.00 "identical both sides")
  Both sides agreeing on estimate is *why* proc3d is conformant. The FreeType
  reference numbers no longer describe how parity is measured.

### NaN family — STILL structural-match (the only remaining A2)
- `graphs-NaN`/`share-NaN`/`windows-NaN`: HEAD `parity.json` = structural-match,
  maxDelta=18. Accepted entries (class A2) in `accepted-divergences.json`.
- Input attrs: `orientation=landscape; ratio=compress; size="16,10"`.
- Fresh render vs oracle: bbox identical (viewBox 0 0 388 1152); **122 polygons,
  76 `<text>`, 76 `<ellipse>` all match; 0 differing text anchors** — node geometry
  is now EXACT. The divergence is **16 edge spline `d="M…"` paths** differing
  ~10–18pt in x (e.g. `M1840.61` oracle vs `M1829.15` port).

## Open question for Follow-up B (re-diagnose graphs-NaN)
The doc's stated NaN mechanism is "9 node half-widths mismeasured 0.5–1.03pt wider
→ tips x-network-simplex → node-x shift." But node geometry now matches EXACTLY,
so that mechanism appears (partly) resolved, yet 16 edge splines still diverge.
The residual may now be:
- a spline-routing delta (compress corridor / pinch threshold), closer to A3, or
- still a font-metric tip that moves edge endpoints/ports but not node centers, or
- genuinely closable.
Instrument before hypothesizing (diagnosis mode). Decide: keep accepted (and
re-characterize) or open a fix mission.

## Follow-up A (doc fix) concrete edits
- `docs/known-divergences.md` §A2: proc3d is conformant — remove the
  "stays at structural-match" claim and the proc3d overlays, OR relabel them as a
  non-corpus illustration that no longer diverges. Re-anchor A2 on the
  estimate-vs-estimate survey reality and the NaN-compress remainder. Keep the
  injectable-TextMeasurer seam explanation (still accurate and valuable).
- Do NOT touch `accepted-divergences.json` NaN entries unless Follow-up B
  reclassifies them.

---

# A1 (force-directed FP determinism) re-assessment — 2026-06-30

Triggered by "can we eliminate A1 with the conformant posture?" Answer: NO — the
posture is dot-only and never exercises A1's engines.

## Evidence
- A1 accepted entry (`accepted-divergences.json`) is engine-scoped
  (`engineIn: [neato, fdp, sfdp, circo, twopi, osage]`), reason: "Matches zero
  graphs in the all-dot corpus today; kept for completeness."
- **The parity survey is 100% dot-engine:**
  - Oracle: `survey.ts:211` spawns `DOT_BIN -Tsvg <input>` under `GVBINDIR=/tmp/ghl`.
  - `/tmp/ghl` symlinks ONLY `core` + `dot_layout` plugins
    (`gen-headless-gvbindir.sh:26` loops `for plugin in core dot_layout`). No
    neato/fdp/circo/twopi/osage/sfdp layout plugin is present — the oracle
    physically cannot run a force-directed layout.
  - Port: `survey.ts:231` calls `render-one.ts <input> dot` — engine hardcoded.
  - So `*_neato`/`*_circo`/`*_twopi` corpus ids are FILENAMES laid out with DOT,
    not their native engine. "Zero graphs" = never surveyed, NOT conformant.
- The port DOES implement all six engines (`src/layout/{neato,circo,twopi,fdp,
  sfdp,osage}`), registered + unit-tested (`default-context.test.ts`). Prior
  memory `sfdp-oracle-and-fp-stability`: sfdp pins to ~6 digits with matched
  PRNG + fma (6 digits ≠ bit-identical; measured on one machine).

## Conclusion
A1 cannot be eliminated by the dot-conformant posture (it's silent on those
engines). A1 is ALSO a genuine cross-platform FP hedge (FMA/Math.pow/
transcendentals not bit-portable across CPU/JS-engine) — same family as A3 Apple
hypot — which a single-machine survey cannot discharge regardless.

## Follow-up A (doc) — A1 edits
Reword §A1 from an implied active divergence to an explicit SCOPE + PORTABILITY
caveat: "force-directed engines are implemented but NOT under the parity survey
(oracle GVBINDIR = core+dot_layout only; survey forces dot). Their FP determinism
is not guaranteed cross-platform." Tie to the same doc-vs-data hygiene gap as the
proc3d/A2 prose rot.

## Follow-up C (new mission) — force-directed parity track
To actually ASSESS A1: build a GVBINDIR variant with neato/fdp/circo/twopi/osage/
sfdp plugins; survey each native-engine input under `-K<engine>` vs the port's
engine; characterize per-engine deltas. Best honest outcome = NARROW A1 to "no
active divergence on the reference platform," not eliminate (cross-platform FP
caveat stays). Separate effort, not a doc tweak.

---

# NaN mechanism — CORRECTED finding (2026-06-30, docs/reconcile-divergences)

Earlier note said "node geometry matches, 16 edge splines diverge." Refined with
proper title-paired + node-position analysis:
- NaN divergent edges = **8** (not 16; earlier count inflated by misaligned diff):
  AtomProperties↔NRAtom, Interp↔InterpF, Target↔TThread, Event↔Target.
- These 8 have **matching piece counts** (4v4, 10v10 — NO doubling/structural defect)
  but **endpoints shifted 6–14pt** (interior maxΔ 9–18pt).
- **All 76 node reference points MATCH** oracle (0 shifted >0.5pt).

CONTRADICTS the doc's A2 NaN mechanism ("9 node half-widths mismeasured → node-x
shift"): nodes now match C exactly (font-metric fixes closed that). Yet 8 edges'
ENDPOINTS shift 6–14pt with node CENTERS unchanged. Candidate mechanisms for
Task 5 (re-diagnose): (a) edge attaches to node boundary at a different clip point
because the spline approaches from a different direction (routing, not position);
(b) residual port/record-cell metric on those specific nodes; (c) a compress
x-network-simplex tie that moves attachment but not center. NOT yet pinned — do
NOT assert a mechanism in the doc; describe NaN as "accepted A2 (structural-match,
maxΔ~18); mechanism under re-diagnosis — node centers match C, residual is in 8
straight-edge endpoints."
