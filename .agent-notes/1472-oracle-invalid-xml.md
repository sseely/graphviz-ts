# 1472 diagnosis — malformed-oracle invalid XML, not a port defect

## Observation: 1472 verdict is `diverged / <compare-threw>`
- **Context**: `/plan-mission root cause and fix 1472`. parity.json (2026-07-01)
  lists 1472 as `diverged`, `firstDiffPath: "<compare-threw>"`,
  errMsg `Opening and ending tag mismatch: "svg" != "g"`.
- **Finding**: The port renders `tests/1472.dot` cleanly (exit 0, 90591-byte
  SVG, **well-formed XML**, node/edge/label element counts match native exactly:
  135 ellipse / 154 path / 161 polygon / 141 text / 296 title). The **native**
  oracle output is **invalid XML** — `tests/1472.dot` is a Google-Autofuzz
  adversarial input with invalid UTF-8 bytes, an unknown color (`blqck`), and
  control chars; native dot passes the invalid UTF-8 straight into its SVG
  output, breaking well-formedness. `normalizeSvg(native)` THROWS; the port SVG
  parses fine.
- **Root cause of verdict**: `compareSvg` throws while normalizing the **oracle**;
  `diffVerdict` (survey.ts:301) blankets any throw as `diverged /
  <compare-threw>`, wrongly implying the *port* diverged. The harness's
  `oracle-error` bucket is only reached when `oracle.svg === undefined`
  (empty/timeout; survey.ts:216,324) — it does not catch a non-empty but
  invalid-XML oracle.
- **Impact**: This is an oracle-quality issue identical to the already-quarantined
  malformed fuzz inputs (1474/1489/1494/1676) and manually-quarantined 2782.dot.
  Upstream #1472's real bug (adjacency-matrix buffer overflow, sparse-matrix fix
  a259a6a8d) is **already ported** — `matrixGet` returns false OOB, `matrixSet`
  expands (mincross-utils.ts:50-90). The port does not crash. There is **no port
  defect** to fix in the layout/emit path.
- **Confidence**: High (empirically isolated: PORT parses OK, NATIVE throws;
  only 1 `<compare-threw>` case in the whole corpus).

## Fix options
- **A (root, general)**: when the ORACLE SVG is not well-formed XML, classify as
  `oracle-error` (like empty/timeout). Reclassifies 1472 → `oracle-error`; catches
  any future malformed-oracle input; never masks a real port bug (only fires when
  the oracle is the unparseable side). Origin: survey.ts oracle-handling site.
- **B (precedent)**: force-quarantine 1472 as `malformed` in enumerate.ts (mirrors
  2782.dot/1474.dot). Needs a comparison-page artifact per CLAUDE.md override.
