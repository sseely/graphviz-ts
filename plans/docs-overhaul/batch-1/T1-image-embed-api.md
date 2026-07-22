<!-- SPDX-License-Identifier: EPL-2.0 -->
# T1 — Image embed API (`setImageResolver` + `inlineImages`)

## Context

graphviz-ts is a faithful, browser-safe TypeScript port of Graphviz. External
images are currently emitted as a verbatim passthrough:
`src/render/svg.ts` `usershape()` (≈line 268–275) writes
`<image xlink:href="<src>" width=… height=… …>`. There is no way to produce a
**self-contained** SVG that carries the image bytes inline. Callers building
offline docs, email, or CSP-restricted embeds need that.

The port already has the exact pattern to mirror: `src/gvc/usershape.ts`
exposes a process-global, caller-injected `setImageSizer` (AD3) because the C
resolves image dimensions from a filesystem dictionary that is browser-hostile.
Read that file first — the new resolver is its twin.

## Task

Add an additive, non-breaking image-inlining feature. See
[decisions.md#image-api](../decisions.md#image-api) — this is locked.

1. **New module `src/gvc/image-resolver.ts`** (mirror `usershape.ts`):
   - `export type ImageResolver = (src: string) => { bytes: Uint8Array; mime?: string } | Uint8Array | null;`
   - `export function setImageResolver(fn: ImageResolver | null): void`
   - `export function findImageBytes(src: string): { bytes: Uint8Array; mime: string } | null`
     — calls the resolver, normalizes `Uint8Array` → `{ bytes, mime }` by
     inferring `mime` from the `src` extension (`.png`→`image/png`,
     `.jpg`/`.jpeg`→`image/jpeg`, `.gif`→`image/gif`, `.svg`→`image/svg+xml`,
     `.webp`→`image/webp`; fallback `application/octet-stream`). Returns `null`
     when no resolver is set or it returns `null`.
   - `export function toDataUri(bytes, mime): string` — browser-safe base64.
     **No `Buffer`.** Encode via chunked `String.fromCharCode(...chunk)` +
     `btoa`, or a manual base64 table. Chunk to avoid call-stack limits on
     large images (e.g. 0x8000-byte chunks).
   - SPDX header + `@see lib/gvc/gvusershape.c` provenance comment.
2. **`RenderOptions.inlineImages?: boolean`** in `src/render/public.ts`
   (default `false`; document it like the existing `engine` field). Thread it
   so the SVG render job knows the flag — pass through `deviceRender` /
   `src/gvc/device.ts` as needed to reach the render job/context that
   `svg.ts` sees. Prefer the smallest thread: a boolean on the render
   job/context, read in `usershape()`.
3. **Emit branch in `src/render/svg.ts` `usershape()`:** when the job's
   `inlineImages` is set AND `findImageBytes(src)` returns bytes, write
   `xlink:href="data:<mime>;base64,<b64>"`; otherwise write the raw `src`
   exactly as today. This one seam also covers HTML `<IMG>` cells (they route
   through `renderer.usershape()` — see `src/common/htmltable-emit.ts:250`).
4. **Re-export** `setImageResolver` and `ImageResolver` from `src/index.ts`,
   adjacent to the existing `setImageSizer` export (line ≈133).

## Read-set

- `src/gvc/usershape.ts` (full — the mirror)
- `src/render/svg.ts:255-290` (the `usershape()` method + surrounding class)
- `src/render/public.ts:41-120` (`RenderOptions`, `render()` body)
- `src/gvc/device.ts` (the `render`/`deviceRender` seam — find how a job/ctx
  reaches the SVG renderer)
- `src/index.ts:130-145` (existing `setImageSizer` export site)
- `src/common/htmltable-emit.ts:210-280` (confirm the shared usershape seam)
- [decisions.md#image-api](../decisions.md#image-api)

## Architecture decisions (locked)

- Global resolver + render option (NOT a standalone post-processor).
- Default `inlineImages=false` ⇒ **byte-identical** existing output.
- Browser-safe base64 only — no Node `Buffer`, no filesystem.

## Interface contract (output — consumed by T7, T11)

```ts
type ImageResolver = (src: string) =>
  { bytes: Uint8Array; mime?: string } | Uint8Array | null;
function setImageResolver(fn: ImageResolver | null): void;    // from 'graphviz-ts'
// RenderOptions gains:  inlineImages?: boolean   // from 'graphviz-ts/render'
```

## Acceptance criteria (Given/When/Then → tests)

- Given a resolver returning PNG bytes and `render(g,'svg',{inlineImages:true})`,
  when a node has `image="logo.png"`, then the SVG contains
  `xlink:href="data:image/png;base64,…"` and no raw `logo.png` href.
- Given the same graph with `inlineImages` **unset**, when rendered, then the
  SVG bytes are **identical** to rendering on `main` (raw href passthrough).
  (Assert against a captured baseline string — this guards the hard stop.)
- Given `inlineImages:true` but **no** resolver registered, when rendered,
  then the raw href is emitted (graceful miss, no throw).
- Given a resolver returning a bare `Uint8Array` for `pic.jpg`, when inlined,
  then mime is inferred as `image/jpeg`.
- Given a >64KB byte array, when `toDataUri` encodes it, then it does not throw
  (chunked base64) and round-trips to the same bytes.

## Observability

N/A — no new observable operation. Pure in-process transform.

## Rollback

Reversible — revert the commit. Additive, non-breaking (AD-1).

## Quality bar

`npm run typecheck && npm test && npm run build` all green. New tests in
`src/gvc/image-resolver.test.ts` and an inline-render test (co-located with
the render suite). Coverage ≥90% on the new module.

## Boundaries

- **Always:** keep default-off output byte-identical; browser-safe only.
- **Never:** import `node:*`, use `Buffer`, touch layout/geometry, or change
  the C-faithful emit for the non-inline path.
- **Ask first:** if threading the flag cleanly requires changing a public
  signature other than adding `RenderOptions.inlineImages` — STOP.

## Commit

`feat(T1): inline external images as data URIs via setImageResolver`
Body: note default-off is byte-identical; mirrors setImageSizer (AD-1).
