/// <reference types="node" />
import { runClaudeAgent, runClaudeTextAgent } from './claude-spawn.ts';
import { callModel } from './call-model/index.ts';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Logger } from './log-state.ts';
import {
  DEFAULT_MAX_REVIEW_COUNT,
  DEFAULT_MAX_FIX_ATTEMPTS,
  DEFAULT_AGENT,
  COMPLETED_CHECK_SCHEMA,
} from '../env.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

const REVIEWER_SCHEMA_PATH = join(__dirname, '..', 'schemas', 'reviewer-schema.json');

export interface ReviewFinding {
  issue: string;
  expected: string;
}

export interface IterativeOptions {
  requirements: string;
  projectDir: string;
  tmpDir: string;
  agentName?: string;
  maxReviewCount?: number;
  logger?: Logger;
}

export interface IterativeResult {
  summary: string;
  tmpDir: string;
}

interface IterativeState {
  round: number;
  projectDir: string;
  tmpDir: string;
  requirements: string;
  agentName: string;
  maxReviewCount: number;
  logger: Logger;
}

export async function runIterative(opts: IterativeOptions): Promise<IterativeResult> {
  const {
    requirements,
    projectDir,
    tmpDir,
    agentName = DEFAULT_AGENT,
    maxReviewCount = DEFAULT_MAX_REVIEW_COUNT,
    logger,
  } = opts;

  const log = logger ?? (await import('./log-state.ts')).createLogger(projectDir, 'iterative');

  const state: IterativeState = {
    round: 1,
    projectDir,
    tmpDir,
    requirements,
    agentName,
    maxReviewCount,
    logger: log,
  };

  console.log(`[iterative] start agent=${agentName} maxReviewCount=${maxReviewCount} tmp=${tmpDir}`);

  await mkdir(tmpDir, { recursive: true });

  // 初始实现轮
  await runImplementAgent(state, true);
  await log.append({ type: 'implement_initial', round: state.round });

  // 审查循环
  while (state.round <= state.maxReviewCount) {
    const findings = await runReviewAgent(state);

    await log.append({
      type: 'review_findings',
      round: state.round,
      findings,
    });

    if (findings.length === 0) {
      console.log(`[iterative] review passed round=${state.round}`);
      break;
    }

    const issueFile = join(tmpDir, `${state.round}.md`);
    await generateIssueFile(findings, issueFile);

    let fixed = false;
    for (let attempt = 1; attempt <= DEFAULT_MAX_FIX_ATTEMPTS; attempt++) {
      await runImplementAgent(state, false, issueFile);
      await log.append({ type: 'implement_fix', round: state.round, attempt });

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

  const summary = await summarizeAllRounds(tmpDir);
  console.log('\n' + summary);

  await log.append({
    type: 'final_summary',
    round: state.round,
    summary,
  });

  return { summary, tmpDir };
}

async function runImplementAgent(state: IterativeState, isInitial: boolean, issueFile?: string): Promise<void> {
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
      issueFile!,
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

async function runReviewAgent(state: IterativeState): Promise<ReviewFinding[]> {
  const prompt = [
    '# 用户需求',
    state.requirements,
    '',
    '请审查当前代码是否满足以上需求。只上报「严重问题」，聚焦以下几类：',
    '1. 功能缺陷：代码功能与需求不一致，或存在导致错误结果的逻辑 bug；',
    '2. 性能问题：经过验证的、真实存在的性能隐患（如 N+1 查询、无上限的大结果集、明显的算法复杂度问题）；',
    '3. 并发与阻塞：死锁、竞态条件，以及在异步流程中调用同步阻塞方法（如同步 I/O 阻塞事件循环）。',
    '',
    '以下类型的问题请忽略，不要上报：',
    '- 安全类问题（信息泄露、注入、鉴权、越权等）；',
    '- 运行环境兼容性 / 可移植性问题（Node 版本要求、实验性 API、依赖选型等）；',
    '- 代码风格、命名、注释，以及可优化但非必需的「锦上添花」建议。',
    '',
    '如果没有任何严重问题，请返回空数组 []。',
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

  const findings = (inner as { findings?: ReviewFinding[] }).findings;
  if (!Array.isArray(findings)) {
    throw new Error('reviewer 返回的不是 findings 数组，无法继续流程');
  }
  return findings;
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

  const markdown = await callModel.call({
    messages: [{ role: 'user', content: prompt }],
  });

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

  const result = await callModel.call({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_schema', schema: COMPLETED_CHECK_SCHEMA },
  });

  try {
    const parsed = JSON.parse(result) as { completed?: boolean };
    return parsed.completed === true;
  } catch {
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

  return callModel.call({
    messages: [{ role: 'user', content: prompt }],
  });
}

export { generateIssueFile, checkIssueFileCompleted, summarizeAllRounds };
