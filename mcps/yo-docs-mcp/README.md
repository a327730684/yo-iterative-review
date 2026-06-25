# yo-docs-mcp

基于关键词匹配的文档查询 MCP Server，使用 jieba 分词 + SQLite 倒排索引。

## 功能特性

- **关键词查询**：支持中文分词，按匹配度排序
- **文档管理**：写入、列出文档
- **本地存储**：SQLite 数据库 + 文件系统
- **MCP 协议**：兼容 Model Context Protocol

## 环境要求

- Node.js 22+（使用内置 `node:sqlite` 模块）
- Python 3.x（node-jieba 依赖）

## 安装

```bash
npm install
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `DOCS_DIR` | 文档存储目录 | `./docs` |
| `DB_PATH` | 数据库文件路径 | `./data/docs.db` |

## 使用方法

### 编译

```bash
npm run build
```

### 启动

```bash
npm start
```

## MCP 工具

### query - 关键词查询

根据关键词查询文档，使用 jieba 分词匹配。

**参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| type | string | 文档类型，如：前端、后端 |
| lang | string | 文档语言/框架，如：vue、react、node |
| query | string | 查询关键词 |
| limit | number | 返回结果数量限制（可选，默认 5） |

**示例**：
```json
{
  "type": "前端",
  "lang": "vue",
  "query": "fontawesome 在 vue 中如何使用"
}
```

### list - 列出文档

列出文档，可按类型和语言筛选。

**参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| type | string | 文档类型筛选（可选） |
| lang | string | 文档语言/框架筛选（可选） |

**示例**：
```json
{
  "type": "前端",
  "lang": "vue"
}
```

### write - 写入文档

写入文档并建立关键词索引。

**参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| type | string | 文档类型 |
| lang | string | 文档语言/框架 |
| question | string | 原始问题/关键词来源 |
| doc_path | string | 文档存储路径（相对于 docs 目录） |
| content | string | 文档内容（Markdown 格式） |

**示例**：
```json
{
  "type": "前端",
  "lang": "vue",
  "question": "Font Awesome 在 Vue 中如何使用",
  "doc_path": "frontend/vue/fontawesome.md",
  "content": "# Font Awesome\n\n..."
}
```

## 项目结构

```
mcps/yo-docs-mcp/
├── docs/                    # 文档存储目录
│   └── frontend/
│       └── vue/
├── data/
│   └── docs.db             # SQLite 数据库
├── src/
│   ├── index.ts            # MCP Server 入口
│   ├── database.ts         # SQLite 操作
│   ├── tokenizer.ts        # jieba 分词
│   └── tools/
│       ├── query.ts        # 查询工具
│       ├── list.ts         # 列表工具
│       └── write.ts        # 写入工具
├── package.json
├── tsconfig.json
└── README.md
```

## 数据库设计

### 表结构

```sql
-- 文档表
CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    lang TEXT NOT NULL,
    question TEXT NOT NULL,
    doc_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 词典表
CREATE TABLE keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL UNIQUE
);

-- 文档-关键词关联表（倒排索引）
CREATE TABLE doc_keywords (
    doc_id TEXT NOT NULL,
    keyword_id INTEGER NOT NULL,
    PRIMARY KEY (doc_id, keyword_id)
);
```

### 查询原理

1. 对查询文本进行 jieba 分词
2. 在 keywords 表中查找匹配的关键词
3. 通过 doc_keywords 关联表找到对应文档
4. 按匹配关键词数量降序排序返回结果

## License

MIT
