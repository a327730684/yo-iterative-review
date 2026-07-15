"""PoDocsDB 主类。"""

from __future__ import annotations

import uuid
from pathlib import Path

from .database import DocsDatabase
from .schemas import (
    DeleteParams,
    DeleteResult,
    Document,
    ListParams,
    ListResult,
    QueryParams,
    QueryResult,
    QueryResultItem,
    WriteParams,
    WriteResult,
)
from .tokenizer import tokenize


class PoDocsDB:
    """基于关键词匹配的文档知识库。

    使用 jieba 分词 + SQLite 倒排索引实现中文/英文混合的关键词搜索。

    ```python
    docs = PoDocsDB(db_path="./data/docs.db", docs_dir="./docs")
    docs.write(type="前端", lang="vue", question="...", doc_name="...", content="...")
    result = docs.query(type="前端", lang="vue", query="关键词")
    docs.close()
    ```
    """

    def __init__(self, db_path: str, docs_dir: str):
        self._db = DocsDatabase(db_path=db_path, docs_dir=docs_dir)

    # ── 写入 ────────────────────────────────────────────

    def write(self, **params: WriteParams) -> WriteResult:
        """写入文档并建立关键词索引。"""
        p = WriteParams(**params) if not isinstance(params, WriteParams) else params
        doc_id = str(uuid.uuid4())
        file_name = f"{p.doc_name}.md"
        full_path = Path(self._db.docs_dir) / file_name

        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_text(p.content, encoding="utf-8")

        keywords = tokenize(p.question)

        self._db.insert_document(
            Document(id=doc_id, type=p.type, lang=p.lang, question=p.question, doc_path=file_name)
        )
        for kw in keywords:
            kw_id = self._db.insert_keyword(kw)
            self._db.insert_doc_keyword(doc_id, kw_id)

        return WriteResult(success=True, id=doc_id, keywords=keywords)

    # ── 查询 ────────────────────────────────────────────

    def query(self, **params: QueryParams) -> QueryResult:
        """按关键词查询文档。"""
        p = QueryParams(**params) if not isinstance(params, QueryParams) else params
        terms = tokenize(p.query)
        if not terms:
            return QueryResult(results=[])

        rows = self._db.search_by_keywords(terms, p.type, p.lang, p.limit)

        results: list[QueryResultItem] = []
        for row in rows:
            doc_full = Path(self._db.docs_dir) / row.doc_path
            content = doc_full.read_text(encoding="utf-8") if doc_full.exists() else ""
            results.append(
                QueryResultItem(
                    id=row.id,
                    question=row.question,
                    doc_path=row.doc_path,
                    match_count=row.match_count,
                    matched_words=row.matched_words.split(",") if row.matched_words else [],
                    content=content,
                )
            )
        return QueryResult(results=results)

    # ── 列表 ────────────────────────────────────────────

    def list(self, **params: ListParams) -> ListResult:
        """列出文档，可按 type、lang 筛选。"""
        p = ListParams(**params) if not isinstance(params, ListParams) else params
        return ListResult(documents=self._db.list_documents(p.type, p.lang))

    # ── 删除 ────────────────────────────────────────────

    def delete(self, **params: DeleteParams) -> DeleteResult:
        """根据 id 删除文档及其关键词关联。"""
        p = DeleteParams(**params) if not isinstance(params, DeleteParams) else params
        success = self._db.delete_document(p.id)
        return DeleteResult(success=success, id=p.id)

    # ── 其他 ────────────────────────────────────────────

    def get_by_id(self, id: str) -> Document | None:
        """获取单条文档记录（不含内容）。"""
        return self._db.get_document(id)

    def tokenize(self, text: str) -> list[str]:
        """对文本分词（暴露底层能力，供外部复用）。"""
        return tokenize(text)

    def close(self) -> None:
        """关闭数据库连接。"""
        self._db.close()
