import { unlinkSync, rmSync } from 'fs';

// 必须在 import 之前设置环境变量
const TEST_DB = `/tmp/yo-docs-test-del-${Date.now()}.db`;
const TEST_DOCS = `/tmp/yo-docs-test-del-docs-${Date.now()}`;
process.env.DB_PATH = TEST_DB;
process.env.DOCS_DIR = TEST_DOCS;

console.log('=== delete.ts 测试 ===\n');
console.log('测试数据库:', TEST_DB);

const { writeDocument } = await import('../src/tools/write.ts');
const { deleteDocumentTool } = await import('../src/tools/delete.ts');
const { queryDocuments } = await import('../src/tools/query.ts');
const { listDocuments } = await import('../src/tools/list.ts');
const { db } = await import('../src/database.ts');

// 1. 写入 3 篇文档
console.log('\n--- [1] 写入 3 篇文档 ---');
const w1 = await writeDocument({
  type: '前端', lang: 'vue',
  question: 'Vue Router 配置',
  doc_path: 'frontend/vue/router.md',
  content: '# Vue Router\n\nVue Router 是 Vue 的官方路由。',
});
const w2 = await writeDocument({
  type: '前端', lang: 'vue',
  question: 'Font Awesome 使用',
  doc_path: 'frontend/vue/fontawesome.md',
  content: '# Font Awesome\n\nFont Awesome 是图标库。',
});
const w3 = await writeDocument({
  type: '前端', lang: 'react',
  question: 'React Hooks 使用',
  doc_path: 'frontend/react/hooks.md',
  content: '# React Hooks\n\nuseState 是 Hook。',
});
console.log('写入 id:', w1.id, w2.id, w3.id);

// 2. 查看删除前状态
console.log('\n--- [2] 删除前 ---');
const kwCountBefore = db.prepare('SELECT COUNT(*) AS cnt FROM keywords').get() as { cnt: number };
const dkCountBefore = db.prepare('SELECT COUNT(*) AS cnt FROM doc_keywords').get() as { cnt: number };
console.log('keywords 数量:', kwCountBefore.cnt);
console.log('doc_keywords 数量:', dkCountBefore.cnt);

// 3. 删除 doc1
console.log('\n--- [3] 删除 doc1 ---');
const del1 = await deleteDocumentTool({ id: w1.id });
console.log('删除结果:', del1);

// 4. 验证 doc1 已不在列表
console.log('\n--- [4] 验证 list ---');
const list = listDocuments({ type: '前端', lang: 'vue' });
console.log('剩余 vue 文档数:', list.documents.length, '(期望: 1)');
list.documents.forEach(d => console.log(`  → ${d.doc_path}`));

// 5. 验证查询也不返回 doc1
console.log('\n--- [5] 验证 query ---');
const q = await queryDocuments({ type: '前端', lang: 'vue', query: 'Vue Router 配置' });
console.log('查询 "Vue Router 配置" 结果数:', q.results.length, '(期望: 0，因为已被删除)');

// 6. 验证 doc_keywords 已清理
console.log('\n--- [6] 验证 doc_keywords ---');
const dkAfter = db.prepare('SELECT COUNT(*) AS cnt FROM doc_keywords').get() as { cnt: number };
console.log('doc_keywords 数量:', dkAfter.cnt, '(应少于删除前的', dkCountBefore.cnt, ')');

// 7. 验证孤立 keywords 已清理
console.log('\n--- [7] 验证孤立 keywords 已清理 ---');
const kwCountAfter = db.prepare('SELECT COUNT(*) AS cnt FROM keywords').get() as { cnt: number };
console.log('keywords 数量:', kwCountAfter.cnt, '(应少于或等于删除前的', kwCountBefore.cnt, ')');

// 8. 删除不存在的 id
console.log('\n--- [8] 删除不存在的 id ---');
const del2 = await deleteDocumentTool({ id: 'non-existent-id' });
console.log('结果:', del2, '(期望: success=false)');

// 9. 再次删除 doc1（已删除）
console.log('\n--- [9] 重复删除 doc1 ---');
const del3 = await deleteDocumentTool({ id: w1.id });
console.log('结果:', del3, '(期望: success=false)');

// 10. 删除全部后检查
console.log('\n--- [10] 删除全部 ---');
await deleteDocumentTool({ id: w2.id });
await deleteDocumentTool({ id: w3.id });
const finalDoc = db.prepare('SELECT COUNT(*) AS cnt FROM documents').get() as { cnt: number };
const finalKw = db.prepare('SELECT COUNT(*) AS cnt FROM keywords').get() as { cnt: number };
const finalDk = db.prepare('SELECT COUNT(*) AS cnt FROM doc_keywords').get() as { cnt: number };
console.log('documents:', finalDoc.cnt, '(期望: 0)');
console.log('doc_keywords:', finalDk.cnt, '(期望: 0)');
console.log('keywords:', finalKw.cnt, '(期望: 0，全部孤立已清理)');

// 清理
db.close();
unlinkSync(TEST_DB);
rmSync(TEST_DOCS, { recursive: true, force: true });
console.log('\n=== delete 测试完成 ===');
