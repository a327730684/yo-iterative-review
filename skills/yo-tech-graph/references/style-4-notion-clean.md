---
id: 4
name: Notion Clean
file: style-4-notion-clean.md
use: Notion 极简风。白底、小标题、细分隔线，适合 wiki/Confluence 嵌入。
---

## 风格 4 · Notion Clean

Notion 极简风。白底、小标题、细分隔线，适合 wiki/Confluence 嵌入。

## 构图要点

- 标题左对齐 + title_divider 分隔线
- 箭头全部单色蓝灰，靠形状而非颜色区分语义
- rx=4 小圆角，整体克制的卡片感

## Tokens（generator 唯一数据源，勿手改色值）

```json
{
  "name": "Notion Clean",
  "font_family": "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', 'Microsoft JhengHei', 'SimHei', sans-serif",
  "background": "#ffffff",
  "shadow": false,
  "title_align": "left",
  "title_fill": "#111827",
  "title_size": 18,
  "subtitle_fill": "#9ca3af",
  "subtitle_size": 13,
  "node_fill": "#f9fafb",
  "node_stroke": "#e5e7eb",
  "node_radius": 4,
  "node_shadow": "",
  "section_fill": "none",
  "section_stroke": "#e5e7eb",
  "section_dash": "",
  "section_label_fill": "#9ca3af",
  "section_sub_fill": "#d1d5db",
  "title_divider": true,
  "section_upper": true,
  "arrow_width": 1.8,
  "arrow_colors": {
    "control": "#3b82f6",
    "write": "#3b82f6",
    "read": "#3b82f6",
    "data": "#3b82f6",
    "async": "#9ca3af",
    "feedback": "#9ca3af",
    "neutral": "#d1d5db"
  },
  "arrow_label_bg": "#ffffff",
  "arrow_label_opacity": 0.96,
  "arrow_label_fill": "#6b7280",
  "type_label_fill": "#9ca3af",
  "type_label_size": 11,
  "text_primary": "#111827",
  "text_secondary": "#374151",
  "text_muted": "#9ca3af",
  "legend_fill": "#6b7280"
}
```
