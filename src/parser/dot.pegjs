// SPDX-License-Identifier: EPL-2.0
//
// DOT language grammar for Peggy (PEG parser generator).
// Derived from:
//   grammar.y  — Bison LALR(1) grammar (lib/cgraph/grammar.y)
//   scan.l     — Flex lexer          (lib/cgraph/scan.l)
//
// Architecture decision AD-11: this file is the canonical faithfulness
// artifact; every production cites its Bison rule or Flex token.

// ── Top-level rule ───────────────────────────────────────────────────────────
// grammar.y: graph : hdr body | error | /* empty */

Graph
  = _ s:OptStrict _ t:GraphType _ id:OptGraphName _ "{" _ stmts:StmtList _ "}" _
    {
      return {
        type: "graph",
        strict: s,
        directed: t,
        id: id,
        stmts: stmts
      };
    }
  / _ "" { return { type: "graph", strict: false, directed: false, id: null, stmts: [] }; }

// grammar.y: hdr : optstrict graphtype optgraphname
// grammar.y: optstrict : T_strict | /* empty */
OptStrict
  = StrictKw _ { return true; }
  / "" { return false; }

// grammar.y: graphtype : T_graph | T_digraph
// scan.l: "graph" → T_graph, "digraph" → T_digraph  (case-insensitive per keywords)
GraphType
  = DigraphKw { return true; }
  / GraphKw   { return false; }

// grammar.y: optgraphname : atom | /* empty */
OptGraphName
  = a:Atom _ { return a; }
  / "" { return null; }

// grammar.y: optstmtlist : stmtlist | /* empty */
// grammar.y: stmtlist : stmtlist stmt | stmt
StmtList
  = stmts:( s:Stmt _ { return s; } )* { return stmts; }

// grammar.y: stmt : attrstmt optsemi | compound optsemi
// grammar.y: optsemi : ';' | /* empty */
Stmt
  = s:AttrStmt _  ( ";" _ )?  { return s; }
  / s:Compound  _  ( ";" _ )?  { return s; }

// ── Attribute statement ───────────────────────────────────────────────────────
// grammar.y: attrstmt : attrtype optmacroname attrlist | graphattrdefs
// grammar.y: attrtype : T_graph | T_node | T_edge
// grammar.y: graphattrdefs : attrassignment  (bare key=value at graph level)
AttrStmt
  = t:AttrType _ attrs:AttrList
    { return { type: "attr", target: t, attrs: attrs }; }
  / a:AttrAssignment
    { return { type: "assign", key: a.key, value: a.value }; }

// grammar.y: attrtype : T_graph | T_node | T_edge
AttrType
  = GraphKw  { return "graph"; }
  / NodeKw   { return "node"; }
  / EdgeKw   { return "edge"; }

// grammar.y: optattr : attrlist | /* empty */
// grammar.y: attrlist : optattr '[' optattrdefs ']'
AttrList
  = _ "[" _ defs:AttrDefs _ "]" rest:AttrList
    { return defs.concat(rest); }
  / _ "[" _ defs:AttrDefs _ "]"
    { return defs; }
  / "" { return []; }

// grammar.y: optattrdefs : optattrdefs attrdefs | /* empty */
// grammar.y: attrdefs : attrassignment optseparator
// grammar.y: optseparator : ';' | ',' | /* empty */
AttrDefs
  = pairs:( a:AttrAssignment _ ( [;,] _ )? { return a; } )*
    { return pairs; }

// grammar.y: attrassignment : atom '=' atom
AttrAssignment
  = k:Atom _ "=" _ v:Atom
    { return { key: k, value: v }; }

// ── Compound (node/edge) statement ───────────────────────────────────────────
// grammar.y: compound : simple rcompound optattr
// grammar.y: simple : nodelist | subgraph
Compound
  = head:Simple _ chain:EdgeChain _ attrs:AttrList
    {
      if (chain.length > 0) {
        const nodes = [head].concat(chain);
        return { type: "edge", nodes: nodes, attrs: attrs };
      } else {
        // single node or subgraph — treat subgraph as subgraph stmt
        if (head.type === "subgraph") {
          // bare subgraph with no edges
          return head;
        }
        // NodeId array — return NodeStmt(s) for first element only
        return { type: "node", id: head, attrs: attrs };
      }
    }

// grammar.y: simple : nodelist | subgraph
// grammar.y: nodelist : node | nodelist ',' node
// We return either a NodeId (plain node) or a SubgraphStmt.
Simple
  = s:Subgraph { return s; }
  / n:Node     { return n; }

// grammar.y: node : atom | atom ':' atom | atom ':' atom ':' atom
// scan.l: NAME token is an atom; compass points are also atoms
Node
  = id:Atom _ ":" _ port:Atom _ ":" _ compass:Atom
    { return { id: id, port: port, compass: compass }; }
  / id:Atom _ ":" _ port:Atom
    { return { id: id, port: port, compass: null }; }
  / id:Atom
    { return { id: id, port: null, compass: null }; }

// grammar.y: rcompound : T_edgeop simple rcompound | /* empty */
// scan.l: "->" and "--" both return T_edgeop (direction validated by wrapper)
EdgeChain
  = EdgeOp _ s:Simple _ rest:EdgeChain
    { return [s].concat(rest); }
  / "" { return []; }

// scan.l: "->" | "--" → T_edgeop
EdgeOp "edge operator"
  = "->" / "--"

// ── Subgraph ──────────────────────────────────────────────────────────────────
// grammar.y: subgraph : optsubghdr body
// grammar.y: optsubghdr : T_subgraph atom | T_subgraph | /* empty */
Subgraph
  = SubgraphKw _ id:Atom _ "{" _ stmts:StmtList _ "}"
    { return { type: "subgraph", id: id, stmts: stmts }; }
  / SubgraphKw _ "{" _ stmts:StmtList _ "}"
    { return { type: "subgraph", id: null, stmts: stmts }; }
  / "{" _ stmts:StmtList _ "}"
    { return { type: "subgraph", id: null, stmts: stmts }; }

// ── Atoms / identifiers ───────────────────────────────────────────────────────
// grammar.y: atom : T_atom | qatom
// grammar.y: qatom : T_qatom | qatom '+' T_qatom   (string concatenation)
Atom
  = first:QAtom rest:( _ "+" _ s:QAtom { return s; } )*
    { return rest.length > 0 ? first + rest.join("") : first; }
  / PlainAtom

// grammar.y: qatom : T_qatom  (quoted string, possibly concatenated)
// scan.l: string concatenation uses '+' operator between T_qatom tokens
QAtom
  = s:QuotedString rest:( _ s2:QuotedString { return s2; } )*
    { return rest.length > 0 ? s + rest.join("") : s; }
  / HtmlString

// scan.l: ["] begins qstring state; ["] ends it → T_qatom
// scan.l escape sequences: \" → ", \\ → \\, \n → newline ignored (escaped),
//   \n (bare) → kept, \l \r kept verbatim, \t → tab, \X → X
QuotedString
  = '"' chars:QChar* '"'
    { return chars.join(""); }

QChar
  = '\\"'        { return '"'; }
  / '\\\\'       { return '\\'; }
  / '\\n'        { return '\n'; }
  / '\\t'        { return '\t'; }
  / '\\l'        { return '\\l'; }
  / '\\r'        { return '\\r'; }
  / '\\\n'       { return ''; }           // scan.l: escaped newline ignored
  / '\\' c:.    { return c; }            // scan.l: \X → X for any other char
  / [^"\\]

// scan.l: [<] begins hstring state; tracks html_nest for matching '>'
// Content between outer <> is returned verbatim (including inner <>).
// HTML strings are returned as "<content>" so caller can detect the <>.
HtmlString
  = "<" content:HtmlContent ">"
    { return "<" + content + ">"; }

HtmlContent
  = chars:HtmlChar*
    { return chars.join(""); }

HtmlChar
  = nested:"<" content:HtmlContent ">"
    { return "<" + content + ">"; }
  / [^<>]

// scan.l: {NAME} → T_atom (case-sensitive identifier)
// scan.l: {NUMBER} → T_atom  (numeric literal returned as string)
// Keywords are excluded from plain atoms to avoid ambiguity.
PlainAtom
  = NumericLiteral
  / !ReservedWord n:Name { return n; }

// scan.l: NAME = {LETTER}({LETTER}|{DIGIT})*
// scan.l: LETTER = [A-Za-z_\200-\377]  (underscore + ASCII letters + high bytes)
Name
  = first:[A-Za-z_\x80-\xFF] rest:[A-Za-z_0-9\x80-\xFF]*
    { return first + rest.join(""); }

// scan.l: NUMBER = [-]?(({DIGIT}+(\.{DIGIT}*)?)|(\.{DIGIT}+))
// Returned as string per spec requirement.
NumericLiteral
  = s:( "-"? ( [0-9]+ ( "." [0-9]* )? / "." [0-9]+ ) ( [eE] [+-]? [0-9]+ )? )
    { return Array.isArray(s) ? s.flat(Infinity).filter(x => x !== null && x !== undefined).join("") : String(s); }

// ── Case-insensitive keywords ─────────────────────────────────────────────────
// scan.l: keywords are matched case-insensitively in the flex rules
// (flex rules come before NAME rule, so they take priority)
StrictKw   = [Ss][Tt][Rr][Ii][Cc][Tt]    !NameContinue
GraphKw    = [Gg][Rr][Aa][Pp][Hh]        !NameContinue
DigraphKw  = [Dd][Ii][Gg][Rr][Aa][Pp][Hh] !NameContinue
NodeKw     = [Nn][Oo][Dd][Ee]            !NameContinue
EdgeKw     = [Ee][Dd][Gg][Ee]            !NameContinue
SubgraphKw = [Ss][Uu][Bb][Gg][Rr][Aa][Pp][Hh] !NameContinue

NameContinue = [A-Za-z_0-9\x80-\xFF]

// Reserved word set — used to exclude keywords from PlainAtom
ReservedWord
  = ( [Ss][Tt][Rr][Ii][Cc][Tt]
    / [Dd][Ii][Gg][Rr][Aa][Pp][Hh]
    / [Gg][Rr][Aa][Pp][Hh]
    / [Nn][Oo][Dd][Ee]
    / [Ee][Dd][Gg][Ee]
    / [Ss][Uu][Bb][Gg][Rr][Aa][Pp][Hh]
    ) !NameContinue

// ── Whitespace and comments ───────────────────────────────────────────────────
// scan.l: [ \t\r] → ignored whitespace
// scan.l: \n → line_num++
// scan.l: "/*" → BEGIN(comment) ... "*"+"/" → BEGIN(INITIAL)
// scan.l: "//".*  → ignored C++-style comment
// scan.l: ^"#".* → ppDirective (preprocessor line directives, ignored here)
// scan.l: "#".*  → ignored shell-like comment
_ = ( [ \t\r\n]+ / BlockComment / LineComment / ShellComment )*

BlockComment
  = "/*" ( !"*/" . )* "*/"

LineComment
  = "//" [^\n]* ( "\n" / !. )

// scan.l: "#".* → ignore shell-like comments (also preprocessor directives)
ShellComment
  = "#" [^\n]* ( "\n" / !. )
