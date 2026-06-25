---
name: yo-web-search
description: 当需要了解外部知识时，使用此工具。如查询百科、时事新闻、天气等信息。
---

# WEB SEARCH

## ✅ 触发条件
- 用户请求使用 API 服务提供的功能
- 用户提及的工具名称包含："bailian_web_search"
- 用户描述的需求与以下功能匹配：搜索可用于查询百科知识、时事新闻、天气等信息

## 说明
需要配置ALI_API_TOKEN环境变量，值为Bailian API_KEY

## 🔧 工具详情

搜索可用于查询百科知识、时事新闻、天气等信息

**调用方式：**

```bash
node yo-web-search.js bailian_web_search --query="<value>" --count="<value>"
```

**参数说明：**

- `query` (string, 必填): user query in the format of string
- `count` (integer): number of search results, adjust 10