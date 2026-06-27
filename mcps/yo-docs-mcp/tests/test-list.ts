import { unlinkSync } from 'fs';

// 必须在 import 之前设置环境变量
const TEST_DB = `/tmp/yo-docs-test-list-${Date.now()}.db`;
process.env.DB_PATH = TEST_DB;

console.log('=== list.ts 测试 ===\n');
console.log('测试数据库:', TEST_DB);

const { db, insertDocument } = await import('../src/database.ts');
const { listDocuments } = await import('../src/tools/list.ts');

// 准备测试数据
insertDocument({
  id: 'doc-1', type: '前端', lang: 'vue',
  question: 'Vue Router 配置', doc_path: 'frontend/vue/router.md',
});
insertDocument({
  id: 'doc-2', type: '前端', lang: 'vue',
  question: 'Font Awesome 使用', doc_path: 'frontend/vue/fontawesome.md',
});
insertDocument({
  id: 'doc-3', type: '前端', lang: 'react',
  question: 'React Hooks 使用', doc_path: 'frontend/react/hooks.md',
});
insertDocument({
  id: 'doc-4', type: '后端', lang: 'node',
  question: 'Node.js 数据库连接', doc_path: 'backend/node/database.md',
});

// 1. 按 type + lang 筛选
console.log('\n[1] listDocuments({ type: "前端", lang: "vue" })');
const r1 = listDocuments({ type: '前端', lang: 'vue' });
console.log('结果数量:', r1.documents.length, '(期望: 2)');
r1.documents.forEach(d => console.log(`  → ${d.doc_path} | ${d.question}`));

// 2. 只按 type 筛选
console.log('\n[2] listDocuments({ type: "前端" })');
const r2 = listDocuments({ type: '前端' });
console.log('结果数量:', r2.documents.length, '(期望: 3)');
r2.documents.forEach(d => console.log(`  → [${d.lang}] ${d.doc_path}`));

// 3. 只按 lang 筛选
console.log('\n[3] listDocuments({ lang: "vue" })');
const r3 = listDocuments({ lang: 'vue' });
console.log('结果数量:', r3.documents.length, '(期望: 2)');
r3.documents.forEach(d => console.log(`  → [${d.type}] ${d.doc_path}`));

// 4. 无条件，返回全部
console.log('\n[4] listDocuments({})');
const r4 = listDocuments({});
console.log('结果数量:', r4.documents.length, '(期望: 4)');
r4.documents.forEach(d => console.log(`  → [${d.type}/${d.lang}] ${d.doc_path}`));

// 5. 不存在的类型
console.log('\n[5] listDocuments({ type: "不存在的类型" })');
const r5 = listDocuments({ type: '不存在的类型' });
console.log('结果数量:', r5.documents.length, '(期望: 0)');

// 清理
db.close();
unlinkSync(TEST_DB);
console.log('\n=== list 测试完成 ===');
