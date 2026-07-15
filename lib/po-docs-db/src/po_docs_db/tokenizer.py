"""jieba 分词封装。"""

import jieba

_STOPWORDS = {
    "的", "了", "在", "是", "我", "有", "和", "就", "不", "人",
    "都", "一", "一个", "上", "也", "很", "到", "说", "要", "去",
    "你", "会", "着", "没有", "看", "好", "自己", "这", "他", "她",
    "它", "们", "那", "些",
}


def tokenize(text: str) -> list[str]:
    """jieba 分词 → 转小写 → 过滤停用词和单字 → 去重。"""
    if not text or not text.strip():
        return []

    words = jieba.cut(text, cut_all=False)
    seen: set[str] = set()
    result: list[str] = []
    for w in words:
        w = w.lower().strip()
        if len(w) > 1 and w not in _STOPWORDS and w not in seen:
            seen.add(w)
            result.append(w)
    return result
