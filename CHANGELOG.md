# Changelog

本项目所有值得注意的变更都记录于此。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.0.1] - 2026-07-01

### Added
- `develop` 命令：实现审查 + 测试一条龙流水线（`runIterative` → 中间 LLM 生成测试需求 → `runTestLoop`），自身不含循环，两阶段各用独立 tmp 子目录并统一日志标签 `develop`。
- `test-loop` 命令：针对已有后端代码的测试—修复循环，tester 写并执行精简测试、fix agent 修复失败用例，直到全部通过或达到轮数上限。
- 抽出 `iterative-runner/lib/iterative.ts` 与 `lib/test-loop.ts`，导出 `runIterative()` / `runTestLoop()` 供编排复用。
- `readme/skills.md` 汇总工具集文档；`iterative-runner/readme.md` 汇总三个 runner 的 CLI 用法。

### Changed
- `iterative.ts` / `test-loop.ts` 瘦身为薄 CLI 包装，行为、参数、默认值不变。
- `README.md` 精简为入口 + 命令表（iterative / test-loop / develop / orchestrate），并补充 `claude plugin install` 失败时的 `/plugin install voyowork@voyo-marketplace` 回退说明。

### Removed
- 旧脚手架文件：`src/`（snowflake 示例）、`start.js`、`end.js`。
