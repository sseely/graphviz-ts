# Batch 3 — B3 FP-ties → A9 accept

Depends on Batch 0. **Provisional** — skip if T0.3 marks B3 empty. Read T0.3
`findings.md` first.

Candidates: 241_0, 2095 — the SAME CDT-incircle / findMaxDev-hypot 1-ULP ties
already accepted as class A9 for sfdp (`accepted-divergences-engines.json`
sfdp.{241_0,2095}, `docs/known-divergences.md#a9-sfdp-fp-ties`). The port already
applies every lever (arm64 `fmadd` in `src/pathplan/triang.ts`, `Math.hypot` in
`src/pathplan/route.ts:198-199`); the residual is a V8-vs-Apple-libm ULP.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|-----------|------|
| T3.1 | Confirm the fdp residual matches the known A9 mechanism | debugger | batch-3/findings.md | Batch 0 | [x] |
| T3.2 | Fix-aggressive attempt else accept A9 w/ controlled-experiment evidence | general-purpose | (src fix if any) + batch-3/findings.md | T3.1 | [x] |

Fix-aggressive (ADR-3): confirm the levers are already applied (read triang.ts /
route.ts), then the accept needs the controlled experiment (reuse the sfdp
native-vs-V8 hypot ULP probe
`plans/sfdp-tracked-divergences/batch-2/hypot-ulp-probe.txt`, or an `otool -tvV`
fmadd disasm). Propose per-id A9 registry entries in findings.md; the finalize
batch writes them. If the fdp residual is LARGER than a tie (structural, many
points), it is NOT A9 — escalate with a stated mechanism.
