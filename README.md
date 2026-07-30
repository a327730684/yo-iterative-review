# Voyo Work Plugin

代码开发工作流 + 文档/搜索工具集。

## 安装

```bash
claude plugin marketplace add https://github.com/a327730684/yo-iterative-review
claude plugin install voyowork@voyo-marketplace
```
更新插件
```
claude plugin marketplace update voyo-marketplace
```



若 `claude plugin install` 安装失败，在 Claude Code 交互模式下改用：

```
/plugin install voyowork@voyo-marketplace
```

## 命令

| 命令 | 说明 |
|---|---|
| `/voyowork:iterative <需求> [--agent <name>] [--max-review-count N]` | 实现—审查—修复循环，直到通过或达到轮数上限 |
| `/voyowork:dev-sm <需求>` | 开发一个小功能 |
| `/voyowork:dev-xxl <需求>` | 大型功能开发：设计 → 实现 → review → 测试 全流程（调用 `yo-dev-xxl` skill） |

示例：

```
/voyowork:dev-xxl 实现一个 JWT 用户登录 API，邮箱+密码验证、bcrypt 哈希、返回 access/refresh token
```

CLI 直接用法与参数见 [iterative-runner/readme.md](iterative-runner/readme.md)。

## 工具集（Skills）

yo-web-search、yo-md2html、yo-pdf2md，见 [readme/skills.md](readme/skills.md)。

另有开发流程与测试类 skill：`yo-dev-xxl`（大型功能开发流程）、`yo-vitest`（前端 vitest 测试）。


