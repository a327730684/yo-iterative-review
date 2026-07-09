// YoDocsDB — 基于关键词匹配的文档知识库
//
// 使用 jieba 分词 + SQLite 倒排索引，提供中文/英文混合的关键词搜索。
//
// ```ts
// import { YoDocsDB } from 'yo-docs-db';
//
// const docs = new YoDocsDB({ dbPath: './data/docs.db', docsDir: './docs' });
// await docs.write({ type: '前端', lang: 'vue', question: '...', doc_name: '...', content: '...' });
// const { results } = await docs.query({ type: '前端', lang: 'vue', query: '关键词' });
// docs.close();
// ```

export { YoDocsDB } from './yo-docs-db.ts';
export type {
  YoDocsOptions,
  WriteParams,
  WriteResult,
  QueryParams,
  QueryResult,
  QueryResultItem,
  ListParams,
  ListResult,
  DeleteParams,
  DeleteResult,
} from './yo-docs-db.ts';
export type { Document, SearchResult } from './database.ts';
