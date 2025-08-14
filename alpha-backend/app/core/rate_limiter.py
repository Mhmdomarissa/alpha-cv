"""
Rate limiting and concurrency control for production safety
"""
import time
import asyncio
from collections import defaultdict, deque
from typing import Dict, Optional
import logging
from fastapi import HTTPException

logger = logging.getLogger(__name__)

class RateLimiter:
    """Simple in-memory rate limiter for API endpoints"""
    
    def __init__(self, max_requests: int = 10, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests: Dict[str, deque] = defaultdict(deque)
    
    def is_allowed(self, client_id: str) -> bool:
        """Check if request is allowed for client"""
        now = time.time()
        client_requests = self.requests[client_id]
        
        # Remove old requests outside the window
        while client_requests and client_requests[0] < now - self.window_seconds:
            client_requests.popleft()
        
        # Check if under limit
        if len(client_requests) < self.max_requests:
            client_requests.append(now)
            return True
        
        return False
    
    def get_reset_time(self, client_id: str) -> Optional[float]:
        """Get time when rate limit resets for client"""
        client_requests = self.requests[client_id]
        if client_requests:
            return client_requests[0] + self.window_seconds
        return None

class ConcurrencyLimiter:
    """Limit concurrent processing to prevent resource exhaustion"""
    
    def __init__(self, max_concurrent: int = 3):
        self.max_concurrent = max_concurrent
        self.current_processing = 0
        self.lock = asyncio.Lock()
    
    async def acquire(self):
        """Acquire a processing slot"""
        async with self.lock:
            if self.current_processing >= self.max_concurrent:
                raise HTTPException(
                    status_code=429, 
                    detail=f"Server busy. Maximum {self.max_concurrent} concurrent requests allowed."
                )
            self.current_processing += 1
            logger.info(f"🔄 Processing slot acquired ({self.current_processing}/{self.max_concurrent})")
    
    async def release(self):
        """Release a processing slot"""
        async with self.lock:
            if self.current_processing > 0:
                self.current_processing -= 1
            logger.info(f"✅ Processing slot released ({self.current_processing}/{self.max_concurrent})")

# Global instances
api_rate_limiter = RateLimiter(max_requests=30, window_seconds=60)  # 30 requests per minute
processing_rate_limiter = RateLimiter(max_requests=5, window_seconds=60)  # 5 processing requests per minute
concurrency_limiter = ConcurrencyLimiter(max_concurrent=3)  # 3 concurrent processing requests

def rate_limit_check(client_id: str, limiter: RateLimiter = api_rate_limiter):
    """Check rate limit and raise exception if exceeded"""
    if not limiter.is_allowed(client_id):
        reset_time = limiter.get_reset_time(client_id)
        reset_in = int(reset_time - time.time()) if reset_time else 60
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Try again in {reset_in} seconds.",
            headers={"Retry-After": str(reset_in)}
        )
