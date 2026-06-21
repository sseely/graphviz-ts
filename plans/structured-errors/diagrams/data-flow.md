# Data flow — error delivery

## `tryRenderSvg` (result-style)

```mermaid
sequenceDiagram
    participant C as Consumer
    participant I as tryRenderSvg
    participant R as renderSvg
    participant P as parse (peggy)
    participant L as layout + render
    participant X as classifyError

    C->>I: tryRenderSvg(dot, engine)
    I->>R: renderSvg(dot, engine)
    R->>P: parse(dot)
    alt parse fails
        P-->>R: throw ParseError (GvError: syntax)
    else parse ok
        R->>L: layout + render (wrapped)
        alt render fails
            L-->>R: throw RenderError (GvError: render)
        else render ok
            L-->>R: svg string
            R-->>I: svg
            I-->>C: { svg }
        end
    end
    R-->>I: throw GvError
    I->>X: classifyError(err)
    X-->>I: plain GvError data {type,code,message,friendlyMessage,location?,expected?}
    I-->>C: { errors: [gvError] }   %% XOR with svg; length 1
```

## `renderSvg` (throwing path)

```mermaid
sequenceDiagram
    participant C as Consumer
    participant R as renderSvg
    C->>R: renderSvg(dot, engine)
    alt failure
        R-->>C: throw GvError (ParseError | RenderError)
        Note over C: e instanceof Error == true; branch on e.code / e.type
    else success
        R-->>C: svg string
    end
```

Faithfulness (relaxed): `location`/`code` are correctness-bound; `message`
wording is library-UX and may diverge from C.
