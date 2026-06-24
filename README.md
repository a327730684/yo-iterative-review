# Voyo Work Plugin

提供两种代码开发工作流：迭代审查循环和结构化编排流程。

## 安装

```bash
claude plugin marketplace add https://github.com/a327730684/yo-iterative-review
claude plugin install voyо-iterative-review@voyо-work
```

## 使用

### 1. 迭代审查循环

通过双 Agent（实现者 + 审查者）迭代协作，自动完成"写代码 → 审代码 → 改代码"循环，直到代码通过审查。

```
/voyо-work:iterative <需求描述>
```

示例：

```
/voyо-work:iterative 实现一个 JWT 用户登录 API，要求邮箱+密码验证、bcrypt 哈希、返回 access/refresh token
```

插件会自动：
1. 实现代码 → 2. 审查者列出缺陷 → 3. 实现者逐条判断 ACCEPT/REJECT → 4. 循环直到通过或达到上限

### 2. 结构化编排流程

通过 MCP 工具管理设计和实施计划，将需求拆解为设计和任务计划，分派给 subAgent 执行。

```
/voyо-work:orchestrate <需求描述>
```

示例：

```
/voyо-work:orchestrate 实现一个用户管理模块，包含注册、登录、个人资料编辑功能
```

流程：
1. 创建需求设计文档 (`<feature_name>_design.md`)
2. 创建实现计划表 (`<feature_name>_plan.md`)
3. 选择 subAgent 执行代码实施
4. 按模块逐步完成，更新计划进度
