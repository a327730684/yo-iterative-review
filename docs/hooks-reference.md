# Claude Code Hooks 完整参考指南

> 基于 [Claude Code 官方文档](https://code.claude.com/docs/zh-CN/hooks-guide) 整理

## 📋 一、Hook 事件类型（Events）startup

| 事件                    | 触发时机                                            | 支持 Matcher                                                                                                          |
| --------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `SessionStart`        | 会话开始或恢复时                                        | `startup`、`resume`、`clear`、`compact`                                                                                |
| `Setup`               | 使用 `--init-only`、`--init` 或 `--maintenance` 启动时 | `init`、`maintenance`                                                                                                |
| `UserPromptSubmit`    | 用户提交提示时                                         | ❌ 不支持                                                                                                               |
| `UserPromptExpansion` | 用户命令展开为提示时                                      | 命令名称（skill 或命令名）                                                                                                    |
| `PreToolUse`          | 工具调用执行前                                         | 工具名称：`Bash`、`Edit\|Write`、`mcp__.*`                                                                                 |
| `PermissionRequest`   | 权限对话框出现时                                        | 工具名称                                                                                                                |
| `PermissionDenied`    | 工具调用被拒绝时                                        | 工具名称                                                                                                                |
| `PostToolUse`         | 工具调用成功后                                         | 工具名称                                                                                                                |
| `PostToolUseFailure`  | 工具调用失败后                                         | 工具名称                                                                                                                |
| `PostToolBatch`       | 一批并行工具调用完成后                                     | ❌ 不支持                                                                                                               |
| `Notification`        | Claude Code 发送通知时                               | `permission_prompt`、`idle_prompt`、`auth_success`、`elicitation_dialog`、`elicitation_complete`、`elicitation_response` |
| `MessageDisplay`      | 助手消息文本显示时                                       | ❌ 不支持                                                                                                               |
| `SubagentStart`       | Subagent 启动时                                    | 代理类型：`general-purpose`、`Explore`、`Plan` 或自定义名称                                                                      |
| `SubagentStop`        | Subagent 完成时                                    | 代理类型（同 `SubagentStart`）                                                                                             |
| `TaskCreated`         | 创建任务时                                           | ❌ 不支持                                                                                                               |
| `TaskCompleted`       | 完成任务时                                           | ❌ 不支持                                                                                                               |
| `Stop`                | Claude 完成响应时                                    | ❌ 不支持                                                                                                               |
| `StopFailure`         | 回合因 API 错误结束时                                   | 错误类型：`rate_limit`、`overloaded`、`authentication_failed`、`billing_error`、`server_error` 等                             |
| `TeammateIdle`        | Agent team 成员即将空闲时                              | ❌ 不支持                                                                                                               |
| `InstructionsLoaded`  | CLAUDE.md 或规则文件加载时                              | 加载原因：`session_start`、`nested_traversal`、`path_glob_match`、`include`、`compact`                                       |
| `ConfigChange`        | 配置文件更改时                                         | 配置源：`user_settings`、`project_settings`、`local_settings`、`policy_settings`、`skills`                                  |
| `CwdChanged`          | 工作目录更改时                                         | ❌ 不支持                                                                                                               |
| `FileChanged`         | 监视的文件更改时                                        | 文字文件名（用 `\|` 分隔）：`.envrc\|.env`                                                                                     |
| `WorktreeCreate`      | 创建 worktree 时                                   | ❌ 不支持                                                                                                               |
| `WorktreeRemove`      | 移除 worktree 时                                   | ❌ 不支持                                                                                                               |
| `PreCompact`          | 上下文压缩前                                          | 触发原因：`manual`、`auto`                                                                                                |
| `PostCompact`         | 上下文压缩后                                          | 触发原因：`manual`、`auto`                                                                                                |
| `Elicitation`         | MCP 服务器请求用户输入时                                  | MCP 服务器名称                                                                                                           |
| `ElicitationResult`   | 用户响应 MCP 引导后                                    | MCP 服务器名称                                                                                                           |
| `SessionEnd`          | 会话终止时                                           | 结束原因：`clear`、`resume`、`logout`、`prompt_input_exit`、`bypass_permissions_disabled`、`other`                            |

***

## 🎯 二、Hook 类型（Type）

| Type       | 说明               | 超时时间                                                     | 用途                               |
| ---------- | ---------------- | -------------------------------------------------------- | -------------------------------- |
| `command`  | 运行 shell 命令      | 10 分钟（`UserPromptSubmit` 为 30 秒，`MessageDisplay` 为 10 秒） | 最常用的类型，执行确定性操作                   |
| `http`     | POST 请求到 HTTP 端点 | 10 分钟                                                    | 与外部服务集成                          |
| `mcp_tool` | 调用 MCP 服务器工具     | 10 分钟                                                    | 使用已连接的 MCP 工具                    |
| `prompt`   | 单轮 LLM 评估        | 30 秒                                                     | 需要判断的决策（返回 `{"ok": true/false}`） |
| `agent`    | 多轮验证（带工具访问）      | 60 秒                                                     | 需要检查文件或运行命令的复杂验证                 |

***

## 🔍 三、Matcher 模式详解

### 1. 工具名称匹配（适用于工具相关事件）

```json
// 单个工具
"matcher": "Bash"

// 多个工具（用 | 或 , 分隔）
"matcher": "Edit|Write"
"matcher": "Edit,Write"  // Claude Code v2.1.191+

// 正则表达式匹配 MCP 工具
"matcher": "mcp__github__.*"
"matcher": "mcp__.*__write.*"
```

### 2. 事件特定匹配

```json
// SessionStart - 会话启动类型
"matcher": "startup"    // 新会话
"matcher": "resume"     // 恢复会话
"matcher": "clear"      // 清空后
"matcher": "compact"    // 压缩后

// Notification - 通知类型
"matcher": "permission_prompt"    // 权限提示
"matcher": "idle_prompt"          // 空闲提示
"matcher": "auth_success"         // 认证成功

// SubagentStart/Stop - 代理类型
"matcher": "general-purpose"
"matcher": "Explore"
"matcher": "Plan"

// ConfigChange - 配置源
"matcher": "user_settings"
"matcher": "project_settings"
"matcher": "skills"

// FileChanged - 文件名（用 | 分隔）
"matcher": ".envrc|.env"

// SessionEnd - 结束原因
"matcher": "clear"
"matcher": "logout"
```

### 3. 使用 `if` 字段进行更精细的过滤

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(git *)",  // 只在 git 命令时触发
            "command": "..."
          }
        ]
      }
    ]
  }
}
```

`if` 支持的模式：

- `Bash(git *)` - 匹配 git 命令
- `Bash(git push *)` - 匹配特定 git 子命令
- `Edit(*.ts)` - 匹配特定文件类型

***

## 📊 四、退出代码含义

| 退出代码 | 含义                         |
| ---- | -------------------------- |
| `0`  | 没有异议，操作正常进行                |
| `2`  | 阻止操作（stderr 信息会反馈给 Claude） |
| 其他   | 操作继续，但显示 hook 错误通知         |

***

## 💡 五、配置位置

| 位置                            | 作用域      | 可共享          |
| ----------------------------- | -------- | ------------ |
| `~/.claude/settings.json`     | 所有项目（全局） | 否，本地到你的机器    |
| `.claude/settings.json`       | 单个项目     | 是，可以提交到仓库    |
| `.claude/settings.local.json` | 单个项目     | 否，gitignored |
| 托管策略设置                        | 组织范围     | 是，管理员控制      |
| Plugin `hooks/hooks.json`     | 启用插件时    | 是，与插件捆绑      |

***

## 🔧 六、常见用例示例

### 1. 桌面通知（Claude 需要输入时）

```json
{
  "hooks": {
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "osascript -e 'display notification \"Claude Code needs your attention\" with title \"Claude Code\"'"
          }
        ]
      }
    ]
  }
}
```

### 2. 自动格式化代码（编辑后）

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "jq -r '.tool_input.file_path' | xargs npx prettier --write"
          }
        ]
      }
    ]
  }
}
```

### 3. 阻止对受保护文件的编辑

创建脚本 `.claude/hooks/protect-files.sh`：

```bash
#!/bin/bash
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

PROTECTED_PATTERNS=(".env" "package-lock.json" ".git/")

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  if [[ "$FILE_PATH" == *"$pattern"* ]]; then
    echo "Blocked: $FILE_PATH matches protected pattern '$pattern'" >&2
    exit 2
  fi
done

exit 0
```

注册 hook：

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/protect-files.sh"
          }
        ]
      }
    ]
  }
}
```

### 4. 压缩后重新注入上下文

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "compact",
        "hooks": [
          {
            "type": "command",
            "command": "echo 'Reminder: use Bun, not npm. Run bun test before committing. Current sprint: auth refactor.'"
          }
        ]
      }
    ]
  }
}
```

### 5. 自动批准特定权限

```json
{
  "hooks": {
    "PermissionRequest": [
      {
        "matcher": "ExitPlanMode",
        "hooks": [
          {
            "type": "command",
            "command": "echo '{\"hookSpecificOutput\": {\"hookEventName\": \"PermissionRequest\", \"decision\": {\"behavior\": \"allow\"}}}'"
          }
        ]
      }
    ]
  }
}
```

### 6. 基于提示的 Hook（需要 LLM 判断）

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Check if all tasks are complete. If not, respond with {\"ok\": false, \"reason\": \"what remains to be done\"}."
          }
        ]
      }
    ]
  }
}
```

### 7. 基于代理的 Hook（复杂验证）

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "agent",
            "prompt": "Verify that all unit tests pass. Run the test suite and check the results. $ARGUMENTS",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

### 8. HTTP Hook（发送到外部服务）

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "hooks": [
          {
            "type": "http",
            "url": "http://localhost:8080/hooks/tool-use",
            "headers": {
              "Authorization": "Bearer $MY_TOKEN"
            },
            "allowedEnvVars": ["MY_TOKEN"]
          }
        ]
      }
    ]
  }
}
```

***

## ⚠️ 七、限制和注意事项

### 限制

- 命令 hooks 仅通过 stdout、stderr 和退出代码通信，无法触发 `/` 命令或工具调用
- Hook 超时因类型而异，可通过 `timeout` 字段覆盖
- `PostToolUse` hooks 无法撤销操作（工具已执行）
- `PermissionRequest` hooks 不在非交互模式（`-p`）中触发
- `Stop` hooks 在 Claude 完成响应时触发，不仅限于任务完成
- 多个 PreToolUse hooks 返回 `updatedInput` 时，最后完成的获胜（非确定性）

### Hooks 和权限模式

- PreToolUse hooks 在权限模式检查**之前**触发
- 返回 `permissionDecision: "deny"` 的 hook 会阻止工具，即使在 `bypassPermissions` 模式下
- 返回 `"allow"` 的 hook **不会**绕过来自设置的拒绝规则
- Hooks 可以收紧限制，但不能放松它们超过权限规则允许的范围

### Agent 特定的 Hooks

- Hooks 是按**事件**注册的，不是按 agent 注册
- `SubagentStart` 和 `SubagentStop` 事件可以使用 matcher 针对特定 agent 类型
- 工具事件（如 `PreToolUse`）的 matcher 基于工具名称，不能区分是哪个 agent 调用的

***

## 🔧 八、故障排除

### Hook 未触发

1. 运行 `/hooks` 确认 hook 出现在正确的事件下
2. 检查 matcher 模式是否与工具名称完全匹配（区分大小写）
3. 验证是否触发了正确的事件类型
4. 非交互模式中使用 `PermissionRequest` hooks 时，改用 `PreToolUse`

### Hook 输出错误

1. 手动测试脚本：
   ```bash
   echo '{"tool_name":"Bash","tool_input":{"command":"ls"}}' | ./my-hook.sh
   echo $?
   ```
2. 使用绝对路径或 `${CLAUDE_PROJECT_DIR}` 引用脚本
3. 安装 `jq` 或使用 Python/Node.js 进行 JSON 解析
4. 确保脚本可执行：`chmod +x ./my-hook.sh`

### Stop Hook 达到阻止上限

Claude Code 在 Stop hook 连续阻止 8 次后会覆盖它。脚本需要检查 `stop_hook_active` 字段：

```bash
#!/bin/bash
INPUT=$(cat)
if [ "$(echo "$INPUT" | jq -r '.stop_hook_active')" = "true" ]; then
  exit 0  # 允许 Claude 停止
fi
# ... hook 逻辑
```

### 调试技术

1. 使用 `Ctrl+O` 切换成绩单视图查看 hook 摘要
2. 使用 `claude --debug-file /tmp/claude.log` 启动以获取完整日志
3. 在会话中运行 `/debug` 启用日志记录

***

## 📚 九、参考资源

- [Hooks 完整参考文档](https://code.claude.com/docs/zh-CN/hooks) - 完整的事件架构、JSON 输出格式
- [Hooks 使用指南](https://code.claude.com/docs/zh-CN/hooks-guide) - 入门教程和常见用例
- [权限管理](https://code.claude.com/docs/zh-CN/permissions) - 权限规则和模式
- [环境变量](https://code.claude.com/docs/zh-CN/env-vars) - `CLAUDE_ENV_FILE` 等环境变量说明

***

*最后更新：2026-06-26*
