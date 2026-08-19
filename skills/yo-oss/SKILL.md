---
name: yo-oss
description: 上传本地文件到阿里云 OSS（Alibaba Object Storage Service），基于 Node.js + @voyo/ali-oss。
---

# Alibaba OSS Upload

## ✅ 触发条件
- 用户需要上传文件到阿里云 OSS
- 用户提及 "OSS"、"ali-oss"、"上传到 oss"、"aliyun oss" 等关键词
- 用户需要把构建产物（HTML/ZIP/图片等）发布到 OSS 并获取访问链接

## 说明
需要环境变量（脚本会按 `process.env` → `~/.claude/settings.json -> env` 顺序读取，不会硬编码到代码中）：

- `OSS_REGION`：OSS 区域（建议带 `oss-` 前缀，如 `oss-cn-shanghai`；若是简写如 `shanghai` 会自动从 `OSS_ENDPOINT` 推导）
- `OSS_ENDPOINT`：OSS endpoint（可选，如 `oss-cn-shanghai.aliyuncs.com`）
- `OSS_ACCESS_KEY_ID`：AccessKey ID
- `OSS_ACCESS_KEY_SECRET`：AccessKey Secret
- `OSS_BUCKET`：Bucket 名称

## 🔧 工具详情

将单个文件或目录下所有文件上传到阿里云 OSS。

**调用方式：**

```bash
node yo-oss.mjs yo_oss_upload --file="<文件路径>" --key="<目标 key>"
node yo-oss.mjs yo_oss_upload --dir="<目录路径>" --prefix="<前缀>"
```

**参数说明：**

- `file` (string, 可选): 单个待上传文件的本地路径
- `dir` (string, 可选): 待上传目录路径，会递归上传目录下所有文件
- `key` (string, 可选): OSS 上存储的目标 key（与 `file` 配合使用）
- `prefix` (string, 可选): OSS 上存储的目录前缀（与 `dir` 配合使用），默认为 `dir` 的最后一段名

**示例：**

```bash
# 上传单个文件，自动追加唯一 id：readme-<uid>.md
node yo-oss.mjs yo_oss_upload --file="README.md" --key="test/readme.md"

# 上传整个目录，每个文件末尾追加唯一 id
node yo-oss.mjs yo_oss_upload --dir="dist" --prefix="static/dist"
```

## 特性
- **自动依赖安装**：若环境中缺少 `@voyo/ali-oss` 或 `@ztwx/utils`，脚本会自动 `npm install --no-save` 安装
- **配置自动加载**：自动从 `~/.claude/settings.json` 或进程环境变量读取 OSS 配置
- **缺失配置快速失败**：配置不全时立即报错并提示需要哪些环境变量
- **批量上传**：传入目录时递归上传所有文件
- **唯一 id 防覆盖**：强制使用 `@ztwx/utils` 的 `getUniqueId()` 生成后缀附加到文件名，避免覆盖同名远程文件