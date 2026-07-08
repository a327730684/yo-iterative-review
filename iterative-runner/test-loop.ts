/// <reference types="node" />
import { runTestLoop } from './lib/test-loop.ts';
import { parseCliArgs, getProjectDir, generateRandom6 } from './lib/utils.ts';
import { createLogger } from './lib/log-state.ts';
import { join } from 'node:path';
import {
  DEFAULT_MAX_TEST_COUNT,
  DEFAULT_TEST_AGENT,
} from './env.ts';

async function main(): Promise<void> {
  const { requirements, flags } = parseCliArgs(process.argv);

  if (!requirements) {
    console.error('用法: node --experimental-strip-types iterative-runner/test-loop.ts [--test-agent <name>] [--fix-agent <name>] [--max-test-count N] "<需求描述>"');
    console.error('  --test-agent  执行测试的 agent，未指定时使用 tester');
    console.error('  --fix-agent   修复代码的 agent，未指定时不指定 agent');
    process.exit(1);
  }

  const testAgentName = flags['test-agent'] || DEFAULT_TEST_AGENT;
  const fixAgentName = flags['fix-agent'] || flags['agent'] || undefined;
  let maxTestCount = DEFAULT_MAX_TEST_COUNT;
  if (flags['max-test-count'] !== undefined) {
    const parsed = parseInt(flags['max-test-count'], 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      console.error(`[test-loop] --max-test-count 必须是大于等于 1 的整数，收到: ${flags['max-test-count']}`);
      process.exit(1);
    }
    maxTestCount = parsed;
  }

  const projectDir = getProjectDir();
  const random6 = generateRandom6();
  const today = new Date().toISOString().slice(0, 10); // yyyy-MM-dd
  const tmpDir = join(projectDir, '.voyo-work', 'tmp', 'test-loop', `${today}.${random6}`);
  const logger = createLogger(projectDir, 'test-loop');

  try {
    await runTestLoop({
      requirements,
      projectDir,
      tmpDir,
      testAgentName,
      fixAgentName,
      maxTestCount,
      logger,
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`[test-loop] 错误: ${error.message}`);
    await logger.append({
      type: 'error',
      message: error.message,
      stack: error.stack || '',
    }).catch(() => {});
    process.exit(1);
  }
}

main().catch(err => {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error(`[test-loop] 未捕获错误: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
