# iterative-runner

## iterative-loop（实现—审查—修复）

```bash
node --experimental-strip-types iterative-runner/iterative.ts \
  [--agent <name>] \
  [--max-review-count N] \
  "<需求描述>"
```

- `--agent`：实现/修复 agent，默认 `implementer`
- `--max-review-count`：审查轮数上限，默认 `1`

## test-loop（测试—修复）

```bash
node --experimental-strip-types iterative-runner/test-loop.ts \
  [--test-agent <name>] \
  [--fix-agent <name>] \
  [--max-test-count N] \
  "<测试需求描述>"
```

- `--test-agent`：测试 agent，默认 `tester`
- `--fix-agent`：修复 agent，未指定时不指定 agent（`--agent` 同 `--fix-agent`）
- `--max-test-count`：测试轮数上限，默认 `2`

## develop（实现审查 + 测试 一条龙）

编排 iterative → 中间 LLM 生成测试需求 → test-loop，自身不含循环。

```bash
node --experimental-strip-types iterative-runner/develop.ts \
  [--agent <impl>] \
  [--test-agent <tester>] \
  [--fix-agent <fixer>] \
  [--max-review-count N] \
  [--max-test-count M] \
  "<需求描述>"
```

- `--agent`：阶段一实现/修复 agent，默认 `implementer`
- `--test-agent`：阶段二测试 agent，默认 `tester`
- `--fix-agent`：阶段二修复 agent，未指定时不指定 agent
- `--max-review-count`：审查轮数上限，默认 `1`
- `--max-test-count`：测试轮数上限，默认 `2`
