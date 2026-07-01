# 1949 data-flow

## D1 — where the HTML label text loses its entity decode

```mermaid
flowchart LR
  DOT["label=&lt;&amp;#91;el...&gt;"] --> LEX[htmltable-lex scanText]
  LEX -->|raw &amp;#91;el... token| PARSE[htmltable-parse parseText]
  PARSE --> ITEM["HtmlTextItem.text = &amp;#91;el..."]
  ITEM --> SIZE[sizeTextContent measure]
  SIZE -->|w=33.8 vs 14.8| VNODE[label vnode ht=dimen.x]
  VNODE --> YC[set_ycoords rank spacing]
  YC -->|+18.7px| SHIFT[whole graph shifted]
  LEX -. FIX: htmlEntityUTF8 decode .-> DEC["[el... token"]
```

Native decodes at the lexer (expat), so `SIZE` sees `[el...` (w≈14.8) and no
shift occurs. The fix moves the port onto the decoded path.

## D2 — cell border color fallback

```mermaid
flowchart LR
  NODE["node color=red"] --> PEN[pen color]
  CELL["TD BORDER=1 SIDES=B (no COLOR)"] --> EMIT[htmltable-emit emitBorder]
  EMIT -->|color ?? 'black'| BLACK[stroke=black  ✗]
  PEN -. FIX: fallback = pen color .-> RED[stroke=red  ✓]
```
