import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tests = [
  'test-tokenizer.ts',
  'test-database.ts',
  'test-list.ts',
  'test-write-query.ts',
  'test-delete.ts',
];

let passed = 0;
let failed = 0;

console.log('╔══════════════════════════════════════╗');
console.log('║   yo-docs-mcp 测试套件               ║');
console.log('╚══════════════════════════════════════╝\n');

for (const test of tests) {
  const testPath = join(__dirname, test);
  console.log(`\n${'━'.repeat(50)}`);
  console.log(`▶ 运行 ${test}`);
  console.log('━'.repeat(50));

  try {
    const output = execSync(`node "${testPath}"`, {
      cwd: join(__dirname, '..'),
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    console.log(output);
    passed++;
    console.log(`✅ ${test} 通过`);
  } catch (err: any) {
    failed++;
    console.log(err.stdout || '');
    console.log(err.stderr || '');
    console.log(`❌ ${test} 失败 (exit code: ${err.status})`);
  }
}

console.log(`\n${'═'.repeat(50)}`);
console.log(`测试结果: ${passed} 通过, ${failed} 失败, 共 ${tests.length} 个`);
console.log('═'.repeat(50));

if (failed > 0) {
  process.exit(1);
}
