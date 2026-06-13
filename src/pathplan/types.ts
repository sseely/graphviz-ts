// SPDX-License-Identifier: EPL-2.0
/** @see lib/pathplan/pathgeom.h, lib/pathplan/vis.h */

export interface Point { x: number; y: number; }
export interface Poly { ps: Point[]; }
export interface Edge { a: Point; b: Point; }

export interface VConfig {
  N: number;
  Npoly: number;
  P: Point[];
  start: number[];
  next: number[];
  prev: number[];
  vis: number[][];
}
