# Voyo Work Plugin

提供两种代码开发工作流：迭代审查循环和结构化编排流程。

## 安装

```bash
claude plugin marketplace add https://github.com/a327730684/yo-iterative-review
claude plugin install voyоwork@voyo-marketplace
```

## 使用

### 1. 迭代审查循环

通过双 Agent（实现者 + 审查者）迭代协作，自动完成"写代码 → 审代码 → 改代码"循环，直到代码通过审查。

```
/voyowork:iterative <需求描述>
```

示例：

```
/voyowork:iterative 实现一个 JWT 用户登录 API，要求邮箱+密码验证、bcrypt 哈希、返回 access/refresh token
```

插件会自动：
1. 实现代码 → 2. 审查者列出缺陷 → 3. 实现者逐条判断 ACCEPT/REJECT → 4. 循环直到通过或达到上限

### 2. 结构化编排流程

通过 MCP 工具管理设计和实施计划，将需求拆解为设计和任务计划，分派给 subAgent 执行。

```
/voyowork:orchestrate <需求描述>
```

示例：

```
/voyowork:orchestrate 实现一个用户管理模块，包含注册、登录、个人资料编辑功能
```

流程：
1. 创建需求设计文档 (`<feature_name>_design.md`)
2. 创建实现计划表 (`<feature_name>_plan.md`)
3. 选择 subAgent 执行代码实施
4. 按模块逐步完成，更新计划进度

## 工具集

### yo-web-search

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

### yo-md2html

将 Markdown 文件或目录批量转换为 HTML，支持 Mermaid 图表渲染、GitHub 风格样式。

```bash
node yo-md-html.js yo_md_html --input="docs/readme.md" --output="dist"
```

**环境变量：** 无

### yo-pdf2md

将 PDF 文件逐页转为图片，通过多模态大模型识别后输出标准 Markdown。

```bash
node yo-pdf2md.ts yo_pdf2md --input="/path/to/doc.pdf" --output="/path/to/doc.md"
```

**环境变量：**
- `yo_base_url` — API 基础 URL（Anthropic Messages API 兼容格式）
- `yo_api_key` — API 密钥
- `yo_multi_model` — 多模态模型名称

