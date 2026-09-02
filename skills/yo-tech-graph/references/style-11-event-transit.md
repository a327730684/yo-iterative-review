---
id: 11
name: Event Transit
file: style-11-event-transit.md
use: 事件地铁图。米纸底 + 点纹理，topic/processor/消费者组/DLQ 的流式拓扑。
---

## 风格 11 · Event Transit

事件地铁图。米纸底 + 点纹理，topic/processor/消费者组/DLQ 的流式拓扑。

## 构图要点

- 箭头 transit_type: rail 出轨道套壳 + 方向箭头
- 容器标题下有虚线站点线；右上角 metro 徽章读 topics 数组长度
- 节点 transit_* 语义 v2 前落回通用节点

## Tokens（generator 唯一数据源，勿手改色值）

```json
{
  "name": "Event Transit",
  "font_family": "'Avenir Next', Avenir, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  "background": "#fbf7ee",
  "shadow": false,
  "title_align": "left",
  "title_fill": "#17213c",
  "title_size": 27,
  "subtitle_fill": "#6e6a61",
  "subtitle_size": 13,
  "node_fill": "#fffdf8",
  "node_stroke": "#c9c2b4",
  "node_radius": 24,
  "node_shadow": "",
  "section_fill": "rgba(255,255,255,0.38)",
  "section_stroke": "#d4cbbb",
  "section_dash": "4 5",
  "section_label_fill": "#514c43",
  "section_sub_fill": "#8d867b",
  "title_divider": false,
  "section_upper": true,
  "arrow_width": 2.8,
  "arrow_colors": {
    "control": "#e4475b",
    "write": "#00897b",
    "read": "#2563eb",
    "data": "#f59e0b",
    "async": "#7c3aed",
    "feedback": "#c62828",
    "neutral": "#7a746a"
  },
  "arrow_label_bg": "#fbf7ee",
  "arrow_label_opacity": 0.96,
  "arrow_label_fill": "#4b5563",
  "type_label_fill": "#7a746a",
  "type_label_size": 10,
  "text_primary": "#17213c",
  "text_secondary": "#5e5a52",
  "text_muted": "#8d867b",
  "legend_fill": "#5e5a52",
  "canvas_treatment": "transit",
  "rail_casing": "#514c43"
}
```
