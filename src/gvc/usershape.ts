// SPDX-License-Identifier: EPL-2.0

/**
 * User-shape (image) size resolution for HTML <IMG> labels.
 *
 * C resolves image dimensions through a process-global dictionary
 * (gvusershape.c ImageDict) populated from the filesystem — browser-
 * hostile. Per AD3, the port exposes a caller-injected ImageSizer in
 * the same global-registry position: callers register a sizer before
 * rendering; absent or unresolvable sources reproduce C's
 * missing-image behavior (warning + zero size).
 *
 * @see lib/gvc/gvusershape.c (ImageDict, gvusershape_find/size)
 */

import type { ImageSizer } from '../common/htmltable-types.js';

export type { ImageSizer } from '../common/htmltable-types.js';

let activeSizer: ImageSizer | null = null;

/**
 * Register (or clear, with null) the global image sizer consulted by
 * HTML <IMG> sizing. Mirrors gvusershape's process-global dictionary.
 */
export function setImageSizer(sizer: ImageSizer | null): void {
  activeSizer = sizer;
}

/** Resolve an image source via the registered sizer; null if unresolved. */
export function findImageSize(src: string): { w: number; h: number } | null {
  return activeSizer !== null ? activeSizer(src) : null;
}
