<!-- SPDX-License-Identifier: EPL-2.0 -->
# Batch 3 — re-survey + regenerate baseline & PARITY.md

Populate `maxDeltaPath` across the corpus and lock in the new baseline. This is
the gate-critical batch.

| ID | Description | Agent | Writes | Depends On | Done |
|---|---|---|---|---|---|
| T3 | Re-survey → gate=0 → `cp` → regen dashboard | (orchestrator, direct) | `test/corpus/parity-rules.json`, `test/corpus/parity.json`, `test/corpus/PARITY.md` | T1, T2 | [ ] |

Run directly (not delegated) — it's a mechanical pipeline with a hard STOP on any
gate regression. See `decisions.md#stop-conditions`.
