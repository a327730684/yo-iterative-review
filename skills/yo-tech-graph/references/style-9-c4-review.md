---
id: 9
name: C4 Review Canvas
file: style-9-c4-review.md
use: C4 评审画布。暖纸底 + 手绘抖动描边，适合 C4 评审、ADR 记录。 enforcing 一个抽象层级。
---

## 风格 9 · C4 Review Canvas

C4 评审画布。暖纸底 + 手绘抖动描边，适合 C4 评审、ADR 记录。 enforcing 一个抽象层级。

## 构图要点

- 容器标题大写，右上角自动出 C4 · LEVEL VIEW 徽章（c4_level/review_state）
- 节点用 review_card 语义（v2 前先落回通用节点）
- protocol 字段可给箭头加双行标签

## Tokens（generator 唯一数据源，勿手改色值）

```json
{
  "name": "C4 Review Canvas",
  "font_family": "'Avenir Next', Avenir, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  "background": "#f7f2e8",
  "shadow": false,
  "title_align": "left",
  "title_fill": "#24312f",
  "title_size": 27,
  "subtitle_fill": "#6f756f",
  "subtitle_size": 13,
  "node_fill": "#fffdf7",
  "node_stroke": "#365f56",
  "node_radius": 7,
  "node_shadow": "",
  "section_fill": "rgba(255,253,247,0.48)",
  "section_stroke": "#8c7d68",
  "section_dash": "9 6",
  "section_label_fill": "#5b5144",
  "section_sub_fill": "#8c7d68",
  "title_divider": false,
  "section_upper": false,
  "arrow_width": 2,
  "arrow_colors": {
    "control": "#365f56",
    "write": "#a44a3f",
    "read": "#356a8a",
    "data": "#c06b35",
    "async": "#7a5c99",
    "feedback": "#b13e53",
    "neutral": "#746b60"
  },
  "arrow_label_bg": "#f7f2e8",
  "arrow_label_opacity": 0.94,
  "arrow_label_fill": "#4b5563",
  "type_label_fill": "#8a6f43",
  "type_label_size": 10,
  "text_primary": "#24312f",
  "text_secondary": "#5f665f",
  "text_muted": "#8a8d86",
  "legend_fill": "#5f665f",
  "canvas_treatment": "review"
}
```
