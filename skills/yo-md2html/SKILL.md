---
name: yo-md-html
description: 将 Markdown 文件或目录批量转换为 HTML，支持 Mermaid 图表渲染、GitHub 风格样式和自动依赖安装。
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
node yo-md-html.js yo_md_html --input="<路径>" [--output="<目录>"] [--title="<标题>"]
```

**参数说明：**

- `input` (string, 必填): Markdown 文件路径或包含 .md 文件的目录路径
- `output` (string, 可选): 输出 HTML 的目录路径，默认为输入所在目录
- `title` (string, 可选): 自定义 HTML 页面标题，仅在单文件转换时生效

**示例：**

```bash
# 转换单个文件
node yo-md-html.js yo_md_html --input="docs/readme.md" --output="dist"

# 批量转换整个目录
node yo-md-html.js yo_md_html --input="docs" --output="site"

# 自定义标题
node yo-md-html.js yo_md_html --input="report.md" --title="项目报告"
```

## 特性
- **Mermaid 图表支持**：自动提取 ` ```mermaid ` 代码块，引入 Mermaid.js v10 CDN，浏览器打开即可渲染
- **批量转换**：传入目录路径时，自动转换该目录下所有 `.md` 文件
- **自动依赖安装**：如果环境中缺少 `marked` 库，脚本会自动 `npm install --no-save marked`
- **内置样式**：生成 GitHub 风格的简洁样式，包含表格、代码块、引用等排版
