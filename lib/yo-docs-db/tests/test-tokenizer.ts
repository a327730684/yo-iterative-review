import { tokenize } from '../src/tokenizer.ts';

console.log('=== tokenizer.ts 测试 ===\n');

// 1. 基础中文分词
const r1 = tokenize('Font Awesome 在 Vue 中如何使用');
console.log('[1] 中文混合英文:', r1);

// 2. 纯英文
const r2 = tokenize('hello world');
console.log('[2] 纯英文:', r2);

// 3. 空字符串
const r3 = tokenize('');
console.log('[3] 空字符串:', r3);

// 4. 只有停用词
const r4 = tokenize('的了在是我');
console.log('[4] 全停用词:', r4);

// 5. 含标点符号
const r5 = tokenize('你好，世界！这是一个测试。');
console.log('[5] 含标点:', r5);

// 6. 去重验证
const r6 = tokenize('vue vue vue 测试 测试');
console.log('[6] 去重:', r6);

// 7. 单字过滤
const r7 = tokenize('我 在 用 vue');
console.log('[7] 单字过滤:', r7);

// 8. 大小写统一
const r8 = tokenize('Vue VUE vue');
console.log('[8] 大小写:', r8);

console.log('\n=== tokenizer 测试完成 ===');
