# yo-docs-mcp 设计文档

## 概述

基于关键词匹配的文档查询 MCP Server，使用 jieba 分词 + SQLite 倒排索引。

## 目录结构

```
mcps/yo-docs-mcp/
├── docs/                    # 文档存储目录
│   └── frontend/
│       └── vue/
│           └── fontawesome.md
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

## 依赖

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "node-jieba": "^0.0.10"
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
```

**注意**：使用 Node.js 内置 `node:sqlite` 模块（Node 22+），无需额外安装 better-sqlite3。

## 环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `DOCS_DIR` | 文档存储目录 | `./docs` |
| `DB_PATH` | 数据库文件路径 | `./data/docs.db` |

---

# SQLite 倒排索引设计（简化版）

## 概述

基于 SQLite 自建倒排索引，按关键词匹配数量排序。

## 约束

- 使用 Node.js 内置 `node:sqlite` 模块（Node 22+）
- **禁止使用外键**
- **禁止使用视图**

## node:sqlite API

```typescript
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('./data/docs.db');

// 执行 SQL
db.exec(`CREATE TABLE ...`);

// 查询
const rows = db.prepare(`SELECT * FROM ...`).all();

// 写入
db.prepare(`INSERT INTO ...`).run(params);

// 事务
db.transaction(() => {
  db.prepare(`INSERT ...`).run();
  db.prepare(`INSERT ...`).run();
})();
```

## 表结构

```sql
-- 文档表
CREATE TABLE documents (
    id TEXT PRIMARY KEY,              -- UUID
    type TEXT NOT NULL,
    lang TEXT NOT NULL,
    question TEXT NOT NULL,           -- 原始问题/关键词来源
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

-- 索引
CREATE INDEX IF NOT EXISTS idx_keywords_keyword ON keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_doc_keywords_keyword ON doc_keywords(keyword_id);
CREATE INDEX IF NOT EXISTS idx_documents_type_lang ON documents(type, lang);
```

## 写入流程

```typescript
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';

const db = new DatabaseSync('./data/docs.db');

function indexDocument(doc: {
  id: string;
  type: string;
  lang: string;
  question: string;
  doc_path: string;
  content: string;
}) {
  const terms = tokenize(doc.question + ' ' + doc.content);

  db.transaction(() => {
    // 插入文档
    db.prepare(`INSERT INTO documents (id, type, lang, question, doc_path)
                VALUES (?, ?, ?, ?, ?)`)
      .run(doc.id, doc.type, doc.lang, doc.question, doc.doc_path);

    for (const keyword of terms) {
      // 插入关键词（去重）
      db.prepare(`INSERT OR IGNORE INTO keywords (keyword) VALUES (?)`).run(keyword);

      // 获取 keyword_id
      const row = db.prepare(
        `SELECT id FROM keywords WHERE keyword = ?`
      ).get(keyword) as { id: number };

      // 插入关联
      db.prepare(`INSERT OR IGNORE INTO doc_keywords (doc_id, keyword_id) VALUES (?, ?)`)
        .run(doc.id, row.id);
    }
  })();
}
```

## 查询流程

```typescript
interface SearchResult {
  id: string;
  question: string;
  doc_path: string;
  match_count: number;
  matched_words: string;
}

function search(query: string, type: string, lang: string, limit = 5): SearchResult[] {
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  const placeholders = queryTerms.map(() => '?').join(',');

  const sql = `
    SELECT
      d.id,
      d.question,
      d.doc_path,
      COUNT(*) AS match_count,
      GROUP_CONCAT(k.keyword) AS matched_words
    FROM documents d
    JOIN doc_keywords dk ON d.id = dk.doc_id
    JOIN keywords k ON dk.keyword_id = k.id
    WHERE d.type = ? AND d.lang = ?
      AND k.keyword IN (${placeholders})
    GROUP BY d.id
    ORDER BY match_count DESC
    LIMIT ?
  `;

  return db.prepare(sql).all(type, lang, ...queryTerms, limit) as SearchResult[];
}
```

## MCP Tools

### 1. query - 关键词查询

**参数**：
```json
{
  "type": "前端",
  "lang": "vue",
  "query": "fontawesome 在 vue 中如何使用",
  "limit": 5
}
```

**返回**：
```json
{
  "results": [
    {
      "id": "uuid-xxx",
      "doc_path": "frontend/vue/fontawesome.md",
      "question": "Font Awesome 在 Vue 中如何使用",
      "match_count": 3,
      "matched_words": ["fontawesome", "vue", "使用"],
      "content": "..."
    }
  ]
}
```

### 2. list - 列出文档

**参数**：
```json
{
  "type": "前端",
  "lang": "vue"
}
```

**返回**：
```json
{
  "documents": [
    {
      "id": "uuid-xxx",
      "type": "前端",
      "lang": "vue",
      "question": "Font Awesome 在 Vue 中如何使用",
      "doc_path": "frontend/vue/fontawesome.md"
    }
  ]
}
```

### 3. write - 写入文档

**参数**：
```json
{
  "type": "前端",
  "lang": "vue",
  "question": "Font Awesome 在 Vue 中如何使用",
  "doc_path": "frontend/vue/fontawesome.md",
  "content": "# Font Awesome\n\n..."
}
```

**返回**：
```json
{
  "success": true,
  "id": "uuid-xxx",
  "keywords": ["fontawesome", "vue", "使用", "图标"]
}
```

## 核心模块说明

### database.ts

使用 `node:sqlite` 的 `DatabaseSync`，负责：
- 初始化三张表（documents, keywords, doc_keywords）
- 创建索引
- 导出 db 实例供其他模块使用

### tokenizer.ts

使用 `node-jieba` 分词，负责：
- 将文本切分为词语
- 过滤停用词（的、了、在 等）
- 去重并转小写
- 返回关键词数组

### 查询示例

```
query: "vue 如何使用 fontawesome"
分词: ["vue", "如何", "使用", "fontawesome"]
type: "前端", lang: "vue"

匹配结果（按 match_count DESC 排序）：
| doc_id | match_count | matched_words          |
|--------|-------------|------------------------|
| doc-1  | 3           | vue,使用,fontawesome   |
| doc-2  | 1           | vue                    |
| doc-3  | 1           | 使用                   |
```
