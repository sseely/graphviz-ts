# Mission: sfdp beautify_leaves (SFDP-1)

## Objective

Port `beautify_leaves` (`lib/sfdpgen/spring_electrical.c:195`) so sfdp
graphs with `beautify=true` render instead of throwing. The pass fans each
node's degree-1 leaves evenly around it at their average distance. Replaces
the hard `throw` at `spring-electrical.ts:356`.

## Deep-dive findings (C-instrumented, 2026-06-17)

- **Runs per multilevel level**, not as a final pass (`spring_electrical.c:378`).
- **FMA required:** `set_leaves` disassembly shows `fmadd` for both coords
  (`cos(ang)*dist + x[i]`, `sin(ang)*dist + y[i]`). The TS port MUST use
  `fma()` there (see [[recover-slack-and-c-harness]] / fdp-fma note).
- **No-diagonal invariant** guaranteed upstream (`SparseMatrix_remove_diagonal`,
  C `:1090`); `node_degree = ia[i+1]−ia[i]` is safe.
- **Testable end-to-end:** sfdp PRNG is matched, so output is deterministic
  and oracle-comparable. A bare star diverges chaotically (~1e-3, FP-symmetry
  — NOT a beautify bug), but a **well-connected graph with a few leaves is
  oracle-stable to 6 digits**. Use that for the e2e pin.

## Oracle ground truth (ring + 2 leaves, `beautify=true`)

Graph: `graph G { beautify=true; n0--n1; n1--n2; n2--n3; n3--n4; n4--n5;
n5--n6; n6--n7; n7--n8; n8--n9; n9--n0; n0--n5; n2--n7; n0--L1; n5--L2; }`

Full-precision ND_pos from sfdp 15.0.0 (pin to 6 digits):
```
n0 2.7899406429179132 1.8562913086323682
n1 4.3128775658599832 3.4722145313936394
n2 5.6611618410937865 4.638460629425162
n3 7.8324499203228832 3.2305650190082797
n4 7.6306254628905155 1.6194970258954737
n5 5.233831007064385  2.0562617282998379
n6 4.2710361744633989 4.6183618840531846
n7 2.7946653301296203 4.9375851976460154
n8 0.44997892990351529 3.9623309738246637
n9 0.37500000000000044 2.2586564545398988
L1 2.1378595911392644 0.25
L2 4.5689475615142596 0.41843388937155312
```

## Oracle probe (rebuild as needed)

Source: `sfdp-oracle.c` (in this dir). Build:
`cc -o /tmp/sfdp-oracle sfdp-oracle.c -I/opt/homebrew/opt/graphviz/include
-L/opt/homebrew/opt/graphviz/lib -lgvc -lcgraph -lcdt`. Run:
`printf '<dot>' | /tmp/sfdp-oracle`. Matches the embedded `SIMPLE_ORACLE_POS`
byte-for-byte (verified same reference as the existing tests).

## Branch / merge

- Branch: `feature/sfdp-beautify-leaves`; merge commit to `main`.

## Constraints (stop / push-forward)

**STOP when:** any sfdp golden churns; the oracle test graph stops
base-matching to 6 digits (pick another well-connected leaf graph); FMA
still diverges beyond 6 digits; 2 consecutive gate failures; a fix needs a
file outside the write-set.

**PUSH FORWARD when:** hook-limit helper split; purely stylistic choice.

## Quality gates

- `npx tsc --noEmit` → 0
- `npx vitest run` → ≥ 1856, zero golden churn
- Hook limits: 30 lines/fn, CCN 10, 5 params, 500/file.

## Baseline (2026-06-17, main): tsc 0, vitest 1856 passed.

## Batches

| Batch | Tasks | Status |
|-------|-------|--------|
| 1 | T1 (beautifyLeaves + unit), T2 (wire + oracle pin) | [ ] |

## Index

- [decisions.md](decisions.md)
- [batch-1/overview.md](batch-1/overview.md)
- [batch-1/T1-beautify-leaves.md](batch-1/T1-beautify-leaves.md)
- [batch-1/T2-wire-oracle.md](batch-1/T2-wire-oracle.md)
- [decision-journal.md](decision-journal.md)
