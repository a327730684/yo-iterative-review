import { db, type Document } from '../database.ts';

export interface ListParams {
  type?: string;
  lang?: string;
}

/**
 * 列出文档
 * 按 type、lang 条件查询 documents 表，若未提供条件则返回全部
 */
export function listDocuments(params: ListParams): { documents: Document[] } {
  const { type, lang } = params;
  const conditions: string[] = [];
  const queryParams: string[] = [];

  if (type) {
    conditions.push('type = ?');
    queryParams.push(type);
  }
  if (lang) {
    conditions.push('lang = ?');
    queryParams.push(lang);
  }

  let sql = 'SELECT id, type, lang, question, doc_path FROM documents';
  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }
  sql += ' ORDER BY created_at DESC';

  const documents = db.prepare(sql).all(...queryParams) as unknown as Document[];
  return { documents };
}

/**
 * 列出文档（工具入口）
 */
export function listDocumentsTool(params: ListParams): { documents: Document[] } {
  return listDocuments(params);
}
