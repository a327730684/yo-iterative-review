# Changelog

本项目所有值得注意的变更都记录于此。

格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.2.0] - 2026-11-18

### Added
- `yo-qwen-image` skill：阿里云百炼 qwen-image 文生图/图生图，支持比例与分辨率档位、批量生成，图片自动下载到本地。
- `yo-qwen-material` skill：透明背景素材图生成，qwen-image 绿/蓝/品红幕出图 + ffmpeg colorkey 抠图输出 RGBA PNG。

### Changed
- `yo-md2html`：Mermaid 图改由 pele 在 Node 端预渲染为内联 SVG（渐变描边主题、默认缩小 85%），不再引入浏览器端 Mermaid.js，离线可看；渲染失败保留原文本块。
- `yo-md2html` 新增 `--scale` 参数控制 Mermaid 图显示缩放；依赖缺失时自动安装 `marked` 与 `pele`。

## [1.1.1] - 2026-10-30

### Added
- `hooks/prompts/coding-reminder.md`：插件 hook 注入的提示词正文，`hooks/simple/coding-reminder.js` 改为读取该文件，调整文案不再改代码。
- 注入提示词新增「Coding requirements」段：禁止过度防御性编程（兜底默认值会掩盖异常），系统确需捕获的异常仍应 catch，但需甄别。

### Changed
- `package.json` 版本号对齐插件版本号。
- `.claude/CLAUDE.md` 增加「版本发布」规则：`package.json`、`.claude-plugin/plugin.json`、`.claude-plugin/marketplace.json` 三处版本号同步更新。

## [1.1.0] - 2026-09-04

### Added
- `yo-oss` skill：上传本地文件到阿里云 OSS 并获取访问链接。
- `yo-svg2png` skill：SVG 转 PNG。
- `yo-tech-graph` skill：生成技术图表 SVG，支持 12 种视觉风格。
- `yo-md2html` skill 支持目录批量转换（新增 `base.js`、`multi-md-html.js`）。

### Changed
- `dev-sm` 拆分为 skill，`commands/` 改为引用形式。

## [1.0.0] - 2026-07-31

### Added
- 插件 hook：`hooks/hooks.json` + `hooks/simple/coding-reminder.js`，在 SessionStart 与 SubagentStart 注入编码提示词。
- 开发流程 agent：`backend-python`、`frontend-vue`、`dev-supervisor`、`dev-review-manager`、`dev-test-manager`、`xxl-supervisor`、`xxl-review-manager`、`xxl-test-manager`。
- `yo-dev-xxl`、`yo-vitest` skill；`dev-sm`、`dev-xxl` 命令。
- `yo-docs-mcp`、`yo-tools-mcp` 两个 MCP 服务。

### Removed
- `skills/iterative-review/SKILL.md`、`commands/develop.md`、`commands/orchestrate.md`。

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
