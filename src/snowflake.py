"""
Snowflake Algorithm - 分布式唯一 ID 生成器

基于 Twitter 的 Snowflake 算法，生成 64 位 long 类型唯一 ID。

64 位 ID 结构（从高位到低位）：
  - 1  bit  : 符号位（始终为 0，保证 ID 为正数）
  - 41 bits : 时间戳（毫秒级，自自定义 epoch 起）
  - 10 bits : 机器 ID（5 位数据中心 ID + 5 位工作节点 ID）
  - 12 bits : 序列号（同一毫秒内的递增序号）

理论容量：
  - 时间戳可用约 69 年（2^41 毫秒）
  - 支持 1024 个节点（2^10）
  - 每毫秒每节点可生成 4096 个 ID（2^12）
"""

import time
import threading


class Snowflake:
    """
    Twitter Snowflake 算法实现，线程安全。

    用法示例::

        generator = Snowflake(datacenter_id=1, worker_id=1)
        unique_id = generator.next_id()
    """

    # ==================== 位分配常量 ====================
    # 各部分占用的位数
    SEQUENCE_BITS = 12          # 序列号位数
    WORKER_ID_BITS = 5          # 工作节点 ID 位数
    DATACENTER_ID_BITS = 5      # 数据中心 ID 位数

    # 各部分最大值（位掩码）
    MAX_SEQUENCE = (1 << SEQUENCE_BITS) - 1          # 4095
    MAX_WORKER_ID = (1 << WORKER_ID_BITS) - 1        # 31
    MAX_DATACENTER_ID = (1 << DATACENTER_ID_BITS) - 1  # 31

    # ==================== 位移常量 ====================
    # 各部分在 64 位整数中的左移位数
    WORKER_ID_SHIFT = SEQUENCE_BITS                                    # 12
    DATACENTER_ID_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS               # 17
    TIMESTAMP_SHIFT = SEQUENCE_BITS + WORKER_ID_BITS + DATACENTER_ID_BITS  # 22

    # ==================== 自定义 Epoch ====================
    # 自定义起始时间戳（毫秒）：2020-01-01 00:00:00 UTC
    # 选用 2020 年作为起点，可使 41 位时间戳覆盖到约 2089 年
    EPOCH = 1577836800000

    def __init__(self, datacenter_id: int = 0, worker_id: int = 0):
        """
        初始化 Snowflake 生成器。

        Args:
            datacenter_id: 数据中心 ID，取值范围 [0, 31]
            worker_id:     工作节点 ID，取值范围 [0, 31]

        Raises:
            ValueError: 当 ID 超出合法范围时抛出
        """
        # 校验数据中心 ID
        if not (0 <= datacenter_id <= self.MAX_DATACENTER_ID):
            raise ValueError(
                f"datacenter_id 必须在 [0, {self.MAX_DATACENTER_ID}] 范围内，"
                f"当前值: {datacenter_id}"
            )

        # 校验工作节点 ID
        if not (0 <= worker_id <= self.MAX_WORKER_ID):
            raise ValueError(
                f"worker_id 必须在 [0, {self.MAX_WORKER_ID}] 范围内，"
                f"当前值: {worker_id}"
            )

        self.datacenter_id = datacenter_id
        self.worker_id = worker_id

        # 运行时状态
        self._sequence = 0               # 当前毫秒内的序列号
        self._last_timestamp = -1        # 上次生成 ID 的时间戳

        # 线程锁，保证多线程下的安全性
        self._lock = threading.Lock()

    # ==================== 公开接口 ====================

    def next_id(self) -> int:
        """
        生成下一个唯一 ID（线程安全）。

        Returns:
            int: 64 位唯一 ID

        Raises:
            ClockBackwardException: 当时钟回拨超过允许范围时抛出
        """
        with self._lock:
            current_timestamp = self._current_timestamp()

            # 时钟回拨检测
            if current_timestamp < self._last_timestamp:
                offset = self._last_timestamp - current_timestamp
                # 如果回拨幅度较小（<= 5ms），等待追上
                if offset <= 5:
                    time.sleep(offset / 1000.0)
                    current_timestamp = self._current_timestamp()
                    # 等待后仍回拨，则抛异常
                    if current_timestamp < self._last_timestamp:
                        raise ClockBackwardException(
                            f"时钟回拨：当前时间 {current_timestamp}ms "
                            f"落后于上次记录 {self._last_timestamp}ms，"
                            f"偏移量: {offset}ms"
                        )
                else:
                    raise ClockBackwardException(
                        f"时钟回拨过大：当前时间 {current_timestamp}ms "
                        f"落后于上次记录 {self._last_timestamp}ms，"
                        f"偏移量: {offset}ms，超过 5ms 容忍阈值"
                    )

            # 判断是否进入新的毫秒
            if current_timestamp == self._last_timestamp:
                # 同一毫秒内，序列号递增
                self._sequence = (self._sequence + 1) & self.MAX_SEQUENCE
                # 序列号溢出：当前毫秒已满，等待下一毫秒
                if self._sequence == 0:
                    current_timestamp = self._wait_next_millis(self._last_timestamp)
            else:
                # 新毫秒，序列号归零
                self._sequence = 0

            self._last_timestamp = current_timestamp

            # 组合 64 位 ID
            return self._assemble_id(current_timestamp)

    # ==================== 内部方法 ====================

    def _assemble_id(self, timestamp: int) -> int:
        """
        将各部分按位组合为 64 位 ID。

        位布局:
          [1 bit 符号=0] [41 bits timestamp] [5 bits dc] [5 bits worker] [12 bits seq]
        """
        return (
            ((timestamp - self.EPOCH) << self.TIMESTAMP_SHIFT)
            | (self.datacenter_id << self.DATACENTER_ID_SHIFT)
            | (self.worker_id << self.WORKER_ID_SHIFT)
            | self._sequence
        )

    def _wait_next_millis(self, last_timestamp: int) -> int:
        """自旋等待，直到获取到比 last_timestamp 更大的时间戳。"""
        ts = self._current_timestamp()
        while ts <= last_timestamp:
            ts = self._current_timestamp()
        return ts

    @staticmethod
    def _current_timestamp() -> int:
        """获取当前时间戳（毫秒）。"""
        return int(time.time() * 1000)

    # ==================== 辅助方法 ====================

    def __repr__(self) -> str:
        return (
            f"Snowflake(datacenter_id={self.datacenter_id}, "
            f"worker_id={self.worker_id})"
        )


class ClockBackwardException(Exception):
    """
    时钟回拨异常。

    当系统时钟发生回拨且超出算法可容忍的范围时抛出此异常，
    以防止生成重复 ID。
    """
    pass


# ==================== 便捷全局实例 ====================

_default_generator = None
_default_lock = threading.Lock()


def configure_default(datacenter_id: int = 0, worker_id: int = 0) -> Snowflake:
    """
    配置全局默认的 Snowflake 生成器。

    Args:
        datacenter_id: 数据中心 ID
        worker_id:     工作节点 ID

    Returns:
        Snowflake: 配置好的默认生成器
    """
    global _default_generator
    with _default_lock:
        _default_generator = Snowflake(datacenter_id, worker_id)
    return _default_generator


def get_default() -> Snowflake:
    """
    获取全局默认的 Snowflake 生成器。
    若尚未配置，则使用默认参数 (datacenter_id=0, worker_id=0) 自动创建。
    """
    global _default_generator
    if _default_generator is None:
        with _default_lock:
            if _default_generator is None:
                _default_generator = Snowflake()
    return _default_generator


def generate_id() -> int:
    """
    使用全局默认生成器产生一个唯一 ID（便捷函数）。

    Returns:
        int: 64 位唯一 ID
    """
    return get_default().next_id()
