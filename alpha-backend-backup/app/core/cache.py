"""
Caching system for performance optimization
"""
import json
import hashlib
import time
from typing import Any, Optional, Dict
import logging

logger = logging.getLogger(__name__)

class SimpleCache:
    """Simple in-memory cache with TTL"""
    
    def __init__(self, default_ttl: int = 300):  # 5 minutes default
        self.cache: Dict[str, Dict] = {}
        self.default_ttl = default_ttl
    
    def _generate_key(self, data: Any) -> str:
        """Generate cache key from data"""
        if isinstance(data, str):
            content = data
        else:
            content = json.dumps(data, sort_keys=True)
        return hashlib.md5(content.encode()).hexdigest()
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache if not expired"""
        if key in self.cache:
            entry = self.cache[key]
            if time.time() < entry['expires']:
                logger.debug(f"💾 Cache hit for key: {key[:8]}...")
                return entry['value']
            else:
                # Expired, remove it
                del self.cache[key]
                logger.debug(f"⏰ Cache expired for key: {key[:8]}...")
        
        logger.debug(f"❌ Cache miss for key: {key[:8]}...")
        return None
    
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache with TTL"""
        ttl = ttl or self.default_ttl
        expires = time.time() + ttl
        
        self.cache[key] = {
            'value': value,
            'expires': expires,
            'created': time.time()
        }
        
        logger.debug(f"💾 Cache set for key: {key[:8]}... (TTL: {ttl}s)")
    
    def clear_expired(self) -> int:
        """Clear expired entries and return count"""
        now = time.time()
        expired_keys = [
            key for key, entry in self.cache.items() 
            if now >= entry['expires']
        ]
        
        for key in expired_keys:
            del self.cache[key]
        
        if expired_keys:
            logger.info(f"🧹 Cleared {len(expired_keys)} expired cache entries")
        
        return len(expired_keys)
    
    def stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        now = time.time()
        active_entries = sum(1 for entry in self.cache.values() if now < entry['expires'])
        
        return {
            'total_entries': len(self.cache),
            'active_entries': active_entries,
            'expired_entries': len(self.cache) - active_entries
        }

# Global caches
gpt_response_cache = SimpleCache(default_ttl=3600)  # 1 hour for GPT responses
similarity_cache = SimpleCache(default_ttl=1800)   # 30 minutes for similarity calculations
embedding_cache = SimpleCache(default_ttl=7200)    # 2 hours for embeddings

def get_gpt_cache_key(text: str, prompt_type: str) -> str:
    """Generate cache key for GPT responses"""
    # Use more text for better cache differentiation but normalize whitespace
    normalized_text = ' '.join(text.split())[:2000]  # Normalize and use first 2000 chars
    content = f"{prompt_type}:{normalized_text}"
    return hashlib.md5(content.encode()).hexdigest()

def get_similarity_cache_key(text1: str, text2: str) -> str:
    """Generate cache key for similarity calculations"""
    # Sort to ensure consistent key regardless of order
    texts = sorted([text1, text2])
    content = f"similarity:{texts[0][:500]}:{texts[1][:500]}"
    return hashlib.md5(content.encode()).hexdigest()

def clear_all_caches():
    """Clear all caches"""
    gpt_response_cache.cache.clear()
    similarity_cache.cache.clear()
    embedding_cache.cache.clear()
    logger.info("🧹 All caches cleared")

def get_cache_stats() -> Dict[str, Any]:
    """Get statistics for all caches"""
    return {
        'gpt_cache': gpt_response_cache.stats(),
        'similarity_cache': similarity_cache.stats(),
        'embedding_cache': embedding_cache.stats()
    }
