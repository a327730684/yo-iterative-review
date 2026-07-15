"""po-docs-db 基本功能测试。"""

import tempfile
from pathlib import Path

import pytest

from po_docs_db import PoDocsDB


@pytest.fixture
def docs(tmp_path):
    db_path = tmp_path / "data" / "docs.db"
    docs_dir = tmp_path / "docs"
    d = PoDocsDB(db_path=str(db_path), docs_dir=str(docs_dir))
    yield d
    d.close()


def test_write_and_query(docs):
    w = docs.write(
        type="前端",
        lang="vue",
        question="Vue Router 如何配置路由",
        doc_name="vue-router-config",
        content="# Vue Router 配置\n内容...",
    )
    assert w.success
    assert w.id
    assert any(k in w.keywords for k in ("vue", "router", "路由", "配置"))

    result = docs.query(type="前端", lang="vue", query="路由配置")
    assert len(result.results) >= 1
    assert result.results[0].question == "Vue Router 如何配置路由"


# def test_list_and_delete(docs):
#     docs.write(
#         type="前端", lang="react", question="React Hooks 基础",
#         doc_name="react-hooks", content="# React Hooks",
#     )
#     docs.write(
#         type="后端", lang="node", question="Node.js 连接 MySQL",
#         doc_name="node-mysql", content="# MySQL",
#     )

#     all_docs = docs.list()
#     assert len(all_docs.documents) == 2

#     front_docs = docs.list(type="前端")
#     assert len(front_docs.documents) == 1

#     target = all_docs.documents[0]
#     d = docs.delete(id=target.id)
#     assert d.success

#     after = docs.list()
#     assert len(after.documents) == 1


def test_get_by_id(docs):
    w = docs.write(
        type="前端", lang="vue", question="Vue Router 配置",
        doc_name="vue-router", content="# Vue Router",
    )
    doc = docs.get_by_id(w.id)
    assert doc is not None
    assert doc.question == "Vue Router 配置"


def test_tokenize(docs):
    words = docs.tokenize("React 如何使用 Hooks 进行状态管理")
    assert len(words) > 0
    assert "的" not in words
