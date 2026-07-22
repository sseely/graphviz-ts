// SPDX-License-Identifier: EPL-2.0

/**
 * Tests for image-resolver.ts: setImageResolver/findImageBytes registry
 * (mirrors usershape.ts's setImageSizer) and the browser-safe toDataUri
 * base64 encoder.
 *
 * @see lib/gvc/gvusershape.c
 * @see plans/docs-overhaul/decisions.md#image-api
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
  setImageResolver,
  findImageBytes,
  toDataUri,
} from './image-resolver.js';

describe('setImageResolver / findImageBytes', () => {
  afterEach(() => setImageResolver(null));

  it('returns null when no resolver is registered', () => {
    expect(findImageBytes('logo.png')).toBeNull();
  });

  it('returns null when the registered resolver returns null (graceful miss)', () => {
    setImageResolver(() => null);
    expect(findImageBytes('missing.png')).toBeNull();
  });

  it('normalizes a bare Uint8Array, inferring mime from the extension', () => {
    const bytes = new Uint8Array([1, 2, 3]);
    setImageResolver((src) => (src === 'pic.jpg' ? bytes : null));
    const result = findImageBytes('pic.jpg');
    expect(result).not.toBeNull();
    expect(result!.bytes).toBe(bytes);
    expect(result!.mime).toBe('image/jpeg');
  });

  it('passes through an explicit mime when the resolver supplies one', () => {
    const bytes = new Uint8Array([1]);
    setImageResolver(() => ({ bytes, mime: 'image/x-custom' }));
    const result = findImageBytes('anything');
    expect(result!.mime).toBe('image/x-custom');
  });

  it('infers mime from extension when the object form omits mime', () => {
    const bytes = new Uint8Array([1]);
    setImageResolver(() => ({ bytes }));
    expect(findImageBytes('icon.gif')!.mime).toBe('image/gif');
    expect(findImageBytes('icon.webp')!.mime).toBe('image/webp');
    expect(findImageBytes('icon.svg')!.mime).toBe('image/svg+xml');
    expect(findImageBytes('icon.png')!.mime).toBe('image/png');
    expect(findImageBytes('icon.jpeg')!.mime).toBe('image/jpeg');
  });

  it('falls back to application/octet-stream for an unknown/absent extension', () => {
    const bytes = new Uint8Array([1]);
    setImageResolver(() => ({ bytes }));
    expect(findImageBytes('data.bin')!.mime).toBe('application/octet-stream');
    expect(findImageBytes('no-extension')!.mime).toBe('application/octet-stream');
    expect(findImageBytes('trailing.')!.mime).toBe('application/octet-stream');
  });

  it('setImageResolver(null) clears a previously-registered resolver', () => {
    setImageResolver(() => new Uint8Array([1]));
    expect(findImageBytes('x.png')).not.toBeNull();
    setImageResolver(null);
    expect(findImageBytes('x.png')).toBeNull();
  });
});

describe('toDataUri', () => {
  it('encodes a short byte array with the RFC 4648 alphabet (no padding, len%3==0)', () => {
    // PNG signature's first 6 bytes; known base64 prefix "iVBORw0K".
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    expect(toDataUri(bytes, 'image/png')).toBe('data:image/png;base64,iVBORw0K');
  });

  it('pads with "==" for a 1-byte remainder', () => {
    const bytes = new Uint8Array([0xff]);
    expect(toDataUri(bytes, 'application/octet-stream')).toBe(
      'data:application/octet-stream;base64,/w==',
    );
  });

  it('pads with "=" for a 2-byte remainder', () => {
    const bytes = new Uint8Array([0xff, 0xee]);
    expect(toDataUri(bytes, 'application/octet-stream')).toBe(
      'data:application/octet-stream;base64,/+4=',
    );
  });

  it('handles an empty byte array', () => {
    expect(toDataUri(new Uint8Array(0), 'image/png')).toBe('data:image/png;base64,');
  });

  it('does not throw on a >64KB byte array (chunk-boundary-free encoder) and round-trips', () => {
    const len = 70_000; // > 0x10000, crosses any 0x8000-style chunk boundary
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = i % 256;
    let uri = '';
    expect(() => {
      uri = toDataUri(bytes, 'application/octet-stream');
    }).not.toThrow();
    const b64 = uri.slice('data:application/octet-stream;base64,'.length);
    const decoded = Buffer.from(b64, 'base64');
    expect(decoded.length).toBe(len);
    expect(new Uint8Array(decoded)).toEqual(bytes);
  });
});
