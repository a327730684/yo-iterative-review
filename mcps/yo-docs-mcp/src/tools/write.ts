import { mkdirSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  runTransaction,
  insertDocument,
  insertKeyword,
  insertDocKeyword,
  type Document,
} from '../database.ts';
import { tokenize } from '../tokenizer.ts';

const DOCS_DIR = process.env.DOCS_DIR || './docs';

export interface WriteParams {
  type: string;
  lang: string;
  question: string;
  doc_path: string;
  content: string;
}

export interface WriteResult {
  success: boolean;
  id: string;
  keywords: string[];
}

/**
 * 写入文档并建立索引
 */
export async function writeDocument(params: WriteParams): Promise<WriteResult> {
  const { type, lang, question, doc_path, content } = params;

  // 生成 UUID
  const id = randomUUID();

  // 写入文档文件（写入前确保子目录存在）
  const fullPath = path.join(DOCS_DIR, doc_path);
  const dir = path.dirname(fullPath);
  mkdirSync(dir, { recursive: true });
  await fs.writeFile(fullPath, content, 'utf-8');

  const keywords = tokenize(question + ' ' + content);

  // 事务写入数据库（事务内是同步操作）
  runTransaction(() => {
    // 插入文档记录
    const doc: Document = { id, type, lang, question, doc_path };
    insertDocument(doc);

    // 对每个分词结果：INSERT OR IGNORE 写入 keywords 表，再获取 id，INSERT OR IGNORE 写入 doc_keywords 关联表
    for (const keyword of keywords) {
      const keywordId = insertKeyword(keyword);
      insertDocKeyword(id, keywordId);
    }
  });

  return {
    success: true,
    id,
    keywords,
  };
}
