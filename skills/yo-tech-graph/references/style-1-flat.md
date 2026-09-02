---
id: 1
name: Flat Icon
file: style-1-flat.md
use: 默认风格。白底扁平卡片，适合博客、文档、汇报、大多数通用架构/流程图。
---

## 风格 1 · Flat Icon

默认风格。白底扁平卡片，适合博客、文档、汇报、大多数通用架构/流程图。

## 构图要点

- 节点白底灰边 + 浅蓝容器虚线框，信息密度可以放最高
- 需要强调的节点给 fill/stroke 覆盖色（如琥珀 #fff7ed/#f97316）
- 标题居中；节点标题自动缩字号，不必手工调 title_size

## Tokens（generator 唯一数据源，勿手改色值）

```json
{
  "name": "Flat Icon",
  "font_family": "'Helvetica Neue', Helvetica, Arial, 'PingFang SC', 'Microsoft YaHei', 'Microsoft JhengHei', 'SimHei', sans-serif",
  "background": "#ffffff",
  "shadow": true,
  "title_align": "center",
  "title_fill": "#111827",
  "title_size": 30,
  "subtitle_fill": "#6b7280",
  "subtitle_size": 14,
  "node_fill": "#ffffff",
  "node_stroke": "#d1d5db",
  "node_radius": 10,
  "node_shadow": "url(#shadowSoft)",
  "section_fill": "none",
  "section_stroke": "#dbe5f1",
  "section_dash": "6 5",
  "section_label_fill": "#2563eb",
  "section_sub_fill": "#94a3b8",
  "title_divider": false,
  "section_upper": true,
  "arrow_width": 2.4,
  "arrow_colors": {
    "control": "#7c3aed",
    "write": "#10b981",
    "read": "#2563eb",
    "data": "#f97316",
    "async": "#7c3aed",
    "feedback": "#ef4444",
    "neutral": "#6b7280"
  },
  "arrow_label_bg": "#ffffff",
  "arrow_label_opacity": 0.94,
  "arrow_label_fill": "#6b7280",
  "type_label_fill": "#9ca3af",
  "type_label_size": 12,
  "text_primary": "#111827",
  "text_secondary": "#6b7280",
  "text_muted": "#94a3b8",
  "legend_fill": "#6b7280"
}
```
