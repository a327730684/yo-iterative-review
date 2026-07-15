"""Unit tests for the MySQL → Oracle SQL conversion layer.

These tests do not require a running Oracle database; they exercise the SQL
rewriting and parameter-rebinding logic only.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import pytest

from group_chat_sentiment.db_pool import SQLConversionError, SQLConverter
from yo_oracle.conn_pool import Row


@pytest.fixture
def converter():
    c = SQLConverter()
    c.register_unique_keys("users", ["id"])
    c.register_unique_keys("chat_messages", ["chat_id", "msg_id"])
    return c


class TestBasicConversions:
    def test_positional_parameters(self, converter):
        sql, params = converter.convert(
            "SELECT * FROM users WHERE id = %s AND name = %s", [1, "alice"]
        )
        assert "id = :1" in sql
        assert "name = :2" in sql
        assert "%s" not in sql
        assert params == [1, "alice"]

    def test_now(self, converter):
        sql, _ = converter.convert("SELECT NOW() FROM DUAL")
        assert "SYSDATE" in sql
        assert "NOW()" not in sql

    def test_ifnull(self, converter):
        sql, _ = converter.convert("SELECT IFNULL(name, 'unknown') FROM users")
        assert "NVL(name, 'unknown')" in sql

    def test_date_format(self, converter):
        sql, _ = converter.convert(
            "SELECT DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') FROM users"
        )
        assert "TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS')" in sql

    def test_limit(self, converter):
        sql, _ = converter.convert("SELECT * FROM users LIMIT 10")
        assert sql.endswith("FETCH FIRST 10 ROWS ONLY")

    def test_limit_offset(self, converter):
        sql, _ = converter.convert("SELECT * FROM users LIMIT 10 OFFSET 20")
        assert "OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY" in sql

    def test_limit_comma(self, converter):
        sql, _ = converter.convert("SELECT * FROM users LIMIT 20, 10")
        assert "OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY" in sql


class TestGroupConcat:
    def test_simple_group_concat(self, converter):
        sql, _ = converter.convert("SELECT GROUP_CONCAT(name) FROM users")
        assert "LISTAGG(name, ',') WITHIN GROUP ()" in sql

    def test_group_concat_separator(self, converter):
        sql, _ = converter.convert("SELECT GROUP_CONCAT(name SEPARATOR ' | ') FROM users")
        assert "LISTAGG(name, ' | ') WITHIN GROUP ()" in sql

    def test_group_concat_order_by(self, converter):
        sql, _ = converter.convert("SELECT GROUP_CONCAT(name ORDER BY name DESC) FROM users")
        assert "LISTAGG(name, ',') WITHIN GROUP (ORDER BY name DESC)" in sql

    def test_group_concat_distinct(self, converter):
        sql, _ = converter.convert("SELECT GROUP_CONCAT(DISTINCT name) FROM users")
        assert "LISTAGG(DISTINCT name, ',') WITHIN GROUP ()" in sql


class TestInsertIgnore:
    def test_insert_ignore(self, converter):
        sql, params = converter.convert(
            "INSERT IGNORE INTO users(id, name) VALUES (%s, %s)", [1, "alice"]
        )
        assert sql.startswith("MERGE INTO users t")
        assert "USING (SELECT :1 AS id, :2 AS name FROM DUAL) s" in sql
        assert "ON (t.id = s.id)" in sql
        assert "WHEN NOT MATCHED THEN INSERT (id, name) VALUES (s.id, s.name)" in sql
        assert params == [1, "alice"]

    def test_insert_ignore_missing_key(self, converter):
        with pytest.raises(SQLConversionError):
            converter.convert("INSERT IGNORE INTO unknown_table(id) VALUES (%s)", [1])


class TestOnDuplicateKeyUpdate:
    def test_on_duplicate_key_update(self, converter):
        sql, params = converter.convert(
            "INSERT INTO users(id, name, counter) VALUES (%s, %s, %s) "
            "ON DUPLICATE KEY UPDATE name = VALUES(name), counter = counter + VALUES(counter)",
            [1, "alice", 5],
        )
        assert sql.startswith("MERGE INTO users t")
        assert "WHEN MATCHED THEN UPDATE SET t.name = s.name, t.counter = counter + s.counter" in sql
        assert "WHEN NOT MATCHED THEN INSERT (id, name, counter) VALUES (s.id, s.name, s.counter)" in sql


class TestRow:
    def test_case_insensitive_access(self):
        class FakeCursor:
            description = [["USER_ID"], ["USER_NAME"]]

        row = Row(FakeCursor, [42, "alice"])
        assert row["user_id"] == 42
        assert row["USER_ID"] == 42
        assert row.user_name == "alice"
        assert row.get("missing") is None
        assert list(row.keys()) == ["USER_ID", "USER_NAME"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
