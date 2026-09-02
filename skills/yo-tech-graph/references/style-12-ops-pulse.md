---
id: 12
name: Ops Pulse
file: style-12-ops-pulse.md
use: 运维脉冲风。深海军蓝底 + 网格 + 金色 glow，golden signals 与关键路径追踪。
---

## 风格 12 · Ops Pulse

运维脉冲风。深海军蓝底 + 网格 + 金色 glow，golden signals 与关键路径追踪。

## 构图要点

- 箭头 critical: true 出金色 glow + hop 徽章（critical_hop/critical_hops）
- 容器 id 含 trace 时自动画百分比标尺
- 节点 ops_service 语义 v2 前落回通用节点

## Tokens（generator 唯一数据源，勿手改色值）

```json
{
  "name": "Ops Pulse",
  "font_family": "'SF Mono', 'Fira Code', Menlo, 'Microsoft YaHei', monospace",
  "background": "#07111f",
  "shadow": false,
  "title_align": "left",
  "title_fill": "#eff6ff",
  "title_size": 27,
  "subtitle_fill": "#8aa4bd",
  "subtitle_size": 13,
  "node_fill": "#0d1b2a",
  "node_stroke": "#29435d",
  "node_radius": 12,
  "node_shadow": "",
  "section_fill": "rgba(13,27,42,0.72)",
  "section_stroke": "#28445f",
  "section_dash": "6 5",
  "section_label_fill": "#38bdf8",
  "section_sub_fill": "#6f8ba5",
  "title_divider": false,
  "section_upper": true,
  "arrow_width": 2.4,
  "arrow_colors": {
    "control": "#f59e0b",
    "write": "#22c55e",
    "read": "#38bdf8",
    "data": "#fb7185",
    "async": "#22d3ee",
    "feedback": "#f43f5e",
    "neutral": "#7892a8"
  },
  "arrow_label_bg": "#07111f",
  "arrow_label_opacity": 0.94,
  "arrow_label_fill": "#cbd5e1",
  "type_label_fill": "#6f8ba5",
  "type_label_size": 10,
  "text_primary": "#eff6ff",
  "text_secondary": "#9fb3c8",
  "text_muted": "#647f99",
  "legend_fill": "#9fb3c8",
  "canvas_treatment": "ops"
}
```
