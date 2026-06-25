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
CREATE INDEX idx_keywords_keyword ON keywords(keyword);
CREATE INDEX idx_doc_keywords_keyword ON doc_keywords(keyword_id);
CREATE INDEX idx_documents_type_lang ON documents(type, lang);
```

## 写入流程

```typescript
import { DatabaseSync } from 'node:sqlite';

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

## 示例

### 数据

| doc_id | question | keywords |
|--------|----------|----------|
| doc-1 | Font Awesome 在 Vue 中如何使用 | fontawesome, vue, 使用, 图标 |
| doc-2 | Vue Router 如何配置 | vue, router, 配置 |
| doc-3 | React 如何使用 hooks | react, 使用, hooks |

### 查询

```
query: "vue 如何使用 fontawesome"
分词: ["vue", "如何", "使用", "fontawesome"]
type: "前端", lang: "vue"
```

### 匹配结果

| doc_id | match_count | matched_words |
|--------|-------------|---------------|
| doc-1 | 3 | vue,使用,fontawesome |
| doc-2 | 1 | vue |
| doc-3 | 1 | 使用 |

按 match_count DESC 排序，返回 top n。
