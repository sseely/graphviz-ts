<!-- SPDX-License-Identifier: EPL-2.0 -->
# Data-flow diagrams

## 1. Image inlining (T1)

The default path is unchanged (verbatim href). The `inlineImages` flag adds
one branch that consults the global resolver and rewrites the href to a
`data:` URI. Default-off output is byte-identical.

```mermaid
sequenceDiagram
  participant App as Caller
  participant R as render(g, 'svg', opts)
  participant J as RenderJob
  participant S as svg.ts usershape(src, box)
  participant IR as image-resolver (global)

  App->>IR: setImageResolver(src => bytes|null)
  App->>R: render(g, 'svg', { inlineImages: true })
  R->>J: create job (inlineImages = true)
  J->>S: emit <image> for node image= / <IMG>
  alt inlineImages && resolver hit
    S->>IR: findImageBytes(src)
    IR-->>S: { bytes, mime }
    S->>S: base64(bytes) (browser-safe)
    S-->>J: <image xlink:href="data:mime;base64,…">
  else default (flag off or miss)
    S-->>J: <image xlink:href="src">  %% unchanged
  end
```

## 2. Docs build (T3 + T12 + copy-reports)

```mermaid
sequenceDiagram
  participant Dev as npm run docs:build
  participant CR as copy-reports.mjs
  participant TD as typedoc (docs:api)
  participant VP as vitepress build

  Dev->>CR: mirror test/corpus/PARITY-*.md → docs-site/*.md
  Note over CR: T2's scrubbed/gitlab-linked tables flow through here
  Dev->>TD: emit docs-site/reference/*.md from src TSDoc
  Dev->>VP: build site (guides + recipes + reference + dashboards)
  VP-->>Dev: static site (GitHub Pages)
```

## 3. Dashboard link hygiene (T2)

```mermaid
graph LR
  A["raw errMsg / test id<br/>/Users/…/tests/1447.dot"]:::bad
  B["corpus-links.ts"]:::new
  C["scrubLocalPaths()"]
  D["gitlabTestUrl()"]
  E["[1447](gitlab…/blob/main/tests/1447.dot)<br/>+ scrubbed message"]:::good
  A --> B
  B --> C --> E
  B --> D --> E
  classDef bad fill:#f8d7da,stroke:#a33,color:#000;
  classDef good fill:#d5f5d5,stroke:#2e7d32,color:#000;
  classDef new fill:#d5f5d5,stroke:#2e7d32,color:#000;
```
