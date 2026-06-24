"""
Snowflake 算法单元测试与功能验证。

运行方式:
    python -m pytest src/test_snowflake.py -v
    或直接: python src/test_snowflake.py
"""

import time
import threading
import unittest
from src.snowflake import Snowflake, ClockBackwardException, generate_id, configure_default


class TestSnowflakeBasic(unittest.TestCase):
    """基础功能测试。"""

    def setUp(self):
        self.sf = Snowflake(datacenter_id=1, worker_id=1)

    def test_positive_id(self):
        """ID 应为正数（符号位为 0）。"""
        for _ in range(100):
            self.assertGreater(self.sf.next_id(), 0)

    def test_unique_ids(self):
        """批量生成的 ID 应互不重复。"""
        ids = {self.sf.next_id() for _ in range(10000)}
        self.assertEqual(len(ids), 10000, "生成的 ID 存在重复")

    def test_monotonically_increasing(self):
        """ID 应单调递增。"""
        prev = self.sf.next_id()
        for _ in range(1000):
            curr = self.sf.next_id()
            self.assertGreater(curr, prev)
            prev = curr

    def test_id_structure(self):
        """验证 ID 的位结构正确。"""
        sf = Snowflake(datacenter_id=3, worker_id=5)
        uid = sf.next_id()

        # 提取序列号（低 12 位）—— 第一个 ID 的序列号为 0
        sequence = uid & 0xFFF
        self.assertEqual(sequence, 0)

        # 提取 worker_id（接下来 5 位）
        worker = (uid >> 12) & 0x1F
        self.assertEqual(worker, 5)

        # 提取 datacenter_id（接下来 5 位）
        dc = (uid >> 17) & 0x1F
        self.assertEqual(dc, 3)


class TestSnowflakeValidation(unittest.TestCase):
    """参数校验测试。"""

    def test_invalid_datacenter_id(self):
        """datacenter_id 越界应抛出 ValueError。"""
        with self.assertRaises(ValueError):
            Snowflake(datacenter_id=32, worker_id=0)
        with self.assertRaises(ValueError):
            Snowflake(datacenter_id=-1, worker_id=0)

    def test_invalid_worker_id(self):
        """worker_id 越界应抛出 ValueError。"""
        with self.assertRaises(ValueError):
            Snowflake(datacenter_id=0, worker_id=32)
        with self.assertRaises(ValueError):
            Snowflake(datacenter_id=0, worker_id=-1)


class TestSnowflakeThreadSafety(unittest.TestCase):
    """线程安全测试。"""

    def test_concurrent_generation(self):
        """多线程并发生成 ID 应保证唯一性。"""
        sf = Snowflake(datacenter_id=0, worker_id=0)
        results = []
        lock = threading.Lock()
        num_threads = 10
        ids_per_thread = 1000

        def worker():
            local_ids = []
            for _ in range(ids_per_thread):
                local_ids.append(sf.next_id())
            with lock:
                results.extend(local_ids)

        threads = [threading.Thread(target=worker) for _ in range(num_threads)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        total_expected = num_threads * ids_per_thread
        self.assertEqual(len(results), total_expected)
        # 检查唯一性
        self.assertEqual(len(set(results)), total_expected, "多线程下生成的 ID 存在重复")


class TestSnowflakeSequenceOverflow(unittest.TestCase):
    """序列号溢出测试。"""

    def test_sequence_overflow_waits(self):
        """同一毫秒内生成超过 4096 个 ID 后应自动等待下一毫秒。"""
        sf = Snowflake(datacenter_id=0, worker_id=0)

        # 快速生成 5000 个 ID（超过单毫秒 4096 上限）
        ids = [sf.next_id() for _ in range(5000)]
        # 全部应唯一
        self.assertEqual(len(set(ids)), 5000)


class TestSnowflakeClockBackward(unittest.TestCase):
    """时钟回拨测试。"""

    def test_small_clock_backward_recovered(self):
        """小幅回拨（<= 5ms）应通过等待恢复。"""
        sf = Snowflake(datacenter_id=0, worker_id=0)
        sf.next_id()  # 初始化 _last_timestamp

        # 模拟小幅回拨：第一次调用 mock 时回拨 3ms，后续调用恢复正常
        original_method = sf._current_timestamp
        call_count = [0]

        def mock_timestamp():
            call_count[0] += 1
            now = original_method()
            if call_count[0] == 1:
                # 第一次调用：回拨 3ms（在容忍阈值内）
                return now - 3
            # 后续调用（sleep 之后）：返回正常时间
            return now

        sf._current_timestamp = mock_timestamp
        # 应能正常生成（等待恢复后继续）
        uid = sf.next_id()
        self.assertGreater(uid, 0)

    def test_large_clock_backward_raises(self):
        """大幅回拨（> 5ms）应抛出 ClockBackwardException。"""
        sf = Snowflake(datacenter_id=0, worker_id=0)
        sf.next_id()

        # 模拟大幅回拨 100ms
        original_method = sf._current_timestamp
        call_count = [0]

        def mock_timestamp():
            call_count[0] += 1
            now = original_method()
            if call_count[0] == 1:
                # 第一次调用即回拨 100ms（超过 5ms 容忍阈值）
                return now - 100
            return now

        sf._current_timestamp = mock_timestamp
        with self.assertRaises(ClockBackwardException):
            sf.next_id()


class TestConvenienceFunctions(unittest.TestCase):
    """便捷函数测试。"""

    def test_generate_id(self):
        """generate_id() 应返回有效的唯一 ID。"""
        ids = {generate_id() for _ in range(1000)}
        self.assertEqual(len(ids), 1000)

    def test_configure_default(self):
        """configure_default() 应正确配置全局生成器。"""
        gen = configure_default(datacenter_id=2, worker_id=3)
        self.assertEqual(gen.datacenter_id, 2)
        self.assertEqual(gen.worker_id, 3)


if __name__ == "__main__":
    unittest.main()
