<!-- SPDX-License-Identifier: EPL-2.0 -->
# Component map

```mermaid
graph TD
  US[user_shapes: shapefile attr] --> SHAPE[common shape resolution/poly-init]
  SHAPE --> EMIT[render/emit + xml-escape.ts]
  B69[b69: multi-path group order] --> INSTALL[splines-clip clipAndInstall append]
  B15[b15: deep path coords] --> CORRIDOR[concentrate corridors / x-coords]
  INSTALL --> EMIT
  CORRIDOR --> EMIT
  HY[hyphen &#45; escaping] --> EMIT
```
