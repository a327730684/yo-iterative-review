import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
const __dirname = path.dirname(import.meta.filename);
const BASE_DIR = path.resolve(__dirname, '..');

const DB_PATH = process.env.DB_PATH || path.join(BASE_DIR, 'data', 'docs.db');

// 导出 DOCS_DIR 供其他模块使用
export const DOCS_DIR = process.env.DOCS_DIR || path.join(BASE_DIR, 'docs');

// 确保数据库目录存在
const dbDir = path.dirname(DB_PATH);
mkdirSync(dbDir, { recursive: true });

export const db = new DatabaseSync(DB_PATH);

/**
 * 在事务中执行同步操作
 * 使用 BEGIN / COMMIT / ROLLBACK 手动控制事务
 * （Node 25.9 的 DatabaseSync 没有 transaction 方法）
 */
export function runTransaction(fn: () => void): void {
  db.prepare('BEGIN').run();
  try {
    fn();
    db.prepare('COMMIT').run();
  } catch (err) {
    db.prepare('ROLLBACK').run();
    throw err;
  }
}

// 初始化表结构
export function initDatabase() {
  db.exec(`
    -- 文档表
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      lang TEXT NOT NULL,
      question TEXT NOT NULL,
      doc_path TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 词典表
    CREATE TABLE IF NOT EXISTS keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      keyword TEXT NOT NULL UNIQUE
    );

    -- 文档-关键词关联表（倒排索引）
    CREATE TABLE IF NOT EXISTS doc_keywords (
      doc_id TEXT NOT NULL,
      keyword_id INTEGER NOT NULL,
      PRIMARY KEY (doc_id, keyword_id)
    );

    -- 索引
    CREATE INDEX IF NOT EXISTS idx_keywords_keyword ON keywords(keyword);
    CREATE INDEX IF NOT EXISTS idx_doc_keywords_keyword ON doc_keywords(keyword_id);
    CREATE INDEX IF NOT EXISTS idx_documents_type_lang ON documents(type, lang);
  `);
}

// 模块加载时自动初始化表结构
initDatabase();

// 文档接口
export interface Document {
  id: string;
  type: string;
  lang: string;
  question: string;
  doc_path: string;
  created_at?: string;
}

// 查询结果接口
export interface SearchResult {
  id: string;
  question: string;
  doc_path: string;
  match_count: number;
  matched_words: string;
}

// 插入文档
export function insertDocument(doc: Document): void {
  db.prepare(`
    INSERT INTO documents (id, type, lang, question, doc_path)
    VALUES (?, ?, ?, ?, ?)
  `).run(doc.id, doc.type, doc.lang, doc.question, doc.doc_path);
}

// 插入关键词（去重）
export function insertKeyword(keyword: string): number {
  db.prepare(`INSERT OR IGNORE INTO keywords (keyword) VALUES (?)`).run(keyword);
  const row = db.prepare(`SELECT id FROM keywords WHERE keyword = ?`).get(keyword) as { id: number };
  return row.id;
}

// 插入文档-关键词关联
export function insertDocKeyword(docId: string, keywordId: number): void {
  db.prepare(`INSERT OR IGNORE INTO doc_keywords (doc_id, keyword_id) VALUES (?, ?)`).run(docId, keywordId);
}

// 查询文档列表
export function listDocuments(type?: string, lang?: string): Document[] {
  let sql = 'SELECT * FROM documents';
  const params: string[] = [];
  const conditions: string[] = [];

  if (type) {
    conditions.push('type = ?');
    params.push(type);
  }
  if (lang) {
    conditions.push('lang = ?');
    params.push(lang);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY created_at DESC';

  return db.prepare(sql).all(...params) as unknown as Document[];
}

// 关键词搜索
export function searchByKeywords(
  queryTerms: string[],
  type: string,
  lang: string,
  limit: number = 5
): SearchResult[] {
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

  return db.prepare(sql).all(type, lang, ...queryTerms, limit) as unknown as SearchResult[];
}

// 删除文档及其关键词关联
export function deleteDocument(docId: string): void {
  runTransaction(() => {
    db.prepare(`DELETE FROM doc_keywords WHERE doc_id = ?`).run(docId);
    db.prepare(`DELETE FROM documents WHERE id = ?`).run(docId);
  });
}
