---
name: yo-tech-graph
description: >-
  生成技术图表 SVG：软件架构、数据流、流程图、时序图、对比矩阵、时间线、
  思维导图、Agent/内存架构、UML（类/用例/状态机）、ER 图、网络拓扑，共 14 种
  类型 × 12 种视觉风格
---

# yo-tech-graph

模型写 **JSON**（描述节点/箭头/容器），脚本渲染成带自动正交布线、避障、
跳线弧、碰撞检查的 SVG。**禁止逐行手写 SVG**——坐标计算和布线全部交给 generator。

## 工作流

1. **分类 + 选风格**：判断图类型（见下方类型表），选风格编号（默认 1）。
   读对应 `references/style-<N>-*.md` 拿构图要点。
2. **写 JSON**：描述 title/containers/nodes/arrows/legend。**写前必读
   `references/json-contract.md`**（开头有最小可跑示例，其后是完整字段表）。

3. **生成**：JSON 写到临时文件（Windows 下避免内联引号问题），然后：

   ```bash
   node "<skill-dir>/scripts/generate-from-template.js" <type> <output.svg> @data.json
   ```

   - `<type>`：architecture | data-flow | flowchart | sequence | comparison | timeline |
     mind-map | agent | memory | use-case | class | state-machine | er-diagram | network-topology
   - 可选 `--style <序号|英文名|中文别名>`（覆盖 JSON 里的 style）、
     `--profile showcase`（更严格构图门禁）、`--report r.json`（布局报告：每条边路由、弯数、桥接点）
   - 生成失败会报明确错误（COMPOSITION_QUALITY / PORT_CAPACITY / 路点越障等），
     按错误信息修 JSON 后重跑，不要绕过校验。

4. **转 PNG 并自检**：用 **voyowork:svg2png** skill 把 SVG 转 PNG（禁止
   cairosvg / Playwright / Puppeteer），然后 Read PNG 检查：
   - **内容偏差**：图是否表达了需求——节点/关系有无缺失、错误、多余
   - **布局质量**：箭头是否穿过节点盒、标签是否互相碰撞或压线、文字是否
     溢出或不可读（深色风格配浅色 fill）、整体是否混乱（过挤、大片失衡空白）
5. **修正闭环**：有问题按问题改 JSON 回到第 3 步重生成、再查，最多两轮。
   满意后返回 SVG 与 PNG 的文件路径。

## 执行方式：建议整个流程交给子 agent

读图会占用大量视觉 token，且"生成者自检"比"旁观者审查"更容易定位问题。
因此**建议 spawn 一个子 agent 承担完整绘制闭环**（Agent 工具，prompt 给它：
绘图需求 + 本 SKILL.md 的路径让它先读 + 输出目录）。子 agent 按上述工作流
绘制 → 转 PNG → 自检 → 修正，满意后**只返回 SVG 与 PNG 的路径和一句话说明**——
图片不进主会话，主会话只拿路径。

## 风格

| # | 名称 | 底色 | 适用 |
|---|------|------|------|
| 1 | Flat Icon（默认） | 白 | 博客、文档、汇报 |
| 2 | Dark Terminal | 深蓝黑 | GitHub、开发者文章 |
| 3 | Blueprint | 工程蓝 | 架构文档、基础设施 |
| 4 | Notion Clean | 白·极简 | wiki、Confluence |
| 5 | Glassmorphism | 深色渐变 | 产品站、keynote |
| 6 | Claude Official | 暖米 | AI 产品图 |
| 7 | OpenAI Official | 纯白 | OpenAI 风格产品图 |
| 8 | Dark Luxury | 纯黑+金 | 高端评审、精品文档 |
| 9 | C4 Review Canvas | 暖纸 | C4 评审、ADR |
| 10 | Cloud Fabric | 云蓝 | 云部署归属 |
| 11 | Event Transit | 米纸 | 事件流/topic 拓扑 |
| 12 | Ops Pulse | 深海军蓝 | golden signals、SRE |

每个风格的构图要点与 token 见 `references/style-<N>-*.md`。JSON 里 `style` 可写编号、
英文名或中文别名（如 `"style": "c4 评审画布"`）。

## 类型与默认画布

类型只是分类：决定默认 viewBox 与 SVG 标注，布线渲染与类型无关。JSON 带
`width/height` 可覆盖画布，构图完全由 nodes/arrows/containers 决定。

| type | 默认画布 | 构图要点 |
|---|---|---|
| `architecture` | 960×600 | 水平分层（客户端→网关→服务→存储），虚线容器分组同层 |
| `data-flow` | 960×600 | 每条箭头标数据类型；主路径 `stroke_width: 2.5`；控制流 `dashed: true` |
| `flowchart` | 960×640 | 自上而下；label ≤3 词，细节放 sublabel；网格对齐 x≈120、y≈120 |
| `sequence` | 960×700 | 参与者顶部横排，消息箭头按时间自上而下；group 用容器框 |
| `comparison` | 960×620 | 列=方案行=属性，小节点做单元格；上限 5 列，超出拆图 |
| `timeline` | 960×520 | X=时间 Y=条目，圆角 rect 按区间摆，里程碑圆点+上方标注 |
| `mind-map` | 960×620 | 中心节点居中，一级分支均布 360/N，二级 30-45° 偏移 |
| `agent` | 960×700 | 输入→核心→记忆→工具→输出分层；推理循环用 `flow: feedback` |
| `memory` | 960×720 | 写/读路径分开（write 绿 / read 蓝），存储用 cylinder |
| `use-case` | 960×600 | 参与者在边界外，«include»/«extend» 用虚线+label |
| `class` | 960×700 | type_label(类型)/label(类名)/sublabel(成员)；继承实线、实现虚线 |
| `state-machine` | 960×620 | 初态小实心圆、终态双圈；守卫 `[条件]` 放 label；复合态容器嵌套 |
| `er-diagram` | 960×680 | 实体 rect 标 1/N；弱实体 double_rect；主键字段排首行 |
| `network-topology` | 960×620 | 自上而下（Internet→边缘→核心→接入）；子网用容器；带宽标线上 |

布局通用：同层节点间距 ≥80px、层间 ≥120px、画布留白 ≥40px；文字 label 尽量
≤14 个半角字符（超长自动缩字号）。

## 布线与修正

- 箭头默认自动正交布线 + 端口吸附 + 跨线自动跳线弧；同端口多条边自动扇出。
- 挤了再调，不要预防性微调：`corridor_x/corridor_y`（走廊偏好）、`source_port/target_port`
  （出边方向）、`route_points`（强制路点，最后手段）。
- 每个节点自带 `flat: true` 可关阴影；`fill/stroke` 覆盖颜色时注意与所选风格底色协调
  （浅色 fill 配深色风格会导致文字不可读）。
- 常见错误：`COMPOSITION_QUALITY`（弯数/拉伸/桥接超预算 → 疏散布局或降低连接密度）、
  `no collision-free orthogonal route`（节点间过挤 → 拉开间距或加大画布）、
  `PORT_CAPACITY`（一个边端口挤太多箭头 → 换端口方向）。

## 输出

- 默认输出 SVG 到当前目录；PNG 由 voyowork:svg2png 生成同名 `.png`。
- `--report` 产出布局报告（边的路由坐标/弯数/交叉），可用于程序化诊断。
