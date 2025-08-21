# alpha-backend/app/utils/cache.py
"""
Simple in-process cache service with stats & cleanup hooks.
"""

import time
from typing import Any, Dict, Optional

class CacheService:
    def __init__(self):
        self._store: Dict[str, Any] = {}
        self._ttl: Dict[str, float] = {}
        self._hits = 0
        self._misses = 0

    def set(self, key: str, value: Any, ttl_seconds: Optional[int] = None):
        self._store[key] = value
        if ttl_seconds:
            self._ttl[key] = time.time() + ttl_seconds

    def get(self, key: str) -> Any:
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

    def clear(self):
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
        return {
            "size": len(self._store),
            "hits": self._hits,
            "misses": self._misses,
            "with_ttl": len(self._ttl),
        }

_cache_service: Optional[CacheService] = None
def get_cache_service() -> CacheService:
    global _cache_service
    if _cache_service is None:
        _cache_service = CacheService()
    return _cache_service