import { tokenize } from '../src/tokenizer.ts';

console.log('=== tokenizer.ts 测试 ===\n');

// 1. 基础中文分词
const r1 = tokenize('Font Awesome 在 Vue 中如何使用');
console.log('[1] 中文混合英文:', r1);
// 期望包含: font, awesome, vue, 如何, 使用

// 2. 纯英文
const r2 = tokenize('hello world');
console.log('[2] 纯英文:', r2);
// 期望: ['hello', 'world']

// 3. 空字符串
const r3 = tokenize('');
console.log('[3] 空字符串:', r3);
// 期望: []

// 4. 只有停用词
const r4 = tokenize('的了在是我');
console.log('[4] 全停用词:', r4);
// 期望: []

// 5. 含标点符号
const r5 = tokenize('你好，世界！这是一个测试。');
console.log('[5] 含标点:', r5);
// 期望不含标点

// 6. 含双引号
const r6 = tokenize('hello "world" 测试');
console.log('[6] 含双引号:', r6);
// 期望不含引号字符

// 7. 含单引号
const r7 = tokenize("it's a test 这是测试");
console.log('[7] 含单引号:', r7);

// 8. 去重验证
const r8 = tokenize('vue vue vue 测试 测试');
console.log('[8] 去重:', r8);
// 期望: ['vue', '测试'] （无重复）

// 9. 单字过滤
const r9 = tokenize('我 在 用 vue');
console.log('[9] 单字过滤:', r9);
// 期望: ['vue']（我、在、用 都是停用词或单字）

// 10. 大小写统一
const r10 = tokenize('Vue VUE vue');
console.log('[10] 大小写:', r10);
// 期望: ['vue']（统一转小写后去重）

console.log('\n=== tokenizer 测试完成 ===');
