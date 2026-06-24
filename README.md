# Iterative Review Plugin

通过双 Agent（实现者 + 审查者）迭代协作，自动完成"写代码 → 审代码 → 改代码"循环，直到代码通过审查。

## 安装

```bash
claude plugin marketplace add https://github.com/a327730684/yo-iterative-review
claude plugin install voyо-iterative-review@iterative-review
```

## 使用

```
/iterative-review:start <需求描述>
```

示例：

```
/iterative-review:start 实现一个 JWT 用户登录 API，要求邮箱+密码验证、bcrypt 哈希、返回 access/refresh token
```

插件会自动：
1. 实现代码 → 2. 审查者列出缺陷 → 3. 实现者逐条判断 ACCEPT/REJECT → 4. 循环直到通过或达到上限
