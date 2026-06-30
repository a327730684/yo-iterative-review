---
description: Start an iterative test loop against existing backend code.
argument-hint: <description of what to test> [--agent <name>] [--max-test-count N]
---

执行固定的 node.js 工作流来跑迭代测试循环。被测后端代码应已存在；tester agent 会编写精简测试、执行、失败则由 implementer 修复，循环到全绿或达上限。

## 用户输入

用户的需求：`$ARGUMENTS`

需求里应说明：**测什么、被测代码位置、用什么语言**（语言与执行方式由 tester agent 据此自决）。

用户可在需求中附加：

- `--agent <name>`：指定修复用的 agent（默认 `implementer`）。
- `--max-test-count N`：指定最大测试轮数（默认 2）。

例如：

```
/voyowork:test-loop 测试 src/snowflake.py 的 Snowflake 类：用 python 覆盖 next_id 唯一性、worker_id 越界抛 ValueError --max-test-count 2
```

## 执行流程

1. 如果 `$ARGUMENTS` 为空，提示用户输入需求。

2. 在工作目录执行：

   ```bash
   node iterative-runner/test-loop.ts "$ARGUMENTS"
   ```

3. 等待脚本结束。脚本会自动：
   - 启动 tester agent 编写/执行测试，返回失败用例
   - 将每轮失败用例与修复情况写入 `.voyo-work/logs/<date>/test-loop_<timestamp>.log`
   - 在测试全绿、达到最大轮数或出错时结束

4. 脚本退出后，向用户汇报最终结果。
