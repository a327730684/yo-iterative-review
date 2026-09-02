# JSON 输入契约

与 fireworks-tech-graph 的 generate-from-template 数据格式兼容。

## 最小可跑示例

```json
{
  "style": 1, "title": "订单架构", "subtitle": "下单链路",
  "width": 960, "height": 600,
  "containers": [
    { "id": "edge", "x": 40, "y": 120, "width": 880, "height": 130, "label": "接入层" }
  ],
  "nodes": [
    { "id": "gw", "x": 80, "y": 160, "width": 160, "height": 60,
      "kind": "rect", "label": "API 网关", "sublabel": "路由 + 限流" },
    { "id": "db", "x": 640, "y": 320, "width": 160, "height": 90,
      "kind": "cylinder", "label": "订单库", "sublabel": "PostgreSQL" }
  ],
  "arrows": [
    { "source": "gw", "target": "db", "flow": "write", "label": "落单" }
  ],
  "legend": [ { "label": "写路径", "flow": "write" } ],
  "footer": "yo-tech-graph 示例"
}
```

节点给 x/y/width/height；箭头只给 source/target（布线自动），复杂场景用
corridor_x/y、route_points、source_port/target_port 微调（见下文）。

## 顶层字段

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `schema_version` | int | 1 | 必须为 1 |
| `mode` / `template_type` | string | CLI 的 type | 与 CLI 参数不一致时报错 |
| `style` / `visual_theme` | int或string | 1 | 编号/英文名/中文别名；两者同时给且冲突时报错 |
| `width` / `height` | number | 按 type | 画布尺寸；`viewBox: "0 0 W H"` 可同时覆盖两者 |
| `title` / `subtitle` | string | "Diagram"/"" | 居中风格标题在 y=56，左对齐风格在 y=48 |
| `composition` 或 `quality_profile` | string或object | "standard" | `standard` / `showcase` / `{profile, ...覆盖}`；showcase：单边弯≤2、零桥接、节点间距≥40px |
| `style_overrides` | object | - | 浅合并进风格 token（如换 accent 色） |
| `meta_left` / `meta_center` / `meta_right` | string | "" | 顶部 y=24 元信息条 |
| `window_controls` | bool或color[] | - | 仅风格 2：macOS 三色窗控点 |
| `blueprint_title_block` | object | - | 仅风格 3：右下角图纸标题栏（width/height/x/y/title/subtitle/left_caption/center_caption/right_caption） |
| `legend_orientation` | string | "vertical" | `vertical` / `horizontal` |
| `legend_position` | string | "bottom-left" | bottom-left / bottom-right / top-left / top-right |
| `legend_x` / `legend_y` | number | 自动 | 手动定位；`legend_locked: true` 后位置不可自动重定位 |
| `legend_box` / `legend_box_fill` / `legend_box_opacity` | - | - | 图例底衬 |
| `footer` / `footer_x` / `footer_y` / `footer_position` | - | 底部 | 页脚注释 |
| `diagram_type` | string | =mode | 写入 SVG root 属性 |
| `rough_seed` | int | 0 | 仅风格 9：手绘抖动种子（确定性） |

## containers[]

虚线分组框。`id`（必填、全图唯一）、`x`/`y`/`width`/`height`（必填）。

| 字段 | 默认 | 说明 |
|---|---|---|
| `label` / `subtitle` | "" | 左上角标题（风格 9-12 会转大写；`preserve_case: true` 保留原样） |
| `header_text` / `header_prefix` / `header_separator` | - | 自定义标题文本 / 前缀拼接（默认 " // "） |
| `rx` | 16 | 圆角 |
| `fill` / `stroke` / `stroke_dasharray` | 风格 token | 覆盖 |
| `header_height` | 有副标题 54 无 30 | 头部避让区高度 |
| `side_label` + `side_label_x/y/fill/size/weight/anchor` | - | 左外侧竖排标注 |
| `deployment_kind` | - | 仅风格 10：`global`/`region`/`network` 出徽章+彩色脊线 |

## nodes[]

| 字段 | 默认 | 说明 |
|---|---|---|
| `id` | node-NNN | 全图唯一，箭头用 id 引用 |
| `kind` | "rect" | 见下表 |
| `x` / `y` | 0 | 左上角（`circle` 为圆心） |
| `width` / `height` | 180 / 76 | |
| `r` | 50 | 仅 `circle` |
| `label` / `sublabel` | "" | 标题自动缩字号防溢出 |
| `type_label` | "" | 盒内顶部小类目标签 |
| `fill` / `stroke` / `stroke_width` / `rx` | 风格 token | 覆盖；`flat: true` 关阴影 |
| `filter` / `glow` | - | 显式滤镜 id / 风格 2 发光 `blue|purple|green|orange` |
| `title_size` | 自动 | 手动指定字号 |
| `tags[]` | - | 盒内底部小徽章 `{label, fill, stroke, text_fill}` |
| `auto_place` + `offset_y` | - | y 省略时自动排在标题下 |

**kind**：`rect`（默认）、`double_rect`（双层边框=编排器/核心）、`cylinder`（存储）、
`document`、`folder`、`terminal`（终端窗）、`hexagon`（网关/API）、`speech`（对话）、
`icon_box`（+`accent_fill` 内衬）、`user_avatar`（用户）、`bot`（机器人）、
`circle_cluster`（图数据库）、`circle`。
风格 9-12 的专属卡片（review_card / cloud_service / transit_* / ops_service / trace_span）
暂按通用节点渲染。

## arrows[]（别名 `edges`）

| 字段 | 默认 | 说明 |
|---|---|---|
| `source` / `target` | - | 节点 id；都省略时用 x1/y1/x2/y2 坐标箭头 |
| `x1` / `y1` / `x2` / `y2` | 0 | 无节点时的端点坐标 |
| `flow` | "control" | `control`(=main/api) `write` `read` `data` `async` `feedback` `neutral`，决定颜色与箭头 |
| `color` / `marker` / `stroke_width` / `stroke_dasharray` / `dashed` / `opacity` | 风格 token | 覆盖 |
| `label` | "" | 自动找无碰撞位置；`label_style: "badge"|"offset"`；`label_dx/label_dy` 微调 |
| `source_port` / `target_port` | 自动 | `left/right/top/bottom`，强制出边方向 |
| `corridor_x` / `corridor_y` | - | 走廊偏好（x/y 车道坐标数组），软约束 |
| `route_points` | - | `[[x,y],...]` 强制路点：不可落在障碍内、必须保序、正交可达 |
| `routing_padding` / `port_clearance` | 24 / max(18, pad×0.85) | 障碍膨胀 / 端口逃逸距离 |
| `protocol` | "" | 仅风格 9：双行标签副行 |
| `via` | "" | 仅风格 10：label 缺省时的替代文案 |
| `transit_type` | - | 仅风格 11：`rail` 出轨道套壳+方向箭头 |
| `critical` + `critical_hop`/`critical_hops` | - | 仅风格 12：金色 glow + 跳数徽章 |
| `edge_kind` / `topic_id` | "flow"/"" | 写入 data-* 属性 |

## legend[]

`{ "label": "写路径", "flow": "write" }`；`color` 可直接指定（否则按 flow 取风格色）。

## 错误与退出码

- 生成成功：exit 0，stdout 打印 `✓ SVG generated: <path>`
- 校验失败：exit 1，stderr 报错误；给了 `--report` 时写 `{ok:false, issues:[...]}`
- 常见错误码：`COMPOSITION_QUALITY`（构图门禁，附明细）、`PORT_CAPACITY`、
  `route waypoint … intersects an obstacle`、`no collision-free orthogonal route`、
  `STYLE_SELECTOR`（风格名不识别）、`duplicate node id`
