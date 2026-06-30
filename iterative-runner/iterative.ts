/// <reference types="node" />
import { runClaudeAgent, runClaudeTextAgent } from './lib/claude-spawn.ts';
import { callModel } from './lib/call-model.ts';
import { parseCliArgs, getProjectDir, generateRandom6 } from './lib/utils.ts';
import { createLogger } from './lib/log-state.ts';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_MAX_REVIEW_COUNT = 5;
const DEFAULT_AGENT = 'implementer';
const REVIEWER_SCHEMA_PATH = join(__dirname, 'schemas', 'reviewer-schema.json');
const COMPLETED_CHECK_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    completed: { type: 'boolean' },
  },
  required: ['completed'],
} as const;

interface ReviewFinding {
  issue: string;
  expected: string;
}

interface State {
  round: number;
  projectDir: string;
  tmpDir: string;
  requirements: string;
  agentName: string;
  maxReviewCount: number;
}

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
  const tmpDir = join(projectDir, '.voyo-work', 'tmp', `iterative.${random6}`);
  const logger = createLogger(projectDir);

  const state: State = {
    round: 1,
    projectDir,
    tmpDir,
    requirements,
    agentName,
    maxReviewCount,
  };

  console.log(`[iterative] start agent=${agentName} maxReviewCount=${maxReviewCount} tmp=${tmpDir}`);

  try {
    await mkdir(tmpDir, { recursive: true });

    // 初始实现轮：不约束输出，只要它去工作
    await runImplementAgent(state, true);
    await logger.append({ type: 'implement_initial', round: state.round });

    // 审查循环
    while (state.round <= state.maxReviewCount) {
      const findings = await runReviewAgent(state);

      await logger.append({
        type: 'review_findings',
        round: state.round,
        findings,
      });

      if (findings.length === 0) {
        console.log(`[iterative] review passed round=${state.round}`);
        break;
      }

      // 生成修复清单文件
      const issueFile = join(tmpDir, `${state.round}.md`);
      await generateIssueFile(findings, issueFile);

      // 修复 + 完成检查（最多 3 次）
      let fixed = false;
      for (let attempt = 1; attempt <= 3; attempt++) {
        await runImplementAgent(state, false, issueFile);
        await logger.append({ type: 'implement_fix', round: state.round, attempt });

        if (await checkIssueFileCompleted(issueFile)) {
          fixed = true;
          break;
        }
      }

      if (!fixed) {
        console.log(`[iterative] round=${state.round} fix attempts exhausted`);
      }

      state.round += 1;
    }

    if (state.round > state.maxReviewCount) {
      console.log(`[iterative] reached max review count ${state.maxReviewCount}`);
    }

    // 最终归纳
    const summary = await summarizeAllRounds(tmpDir);
    console.log('\n' + summary);

    await logger.append({
      type: 'final_summary',
      round: state.round,
      summary,
    });
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error(`[iterative] 错误: ${error.message}`);
    await logger.append({
      type: 'error',
      round: state.round,
      message: error.message,
      stack: error.stack || '',
    }).catch(() => {});
    process.exit(1);
  }
}

async function runImplementAgent(state: State, isInitial: boolean, issueFile?: string): Promise<void> {
  let prompt: string;
  if (isInitial) {
    prompt = [
      '#这是用户的需要：',
      state.requirements,
      '',
      '请根据以上需求实现代码。',
      '完成后直接结束即可，无需返回特定格式。',
    ].join('\n');
  } else {
    prompt = [
      '#这是用户的需要：',
      state.requirements,
      '',
      '你已经完成了这些需求，现在代码审核者发现问题，并以文件形式存放：',
      issueFile,
      '查看此清单，发现里面待修复的问题，去修复，最后修改此清单中的问题状态为[x]。',
      '完成后直接结束即可，无需返回特定格式。',
    ].join('\n');
  }

  await runClaudeTextAgent({
    agent: state.agentName,
    prompt,
    projectDir: state.projectDir,
  });
}

async function runReviewAgent(state: State): Promise<ReviewFinding[]> {
  const prompt = [
    '# 用户需求',
    state.requirements,
    '',
    '请审查当前代码是否满足以上需求。请依次进行：',
    '1. 功能比对：代码功能是否与需求一致；',
    '2. 代码检查：是否存在逻辑 bug；',
    '3. 隐患检查：是否存在未知隐患（安全、性能、边界等）。',
    '',
    '如果没有任何问题，请返回空数组 []。',
    '如果有问题，请返回 JSON 数组，每项包含：',
    '- issue: string（问题描述）',
    '- expected: string（期望的修复标准）',
    '',
    '重要：只输出 JSON 数组，不要任何解释、不要 markdown 代码块、不要其他内容。',
  ].join('\n');

  const { inner } = await runClaudeAgent({
    agent: 'reviewer',
    prompt,
    schemaPath: REVIEWER_SCHEMA_PATH,
    projectDir: state.projectDir,
  });

  if (!Array.isArray(inner)) {
    throw new Error('reviewer 返回的不是 JSON 数组，无法继续流程');
  }
  return inner as ReviewFinding[];
}

async function generateIssueFile(findings: ReviewFinding[], filePath: string): Promise<void> {
  const list = findings.map(f => `- [ ] ${f.issue}\n  - 期望：${f.expected}`).join('\n');
  const prompt = [
    '请将以下代码审查问题整理成 Markdown 修复清单。',
    '输出只包含 Markdown 列表，每项以 `- [ ]` 开头，后接问题描述。',
    '如果问题有 expected 字段，请在同一项内保留期望的修复标准。',
    '',
    '问题列表：',
    JSON.stringify(findings, null, 2),
  ].join('\n');

  const markdown = await callModel({
    messages: [{ role: 'user', content: prompt }],
  });

  // 如果模型输出不符合预期，回退到简单格式
  const content = markdown.includes('- [ ]') ? markdown : list;
  await writeFile(filePath, content, 'utf8');
}

async function checkIssueFileCompleted(filePath: string): Promise<boolean> {
  const content = await readFile(filePath, 'utf8');
  const prompt = [
    '请检查以下 Markdown 修复清单是否所有项目都已标记为完成（即所有 `- [ ]` 都已改为 `- [x]`）。',
    '只返回一个 JSON 对象：{"completed": true} 或 {"completed": false}。',
    '重要：只输出 JSON 对象，不要任何解释、不要 markdown 代码块、不要其他内容。',
    '',
    '清单内容：',
    '```markdown',
    content,
    '```',
  ].join('\n');

  const result = await callModel({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_schema', schema: COMPLETED_CHECK_SCHEMA },
  });

  try {
    const parsed = JSON.parse(result) as { completed?: boolean };
    return parsed.completed === true;
  } catch {
    // 如果解析失败，直接检查是否还有未完成的项
    return !content.includes('- [ ]');
  }
}

async function summarizeAllRounds(tmpDir: string): Promise<string> {
  const files = await readdir(tmpDir);
  const mdFiles = files.filter((f: string) => f.endsWith('.md')).sort();
  const contents: string[] = [];
  for (const f of mdFiles) {
    const content = await readFile(join(tmpDir, f), 'utf8');
    contents.push(`## ${f}\n\n${content}`);
  }

  if (contents.length === 0) {
    return '所有轮次均未发现问题，流程结束。';
  }

  const prompt = [
    '请归纳总结以下所有轮次的代码审查与修复清单，给出最终结论：',
    '- 总共进行了几轮审查',
    '- 每轮发现的核心问题',
    '- 修复情况',
    '- 是否还有遗留问题',
    '',
    contents.join('\n\n---\n\n'),
  ].join('\n');

  return callModel({
    messages: [{ role: 'user', content: prompt }],
  });
}

main().catch(err => {
  const error = err instanceof Error ? err : new Error(String(err));
  console.error(`[iterative] 未捕获错误: ${error.message}`);
  console.error(error.stack);
  process.exit(1);
});
