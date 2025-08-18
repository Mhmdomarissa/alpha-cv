"""
Smart Caching Layer for CV Analyzer
Implements document-level caching with hash-based keys to prevent redundant GPT processing.
"""
import hashlib
import json
import time
import logging
from typing import Dict, Any, Optional, List
from functools import wraps

logger = logging.getLogger(__name__)

# In-memory cache for development (can be replaced with Redis for production)
_document_cache: Dict[str, Dict[str, Any]] = {}
_cache_stats = {"hits": 0, "misses": 0, "total_requests": 0}

def generate_document_hash(content: str, doc_type: str = "unknown") -> str:
    """Generate unique hash for document content."""
    # Normalize content for consistent hashing
    normalized = content.strip().lower()
    hash_input = f"{doc_type}:{normalized}"
    return hashlib.sha256(hash_input.encode()).hexdigest()[:16]

def get_cache_key(content: str, doc_type: str, model: str) -> str:
    """Generate cache key combining document hash, type, and model."""
    doc_hash = generate_document_hash(content, doc_type)
    return f"{doc_type}:{doc_hash}:{model}"

def cache_document(func):
    """
    Decorator to cache document processing results.
    Automatically handles cache key generation and retrieval.
    """
    @wraps(func)
    def wrapper(*args, **kwargs):
        global _cache_stats
        _cache_stats["total_requests"] += 1
        
        # Extract content and metadata from function arguments
        content = None
        doc_type = "unknown"
        model = "gpt-5-nano"
        
        # Handle different function signatures
        if len(args) >= 1 and isinstance(args[0], str):
            content = args[0]
        elif 'text' in kwargs:
            content = kwargs['text']
        elif 'jd_text' in kwargs:
            content = kwargs['jd_text']
            doc_type = "jd"
        elif 'cv_texts' in kwargs:
            # For batch processing, create combined hash
            content = "|".join(kwargs['cv_texts'])
            doc_type = "cv_batch"
        
        if 'model' in kwargs:
            model = kwargs['model']
        elif len(args) >= 3 and isinstance(args[2], str):
            model = args[2]
            
        # Determine document type from function name if not set
        if doc_type == "unknown":
            func_name = func.__name__
            if "cv" in func_name:
                doc_type = "cv"
            elif "jd" in func_name:
                doc_type = "jd"
        
        if not content:
            # No cache for functions without content
            return func(*args, **kwargs)
        
        # Generate cache key
        cache_key = get_cache_key(content, doc_type, model)
        
        # Check cache
        if cache_key in _document_cache:
            cached_result = _document_cache[cache_key]
            cache_age = time.time() - cached_result["timestamp"]
            
            # Use cache if less than 1 hour old
            if cache_age < 3600:
                _cache_stats["hits"] += 1
                logger.info(f"✅ Cache HIT for {doc_type} (key: {cache_key[:8]}..., age: {cache_age:.1f}s)")
                
                # Return a copy to prevent mutations
                result = cached_result["data"].copy()
                
                # Update filename if provided
                if len(args) >= 2 and isinstance(args[1], str):
                    if isinstance(result, dict):
                        result["filename"] = args[1]
                    elif isinstance(result, list):
                        for i, item in enumerate(result):
                            if isinstance(item, dict) and i < len(args[1:]):
                                item["filename"] = args[1:][i] if isinstance(args[1], list) else f"cv_{i+1}.txt"
                
                return result
        
        # Cache miss - call original function
        _cache_stats["misses"] += 1
        logger.info(f"❌ Cache MISS for {doc_type} (key: {cache_key[:8]}...)")
        
        start_time = time.time()
        result = func(*args, **kwargs)
        processing_time = time.time() - start_time
        
        # Cache the result
        _document_cache[cache_key] = {
            "data": result.copy() if isinstance(result, (dict, list)) else result,
            "timestamp": time.time(),
            "processing_time": processing_time,
            "doc_type": doc_type,
            "model": model
        }
        
        logger.info(f"📦 Cached {doc_type} result (key: {cache_key[:8]}..., processing: {processing_time:.2f}s)")
        
        return result
    
    return wrapper

def get_cache_stats() -> Dict[str, Any]:
    """Get current cache statistics."""
    total = _cache_stats["total_requests"]
    hits = _cache_stats["hits"]
    misses = _cache_stats["misses"]
    
    return {
        "total_requests": total,
        "cache_hits": hits,
        "cache_misses": misses,
        "hit_rate": (hits / total * 100) if total > 0 else 0,
        "cache_size": len(_document_cache),
        "estimated_savings": f"{hits * 2}s" if hits > 0 else "0s"  # Assuming 2s per GPT call
    }

def clear_cache():
    """Clear all cached documents."""
    global _document_cache, _cache_stats
    _document_cache.clear()
    _cache_stats = {"hits": 0, "misses": 0, "total_requests": 0}
    logger.info("🗑️ Cache cleared")

def get_cached_documents() -> List[Dict[str, Any]]:
    """Get summary of all cached documents."""
    cached_docs = []
    for cache_key, cached_item in _document_cache.items():
        doc_info = {
            "cache_key": cache_key,
            "doc_type": cached_item["doc_type"],
            "model": cached_item["model"],
            "timestamp": cached_item["timestamp"],
            "age_seconds": time.time() - cached_item["timestamp"],
            "processing_time": cached_item["processing_time"]
        }
        cached_docs.append(doc_info)
    
    return sorted(cached_docs, key=lambda x: x["timestamp"], reverse=True)

def cache_health_check() -> Dict[str, Any]:
    """Comprehensive cache health check."""
    stats = get_cache_stats()
    cached_docs = get_cached_documents()
    
    # Calculate cache efficiency
    avg_processing_time = sum(doc["processing_time"] for doc in cached_docs) / len(cached_docs) if cached_docs else 0
    total_saved_time = stats["cache_hits"] * avg_processing_time
    
    return {
        "status": "healthy" if stats["hit_rate"] > 20 else "needs_optimization",
        "cache_stats": stats,
        "performance": {
            "avg_processing_time": f"{avg_processing_time:.2f}s",
            "total_saved_time": f"{total_saved_time:.2f}s",
            "cache_efficiency": "high" if stats["hit_rate"] > 50 else "medium" if stats["hit_rate"] > 20 else "low"
        },
        "cached_documents_count": len(cached_docs),
        "oldest_cache_age": max((doc["age_seconds"] for doc in cached_docs), default=0)
    }
