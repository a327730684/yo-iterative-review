# yo-docs-mcp

基于关键词匹配的文档查询 MCP Server，使用 jieba 分词 + SQLite 倒排索引。为 Agent 提供知识存储与查询能力。

## 功能特性

- **关键词查询**：支持中文分词，按匹配度排序
- **文档管理**：写入、列出、删除文档
- **本地存储**：SQLite 数据库 + 文件系统
- **MCP 协议**：兼容 Model Context Protocol

## 与 Agent 对话使用指南

### 1. 添加文档

当 Agent 在开发过程中积累了可复用的知识（如某个库的使用方式、架构方案、最佳实践等），可以将这些内容写入 yo-docs-mcp 作为持久化知识。

**使用场景**：
- 用户让 Agent 完成某个任务后，希望将解决方案保存下来供后续查询
- 团队沉淀通用知识（如 Font Awesome 在 Vue 中的使用、雪花算法生成唯一 ID 等）

**示例指令**：
```
请把这段 Font Awesome 的使用说明写入 yo-docs-mcp，lang 为 vue，type 为前端，question 为"如何在 Vue 3 中使用 Font Awesome"
```

Agent 会调用：
```json
{
  "tool": "mcp__yo-docs-mcp__write",
  "params": {
    "type": "前端",
    "lang": "vue",
    "question": "如何在 Vue 3 中使用 Font Awesome",
    "doc_name": "fontawesome-usage",
    "content": "..."
  }
}
```

### 2. 查询文档

当 Agent 遇到不确定的实现方式时，可以先查询 yo-docs-mcp 中是否已有相关知识。

**使用场景**：
- Agent 配置文件（如 `frontend-vue.md`）中指引："使用 `mcp__yo-docs-mcp__query` 查询 Font Awesome 的使用方法"
- 用户询问某个技术问题，Agent 先检索已有文档

**示例指令**：
```
请查询 yo-docs-mcp 中关于 Font Awesome 的文档，lang 为 vue
```

Agent 会调用：
```json
{
  "tool": "mcp__yo-docs-mcp__query",
  "params": {
    "type": "前端",
    "lang": "vue",
    "query": "Font Awesome"
  }
}
```

### 3. 查看文档列表

需要了解当前已有哪些文档时，可以列出文档。

**示例指令**：
```
列出 yo-docs-mcp 中所有前端 vue 相关的文档
```

Agent 会调用：
```json
{
  "tool": "mcp__yo-docs-mcp__list",
  "params": {
    "type": "前端",
    "lang": "vue"
  }
}
```

### 4. 删除文档

当文档过时或需要更新时，可以删除旧文档。

**示例指令**：
```
删除 yo-docs-mcp 中 ID 为 xxx 的文档
```

Agent 会调用：
```json
{
  "tool": "mcp__yo-docs-mcp__delete",
  "params": {
    "id": "xxx"
  }
}
```

## Agent 配置建议

在 Agent 配置文件中，可以将具体的知识内容替换为查询指引，让 Agent 动态查询而非硬编码。例如：

```markdown
## Font Awesome

使用 `mcp__yo-docs-mcp__query` 查询 Font Awesome 的使用方法（lang: `vue`，query: `Font Awesome`）
```

这样做的好处：
- Agent 配置文件更精简，只保留规范约定
- 具体实现细节通过查询获取，易于维护和更新
- 多个 Agent 可以共享同一份知识库

## 工具参数速查

| 工具 | 必填参数 | 说明 |
|------|----------|------|
| `query` | type, lang, query | 按关键词查询文档 |
| `list` | 无（type/lang 可选） | 列出文档 |
| `write` | type, lang, question, doc_name, content | 写入文档并建立索引 |
| `delete` | id | 按 ID 删除文档 |

## 架构详情

项目结构、数据库设计等技术细节请参考 [architecture.md](./architecture.md)。
