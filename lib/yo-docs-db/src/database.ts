import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

// ─── 类型定义 ──────────────────────────────────────────────

export interface Document {
  id: string;
  type: string;
  lang: string;
  question: string;
  doc_path: string;
  created_at?: string;
}

export interface SearchResult {
  id: string;
  question: string;
  doc_path: string;
  match_count: number;
  matched_words: string;
}

export interface DatabaseOptions {
  /** SQLite 数据库文件路径 */
  dbPath: string;
  /** 文档存储目录 */
  docsDir: string;
}

// ─── Database 类 ───────────────────────────────────────────

/**
 * SQLite 数据库封装，管理倒排索引的存储与查询。
 *
 * 用法：
 * ```ts
 * const db = new DocsDatabase({ dbPath: './data/docs.db', docsDir: './docs' });
 * db.insertDocument({ ... });
 * db.close();
 * ```
 */
export class DocsDatabase {
  private db: DatabaseSync;
  public readonly docsDir: string;

  constructor(opts: DatabaseOptions) {
    const { dbPath, docsDir } = opts;

    // 确保数据库目录存在
    mkdirSync(path.dirname(dbPath), { recursive: true });
    // 确保文档目录存在
    mkdirSync(docsDir, { recursive: true });

    this.docsDir = docsDir;
    this.db = new DatabaseSync(dbPath);
    this.initSchema();
  }

  // ──  schema  ────────────────────────────────────────────

  private initSchema(): void {
    this.db.exec(`
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

  // ──  事务  ──────────────────────────────────────────────

  private runTransaction(fn: () => void): void {
    this.db.prepare('BEGIN').run();
    try {
      fn();
      this.db.prepare('COMMIT').run();
    } catch (err) {
      this.db.prepare('ROLLBACK').run();
      throw err;
    }
  }

  // ──  写入  ──────────────────────────────────────────────

  insertDocument(doc: Document): void {
    this.db.prepare(`
      INSERT INTO documents (id, type, lang, question, doc_path)
      VALUES (?, ?, ?, ?, ?)
    `).run(doc.id, doc.type, doc.lang, doc.question, doc.doc_path);
  }

  /** 插入关键词（去重），返回 keyword id */
  insertKeyword(keyword: string): number {
    this.db.prepare(`INSERT OR IGNORE INTO keywords (keyword) VALUES (?)`).run(keyword);
    const row = this.db.prepare(`SELECT id FROM keywords WHERE keyword = ?`).get(keyword) as { id: number };
    return row.id;
  }

  insertDocKeyword(docId: string, keywordId: number): void {
    this.db.prepare(`INSERT OR IGNORE INTO doc_keywords (doc_id, keyword_id) VALUES (?, ?)`).run(docId, keywordId);
  }

  // ──  查询  ──────────────────────────────────────────────

  listDocuments(type?: string, lang?: string): Document[] {
    let sql = 'SELECT id, type, lang, question, doc_path, created_at FROM documents';
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

    return this.db.prepare(sql).all(...params) as unknown as Document[];
  }

  searchByKeywords(
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

    return this.db.prepare(sql).all(type, lang, ...queryTerms, limit) as unknown as SearchResult[];
  }

  getDocument(id: string): Document | undefined {
    return this.db.prepare(
      'SELECT id, type, lang, question, doc_path FROM documents WHERE id = ?'
    ).get(id) as Document | undefined;
  }

  // ──  删除  ──────────────────────────────────────────────

  deleteDocument(docId: string): boolean {
    const doc = this.db.prepare('SELECT id FROM documents WHERE id = ?').get(docId);
    if (!doc) return false;

    this.runTransaction(() => {
      // 删除关联
      this.db.prepare(`DELETE FROM doc_keywords WHERE doc_id = ?`).run(docId);
      // 删除文档
      this.db.prepare(`DELETE FROM documents WHERE id = ?`).run(docId);

      // 清理不再被引用的孤立关键词
      const keywordIds = this.db
        .prepare('SELECT keyword_id FROM doc_keywords WHERE doc_id = ?')
        .all(docId) as { keyword_id: number }[];
      for (const { keyword_id } of keywordIds) {
        const refCount = this.db
          .prepare('SELECT COUNT(*) AS cnt FROM doc_keywords WHERE keyword_id = ?')
          .get(keyword_id) as { cnt: number };
        if (refCount.cnt === 0) {
          this.db.prepare('DELETE FROM keywords WHERE id = ?').run(keyword_id);
        }
      }
    });

    return true;
  }

  // ──  资源释放  ─────────────────────────────────────────

  close(): void {
    this.db.close();
  }
}
