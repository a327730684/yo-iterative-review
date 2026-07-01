/// <reference types="node" />
import { runIterative } from './lib/iterative.ts';
import { runTestLoop } from './lib/test-loop.ts';
import { callModel } from './lib/call-model.ts';
import { parseCliArgs, getProjectDir, generateRandom6 } from './lib/utils.ts';
import { createLogger } from './lib/log-state.ts';
import { join } from 'node:path';

const DEFAULT_MAX_REVIEW_COUNT = 1;
const DEFAULT_MAX_TEST_COUNT = 2;
const DEFAULT_AGENT = 'implementer';
const DEFAULT_TEST_AGENT = 'tester';

async function main(): Promise<void> {
  const { requirements, flags } = parseCliArgs(process.argv);

  if (!requirements) {
    console.error('用法: node --experimental-strip-types iterative-runner/develop.ts [--agent <impl>] [--test-agent <tester>] [--fix-agent <fixer>] [--max-review-count N] [--max-test-count M] "<需求描述>"');
    process.exit(1);
  }

  const agentName = flags['agent'] || DEFAULT_AGENT;
  const testAgentName = flags['test-agent'] || DEFAULT_TEST_AGENT;
  const fixAgentName = flags['fix-agent'] || undefined;

  let maxReviewCount = DEFAULT_MAX_REVIEW_COUNT;
  if (flags['max-review-count'] !== undefined) {
    const parsed = parseInt(flags['max-review-count'], 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      console.error(`[develop] --max-review-count 必须是大于等于 1 的整数，收到: ${flags['max-review-count']}`);
      process.exit(1);
    }
    maxReviewCount = parsed;
  }

  let maxTestCount = DEFAULT_MAX_TEST_COUNT;
  if (flags['max-test-count'] !== undefined) {
    const parsed = parseInt(flags['max-test-count'], 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      console.error(`[develop] --max-test-count 必须是大于等于 1 的整数，收到: ${flags['max-test-count']}`);
      process.exit(1);
    }
    maxTestCount = parsed;
  }

  const projectDir = getProjectDir();
  const random6 = generateRandom6();
  const today = new Date().toISOString().slice(0, 10); // yyyy-MM-dd
  const baseDir = join(projectDir, '.voyo-work', 'tmp', 'develop', `${today}.${random6}`);
  // 两个阶段各用独立子目录，避免各自的轮次清单与总结互相串扰
  const iterativeTmpDir = join(baseDir, 'iterative');
  const testLoopTmpDir = join(baseDir, 'test-loop');
  const logger = createLogger(projectDir, 'develop');

  console.log(`[develop] start agent=${agentName} testAgent=${testAgentName} fixAgent=${fixAgentName || 'default'} maxReviewCount=${maxReviewCount} maxTestCount=${maxTestCount} tmp=${baseDir}`);

  try {
    // 阶段一：实现 + 审查修复
    const impl = await runIterative({
      requirements,
      projectDir,
      tmpDir: iterativeTmpDir,
      agentName,
      maxReviewCount,
      logger,
    });

    // 中间 LLM 处理：把实现阶段的总结翻译成可执行的测试需求
    const testRequirements = await deriveTestRequirements(requirements, impl.summary);
    await logger.append({ type: 'derive_test_requirements', testRequirements });
    console.log(`\n[develop] 生成的测试需求：\n${testRequirements}\n`);

    // 阶段二：测试 + 修复
    const test = await runTestLoop({
      requirements: testRequirements,
      projectDir,
      tmpDir: testLoopTmpDir,
      testAgentName,
      fixAgentName,
      maxTestCount,
      logger,
    });

    // 两阶段合并总结
    const merged = [
      '========== develop 流程总结 ==========',
      '',
      '## 阶段一：实现 + 审查修复',
      impl.summary,
      '',
      '## 阶段二：测试 + 修复',
      test.summary,
    ].join('\n');
    console.log('\n' + merged);

    await logger.append({ type: 'develop_summary', summary: merged });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`[develop] 错误: ${error.message}`);
    await logger.append({
      type: 'error',
      message: error.message,
      stack: error.stack || '',
    }).catch(() => {});
    process.exit(1);
  }
}

/**
 * 中间 LLM 处理：依据「原始需求 + 实现阶段总结」，生成一段可执行的测试需求描述
 * （要测什么 / 代码在哪 / 什么语言），交给 test-loop。
 */
async function deriveTestRequirements(requirements: string, implSummary: string): Promise<string> {
  const prompt = [
    '下面是一次代码实现任务的「原始需求」和「实现阶段总结」。',
    '请据此生成一段用于自动化测试的「测试需求描述」，必须明确：',
    '1. 要测什么：核心功能点与关键边界；',
    '2. 代码在哪：被测代码所在的文件/目录/模块；',
    '3. 什么语言：被测代码使用的编程语言。',
    '',
    '只输出测试需求描述本身，不要解释、不要 markdown 代码块。',
    '',
    '# 原始需求',
    requirements,
    '',
    '# 实现阶段总结',
    implSummary,
  ].join('\n');

  return callModel({
    messages: [{ role: 'user', content: prompt }],
  });
}

main().catch(err => {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error(`[develop] 未捕获错误: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
