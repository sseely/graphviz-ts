<!-- SPDX-License-Identifier: EPL-2.0 -->

# Component map — touched modules

```mermaid
graph TD
    subgraph T1[T1 write-set]
        EMIT[htmltable-emit.ts<br/>emitBgFill, BgFillCtx]
        FILL[htmltable-emit-fill.ts<br/>HtmlPaint, withHtmlPaint, parseGradientSpec]
    end
    subgraph readonly[read-only — already correct]
        POLY[poly-gencode.ts<br/>applyGradientFields — the model]
        GRAD[svg-gradient.ts<br/>emitLinear/RadialGradient, gradientId]
        TYPES[htmltable-types.ts<br/>gradientangle, style, bgcolor]
    end
    subgraph T2[T2 write-set]
        GOLD[test/golden/* — input, ref, manifest]
        PAR[test/corpus/parity.json + PARITY.md]
    end

    EMIT -->|fill+stop+angle+radial| FILL
    FILL -->|sets ObjState gradient fields| GRAD
    FILL -.mirrors.-> POLY
    EMIT -.reads.-> TYPES
    T1 ==>|verified by| T2
```
