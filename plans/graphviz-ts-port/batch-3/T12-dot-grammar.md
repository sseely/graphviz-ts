# T12 — Peggy Grammar File

## Context

The DOT language parser is specified by two C source files:
- `lib/cgraph/grammar.y` — the Bison grammar (LALR(1))
- `lib/cgraph/scan.l` — the Flex lexer

Architecture decision **AD-11** mandates a Peggy-generated PEG grammar at
`src/parser/dot.pegjs`. The `.pegjs` file is the canonical faithfulness
artifact — each production must be annotated with a comment citing its Bison
equivalent so divergence is detectable by inspection.

The DOT language handles:
- `graph` and `digraph` declarations, with optional `strict` prefix
- Named and anonymous `subgraph` clusters
- Node statements: `nodeId [attrList]`
- Edge statements: `nodeIdOrSubgraph (-> | --) nodeIdOrSubgraph [attrList]`
  (only `->` for digraphs; only `--` for undirected graphs)
- Attribute list statements: `graph|node|edge [attrList]`
- Attribute lists: `[key=value, key=value, ...]`
- IDs: plain identifiers, double-quoted strings (with C-style escaping and
  embedded newlines), numeral literals, and HTML labels `<...>`
- HTML labels are distinguished from `<` comparison operators by context:
  an HTML label can only appear as an attribute value, never as a standalone
  expression

From `scan.l`, the lexer also handles:
- C-style block comments `/* ... */` and line comments `// ...`
- Quoted strings with `\"` and `\\` escapes, and `\n`/`\t` escape sequences
- String concatenation: adjacent strings `"a" "b"` are concatenated
- HTML strings: `<` starts an HTML label only in contexts where an ID is
  expected; `html_nest` tracks nesting depth for `<` / `>`; ends at the
  matching unquoted `>` at depth 0

The lexer in `scan.l` handles the `graphType` state for `strict`, `graph`,
`digraph` keywords. These are case-insensitive (DOT keywords are
case-insensitive; attribute names and values are case-sensitive).

## Task

Write `src/parser/dot.pegjs` — a Peggy PEG grammar that parses the full DOT
language as defined by `grammar.y` and `scan.l`.

Requirements:

1. **Every production must have a comment** citing the corresponding Bison
   rule or Flex token, e.g.:
   ```
   // grammar.y: graph : graphtype optstrict NAME '{' stmtlist '}'
   graph = ...
   ```

2. **Whitespace and comment handling**: Use a whitespace rule that consumes
   spaces, tabs, newlines, C block comments `/* ... */`, and line comments
   `// ...`. Insert this rule at every token boundary.

3. **HTML labels**: An HTML label starts with `<` and ends at the matching
   `>`, tracking nesting depth for `<` / `>` within. The content between
   the outer `<>` is returned verbatim (not parsed as HTML). Distinguish
   this from any other use of `<` in the grammar.

4. **String escaping**: Quoted strings must handle:
   - `\"` → literal `"`
   - `\\` → literal `\`
   - `\n` → literal newline (DOT `\n` in a label renders as a newline)
   - `\l`, `\r` → left/right-justified line break markers (kept verbatim
     in the AST — the renderer interprets them)
   - `\t` → tab
   - Any other `\X` → `X` (pass through)

5. **String concatenation**: Adjacent quoted strings (separated only by
   whitespace) are concatenated into a single string value. This matches
   the `scan.l` behavior where the lexer accumulates into `Sbuf`.

6. **Numeric IDs**: Per `scan.l`, a numeral is an optional `-`, followed by
   an optional integer part, an optional decimal point, and an optional
   fractional part. Examples: `42`, `.5`, `-.3`, `-0.5e3`. Return as string,
   not number (consistent with how DOT treats all IDs as strings internally).

7. **Keyword case-insensitivity**: `strict`, `graph`, `digraph`, `node`,
   `edge`, `subgraph` are case-insensitive. Plain identifiers used as node
   names are case-sensitive.

8. **Edge operators**: `->` is valid only in digraphs; `--` is valid only in
   undirected graphs. The grammar should accept both operators syntactically
   and leave the digraph/undirected consistency check to a semantic pass
   (mirrors the Bison grammar which accepts both operators at the grammar
   level and validates at the semantic action level in `grammar.y`).

9. **Multiple edges in a single statement**: DOT allows chains:
   `A -> B -> C [color=red]`. The attribute list applies to all edges in
   the chain.

10. **AST shape**: Return plain TypeScript objects. Do not import from
    `src/model/` — the grammar produces raw parse tree nodes that T13 will
    convert to model objects.

    Suggested top-level AST nodes:
    ```typescript
    type ParsedGraph = {
      kind: 'graph' | 'digraph';
      strict: boolean;
      id: string | null;
      stmts: Stmt[];
    };
    type Stmt = NodeStmt | EdgeStmt | AttrStmt | SubgraphStmt | AssignStmt;
    ```

## Write-Set

- `src/parser/dot.pegjs`

## Read-Set

- `~/git/graphviz/lib/cgraph/grammar.y` — full file; all Bison rules
- `~/git/graphviz/lib/cgraph/scan.l` — full file; token rules, HTML label
  nesting, string accumulation in `Sbuf`, escape handling

## Architecture Decisions

- **AD-11**: Peggy PEG grammar from `grammar.y` and `scan.l`. The `.pegjs`
  file is the canonical faithfulness artifact. Build command:
  `peggy --format es --dts src/parser/dot.pegjs`. The generated output is
  committed.
- The grammar does NOT validate `->` vs `--` vs digraph type — that is a
  semantic check done in the wrapper (T13).

## Interface Contracts

The grammar file's start rule produces a `ParsedGraph` object. The Peggy
`--dts` flag generates a `.d.ts` file; ensure the types match the AST shapes
described above.

The grammar file is consumed by T13 via:
```bash
peggy --format es --dts src/parser/dot.pegjs
# produces: src/parser/dot.js  src/parser/dot.d.ts
```

## Acceptance Criteria

**Given** every `.dot` file in `~/git/graphviz/graphs/`,  
**When** the Peggy-generated parser processes each file,  
**Then** parsing completes without throwing a `ParseError`.

**Given** the DOT attribute value `<B>bold</B>` (an HTML label),  
**When** parsed as an attribute value,  
**Then** the result is an HTML label token containing `B>bold</B` (the outer
`<>` are the delimiters, not part of the content) — distinct from a plain
string `"<B>bold</B>"`.

**Given** the string `"hello\nworld"` in a DOT source file,  
**When** parsed,  
**Then** the AST contains the string with a literal newline character
(the `\n` escape is resolved during parsing, matching `scan.l` behavior).

## Observability

N/A — grammar file; no runtime state.

## Rollback

Reversible. Single new file. Revert by removing `src/parser/dot.pegjs` and
any generated outputs.

## Quality Bar

- `peggy --format es --dts src/parser/dot.pegjs` exits 0 (grammar is valid)
- Manual spot-check: parse `~/git/graphviz/graphs/` directory samples
  (at least the 5 simplest `.dot` files) without error
- One commit: `feat(parser): add Peggy DOT grammar derived from grammar.y`
- The grammar file must not exceed 400 lines; if longer, it likely contains
  redundant rules — consolidate
