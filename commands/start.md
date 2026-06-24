---
description: Start an iterative implementation-review loop with quality gate. Use when the user wants code written with strict review, or invokes "/iterative-review:start".
argument-hint: <description of what to implement>
---

你将启动一个迭代式审查循环来确保代码质量。

## 用户输入

用户的需求：$ARGUMENTS

## 执行流程

1. **理解需求**：解析 `$ARGUMENTS`，确认用户的实现目标。如果需求模糊，先向用户澄清。

2. **触发 `iterative-review` Skill**：
   - 加载 `iterative-review` Skill 中定义的完整循环协议
   - 按 ROUND 1 → ROUND N 的流程执行
   - 维护 Review State，调度 `implementer` 和 `reviewer` Agent
   - 遵守 20 轮上限和所有终止条件

3. **向用户汇报最终结果**：
   - 若审查通过（APPROVED）：汇报轮次数、已修复问题、已拒绝问题、修改的文件列表
   - 若达到最大轮数：汇报当前状态、未解决问题，建议用户手动介入
   - 若陷入僵局：提示僵局原因，建议用户裁决

## 示例用法

```
/iterative-review:start 实现一个 JWT 用户登录 API，要求邮箱+密码验证、返回 access/refresh token、使用 bcrypt、支持 rate limiting
/iterative-review:start 重构 src/utils.ts 中的日期处理函数，统一使用 date-fns
```
