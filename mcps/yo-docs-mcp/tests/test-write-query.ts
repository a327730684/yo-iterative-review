import { unlinkSync, rmSync, existsSync } from 'fs';

// 必须在 import 之前设置环境变量
const TEST_DB = `/tmp/yo-docs-test-wq-${Date.now()}.db`;
const TEST_DOCS = `/tmp/yo-docs-test-docs-${Date.now()}`;
process.env.DB_PATH = TEST_DB;
process.env.DOCS_DIR = TEST_DOCS;

console.log('=== write.ts + query.ts 联合测试 ===\n');
console.log('测试数据库:', TEST_DB);
console.log('测试文档目录:', TEST_DOCS);

const { writeDocument } = await import('../src/tools/write.ts');
const { queryDocuments } = await import('../src/tools/query.ts');

// 1. 写入文档 1
console.log('\n--- [1] 写入文档: Font Awesome in Vue ---');
const w1 = await writeDocument({
  type: '前端',
  lang: 'vue',
  question: 'Font Awesome 在 Vue 中如何使用',
  doc_path: 'frontend/vue/fontawesome.md',
  content: '# Font Awesome\n\n在 Vue 项目中使用 Font Awesome 图标库，可以通过 npm 安装。',
});
console.log('success:', w1.success);
console.log('id:', w1.id);
console.log('keywords:', w1.keywords);

// 2. 写入文档 2
console.log('\n--- [2] 写入文档: Vue Router ---');
const w2 = await writeDocument({
  type: '前端',
  lang: 'vue',
  question: 'Vue Router 如何配置路由',
  doc_path: 'frontend/vue/router.md',
  content: '# Vue Router\n\nVue Router 是 Vue 的官方路由，使用 createRouter 创建实例。',
});
console.log('success:', w2.success);
console.log('keywords:', w2.keywords);

// 3. 写入文档 3（不同类型）
console.log('\n--- [3] 写入文档: React Hooks ---');
const w3 = await writeDocument({
  type: '前端',
  lang: 'react',
  question: 'React 如何使用 Hooks',
  doc_path: 'frontend/react/hooks.md',
  content: '# React Hooks\n\nuseState 和 useEffect 是最常用的 Hooks。',
});
console.log('success:', w3.success);
console.log('keywords:', w3.keywords);

// 4. 查询：vue fontawesome（应匹配 doc1）
console.log('\n--- [4] 查询: vue fontawesome (type=前端, lang=vue) ---');
const q1 = await queryDocuments({ type: '前端', lang: 'vue', query: 'vue fontawesome 如何使用' });
console.log('结果数量:', q1.results.length);
for (const r of q1.results) {
  console.log(`  → ${r.doc_path} | match_count=${r.match_count} | matched=${JSON.stringify(r.matched_words)}`);
}

// 5. 查询：路由（应匹配 doc2）
console.log('\n--- [5] 查询: 路由 (type=前端, lang=vue) ---');
const q2 = await queryDocuments({ type: '前端', lang: 'vue', query: '如何配置路由' });
console.log('结果数量:', q2.results.length);
for (const r of q2.results) {
  console.log(`  → ${r.doc_path} | match_count=${r.match_count} | matched=${JSON.stringify(r.matched_words)}`);
}

// 6. 查询：空关键词
console.log('\n--- [6] 查询: 空的了（全停用词）---');
const q3 = await queryDocuments({ type: '前端', lang: 'vue', query: '的 了 在' });
console.log('结果数量:', q3.results.length, '(期望: 0)');

// 7. 查询：跨类型不应匹配
console.log('\n--- [7] 查询: hooks (type=前端, lang=vue) ---');
const q4 = await queryDocuments({ type: '前端', lang: 'vue', query: 'hooks' });
console.log('结果数量:', q4.results.length, '(期望: 0，因为 hooks 在 react 文档中)');

// 8. 查询：跨类型匹配
console.log('\n--- [8] 查询: hooks (type=前端, lang=react) ---');
const q5 = await queryDocuments({ type: '前端', lang: 'react', query: 'hooks 如何使用' });
console.log('结果数量:', q5.results.length);
for (const r of q5.results) {
  console.log(`  → ${r.doc_path} | match_count=${r.match_count} | matched=${JSON.stringify(r.matched_words)}`);
}

// 9. limit 参数
console.log('\n--- [9] 查询: vue (type=前端, lang=vue, limit=1) ---');
const q6 = await queryDocuments({ type: '前端', lang: 'vue', query: 'vue', limit: 1 });
console.log('结果数量:', q6.results.length, '(期望: 最多 1)');

// 验证文件已写入磁盘
console.log('\n--- [10] 验证文件写入 ---');
const { readFileSync } = await import('fs');
const file1 = readFileSync(`${TEST_DOCS}/frontend/vue/fontawesome.md`, 'utf-8');
console.log('fontawesome.md 存在:', file1.length > 0);
const file2 = readFileSync(`${TEST_DOCS}/frontend/react/hooks.md`, 'utf-8');
console.log('hooks.md 存在:', file2.length > 0);

// 清理
const { db } = await import('../src/database.ts');
db.close();
unlinkSync(TEST_DB);
rmSync(TEST_DOCS, { recursive: true, force: true });
console.log('\n=== write + query 测试完成 ===');
