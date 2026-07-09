import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { DocsDatabase, type Document, type SearchResult } from './database.ts';
import { tokenize } from './tokenizer.ts';

// ─── 公开类型 ──────────────────────────────────────────────

export interface YoDocsOptions {
  /** SQLite 数据库文件路径 */
  dbPath: string;
  /** 文档存储目录（Markdown 文件实际存放位置） */
  docsDir: string;
}

export interface WriteParams {
  type: string;
  lang: string;
  question: string;
  doc_name: string;
  content: string;
}

export interface WriteResult {
  success: boolean;
  id: string;
  keywords: string[];
}

export interface QueryParams {
  type: string;
  lang: string;
  query: string;
  limit?: number;
}

export interface QueryResultItem {
  id: string;
  question: string;
  doc_path: string;
  match_count: number;
  matched_words: string[];
  content: string;
}

export interface QueryResult {
  results: QueryResultItem[];
}

export interface ListParams {
  type?: string;
  lang?: string;
}

export interface ListResult {
  documents: Document[];
}

export interface DeleteParams {
  id: string;
}

export interface DeleteResult {
  success: boolean;
  id: string;
}

// ─── YoDocsDB 主类 ────────────────────────────────────────

/**
 * 基于关键词匹配的文档知识库。
 *
 * 使用 jieba 分词 + SQLite 倒排索引实现中文/英文混合的关键词搜索。
 *
 * @example
 * ```ts
 * const docs = new YoDocsDB({
 *   dbPath: './data/docs.db',
 *   docsDir: './docs',
 * });
 *
 * // 写入文档
 * await docs.write({
 *   type: '前端',
 *   lang: 'vue',
 *   question: 'Font Awesome 在 Vue 中如何使用',
 *   doc_name: 'fontawesome-usage',
 *   content: '# Font Awesome\n...',
 * });
 *
 * // 查询
 * const { results } = await docs.query({
 *   type: '前端', lang: 'vue', query: 'fontawesome 图标'
 * });
 *
 * // 关闭
 * docs.close();
 * ```
 */
export class YoDocsDB {
  private db: DocsDatabase;

  constructor(options: YoDocsOptions) {
    this.db = new DocsDatabase({
      dbPath: options.dbPath,
      docsDir: options.docsDir,
    });
  }

  /**
   * 写入文档并建立关键词索引。
   *
   * - 生成 UUID 作为文档 ID
   * - 将 Markdown 内容写入 `{docsDir}/{doc_name}.md`
   * - 对 question 分词，建立倒排索引
   */
  async write(params: WriteParams): Promise<WriteResult> {
    const { type, lang, question, doc_name, content } = params;

    const id = randomUUID();
    const fileName = `${doc_name}.md`;
    const fullPath = path.join(this.db.docsDir, fileName);

    // 确保子目录存在（如 docs/frontend/vue/）
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');

    // 分词
    const keywords = tokenize(question);

    // 写入文档记录 + 建立倒排索引
    this.db.insertDocument({ id, type, lang, question, doc_path: fileName });
    for (const keyword of keywords) {
      const keywordId = this.db.insertKeyword(keyword);
      this.db.insertDocKeyword(id, keywordId);
    }

    return { success: true, id, keywords };
  }

  /**
   * 按关键词查询文档。
   *
   * 对查询文本分词后，在倒排索引中匹配，按 match_count 降序排列。
   */
  async query(params: QueryParams): Promise<QueryResult> {
    const { type, lang, query, limit = 5 } = params;
    const queryTerms = tokenize(query);

    if (queryTerms.length === 0) {
      return { results: [] };
    }

    const rows = this.db.searchByKeywords(queryTerms, type, lang, limit);

    const results: QueryResultItem[] = [];
    for (const row of rows) {
      const docFullPath = path.join(this.db.docsDir, row.doc_path);
      const content = await fs.readFile(docFullPath, 'utf-8').catch(() => '');

      results.push({
        id: row.id,
        question: row.question,
        doc_path: row.doc_path,
        match_count: row.match_count,
        matched_words: row.matched_words ? row.matched_words.split(',') : [],
        content,
      });
    }

    return { results };
  }

  /**
   * 列出文档，可按 type、lang 筛选。
   */
  list(params: ListParams = {}): ListResult {
    const documents = this.db.listDocuments(params.type, params.lang);
    return { documents };
  }

  /**
   * 根据 ID 删除文档及其关键词关联。
   * 同时清理不再被引用的孤立关键词。
   */
  delete(params: DeleteParams): DeleteResult {
    const success = this.db.deleteDocument(params.id);
    return { success, id: params.id };
  }

  /**
   * 获取单条文档记录（不含内容）。
   */
  getById(id: string): Document | undefined {
    return this.db.getDocument(id);
  }

  /**
   * 对文本进行分词（暴露底层能力，供外部复用）。
   */
  tokenize(text: string): string[] {
    return tokenize(text);
  }

  /**
   * 关闭数据库连接，释放资源。
   */
  close(): void {
    this.db.close();
  }
}
