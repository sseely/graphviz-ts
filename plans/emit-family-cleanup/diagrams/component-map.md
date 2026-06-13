# Component map — emit-family cleanup

## Before deletion (pre-`a785a86`)

```mermaid
graph TD
  subgraph DEAD["Dead emit-family (drifted — incompatible RenderJob)"]
    EM["emit.ts"]
    EN["emit-node.ts"]
    EE["emit-edge.ts"]
    EC["emit-cluster.ts"]
    EX["emit-xdot.ts"]
    ES["emit-style.ts"]
    EB["emit-bb.ts"]
    ECO["emit-coord.ts"]
    ESH["emit-shape.ts"]
    ET_TEST["emit.test.ts"]
    EM --> EN
    EM --> EE
    EM --> EC
    EM --> EX
    EM --> ES
    EM --> EB
    EM --> ECO
    EM --> ESH
    ET_TEST --> EM
  end

  subgraph LIVE["Live render path (golden-validated)"]
    DEV["src/gvc/device.ts"]
    SVG["src/render/svg*.ts + svg-helpers.ts"]
    DEV --> SVG
  end

  subgraph TYPES["emit-types.ts (KEPT)"]
    TS["TextSpan, HTML_BF/IF/UL/SUP/SUB/S/OL"]
  end

  TYPES -->|imported by 12 live files| LIVE
  DEAD -.->|zero imports from LIVE| LIVE
```

## After deletion (current state on `feature/post-parity`)

```mermaid
graph TD
  subgraph TYPES["src/common/emit-types.ts (only emit file remaining)"]
    TS["TextSpan, HTML_* constants"]
  end

  subgraph LIVE["Live render path"]
    DEV["src/gvc/device.ts"]
    CTX["src/gvc/context.ts"]
    TL["src/gvc/textlayout.ts"]
    DOT["src/render/dot.ts"]
    SVG_R["src/render/svg.ts"]
    JSON_R["src/render/json.ts"]
    MAP["src/render/map.ts"]
    SVGH["src/render/svg-helpers.ts"]
    HTP["src/common/htmltable-pos.ts"]
    PG["src/common/poly-gencode.ts"]
    ML["src/common/make-label.ts"]
    HTE["src/common/htmltable-emit.ts"]
  end

  TYPES -->|TextSpan| DEV
  TYPES -->|TextSpan| CTX
  TYPES -->|TextSpan| TL
  TYPES -->|TextSpan| DOT
  TYPES -->|TextSpan| SVG_R
  TYPES -->|TextSpan| JSON_R
  TYPES -->|TextSpan| MAP
  TYPES -->|TextSpan + HTML_*| SVGH
  TYPES -->|HTML_*| HTP
  TYPES -->|TextSpan| PG
  TYPES -->|TextSpan| ML
  TYPES -->|TextSpan| HTE
```

## Worktrees (pre-cleanup)

```mermaid
graph LR
  PP["feature/post-parity (HEAD 22c4625)"]
  WT1["worktree-agent-a205a9b4e56ad3864 (locked, 0 unique commits)"]
  WT2["worktree-agent-a7c8e94fee4b76454 (locked, 0 unique commits)"]
  WT3["worktree-agent-a8390b63b9a90d79f (locked, 0 unique commits)"]
  WT4["worktree-agent-acdfd75414a43cce4 (locked, 0 unique commits)"]
  WT5["worktree-agent-ad8c7c7c61bf2c37d (locked, 0 unique commits)"]
  WT6["worktree-agent-af8ee944fa4a79584 (locked, 0 unique commits)"]
  WT7["worktree-agent-aff5e70b995d3283a (locked, 0 unique commits)"]

  PP -->|contains| WT1
  PP -->|contains| WT2
  PP -->|contains| WT3
  PP -->|contains| WT4
  PP -->|contains| WT5
  PP -->|contains| WT6
  PP -->|contains| WT7
```

Each worktree still holds the pre-deletion emit-family files in its
`.claude/worktrees/agent-*/src/common/` directory. T2 removes them.
