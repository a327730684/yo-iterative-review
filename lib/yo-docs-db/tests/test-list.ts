import { unlinkSync, rmSync } from 'node:fs';

const TEST_DB = `/tmp/yo-docs-lib-test-list-${Date.now()}.db`;
const TEST_DOCS = `/tmp/yo-docs-lib-test-list-docs-${Date.now()}`;

console.log('=== list 测试 ===\n');
console.log('测试数据库:', TEST_DB);

const { YoDocsDB } = await import('../src/index.ts');
const docs = new YoDocsDB({ dbPath: TEST_DB, docsDir: TEST_DOCS });

// 准备测试数据
await docs.write({
  type: '前端', lang: 'vue',
  question: 'Vue Router 配置', doc_name: 'router',
  content: '# Vue Router',
});
await docs.write({
  type: '前端', lang: 'vue',
  question: 'Font Awesome 使用', doc_name: 'fontawesome',
  content: '# Font Awesome',
});
await docs.write({
  type: '前端', lang: 'react',
  question: 'React Hooks 使用', doc_name: 'hooks',
  content: '# React Hooks',
});
await docs.write({
  type: '后端', lang: 'node',
  question: 'Node.js 数据库连接', doc_name: 'database',
  content: '# Node DB',
});

// 1. 按 type + lang 筛选
console.log('\n[1] list({ type: "前端", lang: "vue" })');
const r1 = docs.list({ type: '前端', lang: 'vue' });
console.log('结果数量:', r1.documents.length, '(期望: 2)');
r1.documents.forEach(d => console.log(`  → ${d.doc_path} | ${d.question}`));

// 2. 只按 type 筛选
console.log('\n[2] list({ type: "前端" })');
const r2 = docs.list({ type: '前端' });
console.log('结果数量:', r2.documents.length, '(期望: 3)');
r2.documents.forEach(d => console.log(`  → [${d.lang}] ${d.doc_path}`));

// 3. 只按 lang 筛选
console.log('\n[3] list({ lang: "vue" })');
const r3 = docs.list({ lang: 'vue' });
console.log('结果数量:', r3.documents.length, '(期望: 2)');
r3.documents.forEach(d => console.log(`  → [${d.type}] ${d.doc_path}`));

// 4. 无条件，返回全部
console.log('\n[4] list({})');
const r4 = docs.list({});
console.log('结果数量:', r4.documents.length, '(期望: 4)');
r4.documents.forEach(d => console.log(`  → [${d.type}/${d.lang}] ${d.doc_path}`));

// 5. 不存在的类型
console.log('\n[5] list({ type: "不存在的类型" })');
const r5 = docs.list({ type: '不存在的类型' });
console.log('结果数量:', r5.documents.length, '(期望: 0)');

docs.close();
unlinkSync(TEST_DB);
rmSync(TEST_DOCS, { recursive: true, force: true });
console.log('\n=== list 测试完成 ===');
