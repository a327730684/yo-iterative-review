/// <reference types="node" />
import { runIterative } from './lib/iterative.ts';
import { parseCliArgs, getProjectDir, generateRandom6 } from './lib/utils.ts';
import { createLogger } from './lib/log-state.ts';
import { join } from 'node:path';
import {
  DEFAULT_MAX_REVIEW_COUNT,
  DEFAULT_AGENT,
} from './env.ts';

async function main(): Promise<void> {
  const { requirements, flags } = parseCliArgs(process.argv);

  if (!requirements) {
    console.error('用法: node --experimental-strip-types iterative-runner/iterative.ts [--agent <name>] [--max-review-count N] "<需求描述>"');
    process.exit(1);
  }

  const agentName = flags['agent'] || DEFAULT_AGENT;
  let maxReviewCount = DEFAULT_MAX_REVIEW_COUNT;
  if (flags['max-review-count'] !== undefined) {
    const parsed = parseInt(flags['max-review-count'], 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      console.error(`[iterative] --max-review-count 必须是大于等于 1 的整数，收到: ${flags['max-review-count']}`);
      process.exit(1);
    }
    maxReviewCount = parsed;
  }

  const projectDir = getProjectDir();
  const random6 = generateRandom6();
  const today = new Date().toISOString().slice(0, 10); // yyyy-MM-dd
  const tmpDir = join(projectDir, '.voyo-work', 'tmp', 'iterative', `${today}.${random6}`);
  const logger = createLogger(projectDir);

  try {
    await runIterative({
      requirements,
      projectDir,
      tmpDir,
      agentName,
      maxReviewCount,
      logger,
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`[iterative] 错误: ${error.message}`);
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
  console.error(`[iterative] 未捕获错误: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
