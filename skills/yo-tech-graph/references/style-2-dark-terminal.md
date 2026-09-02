---
id: 2
name: Dark Terminal
file: style-2-dark-terminal.md
use: 深色终端风。适合 GitHub README、开发者文章、CLI/Agent 主题。
---

## 风格 2 · Dark Terminal

深色终端风。适合 GitHub README、开发者文章、CLI/Agent 主题。

## 构图要点

- 背景走 terminalGradient 深蓝黑，文本自动用浅色
- 节点可加 glow: blue/purple/green/orange 发光滤镜
- window_controls: true 可加 macOS 三色窗控点

## Tokens（generator 唯一数据源，勿手改色值）

```json
{
  "name": "Dark Terminal",
  "font_family": "'SF Mono', 'Fira Code', Menlo, 'Microsoft YaHei', 'SimHei', monospace",
  "background": "#0f172a",
  "shadow": false,
  "title_align": "center",
  "title_fill": "#e2e8f0",
  "title_size": 30,
  "subtitle_fill": "#94a3b8",
  "subtitle_size": 14,
  "node_fill": "#111827",
  "node_stroke": "#334155",
  "node_radius": 10,
  "node_shadow": "",
  "section_fill": "rgba(15,23,42,0.28)",
  "section_stroke": "#334155",
  "section_dash": "7 6",
  "section_label_fill": "#38bdf8",
  "section_sub_fill": "#64748b",
  "title_divider": false,
  "section_upper": true,
  "arrow_width": 2.3,
  "arrow_colors": {
    "control": "#a855f7",
    "write": "#22c55e",
    "read": "#38bdf8",
    "data": "#fb7185",
    "async": "#f59e0b",
    "feedback": "#f97316",
    "neutral": "#94a3b8"
  },
  "arrow_label_bg": "#0f172a",
  "arrow_label_opacity": 0.92,
  "arrow_label_fill": "#cbd5e1",
  "type_label_fill": "#64748b",
  "type_label_size": 12,
  "text_primary": "#e2e8f0",
  "text_secondary": "#94a3b8",
  "text_muted": "#64748b",
  "legend_fill": "#94a3b8"
}
```
