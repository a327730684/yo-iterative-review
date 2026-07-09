# Voyo Work Plugin

代码开发工作流 + 文档/搜索工具集。

## 安装

```bash
claude plugin marketplace add https://github.com/a327730684/yo-iterative-review
claude plugin install voyоwork@voyo-marketplace
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
| `/voyowork:iterative <需求>` | 实现—审查—修复循环，直到通过或达到轮数上限 |
| `/voyowork:test-loop <需求>` | 针对已有代码的测试—修复循环 |
| `/voyowork:develop <需求>` | 实现审查 + 测试 一条龙（iterative → 自动生成测试需求 → test-loop）|
| `/voyowork:orchestrate <需求>` | 结构化设计 + 任务编排流程，拆解为设计文档与实施计划分派执行 |

示例：

```
/voyowork:develop 实现一个 JWT 用户登录 API，邮箱+密码验证、bcrypt 哈希、返回 access/refresh token
```

CLI 直接用法与参数见 [iterative-runner/readme.md](iterative-runner/readme.md)。

## 工具集（Skills）

yo-web-search、yo-md2html、yo-pdf2md，见 [readme/skills.md](readme/skills.md)。
