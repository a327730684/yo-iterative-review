# yo-docs-mcp 实现计划表

## 1. 项目初始化

- [x] 1.1 创建目录结构（mcps/yo-docs-mcp/ 及 src/、src/tools/、data/、docs/ 子目录）
- [x] 1.2 创建 package.json（声明依赖：@modelcontextprotocol/sdk、node-jieba；devDeps：typescript）
- [x] 1.3 创建 tsconfig.json（target ES2022、module NodeNext、outDir dist）
- [x] 1.4 执行 npm install 安装依赖

## 2. 核心模块 - database.ts

- [x] 2.1 使用 `node:sqlite` 的 DatabaseSync 建立数据库连接（读取 DB_PATH 环境变量）
- [x] 2.2 执行建表 SQL：documents 表（id, type, lang, question, doc_path, created_at）
- [x] 2.3 执行建表 SQL：keywords 表（id, keyword UNIQUE）
- [x] 2.4 执行建表 SQL：doc_keywords 表（doc_id, keyword_id 复合主键）
- [x] 2.5 创建三个索引（idx_keywords_keyword、idx_doc_keywords_keyword、idx_documents_type_lang）
- [x] 2.6 导出 db 实例

## 3. 核心模块 - tokenizer.ts

- [x] 3.1 定义停用词 Set（的、了、在、是 等常见停用词）
- [x] 3.2 实现 tokenize 函数：jieba.cut 分词 → 转小写 → 过滤停用词和单字 → 去重（注：node-jieba@0.0.3 是异步 API，tokenize 返回 Promise<string[]>）

## 4. MCP Tools - query.ts

- [x] 4.1 实现 queryDocuments 函数：对 query 分词，用 IN 子句匹配 keywords，GROUP BY 统计 match_count
- [x] 4.2 按 match_count DESC 排序，LIMIT 限制结果数
- [x] 4.3 读取对应 doc_path 文件内容，组装返回结果（含 matched_words 数组和 content）

## 5. MCP Tools - list.ts

- [x] 5.1 实现 listDocuments 函数：按 type、lang 可选条件查询 documents 表
- [x] 5.2 返回文档列表（id、type、lang、question、doc_path）

## 6. MCP Tools - write.ts

- [x] 6.1 实现 writeDocument 函数：生成 UUID，将 content 写入 docs/{doc_path} 文件
- [x] 6.2 在事务中插入 documents 记录，并对 question + content 进行分词索引
- [x] 6.3 将分词结果写入 keywords（INSERT OR IGNORE 去重）和 doc_keywords 关联表
- [x] 6.4 返回 success、id、keywords 列表

## 7. MCP Server 入口 - index.ts

- [x] 7.1 引入 @modelcontextprotocol/sdk，初始化 Server 实例（设置 name、version）
- [x] 7.2 注册 ListToolsRequestHandler，声明 query、list、write 三个工具的 schema
- [x] 7.3 注册 CallToolRequestHandler，根据 tool name 路由到对应处理函数
- [x] 7.4 使用 stdio 传输启动 Server

## 8. 文档与验证

- [x] 8.1 编写 README.md（说明功能、安装、配置、使用方法）
- [x] 8.2 执行 tsc 构建验证，确保无编译错误
