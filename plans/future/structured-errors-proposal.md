# Proposal: Structured Errors

A proposal for how the rendering engine surfaces errors to **library consumers**,
without compromising the faithful-port claim.

## Motivation

C graphviz is a CLI: its only error consumer is a human reading stderr, so a
text blob ("Expected '#', '-', '.', ... but end of input found") is fine.

A *library* has a different consumer: code that must **catch, branch on, and
present** errors — a live-preview pane that underlines the offending span, a
Confluence editor that marks the bad line, a CI step that logs structured
output, a developer who wants to handle syntax-vs-render failures differently.
A raw text blob is hard to consume programmatically.

Serving that consumer is **not** a faithfulness divergence (see next section).
It's library-API quality on top of faithful error *detection*.

## The faithfulness line (why this is allowed)

Split every error into two parts:

- **Detection — what is wrong, and where.** This stays **faithful to C**: same
  errors, same conditions, same locations, same messages C would emit. No
  divergence. "Nothing more, nothing less."
- **Delivery — the *form* the error is handed back in.** A CLI prints text; a
  library returns a structured object. Choosing the structured form serves a
  consumer C never had (programmatic callers). This is **API design, not a
  behavior change.**

We match C on *what the error is*; we package it usefully because we are a
library, not a CLI. The error *content* is C-faithful; the *delivery* is ours to
design well.

We do **not** rewrite C's messages into friendlier prose at the engine level —
that would be a user-visible divergence. Humanizing prose ("did you forget a
'}'?") belongs in a **consumer/adapter layer** built on top of this structured
data, not in the engine. The engine stays faithful; consumers build UX.

## Design principles

1. **Faithful detection, structured delivery.** Content matches C; shape is ours.
2. **Lean shape.** A small, stable set of fields. Resist an elaborate error
   taxonomy — consumers can build any UX from a few good fields, and a lean
   contract is easier to keep stable. (Same discipline as the tiny render API.)
3. **Location is the highest-value field.** `{line, column}` of where parsing
   failed is what lets every consumer point at the problem (underline the span,
   mark the line, log the spot). More valuable than the expected-token set.
4. **Always returns a renderable result OR structured errors — never a silent
   failure.** Consumers must always be able to tell success from failure and
   present accordingly.

## Proposed shape

```ts
type GvErrorType =
  | "syntax"    // parse failure (malformed DOT)
  | "semantic"  // parsed but invalid (e.g. bad attribute value, unknown ref)
  | "render";   // layout/render-stage failure

interface GvError {
  type: GvErrorType;
  message: string;            // C-faithful text (what C would emit)
  location?: {                // where, when known (parser-tracked position)
    line: number;             // 1-based
    column: number;           // 1-based
    offset?: number;          // 0-based char index into source, if available
  };
  expected?: string[];        // optional: tokens the parser expected (for
                              // consumers that want to surface it)
}

interface RenderResult {
  svg?: string;               // present on success (and on partial, if/when
                              // partial render is supported — see Open Qs)
  errors?: GvError[];         // present on failure; empty/absent on success
}
```

### Core fields (the useful minimum)
- `type` — lets consumers branch (show syntax errors inline; treat render
  failures differently).
- `message` — C-faithful text.
- `location` — **the high-value field.** Line/column to point at the problem.

### Optional
- `expected` — the parser's expected-token set, for consumers who want
  "expected X, Y, Z." Most consumers will ignore it; a few (advanced editors)
  will use it.
- `offset` — raw char index, for consumers doing span math.

## API surface (keep the tiny API tiny)

Two entry points, not a redesign:

```ts
// Happy-path, 95% case — unchanged, simple.
renderSvg(dot: string, engine?: Engine): string;   // throws GvError on failure

// Structured variant — for consumers that route errors themselves.
tryRenderSvg(dot: string, engine?: Engine): RenderResult;
```

- `renderSvg` stays the simple string→string call. On failure it **throws** a
  `GvError` (so even the simple path carries structured info for anyone who
  catches it — the structure costs the simple consumer nothing).
- `tryRenderSvg` returns `RenderResult` for consumers that prefer result-style
  handling over try/catch (live preview, editors, CI). This is the one
  deliberate API extension.

(Exact names TBD — `renderSvg`/`tryRenderSvg` shown for illustration; align with
whatever the published happy-path name ends up being.)

## What consumers build on top (NOT the engine's job)

- **Live preview:** read `errors`, underline `location`, optionally keep last
  good render; debounce so mid-typing parse errors don't flash on every
  keystroke.
- **Confluence/editor:** put a marker at `location.line`; show `message`.
- **Humanized prose:** an adapter MAY map common cases (`type: "syntax"` +
  end-of-input) to friendlier text ("looks like a missing '}'"). This lives in
  the consumer/adapter, not the engine — engine stays C-faithful.
- **CI / pre-render:** log structured errors, fail the build.

The engine provides faithful, structured *data*; presentation/humanization is
the consumer's domain.

## Requirements / dependencies

- [ ] **Parser must track position** (line/column, ideally offset) so `location`
      can be populated. If it already does (most parsers do, for error
      reporting), surfacing it is the main work. If not, adding position
      tracking is the prerequisite — and it's the single highest-value piece.
- [ ] Confirm `message` is the **C-faithful** text (don't humanize at engine
      level).
- [ ] Decide error coverage: do all three `type`s exist yet, or is `syntax` the
      only one initially? (Fine to ship `syntax` first; add `semantic`/`render`
      as those paths gain structured errors.)

## Open questions

1. **Partial render.** Does `tryRenderSvg` ever return BOTH `svg` and `errors`
   (best-effort partial render with annotated problems), or is it strictly
   svg-XOR-errors for v1? Recommend **XOR for v1** (simpler); partial render is
   a later enhancement the live-preview surfaces will eventually want.
   [scott] agree
2. **Multiple errors.** Does the parser report one error (first failure) or
   collect several? `errors[]` is an array to allow many, but v1 may only ever
   populate one. Array shape is future-proof either way.
   [scott] First failure is fine. Unless the code keeps trying after that failure, we stick with 1.
3. **Render-stage errors.** Are there layout/render failures distinct from parse
   failures that need `type: "render"`, or do all real-world failures originate
   at parse time? Determines whether `render` type is needed at launch.
   [scott] I think it's fine to have both.
## Summary

- Faithful **detection** (what/where matches C) + structured **delivery** (our
  library-grade shape). Not a faithfulness divergence — it serves the
  programmatic consumer C never had.
- Lean shape: `type`, `message`, **`location`** (the high-value field),
  optional `expected`.
- Keep the tiny API tiny: simple `renderSvg` (throws) + `tryRenderSvg` (returns
  `RenderResult`).
- Humanized prose and all presentation live in consumers/adapters, NOT the
  engine.
- Prerequisite: parser position tracking, to populate `location`.
