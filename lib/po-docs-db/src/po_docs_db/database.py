"""SQLite 倒排索引存储。"""

import sqlite3
from pathlib import Path
from typing import Optional

from .schemas import Document, SearchResult


class DocsDatabase:
    """SQLite 数据库封装，管理倒排索引的存储与查询。"""

    def __init__(self, db_path: str, docs_dir: str):
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        Path(docs_dir).mkdir(parents=True, exist_ok=True)

        self.docs_dir = docs_dir
        self.conn = sqlite3.connect(db_path)
        self.conn.row_factory = sqlite3.Row
        self._init_schema()

    # ── schema ──────────────────────────────────────────

    def _init_schema(self) -> None:
        cur = self.conn.cursor()
        cur.executescript("""
            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                lang TEXT NOT NULL,
                question TEXT NOT NULL,
                doc_path TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS keywords (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                keyword TEXT NOT NULL UNIQUE
            );

            CREATE TABLE IF NOT EXISTS doc_keywords (
                doc_id TEXT NOT NULL,
                keyword_id INTEGER NOT NULL,
                PRIMARY KEY (doc_id, keyword_id)
            );

            CREATE INDEX IF NOT EXISTS idx_keywords_keyword ON keywords(keyword);
            CREATE INDEX IF NOT EXISTS idx_doc_keywords_keyword ON doc_keywords(keyword_id);
            CREATE INDEX IF NOT EXISTS idx_documents_type_lang ON documents(type, lang);
        """)
        self.conn.commit()

    # ── 事务 ────────────────────────────────────────────

    def transaction(self):
        """事务上下文管理器。"""
        return _Transaction(self.conn)

    # ── 写入 ────────────────────────────────────────────

    def insert_document(self, doc: Document) -> None:
        self.conn.execute(
            "INSERT INTO documents (id, type, lang, question, doc_path) VALUES (?, ?, ?, ?, ?)",
            (doc.id, doc.type, doc.lang, doc.question, doc.doc_path),
        )
        self.conn.commit()

    def insert_keyword(self, keyword: str) -> int:
        """插入关键词（去重），返回 keyword id。"""
        cur = self.conn.execute("INSERT OR IGNORE INTO keywords (keyword) VALUES (?)", (keyword,))
        cur = self.conn.execute("SELECT id FROM keywords WHERE keyword = ?", (keyword,))
        return cur.fetchone()["id"]

    def insert_doc_keyword(self, doc_id: str, keyword_id: int) -> None:
        self.conn.execute(
            "INSERT OR IGNORE INTO doc_keywords (doc_id, keyword_id) VALUES (?, ?)",
            (doc_id, keyword_id),
        )
        self.conn.commit()

    # ── 查询 ────────────────────────────────────────────

    def list_documents(self, type: Optional[str] = None, lang: Optional[str] = None) -> list[Document]:
        sql = "SELECT id, type, lang, question, doc_path, created_at FROM documents"
        params: list = []
        conditions: list[str] = []
        if type:
            conditions.append("type = ?")
            params.append(type)
        if lang:
            conditions.append("lang = ?")
            params.append(lang)
        if conditions:
            sql += " WHERE " + " AND ".join(conditions)
        sql += " ORDER BY created_at DESC"
        rows = self.conn.execute(sql, params).fetchall()
        return [Document(**dict(r)) for r in rows]

    def search_by_keywords(
        self, query_terms: list[str], type: str, lang: str, limit: int = 5
    ) -> list[SearchResult]:
        if not query_terms:
            return []

        placeholders = ",".join("?" * len(query_terms))
        sql = f"""
            SELECT d.id, d.question, d.doc_path,
                   COUNT(*) AS match_count,
                   GROUP_CONCAT(k.keyword) AS matched_words
            FROM documents d
            JOIN doc_keywords dk ON d.id = dk.doc_id
            JOIN keywords k ON dk.keyword_id = k.id
            WHERE d.type = ? AND d.lang = ? AND k.keyword IN ({placeholders})
            GROUP BY d.id
            ORDER BY match_count DESC
            LIMIT ?
        """
        params = [type, lang, *query_terms, limit]
        rows = self.conn.execute(sql, params).fetchall()
        return [SearchResult(**dict(r)) for r in rows]

    def get_document(self, id: str) -> Optional[Document]:
        row = self.conn.execute(
            "SELECT id, type, lang, question, doc_path FROM documents WHERE id = ?", (id,)
        ).fetchone()
        return Document(**dict(row)) if row else None

    # ── 删除 ────────────────────────────────────────────

    def delete_document(self, doc_id: str) -> bool:
        row = self.conn.execute("SELECT id FROM documents WHERE id = ?", (doc_id,)).fetchone()
        if not row:
            return False

        with self.transaction():
            self.conn.execute("DELETE FROM doc_keywords WHERE doc_id = ?", (doc_id,))
            self.conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
            # 清理不再被引用的孤立关键词
            kw_ids = self.conn.execute(
                "SELECT keyword_id FROM doc_keywords WHERE doc_id = ?", (doc_id,)
            ).fetchall()
            for (kw_id,) in kw_ids:
                ref = self.conn.execute(
                    "SELECT COUNT(*) AS cnt FROM doc_keywords WHERE keyword_id = ?", (kw_id,)
                ).fetchone()["cnt"]
                if ref == 0:
                    self.conn.execute("DELETE FROM keywords WHERE id = ?", (kw_id,))
        return True

    # ── 资源释放 ───────────────────────────────────────

    def close(self) -> None:
        self.conn.close()


class _Transaction:
    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn

    def __enter__(self):
        self.conn.execute("BEGIN")
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc_type is None:
            self.conn.execute("COMMIT")
        else:
            self.conn.execute("ROLLBACK")
        return False
