import { unlinkSync, rmSync } from 'node:fs';

const TEST_DB = `/tmp/yo-docs-lib-test-del-${Date.now()}.db`;
const TEST_DOCS = `/tmp/yo-docs-lib-test-del-docs-${Date.now()}`;

console.log('=== delete 测试 ===\n');
console.log('测试数据库:', TEST_DB);

const { YoDocsDB } = await import('../src/index.ts');
const docs = new YoDocsDB({ dbPath: TEST_DB, docsDir: TEST_DOCS });

// 1. 写入 3 篇文档
console.log('\n--- [1] 写入 3 篇文档 ---');
const w1 = await docs.write({
  type: '前端', lang: 'vue',
  question: 'Vue Router 配置',
  doc_name: 'router',
  content: '# Vue Router\n\nVue Router 是 Vue 的官方路由。',
});
const w2 = await docs.write({
  type: '前端', lang: 'vue',
  question: 'Font Awesome 使用',
  doc_name: 'fontawesome',
  content: '# Font Awesome\n\nFont Awesome 是图标库。',
});
const w3 = await docs.write({
  type: '前端', lang: 'react',
  question: 'React Hooks 使用',
  doc_name: 'hooks',
  content: '# React Hooks\n\nuseState 是 Hook。',
});
console.log('写入 id:', w1.id, w2.id, w3.id);

// 2. 删除 doc1
console.log('\n--- [2] 删除 doc1 ---');
const del1 = docs.delete({ id: w1.id });
console.log('删除结果:', del1);

// 3. 验证 doc1 已不在列表
console.log('\n--- [3] 验证 list ---');
const list = docs.list({ type: '前端', lang: 'vue' });
console.log('剩余 vue 文档数:', list.documents.length, '(期望: 1)');
list.documents.forEach(d => console.log(`  → ${d.doc_path}`));

// 4. 验证查询也不返回 doc1
console.log('\n--- [4] 验证 query ---');
const q = await docs.query({ type: '前端', lang: 'vue', query: 'Vue Router 配置' });
console.log('查询 "Vue Router 配置" 结果数:', q.results.length, '(期望: 0，因为已被删除)');

// 5. 删除不存在的 id
console.log('\n--- [5] 删除不存在的 id ---');
const del2 = docs.delete({ id: 'non-existent-id' });
console.log('结果:', del2, '(期望: success=false)');

// 6. 再次删除 doc1（已删除）
console.log('\n--- [6] 重复删除 doc1 ---');
const del3 = docs.delete({ id: w1.id });
console.log('结果:', del3, '(期望: success=false)');

// 7. 删除全部后检查
console.log('\n--- [7] 删除全部 ---');
docs.delete({ id: w2.id });
docs.delete({ id: w3.id });
const finalList = docs.list({});
console.log('剩余文档数:', finalList.documents.length, '(期望: 0)');

docs.close();
unlinkSync(TEST_DB);
rmSync(TEST_DOCS, { recursive: true, force: true });
console.log('\n=== delete 测试完成 ===');
