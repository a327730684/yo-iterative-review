import fs from 'fs/promises';
import path from 'path';
import { searchByKeywords } from '../database.ts';
import { tokenize } from '../tokenizer.ts';

const DOCS_DIR = process.env.DOCS_DIR || './docs';

export interface QueryParams {
  type: string;
  lang: string;
  query: string;
  limit?: number;
}

export interface QueryResult {
  id: string;
  question: string;
  doc_path: string;
  match_count: number;
  matched_words: string[];
  content: string;
}

/**
 * 查询文档
 */
export async function queryDocuments(params: QueryParams): Promise<{ results: QueryResult[] }> {
  const { type, lang, query, limit = 5 } = params;

  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) {
    return { results: [] };
  }

  // 搜索
  const rows = searchByKeywords(queryTerms, type, lang, limit);

  // 读取文档内容
  const results: QueryResult[] = [];
  for (const row of rows) {
    const docFullPath = path.join(DOCS_DIR, row.doc_path);
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
