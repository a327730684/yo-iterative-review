import { unlinkSync, rmSync, existsSync } from 'node:fs';
import { readFileSync } from 'node:fs';

const TEST_DB = `/tmp/yo-docs-lib-test-wq-${Date.now()}.db`;
const TEST_DOCS = `/tmp/yo-docs-lib-test-docs-${Date.now()}`;

console.log('=== write + query 联合测试 ===\n');
console.log('测试数据库:', TEST_DB);
console.log('测试文档目录:', TEST_DOCS);

const { YoDocsDB } = await import('../src/index.ts');
const docs = new YoDocsDB({ dbPath: TEST_DB, docsDir: TEST_DOCS });

// 1. 写入文档 1
console.log('\n--- [1] 写入文档: Font Awesome in Vue ---');
const w1 = await docs.write({
  type: '前端',
  lang: 'vue',
  question: 'Font Awesome 在 Vue 中如何使用',
  doc_name: 'fontawesome-usage',
  content: '# Font Awesome\n\n在 Vue 项目中使用 Font Awesome 图标库，可以通过 npm 安装。',
});
console.log('success:', w1.success);
console.log('id:', w1.id);
console.log('keywords:', w1.keywords);

// 2. 写入文档 2
console.log('\n--- [2] 写入文档: Vue Router ---');
const w2 = await docs.write({
  type: '前端',
  lang: 'vue',
  question: 'Vue Router 如何配置路由',
  doc_name: 'vue-router-config',
  content: '# Vue Router\n\nVue Router 是 Vue 的官方路由，使用 createRouter 创建实例。',
});
console.log('success:', w2.success);
console.log('keywords:', w2.keywords);

// 3. 写入文档 3（不同类型）
console.log('\n--- [3] 写入文档: React Hooks ---');
const w3 = await docs.write({
  type: '前端',
  lang: 'react',
  question: 'React 如何使用 Hooks',
  doc_name: 'react-hooks',
  content: '# React Hooks\n\nuseState 和 useEffect 是最常用的 Hooks。',
});
console.log('success:', w3.success);
console.log('keywords:', w3.keywords);

// 4. 查询：vue fontawesome（应匹配 doc1）
console.log('\n--- [4] 查询: vue fontawesome (type=前端, lang=vue) ---');
const q1 = await docs.query({ type: '前端', lang: 'vue', query: 'vue fontawesome 如何使用' });
console.log('结果数量:', q1.results.length);
for (const r of q1.results) {
  console.log(`  → ${r.doc_path} | match_count=${r.match_count} | matched=${JSON.stringify(r.matched_words)}`);
}

// 5. 查询：路由（应匹配 doc2）
console.log('\n--- [5] 查询: 路由 (type=前端, lang=vue) ---');
const q2 = await docs.query({ type: '前端', lang: 'vue', query: '如何配置路由' });
console.log('结果数量:', q2.results.length);
for (const r of q2.results) {
  console.log(`  → ${r.doc_path} | match_count=${r.match_count} | matched=${JSON.stringify(r.matched_words)}`);
}

// 6. 查询：空关键词
console.log('\n--- [6] 查询: 空的了（全停用词）---');
const q3 = await docs.query({ type: '前端', lang: 'vue', query: '的 了 在' });
console.log('结果数量:', q3.results.length, '(期望: 0)');

// 7. 查询：跨类型不应匹配
console.log('\n--- [7] 查询: hooks (type=前端, lang=vue) ---');
const q4 = await docs.query({ type: '前端', lang: 'vue', query: 'hooks' });
console.log('结果数量:', q4.results.length, '(期望: 0，因为 hooks 在 react 文档中)');

// 8. 查询：跨类型匹配
console.log('\n--- [8] 查询: hooks (type=前端, lang=react) ---');
const q5 = await docs.query({ type: '前端', lang: 'react', query: 'hooks 如何使用' });
console.log('结果数量:', q5.results.length);
for (const r of q5.results) {
  console.log(`  → ${r.doc_path} | match_count=${r.match_count} | matched=${JSON.stringify(r.matched_words)}`);
}

// 9. limit 参数
console.log('\n--- [9] 查询: vue (type=前端, lang=vue, limit=1) ---');
const q6 = await docs.query({ type: '前端', lang: 'vue', query: 'vue', limit: 1 });
console.log('结果数量:', q6.results.length, '(期望: 最多 1)');

// 10. 验证文件已写入磁盘
console.log('\n--- [10] 验证文件写入 ---');
const file1 = readFileSync(`${TEST_DOCS}/fontawesome-usage.md`, 'utf-8');
console.log('fontawesome-usage.md 存在:', file1.length > 0);
const file2 = readFileSync(`${TEST_DOCS}/react-hooks.md`, 'utf-8');
console.log('react-hooks.md 存在:', file2.length > 0);

// 11. 验证查询返回 content（"font" 匹配 jieba 分词后的 "font"）
console.log('\n--- [11] 验证查询返回 content ---');
const q7 = await docs.query({ type: '前端', lang: 'vue', query: 'font 图标' });
if (q7.results.length > 0) {
  console.log('content 长度:', q7.results[0].content.length, '(期望 > 0)');
  console.log('content 前 30 字:', q7.results[0].content.slice(0, 30));
} else {
  console.log('未匹配到结果（font 在分词后被拆为 font + awesome）');
}

docs.close();
unlinkSync(TEST_DB);
rmSync(TEST_DOCS, { recursive: true, force: true });
console.log('\n=== write + query 测试完成 ===');
