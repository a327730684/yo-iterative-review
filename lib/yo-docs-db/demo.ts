/**
 * Demo：写入示例数据并查询，产出持久化的数据库文件和文档。
 *
 * 运行：node --experimental-strip-types demo.ts
 *
 * 产出：
 *   - .yo_ddb/data/docs.db     SQLite 数据库
 *   - .yo_ddb/docs/             Markdown 文档目录
 */
import { YoDocsDB } from './src/index.ts';
import path from 'node:path';

const BASE_DIR = path.join(process.cwd(), '.yo_ddb');
const DB_PATH = path.join(BASE_DIR, 'data', 'docs.db');
const DOCS_DIR = path.join(BASE_DIR, 'docs');

const docs = new YoDocsDB({ dbPath: DB_PATH, docsDir: DOCS_DIR });

console.log('📝 写入示例文档...\n');

// 1. Font Awesome in Vue
const w1 = await docs.write({
  type: '前端',
  lang: 'vue',
  question: 'Font Awesome 在 Vue 中如何使用',
  doc_name: 'fontawesome-usage',
  content: `# Font Awesome 在 Vue 中的使用

在 Vue 项目中使用 Font Awesome 图标库，可以通过 npm 安装。

## 安装

\`\`\`bash
npm install @fortawesome/fontawesome-svg-core
npm install @fortawesome/free-solid-svg-icons
npm install @fortawesome/vue-fontawesome
\`\`\`

## 配置

在 main.js 中注册：

\`\`\`js
import { library } from '@fortawesome/fontawesome-svg-core';
import { faUser, faHome } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

library.add(faUser, faHome);
app.component('font-awesome-icon', FontAwesomeIcon);
\`\`\`

## 使用

\`\`\`html
<font-awesome-icon icon="user" />
<font-awesome-icon icon="home" />
\`\`\`
`,
});
console.log(`✅ [1] ${w1.id} — 关键词: ${JSON.stringify(w1.keywords)}`);

// 2. Vue Router
const w2 = await docs.write({
  type: '前端',
  lang: 'vue',
  question: 'Vue Router 如何配置路由',
  doc_name: 'vue-router-config',
  content: `# Vue Router 配置路由

Vue Router 是 Vue 的官方路由管理器。

## 安装

\`\`\`bash
npm install vue-router@4
\`\`\`

## 配置

\`\`\`js
import { createRouter, createWebHistory } from 'vue-router';
import Home from './views/Home.vue';

const routes = [
  { path: '/', component: Home },
  { path: '/about', component: () => import('./views/About.vue') },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
\`\`\`
`,
});
console.log(`✅ [2] ${w2.id} — 关键词: ${JSON.stringify(w2.keywords)}`);

// 3. React Hooks
const w3 = await docs.write({
  type: '前端',
  lang: 'react',
  question: 'React 如何使用 Hooks',
  doc_name: 'react-hooks-basic',
  content: `# React Hooks 基础

useState 和 useEffect 是最常用的 Hooks。

## useState

\`\`\`jsx
const [count, setCount] = useState(0);
\`\`\`

## useEffect

\`\`\`jsx
useEffect(() => {
  document.title = \`点击了 \${count} 次\`;
}, [count]);
\`\`\`

## 规则

- 只在函数组件或自定义 Hook 中调用
- 只在顶层调用，不在循环/条件/嵌套函数中调用
`,
});
console.log(`✅ [3] ${w3.id} — 关键词: ${JSON.stringify(w3.keywords)}`);

// 4. Node.js 数据库连接
const w4 = await docs.write({
  type: '后端',
  lang: 'node',
  question: 'Node.js 连接 MySQL 数据库',
  doc_name: 'node-mysql-connect',
  content: `# Node.js 连接 MySQL

使用 mysql2 驱动连接 MySQL 数据库。

## 安装

\`\`\`bash
npm install mysql2
\`\`\`

## 连接代码

\`\`\`js
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'password',
  database: 'mydb',
  waitForConnections: true,
  connectionLimit: 10,
});

const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [1]);
console.log(rows);
\`\`\`
`,
});
console.log(`✅ [4] ${w4.id} — 关键词: ${JSON.stringify(w4.keywords)}`);

// ─── 查询演示 ────────────────────────────────────────────

console.log('\n🔍 查询演示\n');

console.log('--- 查询: "vue fontawesome 图标" (前端/vue) ---');
const q1 = await docs.query({ type: '前端', lang: 'vue', query: 'vue fontawesome 图标' });
q1.results.forEach(r => {
  console.log(`  → ${r.doc_path} | 匹配 ${r.match_count} 个词: ${JSON.stringify(r.matched_words)}`);
});

console.log('\n--- 查询: "路由配置" (前端/vue) ---');
const q2 = await docs.query({ type: '前端', lang: 'vue', query: '路由配置' });
q2.results.forEach(r => {
  console.log(`  → ${r.doc_path} | 匹配 ${r.match_count} 个词: ${JSON.stringify(r.matched_words)}`);
});

console.log('\n--- 查询: "数据库连接" (后端/node) ---');
const q3 = await docs.query({ type: '后端', lang: 'node', query: '数据库连接' });
q3.results.forEach(r => {
  console.log(`  → ${r.doc_path} | 匹配 ${r.match_count} 个词: ${JSON.stringify(r.matched_words)}`);
});

// ─── 列表 ──────────────────────────────────────────────

console.log('\n📋 全部文档列表');
const all = docs.list();
all.documents.forEach(d => {
  console.log(`  [${d.type}/${d.lang}] ${d.doc_path} — ${d.question}`);
});

docs.close();

console.log(`\n✅ 数据库文件: ${DB_PATH}`);
console.log(`✅ 文档目录:   ${DOCS_DIR}`);
console.log('\n yo_ddb 目录结构:');
console.log('   .yo_ddb/data/docs.db');
console.log('   .yo_ddb/docs/*.md');
console.log('\n你可以用 SQLite 客户端打开 docs.db 查看倒排索引结构。');
