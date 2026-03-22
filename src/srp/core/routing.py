import asyncio
import logging
from typing import Dict, Any, Callable, Awaitable

logger = logging.getLogger(__name__)

class LaneQueueManager:
    """
    Linus-style Concurrency Queue.
    Provides simple asyncio Locks indexed by a 'lane_key' (e.g. file path or state key)
    to prevent race conditions when multiple Swarm agents attempt to modify the same resource simultaneously.
    """
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(LaneQueueManager, cls).__new__(cls)
            cls._instance._locks: Dict[str, asyncio.Lock] = {}
        return cls._instance

    def _get_lock(self, lane_key: str) -> asyncio.Lock:
        if lane_key not in self._locks:
            self._locks[lane_key] = asyncio.Lock()
        return self._locks[lane_key]

    async def execute_in_lane(self, lane_key: str, coro_func: Callable[..., Awaitable[Any]], *args, **kwargs) -> Any:
        """
        Executes an asynchronous function safely within a specific concurrency lane.
        Guarantees that no two coroutines run simultaneously for the same `lane_key`.
        """
        lock = self._get_lock(lane_key)
        
        logger.debug(f"[LaneQueue] Waiting for lock on lane: {lane_key}")
        async with lock:
            logger.debug(f"[LaneQueue] Acquired lock on lane: {lane_key}. Executing.")
            try:
                result = await coro_func(*args, **kwargs)
                return result
            except Exception as e:
                logger.error(f"[LaneQueue] Execution failed in lane {lane_key}: {e}")
                raise
            finally:
                logger.debug(f"[LaneQueue] Releasing lock on lane: {lane_key}")

# Global singleton instance for easy access
lane_manager = LaneQueueManager()
