---
id: 5
name: Glassmorphism
file: style-5-glassmorphism.md
use: 玻璃拟态风。深色渐变底 + 半透明节点，适合产品官网、keynote。
---

## 风格 5 · Glassmorphism

玻璃拟态风。深色渐变底 + 半透明节点，适合产品官网、keynote。

## 构图要点

- 节点 fill 默认 rgba 白 12%，可覆盖强调色
- shadow 走 shadowGlass 大柔光，节点少而大时最好看
- 避免 >20 个节点，半透明叠加会糊

## Tokens（generator 唯一数据源，勿手改色值）

```json
{
  "name": "Glassmorphism",
  "font_family": "'Helvetica Neue', Helvetica, Arial, 'PingFang SC', 'Microsoft YaHei', 'Microsoft JhengHei', 'SimHei', sans-serif",
  "background": "#0f172a",
  "shadow": true,
  "title_align": "center",
  "title_fill": "#f8fafc",
  "title_size": 30,
  "subtitle_fill": "#cbd5e1",
  "subtitle_size": 14,
  "node_fill": "rgba(255,255,255,0.12)",
  "node_stroke": "rgba(255,255,255,0.28)",
  "node_radius": 18,
  "node_shadow": "url(#shadowGlass)",
  "section_fill": "rgba(255,255,255,0.05)",
  "section_stroke": "rgba(255,255,255,0.18)",
  "section_dash": "7 6",
  "section_label_fill": "#e2e8f0",
  "section_sub_fill": "#94a3b8",
  "title_divider": false,
  "section_upper": true,
  "arrow_width": 2.2,
  "arrow_colors": {
    "control": "#c084fc",
    "write": "#34d399",
    "read": "#60a5fa",
    "data": "#fb923c",
    "async": "#f472b6",
    "feedback": "#f59e0b",
    "neutral": "#cbd5e1"
  },
  "arrow_label_bg": "rgba(15,23,42,0.7)",
  "arrow_label_opacity": 1,
  "arrow_label_fill": "#e2e8f0",
  "type_label_fill": "#cbd5e1",
  "type_label_size": 12,
  "text_primary": "#f8fafc",
  "text_secondary": "#cbd5e1",
  "text_muted": "#94a3b8",
  "legend_fill": "#cbd5e1"
}
```
