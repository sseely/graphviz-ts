# Batch 4 — goldens + C-oracle verification (orchestrator inline)

Per AD-C1 append-only rules. The parity-render-styling T6 is the
procedure precedent.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T-gold | multicolor goldens + oracle verify ([T-gold-goldens.md](T-gold-goldens.md)) | orchestrator | test/golden/{inputs,refs}/*, manifest.json, suite.test.ts | G3, G4, S1, M1 | [ ] |

Mints goldens for every new multicolor behavior, verified against dot
15.0.0 at deterministic tolerance; prior 97 refs byte-unchanged.
