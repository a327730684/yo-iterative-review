# Plan: 新增 `develop` 命令，串联 iterative + test-loop

## Context

现有两个命令：
- `/voyowork:iterative` → `iterative-runner/iterative.ts`：实现 + 审查-修复循环
- `/voyowork:test-loop` → `iterative-runner/test-loop.ts`：测试-修复循环

新增 `/voyowork:develop`，把「实现/审查」与「测试」串成一条流水线。要求：**精简、复用代码、不绕弯**。

方向：
- **不**抽象循环引擎（loop-engine）。
- 把两个流程的核心逻辑分别抽到 `lib/iterative.ts` 与 `lib/test-loop.ts`，导出可调用函数。
- `develop.ts` 直接 import 这两个函数，中间加一段 LLM 处理把实现产出转成测试需求，串起来。
- develop 自身**不含循环**——循环都在两个 lib 函数内部。

## Design

### 1. 抽出 `lib/iterative.ts`

把 `iterative.ts` 的 `main()` 主体（除 CLI 参数解析外）抽成导出函数：

```ts
export interface IterativeOptions {
  requirements: string;
  projectDir: string;
  tmpDir: string;
  agentName?: string;        // 默认 'implementer'
  maxReviewCount?: number;   // 默认 1
  logger?: Logger;           // 可选注入，未传则内部自建（标签 'iterative'）
}
export interface IterativeResult { summary: string; tmpDir: string; }
export async function runIterative(opts: IterativeOptions): Promise<IterativeResult>
```

内部流程不变：mkdir tmp → `runImplementAgent(initial)` → 审查循环 → `summarizeAllRounds` → 返回 `{summary, tmpDir}`。
其余私有函数（`runReviewAgent`/`runImplementAgent`/`generateIssueFile`/`checkIssueFileCompleted`/`summarizeAllRounds`）随之迁入 `lib/iterative.ts`。

### 2. 抽出 `lib/test-loop.ts`

同样把 `test-loop.ts` 的 `main()` 主体抽成：

```ts
export interface TestLoopOptions {
  requirements: string;
  projectDir: string;
  tmpDir: string;
  testAgentName?: string;    // 默认 'tester'
  fixAgentName?: string;     // 可选
  maxTestCount?: number;     // 默认 2
  logger?: Logger;           // 可选注入，未传则内部自建（标签 'test-loop'）
}
export interface TestLoopResult { summary: string; tmpDir: string; }
export async function runTestLoop(opts: TestLoopOptions): Promise<TestLoopResult>
```

### 3. 现有入口瘦成 CLI 薄包装

- `iterative-runner/iterative.ts`：仅 `parseCliArgs` → 组装 opts → `runIterative` → 错误处理。
- `iterative-runner/test-loop.ts`：仅 `parseCliArgs` → 组装 opts → `runTestLoop` → 错误处理。
- 两个老命令行为、参数、默认值完全不变。

### 4. 新增 `develop.ts`（无循环，纯编排）

```
./develop.ts "<需求>" [--max-review-count N] [--max-test-count M] [--agent <impl>] [--test-agent <tester>] [--fix-agent <fixer>]

1. logger = createLogger(projectDir, 'develop')
2. impl = await runIterative({ requirements, agentName, maxReviewCount, logger, tmpDir })
3. 中间 LLM 处理：callModel 根据「原始需求 + impl.summary」生成一段测试需求描述
   （要测什么 / 代码在哪 / 什么语言），记入日志。
4. await runTestLoop({ requirements: 测试需求, testAgentName, fixAgentName, maxTestCount, logger, tmpDir })
5. 打印两阶段合并总结 + 错误处理。
```

中间 LLM 处理是唯一的「新逻辑」，约 10~15 行：一个 `callModel` 调用 + prompt，把实现阶段的总结翻译成可执行的测试需求，交给 test-loop。

### 5. 新增 `commands/develop.md`

参照 `commands/iterative.md` / `commands/test-loop.md` 的结构：
- 说明 develop = 实现审查 + 测试 一条龙
- 参数：`--max-review-count`（默认 1）、`--max-test-count`（默认 2）、`--agent`、`--test-agent`、`--fix-agent`
- **强调后台运行**（与另外两个命令统一的写法一致）
- Report 步骤：后台完成后读取最终总结再汇报

## 关键文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `iterative-runner/lib/iterative.ts` | 新增 | 导出 `runIterative()` + 迁入其私有函数 |
| `iterative-runner/lib/test-loop.ts` | 新增 | 导出 `runTestLoop()` + 迁入其私有函数 |
| `iterative-runner/iterative.ts` | 改为薄 CLI | 解析参数 → `runIterative` |
| `iterative-runner/test-loop.ts` | 改为薄 CLI | 解析参数 → `runTestLoop` |
| `iterative-runner/develop.ts` | 新增 | 编排：runIterative → 中间 LLM → runTestLoop |
| `commands/develop.md` | 新增 | slash command 定义 |

## 复用项

- `parseCliArgs` / `getProjectDir` / `generateRandom6` → `lib/utils.ts`
- `createLogger` → `lib/log-state.ts`（支持第二参数自定义日志标签，develop 用 `'develop'`）
- `runClaudeAgent` / `runClaudeTextAgent` → `lib/claude-spawn.ts`
- `callModel` → `lib/call-model.ts`（复用于中间 LLM 处理与内部总结）
- schemas 与 agents 文件（reviewer/tester）不变

## 验证

1. 语法检查：`node --experimental-strip-types --check iterative-runner/develop.ts`（及两个薄 CLI）。
2. 回归：`node iterative-runner/iterative.ts "..."` 与 `node iterative-runner/test-loop.ts "..."` 行为不变。
3. 端到端：以本次生成的 `test/` Express 标题服务为目标，
   `node iterative-runner/develop.ts "在 test/ 下实现并验证标题服务" --max-review-count 1 --max-test-count 1`，
   确认先跑实现审查、再自动生成测试需求、再跑测试修复，日志标签统一为 `develop`。

## 非目标

- 不抽循环引擎，不改两个流程内部的循环/prompt/schema。
- 不改 `reviewer.md` / `tester.md` / schemas。
- develop 不自带循环，只做编排 + 一段中间 LLM 处理。
