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

## SQLite 数据库设计

详见 [sqlite-inverted-index.md](./sqlite-inverted-index.md)

### 表概览

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

### 约束

- **禁止使用外键**
- **禁止使用视图**
- 使用 `node:sqlite` 内置模块

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

## 核心代码

### database.ts（使用 node:sqlite）

```typescript
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(process.env.DB_PATH || './data/docs.db');

// 初始化表
db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    lang TEXT NOT NULL,
    question TEXT NOT NULL,
    doc_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS doc_keywords (
    doc_id TEXT NOT NULL,
    keyword_id INTEGER NOT NULL,
    PRIMARY KEY (doc_id, keyword_id)
  );

  CREATE INDEX IF NOT EXISTS idx_keywords_keyword ON keywords(keyword);
  CREATE INDEX IF NOT EXISTS idx_doc_keywords_keyword ON doc_keywords(keyword_id);
  CREATE INDEX IF NOT EXISTS idx_documents_type_lang ON documents(type, lang);
`);

export { db };
```

### tokenizer.ts

```typescript
import jieba from 'node-jieba';

const stopwords = new Set([
  '的', '了', '在', '是', '我', '有', '和', '就', '不', '人', '都', '一', 
  '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', 
  '没有', '看', '好', '自己', '这', '他', '她', '它', '们', '那', '些'
]);

export function tokenize(text: string): string[] {
  const words = jieba.cut(text);
  return [
    ...new Set(
      words
        .map(w => w.toLowerCase().trim())
        .filter(w => w.length > 1 && !stopwords.has(w))
    )
  ];
}
```

### query 实现

```typescript
import { db } from '../database';
import { tokenize } from '../tokenizer';
import fs from 'fs/promises';
import path from 'path';

export async function queryDocuments(params: {
  type: string;
  lang: string;
  query: string;
  limit?: number;
}) {
  const { type, lang, query, limit = 5 } = params;
  const queryTerms = tokenize(query);
  
  if (queryTerms.length === 0) return { results: [] };
  
  const placeholders = queryTerms.map(() => '?').join(',');
  
  const sql = `
    SELECT 
      d.id, d.question, d.doc_path,
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
  
  const rows = db.prepare(sql).all(type, lang, ...queryTerms, limit) as any[];
  
  // 读取文档内容
  const results = [];
  for (const row of rows) {
    const content = await fs.readFile(
      path.join(process.env.DOCS_DIR || './docs', row.doc_path), 
      'utf-8'
    ).catch(() => '');
    
    results.push({
      ...row,
      matched_words: row.matched_words?.split(',') || [],
      content,
    });
  }
  
  return { results };
}
```

## 使用示例

```
用户: Font Awesome 在 Vue 中怎么用？

Agent 调用:
{
  "tool": "query",
  "args": { "type": "前端", "lang": "vue", "query": "Font Awesome Vue 使用" }
}

处理:
1. 分词: ["fontawesome", "vue", "使用"]
2. 查询匹配文档
3. 返回内容
```
