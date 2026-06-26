import { mkdirSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  runTransaction,
  insertDocument,
  insertKeyword,
  insertDocKeyword,
  DOCS_DIR,
  type Document,
} from '../database.ts';
import { tokenize } from '../tokenizer.ts';

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

/**
 * 写入文档并建立索引
 */
export async function writeDocument(params: WriteParams): Promise<WriteResult> {
  const { type, lang, question, doc_name, content } = params;

  // 生成 UUID
  const id = randomUUID();

  // 写入文档文件（直接使用 doc_name.md 作为文件名，存储在 DOCS_DIR 下）
  const fullPath = path.join(DOCS_DIR, `${doc_name}.md`);
  mkdirSync(DOCS_DIR, { recursive: true });
  await fs.writeFile(fullPath, content, 'utf-8');

  const keywords = tokenize(question);

  // 事务写入数据库（事务内是同步操作）
  runTransaction(() => {
    // 插入文档记录
    const doc: Document = { id, type, lang, question, doc_path: `${doc_name}.md` };
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
