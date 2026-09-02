---
id: 10
name: Cloud Fabric
file: style-10-cloud-fabric.md
use: 云部署结构风。云蓝底 + 网格，表达 region/network/workload 的部署归属。
---

## 风格 10 · Cloud Fabric

云部署结构风。云蓝底 + 网格，表达 region/network/workload 的部署归属。

## 构图要点

- 容器加 deployment_kind: global/region/network 出徽章 + 彩色脊线
- 右上角徽章读 platform_profile 与 region 计数
- 节点 cloud_service 语义 v2 前落回通用节点

## Tokens（generator 唯一数据源，勿手改色值）

```json
{
  "name": "Cloud Fabric",
  "font_family": "Inter, 'Helvetica Neue', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
  "background": "#edf5fb",
  "shadow": true,
  "title_align": "left",
  "title_fill": "#102a43",
  "title_size": 27,
  "subtitle_fill": "#52718d",
  "subtitle_size": 13,
  "node_fill": "#ffffff",
  "node_stroke": "#9bb7cf",
  "node_radius": 12,
  "node_shadow": "url(#shadowSoft)",
  "section_fill": "rgba(255,255,255,0.54)",
  "section_stroke": "#7fa3c2",
  "section_dash": "7 5",
  "section_label_fill": "#315d7e",
  "section_sub_fill": "#7892a8",
  "title_divider": false,
  "section_upper": true,
  "arrow_width": 2.2,
  "arrow_colors": {
    "control": "#2563eb",
    "write": "#ea580c",
    "read": "#0891b2",
    "data": "#059669",
    "async": "#7c3aed",
    "feedback": "#db2777",
    "neutral": "#64748b"
  },
  "arrow_label_bg": "#f7fbfe",
  "arrow_label_opacity": 0.96,
  "arrow_label_fill": "#334e68",
  "type_label_fill": "#6b879d",
  "type_label_size": 10,
  "text_primary": "#102a43",
  "text_secondary": "#486581",
  "text_muted": "#829ab1",
  "legend_fill": "#486581",
  "canvas_treatment": "cloud"
}
```
