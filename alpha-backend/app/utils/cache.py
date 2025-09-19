# alpha-backend/app/utils/cache.py
"""
Enhanced cache service with Redis primary and in-memory fallback.
"""

import time
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

class CacheService:
    def __init__(self):
        self._store: Dict[str, Any] = {}
        self._ttl: Dict[str, float] = {}
        self._hits = 0
        self._misses = 0
        
        # Try to initialize Redis cache
        try:
            from app.utils.redis_cache import get_redis_cache
            self.redis_cache = get_redis_cache()
            logger.info("✅ Redis cache initialized for CacheService")
        except Exception as e:
            logger.warning(f"⚠️ Redis cache not available: {e}")
            self.redis_cache = None

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None, namespace: str = "default"):
        # Try Redis first
        if self.redis_cache:
            try:
                self.redis_cache.set(key, value, ttl_seconds, namespace)
                return
            except Exception as e:
                logger.warning(f"Redis cache set failed: {e}")
        
        # Fallback to in-memory
        self._store[key] = value
        if ttl_seconds:
            self._ttl[key] = time.time() + ttl_seconds

    def get(self, key: str, namespace: str = "default") -> Any:
        # Try Redis first
        if self.redis_cache:
            try:
                value = self.redis_cache.get(key, namespace)
                if value is not None:
                    self._hits += 1
                    return value
            except Exception as e:
                logger.warning(f"Redis cache get failed: {e}")
        
        # Fallback to in-memory
        if key in self._store:
            if key in self._ttl and time.time() > self._ttl[key]:
                self._store.pop(key, None)
                self._ttl.pop(key, None)
                self._misses += 1
                return None
            self._hits += 1
            return self._store[key]
        self._misses += 1
        return None

    def delete(self, key: str, namespace: str = "default"):
        # Try Redis first
        if self.redis_cache:
            try:
                self.redis_cache.delete(key, namespace)
            except Exception as e:
                logger.warning(f"Redis cache delete failed: {e}")
        
        # Fallback to in-memory
        self._store.pop(key, None)
        self._ttl.pop(key, None)

    def clear(self, namespace: str = "default"):
        # Try Redis first
        if self.redis_cache:
            try:
                self.redis_cache.clear_namespace(namespace)
            except Exception as e:
                logger.warning(f"Redis cache clear failed: {e}")
        
        # Fallback to in-memory
        self._store.clear()
        self._ttl.clear()
        self._hits = 0
        self._misses = 0

    def cleanup_expired(self):
        now = time.time()
        expired = [k for k, t in self._ttl.items() if now > t]
        for k in expired:
            self._ttl.pop(k, None)
            self._store.pop(k, None)

    def get_stats(self):
        stats = {
            "size": len(self._store),
            "hits": self._hits,
            "misses": self._misses,
            "with_ttl": len(self._ttl),
            "redis_enabled": self.redis_cache is not None
        }
        
        # Add Redis stats if available
        if self.redis_cache:
            try:
                redis_stats = self.redis_cache.get_stats()
                stats.update({
                    "redis_stats": redis_stats
                })
            except Exception as e:
                logger.warning(f"Failed to get Redis stats: {e}")
        
        return stats

    def health_check(self):
        """Check cache health including Redis"""
        health = {
            "in_memory": {
                "status": "healthy",
                "size": len(self._store)
            }
        }
        
        if self.redis_cache:
            try:
                redis_health = self.redis_cache.health_check()
                health["redis"] = redis_health
            except Exception as e:
                health["redis"] = {
                    "status": "unhealthy",
                    "error": str(e)
                }
        else:
            health["redis"] = {
                "status": "unavailable",
                "message": "Redis not configured"
            }
        
        return health

_cache_service: Optional[CacheService] = None
def get_cache_service() -> CacheService:
    global _cache_service
    if _cache_service is None:
        _cache_service = CacheService()
    return _cache_service