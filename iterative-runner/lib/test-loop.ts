/// <reference types="node" />
import { runClaudeAgent, runClaudeTextAgent } from './claude-spawn.ts';
import { callModel } from './call-model/index.ts';
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Logger } from './log-state.ts';
import {
  DEFAULT_MAX_TEST_COUNT,
  DEFAULT_MAX_FIX_ATTEMPTS,
  DEFAULT_TEST_AGENT,
  COMPLETED_CHECK_SCHEMA,
} from '../env.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

const TESTER_SCHEMA_PATH = join(__dirname, '..', 'schemas', 'tester-schema.json');

export interface TestFailure {
  case: string;
  failure: string;
  passed: boolean;
}

export interface TestLoopOptions {
  requirements: string;
  projectDir: string;
  tmpDir: string;
  testAgentName?: string;
  fixAgentName?: string;
  maxTestCount?: number;
  logger?: Logger;
}

export interface TestLoopResult {
  summary: string;
  tmpDir: string;
}

interface TestLoopState {
  round: number;
  projectDir: string;
  tmpDir: string;
  requirements: string;
  testAgentName: string;
  fixAgentName?: string;
  maxTestCount: number;
  logger: Logger;
}

export async function runTestLoop(opts: TestLoopOptions): Promise<TestLoopResult> {
  const {
    requirements,
    projectDir,
    tmpDir,
    testAgentName = DEFAULT_TEST_AGENT,
    fixAgentName,
    maxTestCount = DEFAULT_MAX_TEST_COUNT,
    logger,
  } = opts;

  const log = logger ?? (await import('./log-state.ts')).createLogger(projectDir, 'test-loop');

  const state: TestLoopState = {
    round: 1,
    projectDir,
    tmpDir,
    requirements,
    testAgentName,
    fixAgentName,
    maxTestCount,
    logger: log,
  };

  console.log(`[test-loop] start testAgent=${testAgentName} fixAgent=${fixAgentName || 'default'} maxTestCount=${maxTestCount} tmp=${tmpDir}`);

  await mkdir(tmpDir, { recursive: true });

  // 测试循环：被测代码已存在，每轮由 tester 写/改测试 + 执行
  while (state.round <= state.maxTestCount) {
    const failures = await runTesterAgent(state);

    await log.append({
      type: 'test_failures',
      round: state.round,
      failures,
    });

    if (failures.length === 0) {
      console.log(`[test-loop] tests passed round=${state.round}`);
      break;
    }

    // 生成失败用例清单文件
    const issueFile = join(tmpDir, `${state.round}.md`);
    await generateIssueFile(failures, issueFile);

    // 修复 + 完成检查（最多 DEFAULT_MAX_FIX_ATTEMPTS 次）
    let fixed = false;
    for (let attempt = 1; attempt <= DEFAULT_MAX_FIX_ATTEMPTS; attempt++) {
      await runImplementAgent(state, issueFile);
      await log.append({ type: 'implement_fix', round: state.round, attempt });

      if (await checkIssueFileCompleted(issueFile)) {
        fixed = true;
        break;
      }
    }

    if (!fixed) {
      console.log(`[test-loop] round=${state.round} fix attempts exhausted`);
    }

    state.round += 1;
  }

  if (state.round > state.maxTestCount) {
    console.log(`[test-loop] reached max test count ${state.maxTestCount}`);
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

async function runTesterAgent(state: TestLoopState): Promise<TestFailure[]> {
  const prompt = [
    '# 测试需求',
    state.requirements,
    '',
    '请针对以上需求对已存在的后端代码编写测试。请依次进行：',
    '1. 定位代码：用 Read/Grep/Glob 找到被测代码（语言、路径以需求为准）。',
    '2. 编写精简测试：不引用测试框架，直接 import 被测方法；断言用语言内置 assert；只在确有必要时引入一个辅助组件。测试文件放在被测代码同级或 tests/ 下。',
    '3. 执行测试：用 Bash 运行测试文件，据 stdout 与 exit code 判定每个用例 PASS/FAIL。',
    '',
    '返回 JSON 数组，每项包含：',
    '- case: string（用例名）',
    '- failure: string（失败原因；通过时留空字符串）',
    '- passed: boolean（该用例是否通过）',
    '',
    '如果所有用例都通过，请返回空数组 []。',
    '重要：只输出 JSON 数组，不要任何解释、不要 markdown 代码块、不要其他内容。',
    '测试完成后，删除测试代码。'
  ].join('\n');

  const { inner } = await runClaudeAgent({
    agent: state.testAgentName,
    prompt,
    schemaPath: TESTER_SCHEMA_PATH,
    projectDir: state.projectDir,
  });

  const results = (inner as { results?: TestFailure[] }).results;
  if (!Array.isArray(results)) {
    throw new Error('tester 返回的不是 results 数组，无法继续流程');
  }

  // 只保留未通过的项作为失败清单；空数组即测试通过
  return results.filter(r => r && r.passed === false);
}

async function runImplementAgent(state: TestLoopState, issueFile: string): Promise<void> {
  const prompt = [
    '#测试需求：',
    state.requirements,
    '',
    '测试执行者已运行测试，发现失败的用例，并以文件形式存放：',
    issueFile,
    '查看此清单，发现里面待修复的失败用例，去修复（可改被测代码或测试代码），最后修改此清单中的问题状态为[x]。',
    '完成后直接结束即可，无需返回特定格式。',
  ].join('\n');

  await runClaudeTextAgent({
    agent: state.fixAgentName,
    prompt,
    projectDir: state.projectDir,
  });
}

async function generateIssueFile(failures: TestFailure[], filePath: string): Promise<void> {
  const list = failures.map(f => `- [ ] ${f.case}\n  - 失败：${f.failure}`).join('\n');
  const prompt = [
    '请将以下测试失败用例整理成 Markdown 修复清单。',
    '输出只包含 Markdown 列表，每项以 `- [ ]` 开头，后接用例名。',
    '每项内保留失败原因。',
    '',
    '失败用例列表：',
    JSON.stringify(failures, null, 2),
  ].join('\n');

  const markdown = await callModel.call({
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

  const result = await callModel.call({
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
    return '所有轮次测试均通过，流程结束。';
  }

  const prompt = [
    '请归纳总结以下所有轮次的测试失败用例与修复清单，给出最终结论：',
    '- 总共进行了几轮测试',
    '- 每轮失败的用例',
    '- 修复情况',
    '- 是否还有遗留失败用例',
    '',
    contents.join('\n\n---\n\n'),
  ].join('\n');

  return callModel.call({
    messages: [{ role: 'user', content: prompt }],
  });
}

export { generateIssueFile, checkIssueFileCompleted, summarizeAllRounds };
