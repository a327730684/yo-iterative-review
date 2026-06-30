# Claude Code 初学者快速指南

Claude Code 是 Anthropic 官方推出的终端命令行工具，用于 AI 辅助编程。使用国内模型时，需通过配置文件接入支持 Anthropic API 兼容格式的平台。

## 安装

```bash
npm install -g @anthropic-ai/claude-code
```

## 配置国内模型

### 1. 跳过官方登录

`~/.claude.json`：

```json
{
  "hasCompletedOnboarding": true
}
```

### 2. 配置 API 信息

`~/.claude/settings.json`：

```json
{
  "env": {
    "ANTHROPIC_BASE_URL": "https://api.moonshot.cn/anthropic/",
    "ANTHROPIC_API_KEY": "sk-你的API-Key",
    "ANTHROPIC_MODEL": "kimi-k2.7-code"
  }
}
```

| 字段 | 说明 |
|------|------|
| `ANTHROPIC_BASE_URL` | 模型商的 Anthropic 兼容接入地址 |
| `ANTHROPIC_API_KEY` | 你的 API Key |
| `ANTHROPIC_MODEL` | 模型名称 |

### 3. 启动

```bash
claude . --dangerously-skip-permissions
```

## 国内模型商参考

| 厂商 | `ANTHROPIC_BASE_URL` | 模型示例 | 备注 |
|------|----------------------|----------|------|
| Kimi | `https://api.moonshot.cn/anthropic/` | `kimi-k2.7-code` | 默认思考模式 |
| DeepSeek | `https://api.deepseek.com/anthropic` | `deepseek-v4-pro` | deepseek-chat 将于 2026/07/24 弃用 |
| 阿里百炼 | `https://coding.dashscope.aliyuncs.com/v1` | `qwen3.7-plus` | 需订阅 Coding Plan |
| 智谱 GLM | `https://maas-coding-api.cn-huabei-1.xf-yun.com/anthropic` | `glm-5.2` | 讯飞 MaaS Coding Plan |

> `ANTHROPIC_BASE_URL` 末尾斜杠以平台文档为准，填错会 404。阿里百炼和讯飞 MaaS 需订阅 Coding Plan 套餐。

## Skills

`~/.claude/skills/`（用户级）或项目 `.claude/skills/`（项目级），创建 `.md` 文件。

对话中通过 `/文件名` 触发。

## MCP

`~/.claude.json` 中配置 `mcpServers`：

```json
{
  "hasCompletedOnboarding": true,
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "mcp-server-package"]
    }
  }
}
```

## 项目提示词

项目根目录创建 `.claude/CLAUDE.md`，Claude Code 启动时自动读取作为项目级上下文。

## 常用命令

| 命令 | 作用 |
|------|------|
| `/add 文件路径` | 将文件加入上下文 |
| `/model` | 查看/切换模型 |
| `/cost` | 查看 token 消耗 |
| `/help` | 查看所有命令 |
| `exit` | 退出 |
