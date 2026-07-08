"""Runtime SQL conversion layer: MySQL dialect → Oracle dialect.

This module sits on top of :mod:`yo_oracle.conn_pool` and transparently rewrites
SQL written for MySQL so it runs on Oracle.  It also rebinds positional
parameters (``%s`` → ``:1``, ``:2`` …) and exposes the same ``Row`` / cursor
behaviour as the underlying pool.

Conversion rules
----------------
* ``%s`` positional placeholders → ``:1``, ``:2`` …
* ``NOW()`` → ``SYSDATE``
* ``IFNULL(a, b)`` → ``NVL(a, b)``
* ``GROUP_CONCAT(...)`` → ``LISTAGG(...) WITHIN GROUP (ORDER BY ...)``
* ``DATE_FORMAT(dt, fmt)`` → ``TO_CHAR(dt, 'oracle-mask')``
* ``LIMIT n`` → ``FETCH FIRST n ROWS ONLY``
* ``LIMIT n OFFSET m`` → ``OFFSET m ROWS FETCH NEXT n ROWS ONLY``
* ``INSERT IGNORE INTO tbl (...) VALUES (...)`` → ``MERGE INTO tbl ...``
* ``INSERT ... ON DUPLICATE KEY UPDATE ...`` → ``MERGE INTO tbl ... WHEN MATCHED THEN UPDATE ... WHEN NOT MATCHED THEN INSERT ...``

Security
--------
* SQL text is rewritten by a parser that only recognises structural patterns.
* Values are **never** interpolated into the SQL string.  Bind placeholders are
  renamed, not replaced with literal values, so parameter binding protects
  against SQL injection.
* ``INSERT IGNORE`` / ``ON DUPLICATE KEY UPDATE`` conversions need the table's
  unique-key columns.  If the converter does not have this metadata it raises
  :class:`SQLConversionError` instead of emitting incorrect ``MERGE`` statements.
"""

from __future__ import annotations

import logging
import re
import threading
from collections.abc import Callable, Sequence
from typing import Any, Optional

from yo_oracle.conn_pool import ConnectionPool, CursorWrapper

logger = logging.getLogger(__name__)


class SQLConversionError(Exception):
    """Raised when a MySQL statement cannot be safely converted to Oracle."""


# ---------------------------------------------------------------------------
# MySQL → Oracle format masks for DATE_FORMAT / TO_CHAR
# ---------------------------------------------------------------------------
_MYSQL_TO_ORACLE_FORMAT: tuple[tuple[str, str], ...] = (
    ("%Y", "YYYY"),
    ("%y", "YY"),
    ("%m", "MM"),
    ("%c", "MM"),  # no leading-zero removal in Oracle mask
    ("%d", "DD"),
    ("%e", "DD"),
    ("%H", "HH24"),
    ("%k", "HH24"),
    ("%h", "HH"),
    ("%I", "HH"),
    ("%i", "MI"),
    ("%s", "SS"),
    ("%S", "SS"),
    ("%f", "FF"),
    ("%p", "AM"),
    ("%W", "Day"),
    ("%a", "Dy"),
    ("%M", "Month"),
    ("%b", "Mon"),
    ("%w", "D"),  # day of week (1-7) — Oracle D uses 1-7 for Sun-Sat by default
    ("%j", "DDD"),
    ("%U", "WW"),
    ("%u", "IW"),
    ("%%", "%"),
)


def _convert_date_format_mask(mysql_mask: str) -> str:
    """Translate a MySQL DATE_FORMAT mask to an Oracle TO_CHAR mask."""
    oracle_mask = mysql_mask
    for mysql_token, oracle_token in _MYSQL_TO_ORACLE_FORMAT:
        oracle_mask = oracle_mask.replace(mysql_token, oracle_token)
    return oracle_mask


# ---------------------------------------------------------------------------
# SQL conversion helpers
# ---------------------------------------------------------------------------
_RE_IDENTIFIER = re.compile(r"`?([a-zA-Z_][a-zA-Z0-9_#$]*)`?")


def _split_columns(col_string: str) -> list[str]:
    """Split a comma-separated column list, respecting backtick quoting."""
    cols: list[str] = []
    depth = 0
    current: list[str] = []
    for ch in col_string:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        elif ch == "," and depth == 0:
            cols.append("".join(current).strip())
            current = []
            continue
        current.append(ch)
    if current:
        cols.append("".join(current).strip())
    return cols


class SQLConverter:
    """Stateful converter that can be registered with table unique keys."""

    def __init__(self) -> None:
        self._table_keys: dict[str, list[str]] = {}
        self._lock = threading.Lock()

    def register_unique_keys(self, table: str, keys: Sequence[str]) -> None:
        """Register the unique-key column(s) for a table.

        Required for converting ``INSERT IGNORE`` and
        ``ON DUPLICATE KEY UPDATE`` to ``MERGE``.
        """
        with self._lock:
            self._table_keys[table.lower()] = [k.lower() for k in keys]

    def get_unique_keys(self, table: str) -> Optional[list[str]]:
        with self._lock:
            return self._table_keys.get(table.lower())

    # -----------------------------------------------------------------------
    # Public entry point
    # -----------------------------------------------------------------------
    def convert(self, sql: str, params: Optional[Sequence[Any]] = None) -> tuple[str, Optional[Sequence[Any]]]:
        """Convert a MySQL SQL string to Oracle SQL and rebind parameters.

        Returns ``(oracle_sql, oracle_params)``.  ``oracle_params`` is the same
        sequence as ``params`` unless the converter had to reorder or duplicate
        values for a ``MERGE`` statement.
        """
        original = sql
        sql = self._normalize_whitespace(sql)

        # Convert functions and simple expressions first.
        sql = self._convert_ifnull(sql)
        sql = self._convert_group_concat(sql)
        sql = self._convert_date_format(sql)
        sql = self._convert_now(sql)

        # Convert INSERT IGNORE / ON DUPLICATE KEY UPDATE before LIMIT because
        # MERGE does not support LIMIT.
        upper = sql.upper()
        if upper.startswith("INSERT IGNORE"):
            sql, params = self._convert_insert_ignore(sql, params)
        elif "ON DUPLICATE KEY UPDATE" in upper:
            sql, params = self._convert_on_duplicate_key_update(sql, params)

        # LIMIT must be converted after MERGE because MERGE does not support it.
        sql = self._convert_limit(sql)

        # Finally rebind positional placeholders.
        sql, params = self._rebind_parameters(sql, params)

        logger.debug("converted SQL:\n%s\n[original: %s]", sql, original)
        return sql, params

    # -----------------------------------------------------------------------
    # Rule implementations
    # -----------------------------------------------------------------------
    @staticmethod
    def _normalize_whitespace(sql: str) -> str:
        # Preserve literal strings by only normalising whitespace outside quotes.
        result: list[str] = []
        in_string = False
        string_char = ""
        prev_ws = False
        i = 0
        while i < len(sql):
            ch = sql[i]
            if not in_string and ch in ("'", '"'):
                in_string = True
                string_char = ch
                result.append(ch)
                prev_ws = False
            elif in_string and ch == string_char:
                # Handle escaped quotes (Oracle/MySQL style '' or \").
                if i + 1 < len(sql) and sql[i + 1] == string_char:
                    result.append(ch)
                    result.append(ch)
                    i += 1
                else:
                    in_string = False
                    string_char = ""
                    result.append(ch)
                prev_ws = False
            elif not in_string and ch.isspace():
                if not prev_ws:
                    result.append(" ")
                    prev_ws = True
            else:
                result.append(ch)
                prev_ws = False
            i += 1
        return "".join(result).strip()

    @staticmethod
    def _convert_now(sql: str) -> str:
        # Match NOW() not inside an identifier.
        return re.sub(r"\bNOW\s*\(\s*\)", "SYSDATE", sql, flags=re.IGNORECASE)

    @staticmethod
    def _convert_ifnull(sql: str) -> str:
        return re.sub(r"\bIFNULL\s*\(", "NVL(", sql, flags=re.IGNORECASE)

    def _convert_group_concat(self, sql: str) -> str:
        """Convert ``GROUP_CONCAT(expr [ORDER BY ...] [SEPARATOR ...])``."""

        def repl(match: re.Match[str]) -> str:
            inner = match.group(1).strip()
            distinct = ""
            if inner.upper().startswith("DISTINCT "):
                distinct = "DISTINCT "
                inner = inner[len("DISTINCT "):].strip()

            # Split on SEPARATOR (case-insensitive, not inside parentheses/quotes).
            separator = ","
            sep_match = re.search(r"\bSEPARATOR\s+'([^']*)'", inner, re.IGNORECASE)
            if sep_match:
                separator = sep_match.group(1)
                inner = inner[: sep_match.start()].strip()

            # Split on ORDER BY.
            order_by = ""
            ob_match = re.search(r"\bORDER\s+BY\b", inner, re.IGNORECASE)
            if ob_match:
                order_by = inner[ob_match.start():].strip()
                inner = inner[: ob_match.start()].strip()

            return (
                f"LISTAGG({distinct}{inner}, '{separator}') "
                f"WITHIN GROUP ({order_by})"
            )

        return re.sub(r"\bGROUP_CONCAT\s*\(([^)]+)\)", repl, sql, flags=re.IGNORECASE)

    def _convert_date_format(self, sql: str) -> str:
        def repl(match: re.Match[str]) -> str:
            expr = match.group(1).strip()
            mask = match.group(2).strip()
            # Remove surrounding quotes if present.
            if (mask.startswith("'") and mask.endswith("'")) or (
                mask.startswith('"') and mask.endswith('"')
            ):
                mask = mask[1:-1]
            oracle_mask = _convert_date_format_mask(mask)
            return f"TO_CHAR({expr}, '{oracle_mask}')"

        return re.sub(
            r"\bDATE_FORMAT\s*\(\s*([^,]+),\s*('[^']*'|\"[^\"]*\")\s*\)",
            repl,
            sql,
            flags=re.IGNORECASE,
        )

    def _convert_limit(self, sql: str) -> str:
        """Convert MySQL ``LIMIT n [OFFSET m]`` / ``LIMIT m, n`` to Oracle 12c+."""
        # Pattern: LIMIT <offset>, <count>
        m = re.search(r"\bLIMIT\s+(\d+)\s*,\s*(\d+)\s*$", sql, re.IGNORECASE)
        if m:
            offset = int(m.group(1))
            count = int(m.group(2))
            prefix = sql[: m.start()].rstrip()
            return f"{prefix} OFFSET {offset} ROWS FETCH NEXT {count} ROWS ONLY"

        # Pattern: LIMIT <count> OFFSET <offset>
        m = re.search(r"\bLIMIT\s+(\d+)\s+OFFSET\s+(\d+)\s*$", sql, re.IGNORECASE)
        if m:
            count = int(m.group(1))
            offset = int(m.group(2))
            prefix = sql[: m.start()].rstrip()
            return f"{prefix} OFFSET {offset} ROWS FETCH NEXT {count} ROWS ONLY"

        # Pattern: LIMIT <count>
        m = re.search(r"\bLIMIT\s+(\d+)\s*$", sql, re.IGNORECASE)
        if m:
            count = int(m.group(1))
            prefix = sql[: m.start()].rstrip()
            return f"{prefix} FETCH FIRST {count} ROWS ONLY"

        return sql

    # -----------------------------------------------------------------------
    # INSERT IGNORE → MERGE
    # -----------------------------------------------------------------------
    def _convert_insert_ignore(
        self, sql: str, params: Optional[Sequence[Any]]
    ) -> tuple[str, Optional[Sequence[Any]]]:
        # INSERT IGNORE INTO table [(cols)] VALUES (vals)
        m = re.match(
            r"INSERT\s+IGNORE\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_#$]*)\s*"
            r"(?:\(([\s\S]+?)\))?\s*"
            r"VALUES\s*\(([\s\S]+?)\)\s*$",
            sql,
            re.IGNORECASE,
        )
        if not m:
            raise SQLConversionError(
                "INSERT IGNORE conversion only supports simple single-row INSERT statements"
            )

        table = m.group(1)
        cols = _split_columns(m.group(2)) if m.group(2) else []
        vals = _split_columns(m.group(3)) if m.group(3) else []

        if len(cols) != len(vals):
            raise SQLConversionError(
                f"INSERT IGNORE column count ({len(cols)}) does not match value count ({len(vals)})"
            )

        keys = self.get_unique_keys(table)
        if not keys:
            raise SQLConversionError(
                f"cannot convert INSERT IGNORE for table {table!r}: "
                "unique key columns not registered; call register_unique_keys()"
            )

        missing_keys = [k for k in keys if k.lower() not in [c.lower().strip("`") for c in cols]]
        if missing_keys:
            raise SQLConversionError(
                f"INSERT IGNORE for table {table!r} is missing unique key columns: {missing_keys}"
            )

        # Build USING source with aliases for every column.
        source_cols = [f"{v} AS {c.strip('`')}" for v, c in zip(vals, cols)]
        using = "SELECT " + ", ".join(source_cols) + " FROM DUAL"

        on_clause = " AND ".join(
            f"t.{k} = s.{k}" for k in keys
        )

        insert_cols = ", ".join(c.strip("`") for c in cols)
        insert_vals = ", ".join(f"s.{c.strip('`')}" for c in cols)

        merged = (
            f"MERGE INTO {table} t "
            f"USING ({using}) s "
            f"ON ({on_clause}) "
            f"WHEN NOT MATCHED THEN INSERT ({insert_cols}) VALUES ({insert_vals})"
        )
        return merged, params

    # -----------------------------------------------------------------------
    # ON DUPLICATE KEY UPDATE → MERGE
    # -----------------------------------------------------------------------
    def _convert_on_duplicate_key_update(
        self, sql: str, params: Optional[Sequence[Any]]
    ) -> tuple[str, Optional[Sequence[Any]]]:
        # INSERT INTO table [(cols)] VALUES (vals) ON DUPLICATE KEY UPDATE ...
        m = re.match(
            r"INSERT\s+INTO\s+([a-zA-Z_][a-zA-Z0-9_#$]*)\s*"
            r"(?:\(([\s\S]+?)\))?\s*"
            r"VALUES\s*\(([\s\S]+?)\)\s*"
            r"ON\s+DUPLICATE\s+KEY\s+UPDATE\s+([\s\S]+)$",
            sql,
            re.IGNORECASE,
        )
        if not m:
            raise SQLConversionError(
                "ON DUPLICATE KEY UPDATE conversion only supports simple single-row INSERT statements"
            )

        table = m.group(1)
        cols = _split_columns(m.group(2)) if m.group(2) else []
        vals = _split_columns(m.group(3)) if m.group(3) else []
        update_clause = m.group(4).strip()

        if len(cols) != len(vals):
            raise SQLConversionError("column count does not match value count")

        keys = self.get_unique_keys(table)
        if not keys:
            raise SQLConversionError(
                f"cannot convert ON DUPLICATE KEY UPDATE for table {table!r}: "
                "unique key columns not registered; call register_unique_keys()"
            )

        col_map = {c.lower().strip("`"): c.strip("`") for c in cols}

        # Parse assignments like `col = VALUES(col)` or `col = col + VALUES(col)`.
        updates = _split_columns(update_clause)
        set_clauses: list[str] = []
        for assignment in updates:
            if "=" not in assignment:
                raise SQLConversionError(f"invalid UPDATE assignment: {assignment!r}")
            left, right = assignment.split("=", 1)
            left = left.strip().strip("`")
            right = self._rewrite_values_function(right.strip(), col_map)
            set_clauses.append(f"t.{left} = {right}")

        source_cols = [f"{v} AS {c.strip('`')}" for v, c in zip(vals, cols)]
        using = "SELECT " + ", ".join(source_cols) + " FROM DUAL"

        on_clause = " AND ".join(f"t.{k} = s.{k}" for k in keys)
        update_set = ", ".join(set_clauses)
        insert_cols = ", ".join(c.strip("`") for c in cols)
        insert_vals = ", ".join(f"s.{c.strip('`')}" for c in cols)

        merged = (
            f"MERGE INTO {table} t "
            f"USING ({using}) s "
            f"ON ({on_clause}) "
            f"WHEN MATCHED THEN UPDATE SET {update_set} "
            f"WHEN NOT MATCHED THEN INSERT ({insert_cols}) VALUES ({insert_vals})"
        )
        return merged, params

    @staticmethod
    def _rewrite_values_function(expr: str, col_map: dict[str, str]) -> str:
        """Rewrite MySQL ``VALUES(col)`` to ``s.col`` in ON DUPLICATE KEY UPDATE."""

        def repl(match: re.Match[str]) -> str:
            col = match.group(1).strip().strip("`").lower()
            if col not in col_map:
                raise SQLConversionError(
                    f"VALUES({col!r}) references a column not present in the INSERT list"
                )
            return f"s.{col_map[col]}"

        return re.sub(r"VALUES\s*\(\s*([a-zA-Z_][a-zA-Z0-9_#$]*)\s*\)", repl, expr, flags=re.IGNORECASE)

    # -----------------------------------------------------------------------
    # Parameter rebinding: %s → :1, :2, ...
    # -----------------------------------------------------------------------
    @staticmethod
    def _rebind_parameters(
        sql: str, params: Optional[Sequence[Any]]
    ) -> tuple[str, Optional[Sequence[Any]]]:
        """Rename ``%s`` placeholders to Oracle ``:n`` style."""
        if "%s" not in sql:
            return sql, params

        # Mixing MySQL %s binds with Oracle :n binds is ambiguous.
        if re.search(r":\d+\b", sql):
            raise SQLConversionError(
                "cannot mix MySQL %s placeholders with Oracle :n placeholders"
            )

        parts = sql.split("%s")
        if params is not None and len(parts) - 1 != len(params):
            raise SQLConversionError(
                f"parameter count mismatch: {len(parts) - 1} placeholders vs {len(params)} values"
            )

        result: list[str] = []
        for i, part in enumerate(parts[:-1]):
            result.append(part)
            result.append(f":{i + 1}")
        result.append(parts[-1])
        return "".join(result), params


# ---------------------------------------------------------------------------
# Pool wrapper
# ---------------------------------------------------------------------------
class DBPool:
    """High-level pool that converts MySQL SQL on the fly for Oracle.

    Example::

        db = DBPool(dsn="localhost:1521/XEPDB1", user="app", password="app")
        db.register_unique_keys("users", ["id"])

        with db.connection() as conn:
            conn.cursor().execute(
                "INSERT IGNORE INTO users(id, name) VALUES (%s, %s)",
                [1, "Alice"],
            )
    """

    def __init__(self, *args: Any, **kwargs: Any) -> None:
        self._pool = ConnectionPool(*args, **kwargs)
        self._converter = SQLConverter()

    @property
    def pool(self) -> ConnectionPool:
        return self._pool

    def register_unique_keys(self, table: str, keys: Sequence[str]) -> None:
        self._converter.register_unique_keys(table, keys)

    def convert_sql(
        self, sql: str, params: Optional[Sequence[Any]] = None
    ) -> tuple[str, Optional[Sequence[Any]]]:
        return self._converter.convert(sql, params)

    @property
    def stats(self) -> Any:
        return self._pool.stats()

    def acquire(self) -> "DBConnection":
        return DBConnection(self._pool.acquire(), self._converter)

    def close(self) -> None:
        self._pool.close()

    def connection(self) -> Any:
        return _DBConnectionContext(self)


class DBConnection:
    """Connection-like object that auto-converts SQL before executing."""

    __slots__ = ("_conn", "_converter")

    def __init__(self, conn: Any, converter: SQLConverter) -> None:
        self._conn = conn
        self._converter = converter

    def cursor(self) -> "DBCursorWrapper":
        return DBCursorWrapper(self._conn.cursor(), self._converter)

    @property
    def raw(self) -> Any:
        return self._conn.raw

    def close(self) -> None:
        self._conn.close()

    def commit(self) -> None:
        self._conn.raw.commit()

    def rollback(self) -> None:
        self._conn.raw.rollback()


class DBCursorWrapper:
    """Cursor that converts MySQL SQL to Oracle SQL on every execute."""

    __slots__ = ("_cursor", "_converter")

    def __init__(self, cursor: CursorWrapper, converter: SQLConverter) -> None:
        self._cursor = cursor
        self._converter = converter

    def execute(
        self, sql: str, params: Optional[Sequence[Any]] = None, **kwargs: Any
    ) -> "DBCursorWrapper":
        oracle_sql, oracle_params = self._converter.convert(sql, params)
        self._cursor.execute(oracle_sql, oracle_params, **kwargs)
        return self

    def executemany(
        self, sql: str, params_list: Sequence[Optional[Sequence[Any]]]
    ) -> "DBCursorWrapper":
        if not params_list:
            return self
        oracle_sql, _ = self._converter.convert(sql, params_list[0])
        self._cursor.executemany(oracle_sql, params_list)
        return self

    def fetchone(self) -> Optional[Any]:
        return self._cursor.fetchone()

    def fetchall(self) -> list[Any]:
        return self._cursor.fetchall()

    def fetchmany(self, size: Optional[int] = None) -> list[Any]:
        return self._cursor.fetchmany(size)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._cursor, name)

    def __iter__(self) -> Iterator[Any]:
        return iter(self._cursor)


class _DBConnectionContext:
    """Context manager returned by ``DBPool.connection()``."""

    def __init__(self, db_pool: DBPool) -> None:
        self._db_pool = db_pool
        self._conn: Optional[DBConnection] = None

    def __enter__(self) -> DBConnection:
        self._conn = self._db_pool.acquire()
        return self._conn

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        if self._conn is not None:
            self._conn.close()


__all__ = [
    "DBPool",
    "DBConnection",
    "DBCursorWrapper",
    "SQLConverter",
    "SQLConversionError",
]
