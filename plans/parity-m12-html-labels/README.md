# Mission 12 — HTML label parity (all label slots, full C surface)

**Objective:** Bring HTML-like labels to full C-graphviz-15.0.0 parity.
Creation dispatch for all 7 label slots via a restored C `make_label`
boundary, font-flag propagation through measurement → layout →
emission (fixes the bold-drop AND the 0.4pt offset on the already-live
node path), lexer/parser/type completeness (GRADIENTANGLE, SIDES,
PORT storage, IMG fields), cell decoration emission (solid BGCOLOR,
rules/sides, HR/VR, anchors), `<IMG>` with an injected ImageSizer,
live-path unskip, C-oracle verification, ~10 new goldens
(manifest 72 → 82). Two declared exceptions, parse+store only:
html_port attachment (→ plans/parity-edge-ports/SCOPE.md) and
gradient paint (→ future gradient-fills work).
Recon evidence: plans/parity-html-labels/SCOPE.md.

## Branch

`feature/parity-m12-html-labels` off `feature/post-parity`. Merge back
with a **merge commit** when all gates pass, on Scott's go-ahead.

## Canonical rules

- C source at `~/git/graphviz/lib/` (tag 15.0.0) is the spec; refs only
  from the installed 15.0.0 dot binary.
- NEVER modify existing refs, manifest entries, or TOLERANCES;
  additions APPEND (carried AD-C1, [decisions.md](decisions.md)).
- One commit per task; re-read this README + decision-journal.md after
  every compaction.
- Agent prompts MUST include: "if a pre-commit/length/CCN hook
  complains, smallest fix, at most 2 attempts per file, then move on."

## Quality Gates (after every task)

```
- command: npx tsc --noEmit
  pass: exit 0
  on_fail: fix_and_rerun
- command: npx vitest run
  pass: exit 0 AND failed == 0 AND passed >= 1254
  on_fail: fix_and_rerun
- command: OUTDIR=/tmp/m12-x npx tsx .probes/render-all.ts + byte-diff vs pre-task baseline
  pass: existing goldens byte-identical (72 until T10 lands, 82 after)
  on_fail: stop
- command: git diff --name-only HEAD~1..HEAD
  pass: within the task's declared write-set
  on_fail: stop
```

Baseline at mission start: **1254 passed / 0 failed**, 72 goldens
(2026-06-12, post-M11 merge).

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 (parallel) | [T1 unified make_label](batch-1/T1-make-label.md), [T2 variant measurement](batch-1/T2-measure-variants.md), [T3 lex/parse/types](batch-1/T3-lex-parse-types.md) | [x] |
| 2 (parallel, after 1) | [T4 creation dispatch](batch-2/T4-creation-dispatch.md), [T5 font-flag chain](batch-2/T5-font-flags.md) | [x] |
| 3 (after 2; T6→T7 sequenced, T8 parallel) | [T6 cell decoration](batch-3/T6-cell-decoration.md), [T7 IMG + ImageSizer](batch-3/T7-img.md), [T8 emission unskip](batch-3/T8-unskip.md) | [x] |
| 4 (after 3) | [T9 C-oracle verify + gap-fill](batch-4/T9-verify.md), then [T10 goldens 72→82](batch-4/T10-goldens.md) (orchestrator inline) | [x] |

## Stop conditions

- Change outside the active task's write-set (EXCEPT T9's declared
  conditional set and the push-forwards below)
- 2 consecutive gate failures on the same check; same location/approach
  changed 3+ times for the same failure
- Implementation contradicts AD1–AD6 or carried rules
  ([decisions.md](decisions.md))
- A divergence from the C oracle traces to code outside this mission's
  blast-radius table (M10/M11 precedent — no silent fixes)
- T9: residual divergence after the font-flag fix traces to the metric
  model itself (FreeType vs LUT) — tolerance call is Scott's (AD5)
- Numeric divergence with an FMA signature, without disassembly
  evidence (M7 rule, src/common/fma.ts)
- A required C behavior depends on an unported subsystem beyond the
  two declared exceptions (html_port attachment; gradient paint)

## Push-forward conditions (journal entry each)

- Hook-forced module splits; C function boundaries + @see preserved
- Probe design under .probes/ (untracked)
- Test-fixture repairs in files the task owns
- T9 porting gaps that trace to files inside the blast-radius table
  (its conditional write-set, M11 T5 precedent)
- T3 porting additional small lexer/parser gaps vs htmllex.c/
  htmlparse.y within its own three files
- Trivially obvious fallback-chain fixes within a task's own files

## Key references

- [decisions.md](decisions.md) — AD1–AD6 + carried rules
- [decision-journal.md](decision-journal.md) — append-only
- [diagrams/component-map.md](diagrams/component-map.md),
  [diagrams/data-flow.md](diagrams/data-flow.md)
- plans/parity-html-labels/SCOPE.md — recon: gap table, C spec map,
  live-path trace, render comparison
- plans/parity-edge-ports/SCOPE.md — where html_port attachment lands
- plans/parity-m11-labels/ — gate technique, T5/T6 precedents
  (.probes/render-all.ts and .probes/m11-combined-check.ts reusable)

## Mission summary (2026-06-12, autonomous run)

**Tasks: 10/10 complete.** Final gates: tsc clean; vitest 1413/1413
(baseline 1254, +159 tests); manifest 72 → 82, prior 72 refs
byte-unchanged vs mission-start baseline; all 10 new goldens pass at
deterministic tolerance.

Commits (one per task + plan closes):
T1 16c6f0e, T2 f06732b, T3 2939df7, T4 ff3ae09, T5 ad1c2ff,
T8 fd81fdf, T6 47efffe, T7 6d50cb9, T9 ×2 (oracle gap-fills +
simple/non-simple vertical model), T10 (goldens).

Headline result: the 0.4pt node-html divergence is FULLY resolved —
the x component was the font-flag bug (AD5 hypothesis, T5); the y
component (0.45pt) was C's unported size_html_txt simple/non-simple
branch, not the metric model (T9). All seven label slots render html
end-to-end and match C at deterministic tolerance, bold included.

Decisions flagged for Scott's review (decision-journal.md):
- T5 write-set expansion: HTML_* constants in emit-types.ts.
- T1/T4 contract change: FontInfo bundle (MAX_PARAMS hook).
- T7: ImageSizer as global registry (C ImageDict architecture) instead
  of "via render options"; RendererPlugin.usershape hook.
- T6 mis-scope resolution: decoration metadata plumbed through
  htmltable-pos.ts.

Known issues / follow-ups (all pre-existing, outside mission scope):
1. shape=plaintext nodes draw a node-outline polygon C suppresses —
   poly-gencode.ts never ported the peripheries loop (likely
   one-line fix; needs its own write-set approval).
2. Non-14pt font sizes diverge in line height for plain AND html text
   (fs=20: 53 vs 51pt svg height) — the true metric-model item; no
   golden covers non-14pt sizes.
3. Anchor `<g id>` machinery for whole-node URL attrs (node-level
   tooltip/href) remains unported (html cell/table anchors ARE done).
4. htmltable-lex parseAttrs phantom-attr quirk (words inside quoted
   values re-match as empty attrs) — harmless, deviates from doAttrs.
5. env->imgscale (node imagescale attr) fallback for IMG SCALE not
   honored; ImageSizer units are points (callers pre-convert px).

Two declared exceptions unchanged: html_port attachment (parse+store
only → parity-edge-ports), gradient paint (solid first-color
fallback per C setFill; <linearGradient> deferred).
