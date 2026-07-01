# 工具集（Skills）

## yo-web-search

联网搜索工具，基于阿里云百炼 WebSearch API，可查询百科知识、时事新闻、天气等信息。

```bash
node yo-web-search.js bailian_web_search --query="人工智能" --count=10
```

**环境变量：** `ALI_API_TOKEN` — 百炼 API Key

**禁用 Claude Code 内置 WebSearch：** 在 `settings.json` 中添加：

```json
{
  "disallowedTools": ["WebSearch"]
}
```

## yo-md2html

将 Markdown 文件或目录批量转换为 HTML，支持 Mermaid 图表渲染、GitHub 风格样式。

```bash
node yo-md-html.js yo_md_html --input="docs/readme.md" --output="dist"
```

**环境变量：** 无

## yo-pdf2md

将 PDF 文件逐页转为图片，通过多模态大模型识别后输出标准 Markdown。

```bash
node yo-pdf2md.ts yo_pdf2md --input="/path/to/doc.pdf" --output="/path/to/doc.md"
```

**环境变量：**
- `yo_base_url` — API 基础 URL（Anthropic Messages API 兼容格式）
- `yo_api_key` — API 密钥
- `yo_multi_model` — 多模态模型名称
