---
id: 8
name: Dark Luxury
file: style-8-dark-luxury.md
use: 暗黑奢华风。纯黑底 + 金色系 + 6 色语义节点桶，适合高端架构评审、精品文档。
---

## 风格 8 · Dark Luxury

暗黑奢华风。纯黑底 + 金色系 + 6 色语义节点桶，适合高端架构评审、精品文档。

## 构图要点

- 节点语义桶（覆盖 node stroke）：代码 #5a9e6f / 服务 #a78bfa / 数据 #38bdf8 / 概念 #f87171 / 基建 #fbbf24 / 文档 #94a3b8
- 箭头金色为主，dependency 用紫罗兰 dashed
- rx=6，节点 fill 统一 #111111，靠 stroke 颜色区分

## Tokens（generator 唯一数据源，勿手改色值）

```json
{
  "name": "Dark Luxury",
  "font_family": "-apple-system, -apple-system, 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', 'Microsoft JhengHei', 'SimHei', sans-serif",
  "background": "#0a0a0a",
  "shadow": false,
  "title_align": "left",
  "title_divider": false,
  "title_fill": "#f5f0eb",
  "title_size": 21,
  "subtitle_fill": "#a39787",
  "subtitle_size": 13,
  "node_fill": "#111111",
  "node_stroke": "#5a9e6f",
  "node_radius": 6,
  "node_shadow": "",
  "section_fill": "none",
  "section_stroke": "#d4a574",
  "section_dash": "",
  "section_label_fill": "#d4a574",
  "section_sub_fill": "#a39787",
  "section_upper": false,
  "arrow_width": 2,
  "arrow_colors": {
    "control": "#d4a574",
    "write": "#6ee7b7",
    "read": "#38bdf8",
    "data": "#fdba74",
    "async": "#a78bfa",
    "feedback": "#d4a574",
    "neutral": "#a39787"
  },
  "arrow_label_bg": "#0a0a0a",
  "arrow_label_opacity": 0.9,
  "arrow_label_fill": "#a39787",
  "type_label_fill": "#a39787",
  "type_label_size": 10,
  "text_primary": "#f5f0eb",
  "text_secondary": "#a39787",
  "text_muted": "#6b5f53",
  "legend_fill": "#a39787"
}
```
