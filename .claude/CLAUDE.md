# Project Memory

## 工具偏好

- **联网搜索**：优先使用 `bailian-web-search` skill，不要用内置的 `WebSearch` 或 `WebFetch`。

## 安装与更新

市场名 `voyo-marketplace`，插件名 `voyowork`。

```bash
# 市场注册
claude plugin marketplace add https://github.com/a327730684/yo-iterative-review

# 安装
claude plugin install voyowork@voyo-marketplace

# 更新
claude plugin marketplace update voyo-marketplace
claude plugin update voyowork
```

命令：`/voyowork:iterative <需求>`、`/voyowork:dev-sm <需求>`、`/voyowork:dev-xxl <需求>`

## 版本发布

发布新版本时，三处版本号必须同步更新，保持一致：

1. `package.json` → `version`
2. `.claude-plugin/plugin.json` → `version`
3. `.claude-plugin/marketplace.json` → `metadata.version`

同时更新 `CHANGELOG.md`。

发布后用户更新：`claude plugin marketplace update voyo-marketplace` → `claude plugin update voyowork`
