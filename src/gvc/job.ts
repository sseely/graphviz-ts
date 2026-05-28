// SPDX-License-Identifier: EPL-2.0

/**
 * RenderJob scaffold — forward-reference stub for T25.
 * Fully implemented by T26 (T26-job-textlayout.md).
 *
 * @see lib/gvc/gvcjob.h:GVJ_s
 */

// Minimal shape required for context.ts RendererPlugin callbacks.
// T26 replaces this with the full class.
export interface RenderJob {
  readonly output: string[];
  write(s: string): void;
}
