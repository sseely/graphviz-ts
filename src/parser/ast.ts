// SPDX-License-Identifier: EPL-2.0

/**
 * AST node types emitted by the Peggy-generated DOT parser.
 *
 * @see src/parser/dot.pegjs
 * @see lib/cgraph/grammar.y
 */

export interface AttrPair {
  readonly key: string;
  readonly value: string;
}

export interface NodeId {
  readonly id: string;
  readonly port: string | null;
  readonly compass: string | null;
}

export interface NodeStmt {
  readonly type: 'node';
  readonly id: NodeId;
  readonly attrs: AttrPair[];
}

export interface EdgeStmt {
  readonly type: 'edge';
  readonly nodes: Array<NodeId | SubgraphStmt>;
  readonly attrs: AttrPair[];
}

export interface AttrStmt {
  readonly type: 'attr';
  readonly target: 'graph' | 'node' | 'edge';
  readonly attrs: AttrPair[];
}

export interface AssignStmt {
  readonly type: 'assign';
  readonly key: string;
  readonly value: string;
}

export interface SubgraphStmt {
  readonly type: 'subgraph';
  readonly id: string | null;
  readonly stmts: ParsedStmt[];
}

export type ParsedStmt =
  | NodeStmt
  | EdgeStmt
  | AttrStmt
  | AssignStmt
  | SubgraphStmt;

export interface ParsedGraph {
  readonly type: 'graph';
  readonly strict: boolean;
  readonly directed: boolean;
  readonly id: string | null;
  readonly stmts: ParsedStmt[];
}
