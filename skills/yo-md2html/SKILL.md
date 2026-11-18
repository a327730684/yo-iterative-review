---
name: yo-md-html
description: 将 Markdown 文件或目录批量转换为 HTML，Mermaid 图由 pele 预渲染为内联 SVG（渐变描边主题、默认缩小 85%），GitHub 风格样式和自动依赖安装。
---

# Markdown to HTML

## 触发条件
- 用户需要将 Markdown 文件转换为 HTML
- 用户要求生成 HTML 文档、静态页面或文档站点
- 用户要求处理 Markdown 中的 Mermaid 图表并渲染为可视化图形
- 用户提及转换 .md 文件为网页


## 工具详情

将单个 Markdown 文件或整个目录下的所有 Markdown 文件转换为 HTML。

**调用方式：**

```bash
node yo-md-html.js yo_md_html --input="<路径>" [--output="<目录>"] [--title="<标题>"] [--scale=<比例>]
```

**参数说明：**

- `input` (string, 必填): Markdown 文件路径或包含 .md 文件的目录路径
- `output` (string, 可选): 输出 HTML 的目录路径，默认为输入所在目录
- `title` (string, 可选): 自定义 HTML 页面标题，仅在单文件转换时生效
- `scale` (number, 可选): Mermaid 图显示等比缩放，默认 0.85

**示例：**

```bash
# 转换单个文件
node yo-md-html.js yo_md_html --input="docs/readme.md" --output="dist"

# 批量转换整个目录
node yo-md-html.js yo_md_html --input="docs" --output="site"

# 自定义标题
node yo-md-html.js yo_md_html --input="report.md" --title="项目报告"
```

## 多文档融合（multi-md-html.js）

将多个 Markdown 文件融合为一个带 Tabs 栏目的 HTML，点击 tab 切换不同文档。

**调用方式：**

```bash
node multi-md-html.js --input="<md1,md2,...>" [--tabs="<名1,名2,...>"] [--output="<目录>"] [--title="<标题>"] [--name="index"] [--scale=<比例>]
```

**参数说明：**

- `input` (string, 必填): 多个 Markdown 文件路径，`,` 分隔
- `tabs` (string, 可选): tab 栏目名，`,` 分隔，index 与 input 文件一一对应；默认使用文件名
- `output` (string, 可选): 输出目录，默认为第一个输入文件所在目录
- `title` (string, 可选): HTML 页面标题，默认 "文档"
- `name` (string, 可选): 输出文件名（不含扩展名），默认 "index"
- `scale` (number, 可选): Mermaid 图显示等比缩放，默认 0.85

**示例：**

```bash
node multi-md-html.js --input="docs/a.md,docs/b.md" --tabs="概览,API" --output="dist" --title="项目文档"
```

**实现要点：** 所有文档的 Mermaid 在生成时预渲染为内联 SVG，tab 切换只做显示隐藏，无浏览器端渲染。

## 特性
- **Mermaid 图表支持**：自动提取 ` ```mermaid ` 代码块，用 pele 在 Node 端预渲染为内联 SVG 嵌入 HTML， viewing 零 JS、离线可看；渲染失败保留原文本块
- **图主题**：白卡片容器＋蓝→玫红渐变描边＋白节点＋黑连线＋灰底边标签；12px 字、紧凑节点/层间距；默认等比缩小 85%（--scale 可调）
- **批量转换**：传入目录路径时，自动转换该目录下所有 `.md` 文件
- **自动依赖安装**：缺少 `marked` 或 `pele` 时脚本自动 `npm install --no-save` 后继续
- **内置样式**：生成 GitHub 风格的简洁样式，包含表格、代码块、引用等排版
