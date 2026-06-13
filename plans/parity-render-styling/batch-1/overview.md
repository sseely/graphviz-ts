# Batch 1 — foundations (parallel)

Two foundation tasks, disjoint write-sets. Neither changes rendered
output for existing inputs: the 82-golden byte-stability probe must
pass byte-identical for both.

| ID | Description | Agent | Writes | Depends On | Done |
|----|-------------|-------|--------|------------|------|
| T1 | Style/color resolution helpers ([T1-style-resolution.md](T1-style-resolution.md)) | sonnet | src/common/style-resolve.ts (+test) | — | [x] |
| T2 | obj-state lifecycle in the device walk ([T2-objstate-lifecycle.md](T2-objstate-lifecycle.md)) | sonnet | src/gvc/device.ts, src/gvc/job.ts (ObjState factory only) (+tests) | — | [x] |

T1 produces pure resolution functions; T2 wires the push/pop lifecycle
and a default-ObjState factory. They are independent: T2 pushes a
DEFAULT ObjState (reproducing today's output); T3–T5 in batch 2 call
T1's resolvers to populate that state per object. Verify no write-set
overlap (T1 owns style-resolve.ts; T2 owns device.ts + the ObjState
factory in job.ts — extract the existing test `makeObjState` shape into
a production factory, do not change the ObjState interface).
