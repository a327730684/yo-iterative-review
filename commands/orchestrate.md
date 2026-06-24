---
description: Start the orchestrate implementation flow. Use when the user wants to plan and implement a feature with structured design and task management.
argument-hint: <description of the feature to implement>
---

你将启动一个结构化的代码编写流程，通过 MCP 工具来管理设计和实施计划。

## 用户输入

用户的需求：$ARGUMENTS

## 执行流程

1. **理解需求**：解析 `$ARGUMENTS`，确认用户的实现目标。如果需求模糊，先向用户澄清。

2. **调用 MCP Tool**：调用 `orchestrate_start_flow` tool 开始流程。

3. **按照 tool 返回的指引执行**：
   - 创建 `{project_dir}/work_flow/<feature_name>_design.md` 需求设计文档
   - 创建 `{project_dir}/work_flow/<feature_name>_plan.md` 实现计划表
   - 完成后调用 `orchestrate_flow2` tool

4. **继续后续流程**：根据每个 tool 的返回指引，依次调用后续的 MCP tools，直到完成整个实施流程。

## 示例用法

```
/voyо-work:orchestrate 实现一个用户管理模块，包含注册、登录、个人资料编辑功能
/voyо-work:orchestrate 开发一个博客系统，支持文章发布、评论、分类标签
```
