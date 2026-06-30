---
description: Start an iterative implementation-review loop with quality gate.
argument-hint: <description of what to implement> [--agent <name>] [--max-review-count N]
---

执行固定的 node.js 工作流来跑迭代审查循环。你不再自己维护状态或调度 Agent，而是直接调用工作流脚本，由确定性代码控制循环。

## 用户输入

用户的需求：`$ARGUMENTS`

用户可在需求中附加：

- `--agent <name>`：指定实施 agent（默认 `implementer`）。
- `--max-review-count N`：指定最大审查轮数（默认 5）。

例如：

```
/voyowork:iterative 实现登录 API --agent implementer --max-review-count 3
/voyowork:iterative --agent frontend-vue 重构登录页面 --max-review-count 2
```

## 执行流程

1. 如果 `$ARGUMENTS` 为空，提示用户输入需求。

2. 在工作目录执行：

   ```bash
   node iterative-runner/iterative.ts "$ARGUMENTS"
   ```

3. 等待脚本结束。脚本会自动：
   - 启动初始实现轮（Round 1）
   - 交替运行 reviewer / 指定的实施 agent 子进程
   - 将每轮发现的问题与解决情况写入 `.voyo-work/logs/<date>/iterative_<timestamp>.log`
   - 在 reviewer 返回空、达到最大轮数或出错时结束

4. 脚本退出后，向用户汇报最终结果。

## 日志

每轮追加 JSON 记录，不含完整对话过程。

## 示例用法

```
/voyowork:iterative 实现一个 JWT 用户登录 API，要求邮箱+密码验证、返回 access/refresh token、使用 bcrypt、支持 rate limiting
/voyowork:iterative --max-review-count 3 重构 src/utils.ts 中的日期处理函数，统一使用 date-fns
/voyowork:iterative --agent frontend-vue 重构登录页面 --max-review-count 2
```
