# yo-docs-mcp 架构文档

基于关键词匹配的文档查询 MCP Server，使用 jieba 分词 + SQLite 倒排索引。

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
4. 按匹配关键词的数量降序排序返回结果

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

## 编译运行

```bash
npm run build
npm start
```

## License

MIT
