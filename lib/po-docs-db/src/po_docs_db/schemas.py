"""公开类型定义。"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class WriteParams:
    type: str
    lang: str
    question: str
    doc_name: str
    content: str


@dataclass
class WriteResult:
    success: bool
    id: str
    keywords: list[str]


@dataclass
class QueryParams:
    type: str
    lang: str
    query: str
    limit: int = 5


@dataclass
class QueryResultItem:
    id: str
    question: str
    doc_path: str
    match_count: int
    matched_words: list[str]
    content: str


@dataclass
class QueryResult:
    results: list[QueryResultItem]


@dataclass
class ListParams:
    type: Optional[str] = None
    lang: Optional[str] = None


@dataclass
class ListResult:
    documents: list["Document"]


@dataclass
class DeleteParams:
    id: str


@dataclass
class DeleteResult:
    success: bool
    id: str


@dataclass
class Document:
    id: str
    type: str
    lang: str
    question: str
    doc_path: str
    created_at: Optional[str] = None


@dataclass
class SearchResult:
    id: str
    question: str
    doc_path: str
    match_count: int
    matched_words: str
