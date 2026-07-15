# po-docs-db

基于关键词匹配的文档知识库，使用 jieba 分词 + SQLite 倒排索引，提供中文/英文混合的关键词搜索。

## 安装

```bash
pip install po-docs-db
```

## 使用

```python
from po_docs_db import PoDocsDB

docs = PoDocsDB(db_path="./data/docs.db", docs_dir="./docs")

# 写入文档
docs.write(
    type="前端",
    lang="vue",
    question="Font Awesome 在 Vue 中如何使用",
    doc_name="fontawesome-usage",
    content="# Font Awesome\n...",
)

# 查询
result = docs.query(type="前端", lang="vue", query="fontawesome 图标")
for item in result.results:
    print(f"{item.doc_path} | 匹配 {item.match_count} 个词: {item.matched_words}")

# 关闭
docs.close()
```

## 许可证

MIT
