# Decision Journal — nonadjacent-flat-multi

Appended during execution (per `~/.claude/rules/autonomous-execution.md`).
One writer per row.

| Task | Date | Decision | Rationale | Flagged |
|------|------|----------|-----------|---------|
| scope | 2026-06-20 | Mission scoped from a COMPLETE oracle-validated diagnosis (findings-diagnosis.md), the latent follow-up banked at the close of `nonadjacent-flat-5ne8nw`. C `make_flat_edge`/`make_flat_bottom_edges` nest cnt≥2 non-adjacent flats via a `(i+1)·Multisep/(cnt+1)` loop; the port routes each independently at `nodesep/2` → identical overlapping splines. ZERO corpus triggers (all 74 corpus non-adjacent flats are cnt=1); validated synthetically; regression bar = cnt=1 byte-identical. Fix = group + cnt-loop in a new module (splines-flat.ts at line cap), reusing generalized box helpers; 4 sequential tasks (T1 helpers → T2 router → T3 dispatch → T4 regression). | Diagnosis-first + cnt=1-reduction proof bound the blast radius of a shared-router change; native-oracle synthetic byte-match is the only available validation (no corpus trigger). | no |
