# Project Memory

## 工具偏好

- **联网搜索**：优先使用 `bailian-web-search` skill，不要用内置的 `WebSearch` 或 `WebFetch`。

## 本地安装方式（已配置）

本插件已通过本地路径安装到 Claude Code：

```bash
# 市场注册（source 指向本项目目录）
claude plugin marketplace add /Users/momo/workspace/claude-plugins/iterative-review

# 安装
claude plugin install voyо-iterative-review@voyowork
```

修改代码后执行 `claude plugin update voyowork` 并重启 Claude Code。

使用命令：`/voyowork:start <需求描述>`

## 版本发布

发布新版本时，三处版本号必须同步更新，保持一致：

1. `package.json` → `version`
2. `.claude-plugin/plugin.json` → `version`
3. `.claude-plugin/marketplace.json` → `metadata.version`

同时更新 `CHANGELOG.md`。

发布后用户更新：`claude plugin marketplace update voyo-marketplace` → `claude plugin update voyowork`
