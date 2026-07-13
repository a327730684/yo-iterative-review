# po-docs-db — 基于关键词匹配的文档知识库
#
# 使用 jieba 分词 + SQLite 倒排索引，提供中文/英文混合的关键词搜索。
#
# ```python
# from po_docs_db import PoDocsDB
#
# docs = PoDocsDB(db_path="./data/docs.db", docs_dir="./docs")
# docs.write(type="前端", lang="vue", question="...", doc_name="...", content="...")
# result = docs.query(type="前端", lang="vue", query="关键词")
# docs.close()
# ```

from .db import PoDocsDB
from .schemas import (
    WriteParams,
    WriteResult,
    QueryParams,
    QueryResult,
    QueryResultItem,
    ListParams,
    ListResult,
    DeleteParams,
    DeleteResult,
    Document,
    SearchResult,
)

__all__ = [
    "PoDocsDB",
    "WriteParams",
    "WriteResult",
    "QueryParams",
    "QueryResult",
    "QueryResultItem",
    "ListParams",
    "ListResult",
    "DeleteParams",
    "DeleteResult",
    "Document",
    "SearchResult",
]
