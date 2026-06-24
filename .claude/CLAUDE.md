# Project Memory

## 工具偏好

- **联网搜索**：优先使用 `bailian-web-search` skill，不要用内置的 `WebSearch` 或 `WebFetch`。

## 本地安装方式（已配置）

本插件已通过本地路径安装到 Claude Code：

```bash
# 市场注册（source 指向本项目目录）
claude plugin marketplace add /Users/momo/workspace/claude-plugins/iterative-review

# 安装
claude plugin install iterative-review@iterative-review
```

修改代码后执行 `claude plugin update iterative-review` 并重启 Claude Code。

使用命令：`/iterative-review:start <需求描述>`
