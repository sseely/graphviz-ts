// SPDX-License-Identifier: EPL-2.0

/**
 * Image byte resolution + browser-safe base64 for inline (data: URI) SVG
 * image embedding.
 *
 * Mirrors `src/gvc/usershape.ts`'s `setImageSizer` pattern (AD3): C resolves
 * images through a process-global filesystem dictionary
 * (gvusershape.c ImageDict) that is browser-hostile, so the port exposes a
 * caller-injected resolver in the same global-registry position instead.
 * Unlike `ImageSizer` (which only reports intrinsic dimensions for HTML
 * `<IMG>` layout), `ImageResolver` supplies the actual bytes so the SVG
 * emitter can inline them as a `data:` URI (AD-1, additive — not a C
 * behavior; native Graphviz never inlines image bytes).
 *
 * @see lib/gvc/gvusershape.c (ImageDict, gvusershape_find/size)
 */

// ---------------------------------------------------------------------------
// Resolver registry
// ---------------------------------------------------------------------------

/**
 * Caller-supplied image resolver: given a node's `image=`/HTML `<IMG SRC=>`
 * value, return the raw bytes (optionally with an explicit MIME type), or
 * `null` when the source cannot be resolved.
 */
export type ImageResolver = (
  src: string,
) => { bytes: Uint8Array; mime?: string } | Uint8Array | null;

let activeResolver: ImageResolver | null = null;

/**
 * Register (or clear, with null) the global image resolver consulted when
 * `RenderOptions.inlineImages` is set. Mirrors gvusershape's process-global
 * dictionary and `setImageSizer`'s registration shape.
 */
export function setImageResolver(fn: ImageResolver | null): void {
  activeResolver = fn;
}

// ---------------------------------------------------------------------------
// MIME inference — @see lib/gvc/gvusershape.c (extension-based format guess)
// ---------------------------------------------------------------------------

const EXT_MIME: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

const FALLBACK_MIME = 'application/octet-stream';

/** Infer a MIME type from `src`'s file extension; falls back when unknown. */
function inferMimeFromSrc(src: string): string {
  const dot = src.lastIndexOf('.');
  if (dot < 0 || dot === src.length - 1) return FALLBACK_MIME;
  const ext = src.slice(dot + 1).toLowerCase();
  return EXT_MIME[ext] ?? FALLBACK_MIME;
}

// ---------------------------------------------------------------------------
// findImageBytes
// ---------------------------------------------------------------------------

/**
 * Resolve `src` via the registered resolver, normalizing a bare `Uint8Array`
 * return into `{ bytes, mime }` (inferring `mime` from the `src` extension
 * when the resolver omits it). Returns `null` when no resolver is set or the
 * resolver itself returns `null` — the graceful-miss path that keeps the raw
 * `src` passthrough in `usershape()`.
 */
export function findImageBytes(
  src: string,
): { bytes: Uint8Array; mime: string } | null {
  if (activeResolver === null) return null;
  const result = activeResolver(src);
  if (result === null) return null;
  if (result instanceof Uint8Array) {
    return { bytes: result, mime: inferMimeFromSrc(src) };
  }
  return { bytes: result.bytes, mime: result.mime ?? inferMimeFromSrc(src) };
}

// ---------------------------------------------------------------------------
// toDataUri — browser-safe base64 (no Buffer, no filesystem)
// ---------------------------------------------------------------------------

/** Standard base64 alphabet (RFC 4648 §4). */
const B64_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/**
 * Encode `bytes` as base64 via a manual alphabet table (3 input bytes → 4
 * output chars per iteration, single pass, no recursion/spread). Chosen over
 * `btoa` + `String.fromCharCode(...chunk)` so there is no dependency on a
 * host-global `btoa` (absent in some Worker/CSP-restricted embeds) and no
 * call-stack risk from spreading large chunks — this loop is O(n) with O(1)
 * stack depth regardless of input size.
 */
function base64Encode(bytes: Uint8Array): string {
  const len = bytes.length;
  const out: string[] = [];
  let i = 0;
  for (; i + 2 < len; i += 3) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8) | bytes[i + 2]!;
    out.push(
      B64_CHARS[(n >> 18) & 0x3f]!,
      B64_CHARS[(n >> 12) & 0x3f]!,
      B64_CHARS[(n >> 6) & 0x3f]!,
      B64_CHARS[n & 0x3f]!,
    );
  }
  const remaining = len - i;
  if (remaining === 1) {
    const n = bytes[i]! << 16;
    out.push(B64_CHARS[(n >> 18) & 0x3f]!, B64_CHARS[(n >> 12) & 0x3f]!, '==');
  } else if (remaining === 2) {
    const n = (bytes[i]! << 16) | (bytes[i + 1]! << 8);
    out.push(
      B64_CHARS[(n >> 18) & 0x3f]!,
      B64_CHARS[(n >> 12) & 0x3f]!,
      B64_CHARS[(n >> 6) & 0x3f]!,
      '=',
    );
  }
  return out.join('');
}

/** Build a `data:` URI from raw bytes + MIME type. Browser-safe base64. */
export function toDataUri(bytes: Uint8Array, mime: string): string {
  return 'data:' + mime + ';base64,' + base64Encode(bytes);
}
