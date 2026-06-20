# Error Handling Design — graphviz-ts / plantuml-ts engine

Captured design notes for how the rendering engine handles malformed / errored
input, and how that interacts with the (deliberately tiny) API surface.

## Core principle

**The engine emits errors in a *structured* form; the *adapter* decides how to
surface them.** Do NOT hard-code a single error-presentation policy into the
engine (not console-only, not red-SVG-only). The engine provides the *mechanism*
(what went wrong, structured); each surface chooses the *policy* (how its user
sees it).

Rationale: any single fixed error destination is wrong for *some* consumer.
Structured-out is wrong for *none*.

## Why a single fixed policy fails

Two fundamentally different classes of consumer, with opposite needs:

- **Programmatic / developer consumers** (library users building on it, the CI /
  pre-render Action): want errors in a channel they *monitor* — console, a thrown
  exception, or a structured result they can route. They can handle and act on it.
- **Display-surface end users** (person typing in the Confluence editor, the
  playground, VS Code live preview): need the error *in the display*, because the
  display is the only thing they are looking at. They are NOT opening browser
  devtools on their Confluence page.

Consequences of picking one policy in the engine:
- **console-only** → invisible to the display-surface users (the majority, and
  the ones whose experience we most want polished). They see a blank
  macro/preview with no idea why. You can't un-console-log; the error already
  went where the user can't see it.
- **red-SVG-only** → wrong for programmatic consumers, who'd rather have a
  structured error to log/throw/fail-the-build than a *picture of* an error they
  then have to read out of an image.

## The contract

Engine returns a structured result, e.g.:

```
{ svg?: string, errors?: ErrorInfo[] }
```

- Display adapters (playground, Confluence editor, VS Code/Obsidian live preview)
  read `errors` and render them **visibly** in the surface (e.g. error text in
  red, or inline markers).
- Programmatic adapters (CLI, CI Action) read `errors` and **log / throw /
  fail-the-build** as appropriate.
- The bare library MAY default to a sensible no-config behavior (e.g. log to
  console) so the simplest usage isn't silent — but every *display* adapter reads
  the structured errors and surfaces them where the user can see them.

### Keep the tiny API tiny

The happy-path API stays `renderSvgForDot(diagram: string): string` (and
per-engine siblings). The structured-error contract is the **one deliberate
extension** for consumers that need rich failure handling — a structured-result
variant alongside the simple string-returning version for the 95% case. The
simple version can throw or carry a default; the structured version
(`{svg?, errors?}`) serves the surfaces that route errors themselves.

## If errors ARE rendered as an SVG (display surfaces)

When a display adapter chooses to present the error as a renderable SVG (error
text in red, etc.), that error-SVG is *display output like any other* and gets
display-output testing:

1. **The error-SVG must be valid, renderable SVG.** A malformed *error*-SVG is
   worse than throwing — it fails silently (broken image / blank pane) with no
   indication why. Property test across the error corpus: feed garbage, assert
   output parses as valid SVG and contains the error text.
2. **The error *text* must be useful.** "Syntax error" is bad; "Syntax error:
   unexpected '}' at line 4" is good. The message *quality* is separate from, and
   as important as, the fact that it's shown. Feed this from the parser's real
   diagnostics — and from C's error diagnostics where C defines them (oracle).
3. **The error-SVG must have sane dimensions.** The failed input gives no diagram
   to size against, so the error display's viewport is chosen *deliberately*.
   Test that error-SVGs have reasonable bounds (not 5000pt tall, not 10pt
   unreadable) so they display sensibly wherever injected.

## Error-behavior testing splits into two kinds

### 1. Oracle-matched error tests (faithfulness)
Where C/graphviz has *defined* error behavior, matching it is a fidelity question
like any other — diff your failure against C's failure (error detection point,
diagnostics, partial output). Continuous with the existing oracle-diff method;
the instrumented C tells you the correct error behavior.

### 2. Designed error tests (UX, no oracle)
Where C's behavior is undefined or irrelevant to our use case, error handling is
our *own* design and needs its own characterization + tests. The big one:

- **C is a CLI; we serve live-preview-as-you-type.** Mid-keystroke, the input is
  *constantly* malformed (user is halfway through typing a node). C's "exit with
  error" is *wrong* here — we must NOT blank/throw every other keystroke. Needs:
  graceful degradation, keep-last-good-render, inline error markers. There's no
  oracle for "good live-preview error behavior" — it's a UX judgment to
  characterize and then test.
- (Note: this is a miniature instance of the broader "no-oracle / characterize
  the intended behavior" problem — relevant to the next research project on
  weak-test-harness porting.)

## One v1 decision to make deliberately: partial failure

What about input that's *mostly* valid with one bad edge?

- **All-or-nothing** (any error → full error result): simpler, fine for v1.
- **Best-effort partial render** (render the valid parts, annotate the error
  inline): much nicer for live preview, more work.

**Recommendation:** all-or-nothing for v1 is reasonable — but decide it
*deliberately*, and note partial-render as a planned later enhancement, because
the live-preview surfaces will eventually want it. Don't let the behavior fall
out implicitly.

## Summary of obligations this adds

- [ ] Structured error result shape out of the engine (`{svg?, errors?}` or
      similar); adapters route presentation.
- [ ] Keep simple string→string happy-path API; add structured variant as the
      one deliberate extension.
- [ ] Oracle-match error behavior where C defines it (diff failures vs C).
- [ ] Characterize + test designed error behavior for use cases C lacks
      (esp. live-preview-mid-typing).
- [ ] If rendering error-SVGs: property-test they are valid SVG, useful text,
      sane dimensions.
- [ ] Decide v1 partial-failure policy (recommend all-or-nothing; note
      partial-render as later enhancement).
