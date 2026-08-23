---
name: yo-oss
description: 上传本地文件到阿里云 OSS（Alibaba Object Storage Service），用于发布构建产物到 OSS 并获取访问链接。
---

# Alibaba OSS Upload

## ✅ 触发条件
- 用户需要上传文件到阿里云 OSS
- 用户提及 "OSS"、"ali-oss"、"上传到 oss"、"aliyun oss" 等关键词
- 用户需要把构建产物（HTML/ZIP/图片等）发布到 OSS 并获取访问链接

## 说明
将本地文件或目录发布到阿里云 OSS。使用前需要配置以下环境变量：

- `OSS_REGION`：OSS 区域（如 `oss-cn-shanghai`）
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

- `file`：单个待上传文件的本地路径
- `dir`：待上传目录路径，会递归上传目录下所有文件
- `key`：OSS 上存储的目标 key（与 `file` 配合使用）
- `prefix`：OSS 上存储的目录前缀（与 `dir` 配合使用）

**示例：**

```bash
# 上传单个文件，自动追加唯一 id：readme-<uid>.md
node yo-oss.mjs yo_oss_upload --file="README.md" --key="test/readme.md"

# 上传整个目录，每个文件末尾追加唯一 id
node yo-oss.mjs yo_oss_upload --dir="dist" --prefix="static/dist"
```

## 特性
- **开箱即用**：无需任何前置准备
- **配置自动加载**：配置不全时立即报错并提示需要哪些环境变量
- **批量上传**：传入目录时递归上传所有文件
- **防覆盖**：自动为文件名追加唯一标识，避免覆盖远程同名文件
- **支持单文件与目录**：可上传单个文件，也可递归上传整个目录