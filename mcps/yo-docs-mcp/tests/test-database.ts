import { unlinkSync, existsSync } from 'fs';

// 必须在 import database 之前设置 DB_PATH（动态导入）
const TEST_DB = `/tmp/yo-docs-test-db-${Date.now()}.db`;
process.env.DB_PATH = TEST_DB;

console.log('=== database.ts 测试 ===\n');
console.log('测试数据库:', TEST_DB);

// 动态导入，确保 DB_PATH 生效
const { db, insertDocument, insertKeyword, insertDocKeyword, searchByKeywords, listDocuments: dbListDocuments, deleteDocument } =
  await import('../src/database.ts');

// 1. 验证表已创建
const tables = db.prepare(
  `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`
).all();
console.log('\n[1] 表列表:', tables.map((t: any) => t.name));

// 2. 验证索引已创建
const indexes = db.prepare(
  `SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%' ORDER BY name`
).all();
console.log('[2] 索引列表:', indexes.map((i: any) => i.name));

// 3. insertDocument
insertDocument({
  id: 'doc-1',
  type: '前端',
  lang: 'vue',
  question: 'Vue Router 如何配置',
  doc_path: 'frontend/vue/router.md',
});
const docs = db.prepare('SELECT * FROM documents').all();
console.log('\n[3] 插入文档后:', docs);

// 4. insertKeyword（新建）
const kw1Id = insertKeyword('vue');
console.log('\n[4] 新关键词 vue → id:', kw1Id);

// 5. insertKeyword（重复，去重）
const kw2Id = insertKeyword('vue');
console.log('[5] 重复 vue → id:', kw2Id, '(应与[4]相同)');

// 6. insertDocKeyword
insertDocKeyword('doc-1', kw1Id);
const docKws = db.prepare('SELECT * FROM doc_keywords').all();
console.log('\n[6] doc_keywords:', docKws);

// 7. searchByKeywords
const results = searchByKeywords(['vue'], '前端', 'vue');
console.log('\n[7] 搜索 [vue]:', results);

// 8. searchByKeywords（无匹配）
const noResults = searchByKeywords(['react'], '前端', 'vue');
console.log('[8] 搜索 [react]（无匹配）:', noResults);

// 9. listDocuments（按条件）
const listed = dbListDocuments('前端', 'vue');
console.log('\n[9] listDocuments(前端, vue):', listed);

// 10. listDocuments（无条件）
const allDocs = dbListDocuments();
console.log('[10] listDocuments() 全部:', allDocs);

// 11. deleteDocument
deleteDocument('doc-1');
const afterDelete = db.prepare('SELECT * FROM documents').all();
const afterDeleteKw = db.prepare('SELECT * FROM doc_keywords').all();
console.log('\n[11] 删除 doc-1 后 documents:', afterDelete);
console.log('[11] 删除 doc-1 后 doc_keywords:', afterDeleteKw);

// 清理测试数据库
db.close();
unlinkSync(TEST_DB);
console.log('\n=== database 测试完成 ===');
