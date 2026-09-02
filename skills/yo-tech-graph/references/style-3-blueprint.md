---
id: 3
name: Blueprint
file: style-3-blueprint.md
use: 工程蓝图风。深蓝底 + 网格纹理，适合架构文档、基础设施图。
---

## 风格 3 · Blueprint

工程蓝图风。深蓝底 + 网格纹理，适合架构文档、基础设施图。

## 构图要点

- blueprint_title_block 可加右下角图纸标题栏（REV/AUTO-GENERATED/DWG）
- 容器/节点用青色系描边，对比靠亮度而非色相
- 适合节点少、留白多的正式图

## Tokens（generator 唯一数据源，勿手改色值）

```json
{
  "name": "Blueprint",
  "font_family": "'SF Mono', 'Fira Code', Menlo, 'Microsoft YaHei', 'SimHei', monospace",
  "background": "#082f49",
  "shadow": false,
  "title_align": "center",
  "title_fill": "#e0f2fe",
  "title_size": 30,
  "subtitle_fill": "#7dd3fc",
  "subtitle_size": 14,
  "node_fill": "#0b3b5e",
  "node_stroke": "#67e8f9",
  "node_radius": 8,
  "node_shadow": "",
  "section_fill": "none",
  "section_stroke": "#0ea5e9",
  "section_dash": "6 4",
  "section_label_fill": "#67e8f9",
  "section_sub_fill": "#7dd3fc",
  "title_divider": false,
  "section_upper": true,
  "arrow_width": 2.1,
  "arrow_colors": {
    "control": "#67e8f9",
    "write": "#22d3ee",
    "read": "#38bdf8",
    "data": "#fde047",
    "async": "#c084fc",
    "feedback": "#fb7185",
    "neutral": "#bae6fd"
  },
  "arrow_label_bg": "#082f49",
  "arrow_label_opacity": 0.9,
  "arrow_label_fill": "#e0f2fe",
  "type_label_fill": "#7dd3fc",
  "type_label_size": 11,
  "text_primary": "#e0f2fe",
  "text_secondary": "#bae6fd",
  "text_muted": "#7dd3fc",
  "legend_fill": "#bae6fd"
}
```
