"""
Cache Utils - Simple In-Memory Caching Service
Handles caching for frequently used data with expiry support.
Single responsibility: Cache management for performance optimization.
"""

import logging
import time
import threading
from typing import Any, Optional, Dict
from dataclasses import dataclass

logger = logging.getLogger(__name__)

@dataclass
class CacheEntry:
    """Cache entry with value and expiry information."""
    value: Any
    created_at: float
    expires_at: float

class CacheService:
    """
    Simple in-memory cache with TTL (Time To Live) support.
    Thread-safe implementation for concurrent access.
    """
    
    def __init__(self, default_ttl: int = 3600):
        """
        Initialize cache service.
        
        Args:
            default_ttl: Default time-to-live in seconds (1 hour)
        """
        self.default_ttl = default_ttl
        self._cache: Dict[str, CacheEntry] = {}
        self._lock = threading.RLock()
        
        logger.info(f"🗄️ CacheService initialized with default TTL: {default_ttl}s")
    
    def get(self, key: str) -> Optional[Any]:
        """
        Get cached data by key.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found/expired
        """
        with self._lock:
            if key not in self._cache:
                return None
            
            entry = self._cache[key]
            current_time = time.time()
            
            # Check if expired
            if current_time > entry.expires_at:
                del self._cache[key]
                logger.debug(f"🗑️ Cache entry expired and removed: {key}")
                return None
            
            logger.debug(f"📦 Cache hit: {key}")
            return entry.value
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """
        Cache data with expiry.
        
        Args:
            key: Cache key
            value: Data to cache
            ttl: Time-to-live in seconds (uses default if None)
        """
        if ttl is None:
            ttl = self.default_ttl
        
        current_time = time.time()
        expires_at = current_time + ttl
        
        entry = CacheEntry(
            value=value,
            created_at=current_time,
            expires_at=expires_at
        )
        
        with self._lock:
            self._cache[key] = entry
        
        logger.debug(f"💾 Cached: {key} (TTL: {ttl}s)")
    
    def delete(self, key: str) -> bool:
        """
        Delete a cached entry.
        
        Args:
            key: Cache key to delete
            
        Returns:
            True if key was found and deleted
        """
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                logger.debug(f"🗑️ Cache entry deleted: {key}")
                return True
            return False
    
    def clear(self) -> None:
        """Clear all cached data."""
        with self._lock:
            count = len(self._cache)
            self._cache.clear()
        
        logger.info(f"🧹 Cache cleared: {count} entries removed")
    
    def cleanup_expired(self) -> int:
        """
        Remove all expired entries.
        
        Returns:
            Number of expired entries removed
        """
        current_time = time.time()
        expired_keys = []
        
        with self._lock:
            for key, entry in self._cache.items():
                if current_time > entry.expires_at:
                    expired_keys.append(key)
            
            for key in expired_keys:
                del self._cache[key]
        
        if expired_keys:
            logger.info(f"🧹 Removed {len(expired_keys)} expired cache entries")
        
        return len(expired_keys)
    
    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.
        
        Returns:
            Dictionary with cache statistics
        """
        with self._lock:
            current_time = time.time()
            active_entries = 0
            expired_entries = 0
            
            for entry in self._cache.values():
                if current_time <= entry.expires_at:
                    active_entries += 1
                else:
                    expired_entries += 1
            
            return {
                "total_entries": len(self._cache),
                "active_entries": active_entries,
                "expired_entries": expired_entries,
                "cache_size_bytes": self._estimate_size(),
                "default_ttl": self.default_ttl
            }
    
    def _estimate_size(self) -> int:
        """Estimate cache size in bytes (rough calculation)."""
        try:
            import sys
            total_size = 0
            
            for key, entry in self._cache.items():
                total_size += sys.getsizeof(key)
                total_size += sys.getsizeof(entry.value)
                total_size += sys.getsizeof(entry)
            
            return total_size
        except Exception:
            return 0
    
    def has_key(self, key: str) -> bool:
        """
        Check if key exists in cache (without retrieving value).
        
        Args:
            key: Cache key to check
            
        Returns:
            True if key exists and is not expired
        """
        with self._lock:
            if key not in self._cache:
                return False
            
            entry = self._cache[key]
            current_time = time.time()
            
            if current_time > entry.expires_at:
                del self._cache[key]
                return False
            
            return True
    
    def get_remaining_ttl(self, key: str) -> Optional[int]:
        """
        Get remaining time-to-live for a cached entry.
        
        Args:
            key: Cache key
            
        Returns:
            Remaining seconds or None if not found/expired
        """
        with self._lock:
            if key not in self._cache:
                return None
            
            entry = self._cache[key]
            current_time = time.time()
            
            if current_time > entry.expires_at:
                del self._cache[key]
                return None
            
            return int(entry.expires_at - current_time)

# Global cache instance
_cache_service: Optional[CacheService] = None

def get_cache_service(default_ttl: int = 3600) -> CacheService:
    """
    Get global cache service instance.
    
    Args:
        default_ttl: Default TTL for cache entries
        
    Returns:
        CacheService instance
    """
    global _cache_service
    if _cache_service is None:
        _cache_service = CacheService(default_ttl=default_ttl)
    return _cache_service

# Convenience functions for direct cache access
def cache_get(key: str) -> Optional[Any]:
    """Get value from cache."""
    return get_cache_service().get(key)

def cache_set(key: str, value: Any, ttl: Optional[int] = None) -> None:
    """Set value in cache."""
    get_cache_service().set(key, value, ttl)

def cache_delete(key: str) -> bool:
    """Delete value from cache."""
    return get_cache_service().delete(key)

def cache_clear() -> None:
    """Clear all cache."""
    get_cache_service().clear()

def cache_stats() -> Dict[str, Any]:
    """Get cache statistics."""
    return get_cache_service().get_stats()

# Specialized caches for common use cases
class EmbeddingCache:
    """Specialized cache for embedding results."""
    
    def __init__(self, ttl: int = 7200):  # 2 hours default
        self.cache = CacheService(default_ttl=ttl)
        logger.info(f"🧠 EmbeddingCache initialized with TTL: {ttl}s")
    
    def get_embedding(self, text: str) -> Optional[Any]:
        """Get cached embedding for text."""
        cache_key = f"embedding:{hash(text)}"
        return self.cache.get(cache_key)
    
    def set_embedding(self, text: str, embedding: Any) -> None:
        """Cache embedding for text."""
        cache_key = f"embedding:{hash(text)}"
        self.cache.set(cache_key, embedding)
    
    def clear_embeddings(self) -> None:
        """Clear all embedding cache."""
        self.cache.clear()

class LLMCache:
    """Specialized cache for LLM responses."""
    
    def __init__(self, ttl: int = 1800):  # 30 minutes default
        self.cache = CacheService(default_ttl=ttl)
        logger.info(f"🤖 LLMCache initialized with TTL: {ttl}s")
    
    def get_response(self, prompt_hash: str) -> Optional[Any]:
        """Get cached LLM response."""
        cache_key = f"llm:{prompt_hash}"
        return self.cache.get(cache_key)
    
    def set_response(self, prompt_hash: str, response: Any) -> None:
        """Cache LLM response."""
        cache_key = f"llm:{prompt_hash}"
        self.cache.set(cache_key, response)
    
    def clear_responses(self) -> None:
        """Clear all LLM cache."""
        self.cache.clear()

# Global specialized caches
_embedding_cache: Optional[EmbeddingCache] = None
_llm_cache: Optional[LLMCache] = None

def get_embedding_cache() -> EmbeddingCache:
    """Get global embedding cache."""
    global _embedding_cache
    if _embedding_cache is None:
        _embedding_cache = EmbeddingCache()
    return _embedding_cache

def get_llm_cache() -> LLMCache:
    """Get global LLM cache."""
    global _llm_cache
    if _llm_cache is None:
        _llm_cache = LLMCache()
    return _llm_cache
