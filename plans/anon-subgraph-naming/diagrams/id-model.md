# Anonymous-id model (cgraph vs port)

```mermaid
flowchart TD
  subgraph cgraph["native cgraph (lib/cgraph/id.c idmap)"]
    C0["one global counter, start 0"]
    C0 --> C1["anon object created<br/>(unnamed root / anon subgraph / keyless edge)"]
    C1 --> C2["id = 2*counter+1 (odd); counter++"]
    C2 --> C3["agnameof → '%'+id"]
    CN["named object (named node / keyed edge)"] --> CP["id = pointer (even); counter UNCHANGED"]
  end
  subgraph port["port today (builder.ts)"]
    P0["anonSeq, start 0"] --> P1["anon SUBGRAPH only"]
    P1 --> P2["name = '%'+anonSeq++  → %0,%1,%2"]
  end
  C3 -. "diverges:<br/>base, odd formula,<br/>+edges advance counter" .-> P2
```

Fix (Batch 2): replace `anonSeq` with a per-parse counter advanced in cgraph
creation order by anon root + anon subgraph + keyless edge; name `'%'+(2*counter+1)`.
