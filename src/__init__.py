"""
Snowflake 分布式唯一 ID 生成器包。

提供基于 Twitter Snowflake 算法的 64 位唯一 ID 生成能力。

主要接口：
  - Snowflake 类：核心生成器，支持自定义 datacenter_id 和 worker_id
  - generate_id()：使用全局默认生成器快速生成 ID
  - configure_default()：配置全局默认生成器
  - ClockBackwardException：时钟回拨异常

用法::

    from src.snowflake import Snowflake, generate_id

    # 方式一：创建独立实例
    sf = Snowflake(datacenter_id=1, worker_id=1)
    uid = sf.next_id()

    # 方式二：使用全局便捷函数
    uid = generate_id()
"""

from .snowflake import Snowflake, ClockBackwardException, generate_id, configure_default, get_default

__all__ = [
    "Snowflake",
    "ClockBackwardException",
    "generate_id",
    "configure_default",
    "get_default",
]
